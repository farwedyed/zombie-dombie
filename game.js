/* --- GAME LOGIC --- */
if (!window.lobbyPlayers) {
    window.lobbyPlayers = { host: "", guest: "" };
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// STATE
let camera = { x: 0, y: 0 };
let gameActive = false;
let showScoreboard = false;
let animationFrameId = null; // Track loop ID to prevent concurrent duplicate game loops

// FIXED TIMESTEP VARIABLES
let lastLoopTime = performance.now();
let accumulator = 0;
const tickRate = 1000 / 60; // Locked game logic tick rate (Exactly 60Hz)

// GLOBAL DATA
let stats = { score: 500, round: 1, zombiesToSpawn: 6, zombiesAlive: 0, frame: 0, sessionKills: 0, selectedMapIdx: 0 };
let players = {};
let me = null;
let bullets = [], zombies = [], particles = [], texts = [];
let zombieIdCounter = 0; 
let myUsername = "Survivor"; // Store local username

// LOCAL CO-OP CONFIGURATION
let p2InputConfig = 'keyboard'; // 'keyboard', 'gamepad0', or 'gamepad1'
let p2PrevButtons = { shoot: false, reload: false, interact: false };

// MOBILE TOUCH STATE
let isTouchDevice = false;
let touchMoveVector = { x: 0, y: 0 };
let touchAimVector = { x: 0, y: 0 };
let isMovingTouch = false;
let isAimingTouch = false;

// INPUTS
const keys = {};
const mouse = { x: 0, y: 0, down: false, pressHandled: false };

document.oncontextmenu = () => false;

function init() {
    document.getElementById('menu-kills').innerText = saveData.kills;
    if(document.getElementById('menu-round')) {
        document.getElementById('menu-round').innerText = saveData.highestRound;
    }
    
    // Desktop Keyboard Listeners
    window.addEventListener('keydown', e => { 
        if(e.code === 'Tab') { e.preventDefault(); showScoreboard = true; }
        else {
            keys[e.code] = true; 
            if(gameActive && e.code==='KeyR') handleReload(); 
            if(gameActive && e.code==='KeyF') handleInteractAction(); 
            
            // Q Key: Switch Weapons on PC
            if(gameActive && e.code==='KeyQ') {
                if(me && me.inventory.length > 1) {
                    me.weapIdx = (me.weapIdx + 1) % me.inventory.length;
                    addText(me.x, me.y - 40, me.inventory[me.weapIdx].name, "#fff");
                }
            }
        }
    });
    window.addEventListener('keyup', e => { 
        if(e.code === 'Tab') showScoreboard = false;
        else keys[e.code] = false; 
    });
    
    // Scroll Wheel: Switch Weapons on PC
    window.addEventListener('wheel', e => {
        if(gameActive && me && me.inventory.length > 1) {
            if(e.deltaY > 0) {
                me.weapIdx = (me.weapIdx + 1) % me.inventory.length;
            } else {
                me.weapIdx = (me.weapIdx - 1 + me.inventory.length) % me.inventory.length;
            }
            addText(me.x, me.y - 40, me.inventory[me.weapIdx].name, "#fff");
        }
    }, { passive: true });
    
    window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mousedown', (e) => { if(e.button===0) mouse.down = true; });
    window.addEventListener('mouseup', () => { mouse.down = false; mouse.pressHandled = false; });

    // Handle Resize cleanly
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    // Detect and Initialize Mobile Interface if active
    checkTouchDevice();
}

/* --- MOBILE DETECTION & JOYSTICKS --- */
function checkTouchDevice() {
    isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
        document.getElementById('mobile-overlay').style.display = 'block';
        document.getElementById('controls-hint').style.display = 'none'; // Hide desktop binds
        setupTouchControls();
    }
}

function setupTouchControls() {
    const stickLeft = document.getElementById('touch-stick-left');
    const knobLeft = document.getElementById('touch-knob-left');
    const stickRight = document.getElementById('touch-stick-right');
    const knobRight = document.getElementById('touch-knob-right');
    
    const maxRadius = 45; // Max radius to boundary of virtual stick
    
    // --- Left Stick Logic (Movement) ---
    let leftTouchId = null;
    let leftStartPos = { x: 0, y: 0 };
    
    stickLeft.addEventListener('touchstart', e => {
        if (leftTouchId !== null) return;
        const touch = e.changedTouches[0];
        leftTouchId = touch.identifier;
        const rect = stickLeft.getBoundingClientRect();
        leftStartPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        isMovingTouch = true;
        handleLeftMove(touch.clientX, touch.clientY);
    });
    
    stickLeft.addEventListener('touchmove', e => {
        if (leftTouchId === null) return;
        for (let touch of e.changedTouches) {
            if (touch.identifier === leftTouchId) {
                handleLeftMove(touch.clientX, touch.clientY);
            }
        }
    });
    
    function handleLeftMove(clientX, clientY) {
        let dx = clientX - leftStartPos.x;
        let dy = clientY - leftStartPos.y;
        let dist = Math.hypot(dx, dy);
        
        if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
            dist = maxRadius;
        }
        
        knobLeft.style.transform = `translate(${dx}px, ${dy}px)`;
        touchMoveVector.x = dx / maxRadius;
        touchMoveVector.y = dy / maxRadius;
    }
    
    stickLeft.addEventListener('touchend', e => {
        for (let touch of e.changedTouches) {
            if (touch.identifier === leftTouchId) {
                leftTouchId = null;
                isMovingTouch = false;
                knobLeft.style.transform = `translate(0px, 0px)`;
                touchMoveVector = { x: 0, y: 0 };
            }
        }
    });
    
    stickLeft.addEventListener('touchcancel', e => {
        for (let touch of e.changedTouches) {
            if (touch.identifier === leftTouchId) {
                leftTouchId = null;
                isMovingTouch = false;
                knobLeft.style.transform = `translate(0px, 0px)`;
                touchMoveVector = { x: 0, y: 0 };
            }
        }
    });

    // --- Right Stick Logic (Aiming & Shooting) ---
    let rightTouchId = null;
    let rightStartPos = { x: 0, y: 0 };
    
    stickRight.addEventListener('touchstart', e => {
        if (rightTouchId !== null) return;
        const touch = e.changedTouches[0];
        rightTouchId = touch.identifier;
        const rect = stickRight.getBoundingClientRect();
        rightStartPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        isAimingTouch = true;
        handleRightMove(touch.clientX, touch.clientY);
    });
    
    stickRight.addEventListener('touchmove', e => {
        if (rightTouchId === null) return;
        for (let touch of e.changedTouches) {
            if (touch.identifier === rightTouchId) {
                handleRightMove(touch.clientX, touch.clientY);
            }
        }
    });
    
    function handleRightMove(clientX, clientY) {
        let dx = clientX - rightStartPos.x;
        let dy = clientY - rightStartPos.y;
        let dist = Math.hypot(dx, dy);
        
        if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
            dist = maxRadius;
        }
        
        knobRight.style.transform = `translate(${dx}px, ${dy}px)`;
        
        if (dist > 5) {
            touchAimVector.x = dx / dist;
            touchAimVector.y = dy / dist;
            
            // Aim character
            if (me) {
                me.angle = Math.atan2(dy, dx);
            }
            
            // Auto-fire whenever deflected past 40% threshold
            if (dist > maxRadius * 0.40) {
                mouse.down = true;
            } else {
                // If returned near center, allow semi-auto weapon resets
                mouse.down = false;
                mouse.pressHandled = false;
            }
        } else {
            mouse.down = false;
            mouse.pressHandled = false;
        }
    }
    
    stickRight.addEventListener('touchend', e => {
        for (let touch of e.changedTouches) {
            if (touch.identifier === rightTouchId) {
                rightTouchId = null;
                isAimingTouch = false;
                knobRight.style.transform = `translate(0px, 0px)`;
                mouse.down = false;
                mouse.pressHandled = false;
            }
        }
    });
    
    stickRight.addEventListener('touchcancel', e => {
        for (let touch of e.changedTouches) {
            if (touch.identifier === rightTouchId) {
                rightTouchId = null;
                isAimingTouch = false;
                knobRight.style.transform = `translate(0px, 0px)`;
                mouse.down = false;
                mouse.pressHandled = false;
            }
        }
    });

    // --- Action Button Handlers ---
    const btnInteract = document.getElementById('btn-touch-interact');
    const btnReload = document.getElementById('btn-touch-reload');
    const btnSwitch = document.getElementById('btn-touch-switch');
    
    btnInteract.addEventListener('touchstart', e => {
        e.preventDefault();
        if (gameActive) handleInteractAction();
    });
    
    btnReload.addEventListener('touchstart', e => {
        e.preventDefault();
        if (gameActive) handleReload();
    });
    
    btnSwitch.addEventListener('touchstart', e => {
        e.preventDefault();
        if (gameActive && me && me.inventory.length > 1) {
            me.weapIdx = (me.weapIdx + 1) % me.inventory.length;
            addText(me.x, me.y - 40, me.inventory[me.weapIdx].name, "#fff");
            if (Network.mode === 'CLIENT') {
                Network.sendClientData(me);
            }
        }
    });
}

/* --- UI FUNCTIONS --- */
window.openMenu = function(id) {
    document.getElementById(id).style.display = 'block';
    if(id === 'ach-modal') renderAchievements();
    if(id === 'gun-modal') renderGunLibrary();
};
window.closeMenu = function(id) { document.getElementById(id).style.display = 'none'; };

function renderAchievements() {
    const list = document.getElementById('ach-list'); list.innerHTML = "";
    achievements.forEach(a => {
        let unlocked = saveData.unlockedAch.includes(a.id);
        list.innerHTML += `<div class="list-item ${unlocked ? 'unlocked' : ''}"><div><div class="item-title">${a.name}</div><div class="item-desc">${a.desc}</div></div><div style="font-size:24px;">${unlocked ? a.icon : '🔒'}</div></div>`;
    });
}
function renderGunLibrary() {
    const list = document.getElementById('gun-list'); list.innerHTML = "";
    weaponDB.forEach(w => {
        let unlocked = saveData.unlockedGuns.includes(w.name);
        list.innerHTML += `<div class="list-item ${unlocked ? 'unlocked' : ''}"><div><div class="item-title">${unlocked ? w.name : '???'}</div><div class="item-desc">${unlocked ? (w.type.toUpperCase() + " | DMG: " + w.dmg) : 'Locked'}</div></div><div style="color:${w.color}; font-size:24px;">${unlocked ? '🔫' : '❓'}</div></div>`;
    });
}
function showToast(ach) { 
    const c = document.getElementById('ach-toast-container'); const d = document.createElement('div'); d.className = 'ach-toast'; 
    d.innerHTML = `<div class="ach-header">UNLOCKED</div><div class="ach-body"><span>${ach.icon}</span> <span>${ach.name}</span></div>`; 
    c.appendChild(d); setTimeout(()=>d.remove(), 5000); 
}
function checkAchievements() { achievements.forEach(a => { if(me && a.check(stats, me)) { if(unlockAch(a.id)) showToast(a); } }); }

/* --- LOBBY --- */
function startOffline() { 
    Network.mode = 'OFFLINE'; 
    const select = document.getElementById('map-select');
    const mapIdx = select ? parseInt(select.value) : 0;
    activeMap = playableMaps[mapIdx]; // Swaps active level boundaries
    launchGame(); 
}
function startLocalCoop() {
    p2InputConfig = document.getElementById('p2-input-select').value;
    closeMenu('coop-modal');
    Network.mode = 'LOCAL_COOP';
    const select = document.getElementById('map-select');
    const mapIdx = select ? parseInt(select.value) : 0;
    activeMap = playableMaps[mapIdx]; // Swaps active level boundaries
    launchGame();
}
function startTutorial() {
    Network.mode = 'OFFLINE';
    if (typeof Tutorial !== 'undefined') {
        Tutorial.isActive = true; // Declare active state before starting engine variables setup
    }
    activeMap = tutorialMapData; // Hot-swap layout to Boot Camp
    launchGame();
    if (typeof Tutorial !== 'undefined') {
        Tutorial.start();
    }
}
function enterLobbyHost() { 
    const select = document.getElementById('map-select');
    stats.selectedMapIdx = select ? parseInt(select.value) : 0; // Cache selected layout index

    // Sync menu map dropdown to the lobby map dropdown
    const lobbySelect = document.getElementById('lobby-map-select');
    if (lobbySelect) {
        lobbySelect.value = stats.selectedMapIdx;
    }

    // Set lobby screen displays: Host can select, client cannot
    document.getElementById('lobby-map-select').style.display = 'block';
    document.getElementById('lobby-map-display-client').style.display = 'none';

    // Identify username
    let nameInput = document.getElementById('username-input');
    myUsername = nameInput ? (nameInput.value || "Survivor") : "Survivor";
    myUsername = myUsername.substring(0, 12);

    window.lobbyPlayers.host = myUsername;
    window.lobbyPlayers.guest = "Waiting...";
    updateLobbyPlayersList();

    document.getElementById('main-menu').style.display = 'none'; 
    document.getElementById('lobby-screen').style.display = 'flex'; 
    Network.mode = 'HOST'; 
    Network.init((id) => { document.getElementById('host-id-display').innerText = id; }); 
}
function enterLobbyJoin() { 
    let id = document.getElementById('join-input').value; 
    if(!id) return alert("Please enter the Host ID"); 
    
    document.getElementById('lobby-status').innerText = "Connecting to Peer Server...";
    
    // Switch to Lobby Screen immediately so the user knows something is happening
    document.getElementById('main-menu').style.display = 'none'; 
    document.getElementById('lobby-screen').style.display = 'flex'; 
    document.getElementById('start-btn').style.display = 'none'; // Hide start button for guest

    // Display the target Host's lobby ID to the guest immediately
    document.getElementById('host-id-display').innerText = "ID: " + id;

    // Hide lobby map select dropdown and show client map display text
    document.getElementById('lobby-map-select').style.display = 'none';
    const clientMapDisplay = document.getElementById('lobby-map-display-client');
    clientMapDisplay.style.display = 'block';
    clientMapDisplay.innerText = "Retrieving map...";

    // Retrieve username
    let nameInput = document.getElementById('username-input');
    myUsername = nameInput ? (nameInput.value || "Survivor") : "Survivor";
    myUsername = myUsername.substring(0, 12);

    window.lobbyPlayers.guest = myUsername;
    window.lobbyPlayers.host = "Connecting...";
    updateLobbyPlayersList();

    Network.init(() => { 
        document.getElementById('lobby-status').innerText = "Locating Host...";
        Network.join(id, () => { 
            document.getElementById('lobby-status').innerText = "Connected! Waiting for Host to start..."; 
            document.getElementById('lobby-status').style.color = "#0f0";
        }); 
    }); 
}

// Lobby Map Selector callback
function lobbyChangeMap() {
    const select = document.getElementById('lobby-map-select');
    if (!select) return;
    stats.selectedMapIdx = parseInt(select.value);
    
    // Synchronize to guest if connected and channel is active
    if (Network.mode === 'HOST' && Network.conn && Network.conn.open) {
        Network.conn.send({
            type: 'LOBBY_MAP_CHANGE',
            mapIndex: stats.selectedMapIdx
        });
    }
}

// Draw the connected users to the lobby list element
function updateLobbyPlayersList() {
    const listEl = document.getElementById('player-list');
    if (!listEl) return;
    let html = `<div style="text-align: left; background: rgba(255,255,255,0.05); padding: 15px; border: 1px solid #333; border-radius: 4px; min-width: 280px; box-sizing: border-box;">`;
    html += `<div style="border-bottom: 1px solid #444; padding-bottom: 5px; margin-bottom: 10px; font-weight: bold; color: #a83232;">CONNECTED PLAYERS:</div>`;
    html += `<div style="color: #3498db; font-size: 16px;">👑 Host: <strong>${window.lobbyPlayers.host || "Survivor"}</strong></div>`;
    if (window.lobbyPlayers.guest && window.lobbyPlayers.guest !== "Waiting..." && window.lobbyPlayers.guest !== "Disconnected") {
        html += `<div style="color: #e67e22; font-size: 16px; margin-top: 8px;">👤 Guest: <strong>${window.lobbyPlayers.guest}</strong></div>`;
    } else if (window.lobbyPlayers.guest === "Disconnected") {
        html += `<div style="color: #c0392b; font-size: 16px; margin-top: 8px; font-style: italic;">👤 Guest: Player Disconnected</div>`;
    } else {
        html += `<div style="color: #666; font-size: 14px; margin-top: 8px; font-style: italic;">👤 Guest: Waiting for guest...</div>`;
    }
    html += `</div>`;
    listEl.innerHTML = html;
}

function updateLobbyUI(connected) { 
    if(connected) { 
        document.getElementById('lobby-status').style.color = '#0f0'; 
        document.getElementById('lobby-status').innerText = "PLAYER 2 JOINED!"; 
        document.getElementById('start-btn').disabled = false; 
        document.getElementById('start-btn').style.background = '#a83232'; 
    } 
}
function hostStartGame() { 
    Network.conn.send({ type: 'START', mapIndex: stats.selectedMapIdx }); // Synchronize level selection with guest
    activeMap = playableMaps[stats.selectedMapIdx];
    launchGame(); 
}

function launchGame() {
    // Prevent concurrent multiple requestAnimationFrame loops from running
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    
    // Evaluate active map swapping mechanics safely
    if (typeof Tutorial !== 'undefined' && Tutorial.isActive) {
        activeMap = tutorialMapData;
    } else {
        if (typeof Tutorial !== 'undefined') Tutorial.end();
    }

    resetSession();
    
    // Get Username from Input (safeguard if element missing)
    let nameInput = document.getElementById('username-input');
    myUsername = nameInput ? (nameInput.value || "Survivor") : "Survivor";
    // Trim to 12 chars
    myUsername = myUsername.substring(0, 12);

    players = {};
    
    // Setup Player Spawning based on active Map size
    let spawnX = 200;
    let spawnY = 200;
    
    if (activeMap === playableMaps[0]) { // The Facility spawn (800x800 Room 0)
        spawnX = 400;
        spawnY = 400;
    } else if (activeMap === playableMaps[1]) { // Bunker Outpost spawn (600x600 Room 0)
        spawnX = 300;
        spawnY = 300;
    } else if (activeMap === playableMaps[2]) { // Sector-9 Lab Maze spawn (500x500 Room 0)
        spawnX = 250;
        spawnY = 250;
    }
    
    // Setup Player 1 using final synchronized codenames
    let p1Name = (Network.mode === 'CLIENT') ? (window.lobbyPlayers.host || "Host") : myUsername;
    players['p1'] = createPlayer('p1', spawnX, spawnY, '#3498db', p1Name);
    
    if(Network.mode !== 'OFFLINE') {
        // Setup Player 2 using final synchronized codenames
        let p2Name = (Network.mode === 'CLIENT') ? myUsername : (window.lobbyPlayers.guest || "Player 2");
        players['p2'] = createPlayer('p2', spawnX + 50, spawnY, '#e67e22', p2Name);
    }

    me = (Network.mode === 'CLIENT') ? players['p2'] : players['p1'];

    // Initialize/Reset loop timestep parameters
    lastLoopTime = performance.now();
    accumulator = 0;

    gameActive = true;
    loop();
}

function requestRestart() { 
    if(Network.mode === 'CLIENT') return; 
    if(Network.mode === 'HOST') Network.conn.send({ type: 'START', mapIndex: stats.selectedMapIdx }); 
    launchGame(); 
}

function createPlayer(id, x, y, color, name) { 
    return { 
        id: id, name: name, x: x, y: y, r: 15, hp: 100, maxHp: 100, state: 'ALIVE', 
        inventory: [{ ...weaponDB[0], clip: 8, ammo: 32 }], 
        weapIdx: 0, angle: 0, reloading: false, reloadTimer: 0, hasJug: false, reviveTimer: 0, 
        color: color, kills: 0, score: 500, 
        triggerShoot: false, triggerReload: false, triggerInteract: false,
        lastRepairTime: 0, // Track rebuild speed cooldown (500ms limit)
        invincibleTimer: 0 // Track temporary damage immunity frames
    }; 
}

/* --- LOOP (WITH LOCKED 60HZ TIMESTEP ACCUMULATOR) --- */
function loop(currentTime) {
    if(!gameActive) return;

    if (!currentTime) currentTime = performance.now();
    let elapsed = currentTime - lastLoopTime;
    lastLoopTime = currentTime;

    // Guard against "spiral of death" during extreme lags or window blur
    if (elapsed > 250) elapsed = 250;

    accumulator += elapsed;

    // Run core game physics/logic ticks at a strict 60Hz rate
    while (accumulator >= tickRate) {
        updateGameLogic();
        accumulator -= tickRate;
    }

    // Render operations run at the monitor's native hardware FPS rate (60, 144, 240, etc.)
    let camTarget = me;
    if(me && me.state !== 'ALIVE') {
        let survivor = Object.values(players).find(p => p.state === 'ALIVE');
        if(survivor) camTarget = survivor;
    }

    if(camTarget) {
        camera.x = camTarget.x - canvas.width/2; camera.y = camTarget.y - canvas.height/2;
        drawGame(); updateUI();
    } else {
        ctx.fillStyle = "black"; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = "white"; ctx.font = "20px monospace"; ctx.fillText("GAME OVER...", 100, 100);
    }

    if(showScoreboard) drawScoreboard(); else document.getElementById('scoreboard').style.display='none';

    animationFrameId = requestAnimationFrame(loop);
}

/* --- ISOLATED GAME PHYSICS & COGNITIVE LOGIC TICK (LOCKED 60 FPS) --- */
function updateGameLogic() {
    if(me) updatePlayerPhysics(me, true);

    // Smoothly interpolate positions and progress internal frames
    Object.values(players).forEach(p => {
        if (p !== me && p.serverX !== undefined) {
            p.x += (p.serverX - p.x) * 0.15;
            p.y += (p.serverY - p.y) * 0.15;
        }

        // Progress damage immunity frames
        if (p.invincibleTimer > 0) {
            p.invincibleTimer--;
        }
    });
    
    // Update active Boot Camp objectives checks
    if (typeof Tutorial !== 'undefined' && Tutorial.isActive) {
        Tutorial.update();
    }

    if(Network.mode === 'CLIENT') {
        Network.sendClientData(me);
        
        // Client Smoothing for Zombies
        zombies.forEach(z => {
            if(z.serverX !== undefined) {
                z.x += (z.serverX - z.x) * 0.15;
                z.y += (z.serverY - z.y) * 0.15;
            }
        });
    } else {
        stats.frame++;
        if(stats.frame % 60 === 0) Object.values(players).forEach(p => { if(p.state === 'ALIVE' && p.hp < p.maxHp) p.hp++; });

        if(players['p2']) {
            if (Network.mode === 'LOCAL_COOP') {
                updateLocalCoopP2(players['p2']);
            } else {
                if(players['p2'].triggerReload) forceReload(players['p2']);
                players['p2'].triggerReload = false;
                updatePlayerPhysics(players['p2'], false);
            }
            if(players['p2'].triggerInteract) { processInteraction(players['p2']); players['p2'].triggerInteract = false; }
        }

        updateZombies();
        updateBullets();
        checkGameFlow();
        checkAllDead(); 
        Object.values(players).forEach(p => { if(p.triggerShoot) { shootGun(p); p.triggerShoot = false; } });
        if(Network.mode === 'HOST') Network.broadcastState();
    }

    checkInteractUI();

    particles.forEach((p,i) => { p.x+=p.vx; p.y+=p.vy; p.life--; if(p.life<=0) particles.splice(i,1); });
    texts.forEach((t,i) => { t.y-=1; t.life--; if(t.life<=0) texts.splice(i,1); });
}

function updatePlayerPhysics(p, isLocal) {
    if(p.state === 'DOWNED') {
        if(p.reviveTimer > 0) { p.reviveTimer--; if(p.reviveTimer === 0) { p.state = 'ALIVE'; p.hp = p.maxHp; p.hasJug = false; p.invincibleTimer = 120; addText(p.x, p.y, "REVIVED (+INVINCIBLE!)", "#0f0"); } }
        return;
    }
    if(isLocal) {
        let dx = 0, dy = 0;
        
        // Check physical keyboard bindings
        if(keys['KeyW']) dy = -1; if(keys['KeyS']) dy = 1;
        if(keys['KeyA']) dx = -1; if(keys['KeyD']) dx = 1;
        
        if (dx || dy) {
            let len = Math.hypot(dx,dy); 
            dx /= len; 
            dy /= len;
        } else if (isTouchDevice && isMovingTouch) {
            // Process touch joysticks if keyboard is silent
            dx = touchMoveVector.x;
            dy = touchMoveVector.y;
        }
        
        if(dx||dy) {
            let speed = 4;
            if(!RoomSystem.checkCollision(p.x+(dx*speed), p.y, true)) p.x += dx*speed;
            if(!RoomSystem.checkCollision(p.x, p.y+(dy*speed), true)) p.y += dy*speed;
        }
        
        // Handle Aiming
        if (isTouchDevice && isAimingTouch) {
            p.angle = Math.atan2(touchAimVector.y, touchAimVector.x);
        } else {
            p.angle = Math.atan2((mouse.y + camera.y) - p.y, (mouse.x + camera.x) - p.x);
        }
        
        let gun = p.inventory[p.weapIdx];
        if(mouse.down) {
            // Keep: Allows continuous holding to shoot all weapons automatically on mobile devices
            if(gun.auto || isTouchDevice) p.triggerShoot = true;
            else if(!mouse.pressHandled) { p.triggerShoot = true; mouse.pressHandled = true; }
        } else mouse.pressHandled = false;
    }
    const gun = p.inventory[p.weapIdx];
    if(p.reloading) {
        p.reloadTimer--;
        if(p.reloadTimer <= 0) { let needed = gun.mag - gun.clip; let take = Math.min(needed, gun.ammo); gun.clip += take; gun.ammo -= take; p.reloading = false; }
    }
}

function updateLocalCoopP2(p) {
    if (p.state === 'DOWNED') {
        if (p.reviveTimer > 0) {
            p.reviveTimer--;
            if (p.reviveTimer === 0) {
                p.state = 'ALIVE';
                p.hp = p.maxHp;
                p.hasJug = false;
                p.invincibleTimer = 120;
                addText(p.x, p.y, "REVIVED!", "#0f0");
            }
        }
        return;
    }

    let dx = 0;
    let dy = 0;
    let isShooting = false;
    let isReloading = false;
    let isInteracting = false;

    if (p2InputConfig === 'keyboard') {
        // --- 1. KEYBOARD CONTROLS FOR PLAYER 2 ---
        if (keys['ArrowUp']) dy = -1;
        if (keys['ArrowDown']) dy = 1;
        if (keys['ArrowLeft']) dx = -1;
        if (keys['ArrowRight']) dx = 1;

        isShooting = keys['Slash'] || keys['Numpad0'];
        isReloading = keys['Period'] || keys['NumpadDecimal'];
        isInteracting = keys['Comma'] || keys['NumpadEnter'];

        // Auto aim at closest zombie, or face direction of movement
        let targetZ = null;
        let minDist = 350;
        zombies.forEach(z => {
            let dist = Math.hypot(z.x - p.x, z.y - p.y);
            if (dist < minDist) {
                minDist = dist;
                targetZ = z;
            }
        });

        if (targetZ) {
            p.angle = Math.atan2(targetZ.y - p.y, targetZ.x - p.x);
        } else if (dx !== 0 || dy !== 0) {
            p.angle = Math.atan2(dy, dx);
        }
    } else {
        // --- 2. GAMEPAD CONTROLS FOR PLAYER 2 ---
        const gpIdx = p2InputConfig === 'gamepad0' ? 0 : 1;
        const gamepads = navigator.getGamepads();
        const gp = gamepads[gpIdx];

        if (gp) {
            // Check Analog sticks movement
            let ax0 = gp.axes[0] || 0;
            let ax1 = gp.axes[1] || 0;

            if (Math.abs(ax0) > 0.15) dx = ax0;
            if (Math.abs(ax1) > 0.15) dy = ax1;

            // Fallback to D-pad buttons
            if (dx === 0 && dy === 0) {
                if (gp.buttons[12] && gp.buttons[12].pressed) dy = -1;
                if (gp.buttons[13] && gp.buttons[13].pressed) dy = 1;
                if (gp.buttons[14] && gp.buttons[14].pressed) dx = -1;
                if (gp.buttons[15] && gp.buttons[15].pressed) dx = 1;
            }

            // Aiming Analog
            let ax2 = gp.axes[2] || 0;
            let ax3 = gp.axes[3] || 0;
            if (Math.abs(ax2) > 0.2 || Math.abs(ax3) > 0.2) {
                p.angle = Math.atan2(ax3, ax2);
            } else {
                // Secondary fallback auto-aim
                let targetZ = null;
                let minDist = 350;
                zombies.forEach(z => {
                    let dist = Math.hypot(z.x - p.x, z.y - p.y);
                    if (dist < minDist) {
                        minDist = dist;
                        targetZ = z;
                    }
                });
                if (targetZ) {
                    p.angle = Math.atan2(targetZ.y - p.y, targetZ.x - p.x);
                } else if (dx !== 0 || dy !== 0) {
                    p.angle = Math.atan2(dy, dx);
                }
            }

            // Button Mapping
            isShooting = (gp.buttons[7] && gp.buttons[7].pressed) || 
                         (gp.buttons[5] && gp.buttons[5].pressed) || 
                         (gp.buttons[0] && gp.buttons[0].pressed);
            
            isReloading = (gp.buttons[2] && gp.buttons[2].pressed);
            
            isInteracting = (gp.buttons[3] && gp.buttons[3].pressed) || 
                            (gp.buttons[1] && gp.buttons[1].pressed);
        }
    }

    // Apply Movement with Collision Checks
    if (dx !== 0 || dy !== 0) {
        let len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        let speed = 4;
        if (!RoomSystem.checkCollision(p.x + (dx * speed), p.y, true)) p.x += dx * speed;
        if (!RoomSystem.checkCollision(p.x, p.y + (dy * speed), true)) p.y += dy * speed;
    }

    const gun = p.inventory[p.weapIdx];

    // Handle Shoot Triggering
    if (isShooting) {
        if (gun.auto) {
            p.triggerShoot = true;
        } else if (!p2PrevButtons.shoot) {
            p.triggerShoot = true;
        }
    }

    // Handle Reload Triggering
    if (isReloading && !p2PrevButtons.reload) {
        if (!p.reloading && gun.clip < gun.mag && gun.ammo > 0) {
            p.reloading = true;
            p.reloadTimer = gun.reload;
            addText(p.x, p.y - 40, "RELOADING...", "#fff");
        }
    }

    // Handle Interact Triggering
    if (isInteracting && !p2PrevButtons.interact) {
        p.triggerInteract = true;
    }

    // Progress Reload Timer
    if (p.reloading) {
        p.reloadTimer--;
        if (p.reloadTimer <= 0) {
            let needed = gun.mag - gun.clip;
            let take = Math.min(needed, gun.ammo);
            gun.clip += take;
            gun.ammo -= take;
            p.reloading = false;
        }
    }

    p2PrevButtons.shoot = isShooting;
    p2PrevButtons.reload = isReloading;
    p2PrevButtons.interact = isInteracting;
}

function shootGun(p) {
    if(p.state !== 'ALIVE') return;
    const gun = p.inventory[p.weapIdx];
    if(stats.frame - (gun.lastShot||0) >= (60/(gun.rpm/60 * 10))) {
        gun.lastShot = stats.frame;
        
        // Infinite ammo during early stages of boot camp
        const isInfinite = (typeof Tutorial !== 'undefined' && Tutorial.isActive && Tutorial.currentStep < 4);

        if(gun.clip > 0 || isInfinite) {
            if (!isInfinite) {
                gun.clip--;
            }
            if(p === me) { camera.x += (Math.random()-0.5)*5; camera.y += (Math.random()-0.5)*5; }
            let pellets = gun.type === 'shotgun' ? gun.pellets : 1;
            if(Network.mode !== 'CLIENT') {
                for(let i=0; i<pellets; i++) {
                    let a = p.angle + (Math.random()-0.5) * (gun.type==='shotgun'?0.2:0.05);
                    bullets.push({ x:p.x, y:p.y, vx:Math.cos(a)*20, vy:Math.sin(a)*20, dmg:gun.dmg, color:gun.color, life:50, ownerId: p.id });
                }
            }
        } else if (gun.ammo > 0) forceReload(p);
    }
}

function handleReload() { forceReload(me); }
function forceReload(p) { let gun = p.inventory[p.weapIdx]; if(!p.reloading && gun.clip < gun.mag && gun.ammo > 0) { p.reloading = true; p.reloadTimer = gun.reload; addText(p.x, p.y-40, "RELOADING...", "#fff"); } }

function checkInteractUI() {
    let msg = document.getElementById('interact-msg'); msg.style.display = 'none'; me.interactionTarget = null;
    if(me.state !== 'ALIVE') return;
    let downed = Object.values(players).find(p => p !== me && p.state === 'DOWNED');
    if(downed && Math.hypot(me.x - downed.x, me.y - downed.y) < 50) { msg.style.display = 'block'; msg.innerText = "[F] REVIVE TEAMMATE"; me.interactionTarget = { type: 'REVIVE', obj: downed }; return; }
    let interact = RoomSystem.getNearbyInteractable(me.x, me.y, me);
    if(interact) { msg.style.display = 'block'; msg.innerText = interact.label; me.interactionTarget = interact; }
}
function handleInteractAction() { if(me.state !== 'ALIVE') return; if(Network.mode === 'CLIENT') Network.sendInteract(); else processInteraction(me); }

function processInteraction(p) {
    let teammate = Object.values(players).find(pl => pl !== p && pl.state === 'DOWNED');
    if(teammate && Math.hypot(p.x - teammate.x, p.y - teammate.y) < 50) { 
        teammate.state = 'ALIVE'; 
        teammate.hp = teammate.maxHp; 
        teammate.hasJug = false; 
        teammate.invincibleTimer = 120; // 2 seconds of damage immunity
        addText(teammate.x, teammate.y, "REVIVED (+INVINCIBLE!)", "#0f0"); 
        return; 
    }
    let interact = RoomSystem.getNearbyInteractable(p.x, p.y, p);
    if(interact) {
        let t = interact;
        if(t.type==='WINDOW') { 
            const now = Date.now();
            if (now - (p.lastRepairTime || 0) < 500) return; // 500ms repair cooldown
            p.lastRepairTime = now;

            t.obj.boards++; 
            p.score+=10; 
            addText(t.obj.x+20, t.obj.y, "+10", "#fff");
            
            // Send window repair completion hook to modular tutorial logic
            if (typeof Tutorial !== 'undefined') {
                Tutorial.onWindowRepaired();
            }
        }
        else if(t.type==='DOOR' && p.score >= t.obj.price) { p.score-=t.obj.price; t.obj.unlocked=true; }
        else if(t.type==='WALLBUY') {
            const hasWeapon = p.inventory.some(w => w.name === t.obj.label);
            const cost = hasWeapon ? Math.floor(t.obj.price / 2) : t.obj.price;
            
            if (p.score >= cost) {
                p.score -= cost;
                if (hasWeapon) {
                    let ext = p.inventory.find(w => w.name === t.obj.label);
                    if (ext) {
                        ext.ammo = ext.reserve;
                        addText(p.x, p.y, "MAX AMMO", "#fff");
                        
                        // Send cheap ammo refill purchase trigger to modular tutorial tracking
                        if (typeof Tutorial !== 'undefined') {
                            Tutorial.onAmmoPurchased();
                        }
                    }
                } else {
                    if (p === me) unlockGun(t.obj.label);
                    let b = weaponDB.find(w => w.name === t.obj.label);
                    p.inventory.push({ ...b, clip: b.mag, ammo: b.reserve });
                    p.weapIdx = p.inventory.length - 1;
                    addText(p.x, p.y, b.name, "#fff");
                }
            }
        }
        else if(t.type==='BOX' && p.score>=950) { p.score-=950; let rnd=weaponDB[Math.floor(Math.random()*weaponDB.length)]; p.inventory.push({...rnd, clip:rnd.mag, ammo:rnd.reserve}); p.weapIdx=p.inventory.length-1; addText(p.x, p.y, rnd.name+"!", "#0ff"); }
        else if(t.type==='PERK' && p.score>=t.obj.price && !p.hasJug) { p.score-=t.obj.price; p.hasJug=true; p.maxHp=250; p.hp=250; if(p===me) checkAchievements(); addText(p.x, p.y, "JUGGERNOG!", "#c0392b"); }
    }
}

function checkAllDead() { if(Network.mode === 'CLIENT') return; let allDown = Object.values(players).every(p => p.state === 'DOWNED'); if(allDown && !Object.values(players).some(p => p.reviveTimer > 0)) gameOver(); }

function updateZombies() {
    // Spawning logic (prevent spawning in tutorial mode outside of custom script instructions)
    if (activeMap !== tutorialMapData && stats.zombiesToSpawn > 0 && stats.frame % 100 === 0 && stats.zombiesAlive < 24) {
        let valid = activeMap.spawnPoints.filter(sp => activeMap.rooms[sp.roomId].unlocked);
        if (valid.length > 0) {
            let sp = valid[Math.floor(Math.random() * valid.length)];
            let hp = 100 + (stats.round * 30);
            zombieIdCounter++;
            
            zombies.push({ 
                id: zombieIdCounter, x: sp.x, y: sp.y, hp: hp, maxHp: hp, 
                speed: 1 + (Math.random() * 1.5), r: 16, hasEntered: false 
            });
            stats.zombiesToSpawn--; stats.zombiesAlive++;
        }
    }

    zombies.forEach((z, i) => {
        let targetX, targetY;

        // --- NEW AI LOGIC: ENTRY WAYPOINTS ---
        if (!z.hasEntered) {
            // Find the closest window to the zombie
            let closestWin = null;
            let minDist = 999999;
            activeMap.windows.forEach(w => {
                let d = Math.hypot(z.x - w.entryX, z.y - w.entryY);
                if (d < minDist) { minDist = d; closestWin = w; }
            });

            if (closestWin) {
                // Head to that window's INSIDE point
                targetX = closestWin.entryX;
                targetY = closestWin.entryY;

                // If zombie reaches the inside point, switch to player-chasing forever
                if (Math.hypot(z.x - targetX, z.y - targetY) < 15) {
                    z.hasEntered = true;
                }
            } else {
                z.hasEntered = true;
            }
        }
        
        if (z.hasEntered) {
            // Normal behavior: Target the closest ALIVE player
            let target = null;
            let minDist = 9999;
            Object.values(players).forEach(p => {
                if (p.state === 'ALIVE') {
                    let d = Math.hypot(p.x - z.x, p.y - z.y);
                    if (d < minDist) { minDist = d; target = p; }
                }
            });
            if (!target) return;
            targetX = target.x;
            targetY = target.y;
        }

        // --- WINDOW COLLISION / BREAKING ---
        let attackingWindow = null;
        for (let w of activeMap.windows) {
            if (w.boards > 0) {
                // Check if zombie is touching the window area
                if (z.x > w.x - 35 && z.x < w.x + w.w + 35 && z.y > w.y - 35 && z.y < w.y + w.h + 35) {
                    attackingWindow = w; break;
                }
            }
        }

        if (attackingWindow) {
            // Break boards instead of moving
            if (stats.frame % 60 === 0) { 
                attackingWindow.boards--; 
                spawnParticles(attackingWindow.x + attackingWindow.w / 2, attackingWindow.y + attackingWindow.h / 2, '#8B4513', 2);
            }
        } else {
            // Standard Movement toward current target (Window Waypoint or Player)
            let a = Math.atan2(targetY - z.y, targetX - z.x);
            let mx = Math.cos(a) * z.speed;
            let my = Math.sin(a) * z.speed;
            
            if (!RoomSystem.checkCollision(z.x + mx, z.y, false)) z.x += mx;
            if (!RoomSystem.checkCollision(z.x, z.y + my, false)) z.y += my;
        }

        // Bumping logic (Keep zombies from stacking)
        for (let j = i + 1; j < zombies.length; j++) {
            let z2 = zombies[j];
            let dist = Math.hypot(z.x - z2.x, z.y - z2.y);
            if (dist < 20 && dist > 0) {
                let push = (20 - dist) / 2;
                let ax = ((z.x - z2.x) / dist) * push * 0.5;
                let ay = ((z.y - z2.y) / dist) * push * 0.5;
                if (!RoomSystem.checkCollision(z.x + ax, z.y + ay, false)) { z.x += ax; z.y += ay; }
                if (!RoomSystem.checkCollision(z2.x - ax, z2.y - ay, false)) { z2.x -= ax; z2.y -= ay; }
            }
        }

        // Damage Players
        Object.values(players).forEach(p => {
            if (Math.hypot(p.x - z.x, p.y - z.y) < 30 && p.state === 'ALIVE') {
                // Skip damage calculations if the target has active invincibility frames
                if (p.invincibleTimer && p.invincibleTimer > 0) return;

                p.hp -= 5;
                if (p === me) {
                    document.getElementById('damage-flash').style.background = "rgba(255,0,0,0.3)";
                    setTimeout(() => document.getElementById('damage-flash').style.background = "transparent", 50);
                }
                if (p.hp <= 0) {
                    p.state = 'DOWNED';
                    p.reviveTimer = p.hasJug ? 300 : -1;
                    if (p.hasJug) addText(p.x, p.y, "JUG SAVED YOU!", "#f00");
                    else addText(p.x, p.y, "DOWNED!", "#f00");
                }
            }
        });
    });
}

function updateBullets() {
    for(let i=bullets.length-1; i>=0; i--) {
        let b = bullets[i]; b.x+=b.vx; b.y+=b.vy; b.life--; let hit = false;
        if(RoomSystem.checkCollision(b.x, b.y, false)) hit = true;
        if(!hit) zombies.forEach((z, zi) => {
            if(!hit && Math.hypot(b.x-z.x, b.y-z.y) < z.r+5) {
                hit = true; z.hp -= b.dmg; spawnParticles(z.x, z.y, '#800', 3);
                if(z.hp <= 0) {
                    zombies.splice(zi, 1); stats.score += 60; stats.zombiesAlive--;
                    if(players[b.ownerId]) { players[b.ownerId].score += 60; players[b.ownerId].kills++; }
                    if(b.ownerId === me.id) { stats.sessionKills++; checkAchievements(); addText(z.x, z.y, "+60", "#ff0"); }
                }
            }
        });
        if(hit || b.life<=0) bullets.splice(i,1);
    }
}

function checkGameFlow() {
    if(activeMap !== tutorialMapData && stats.zombiesAlive <= 0 && stats.zombiesToSpawn <= 0 && !stats.changingRound) {
        stats.changingRound = true;
        setTimeout(() => {
            stats.round++; stats.zombiesToSpawn = Math.floor(6 * Math.pow(1.15, stats.round)); stats.changingRound = false; addText(me.x, me.y-100, "ROUND "+stats.round, "#a83232"); checkAchievements();
            Object.values(players).forEach(p => {
                if(p.state !== 'ALIVE') {
                    p.state = 'ALIVE'; p.hp = 100; p.maxHp = 100; p.hasJug = false;
                    let survivor = Object.values(players).find(pl => pl.state === 'ALIVE' && pl !== p);
                    if(survivor) { p.x = survivor.x; p.y = survivor.y; }
                    addText(p.x, p.y, "RESPAWNED!", "#0ff");
                }
            });
        }, 4000);
    }
}

function drawScoreboard() {
    const board = document.getElementById('scoreboard'); board.style.display = 'block';
    const tbody = document.getElementById('score-body'); tbody.innerHTML = '';
    Object.values(players).forEach(p => {
        let ping = (p.id === me.id) ? "0ms" : "35ms";
        let status = p.state === 'ALIVE' ? '<span style="color:#0f0">ALIVE</span>' : '<span style="color:#f00">DOWN</span>';
        tbody.innerHTML += `<tr><td style="color:${p.color}">${p.name}</td><td>${p.kills}</td><td>${p.score}</td><td>${status}</td><td>${ping}</td></tr>`;
    });
}

function resetSession() { 
    // Preserve map index across resets so synchronization doesn't fail on restarts
    const currentMapIdx = stats.selectedMapIdx !== undefined ? stats.selectedMapIdx : 0;
    stats = { score: 0, round: 1, zombiesToSpawn: 6, zombiesAlive: 0, frame: 0, sessionKills: 0, selectedMapIdx: currentMapIdx }; 
    zombies = []; bullets = []; particles = []; texts = []; zombieIdCounter = 0; 
    activeMap.rooms.forEach(r => r.unlocked = (r.id === 0)); 
    
    // Evaluate map layout and assign suitable barriers count
    if (activeMap === tutorialMapData) {
        activeMap.windows.forEach(w => w.boards = 0); // Start empty so player can build them
    } else {
        activeMap.windows.forEach(w => w.boards = w.max); // Start fully completed in normal play
    }
}
function spawnParticles(x, y, c, n) { for(let i=0; i<n; i++) particles.push({x, y, vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5, life:20, color:c}); }
function addText(x, y, t, c) { texts.push({x, y, text:t, color:c, life:60}); }
function gameOver() { 
    if(!gameActive) return; 
    gameActive = false; 
    if(Network.mode === 'HOST') Network.broadcastGameOver(stats); 
    
    // Check if Tutorial is active - instantly retry instead of displaying high scores or returning to main menu
    if (typeof Tutorial !== 'undefined' && Tutorial.isActive) {
        Tutorial.resetOnDeath();
        return;
    }

    let msg = ""; 
    try { msg = saveGame(stats.round, stats.sessionKills, me.score); } catch(e) {} 
    document.getElementById('game-ui').style.display='none'; 
    document.getElementById('game-over').style.display='flex'; 
    document.getElementById('death-msg').innerText="Survived to Round "+stats.round; 
    if(document.getElementById('perf-msg')) document.getElementById('perf-msg').innerText = msg; 

    // Handle return to lobby button visibility and interactivity
    const returnLobbyBtn = document.getElementById('return-lobby-btn');
    if (returnLobbyBtn) {
        if (Network.mode === 'HOST') {
            returnLobbyBtn.style.display = 'block';
            returnLobbyBtn.innerText = "RETURN TO LOBBY";
            returnLobbyBtn.disabled = false;
        } else if (Network.mode === 'CLIENT') {
            returnLobbyBtn.style.display = 'block';
            returnLobbyBtn.innerText = "WAITING FOR HOST...";
            returnLobbyBtn.disabled = true;
        } else {
            returnLobbyBtn.style.display = 'none';
        }
    }
}

function returnToLobby() {
    if (Network.mode === 'HOST' && Network.conn && Network.conn.open) {
        Network.conn.send({ type: 'RETURN_TO_LOBBY' });
    }
    goToLobbyScreen();
}

function goToLobbyScreen() {
    gameActive = false;
    // Clean up loop to ensure it doesn't leak or run concurrently
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Hide game screens and show lobby
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('lobby-screen').style.display = 'flex';
    
    // Clean up temporary in-game state objects to prevent lingering artifacts
    zombies = [];
    bullets = [];
    particles = [];
    texts = [];
    
    if (Network.mode === 'HOST') {
        document.getElementById('lobby-status').innerText = "PLAYER 2 JOINED!";
        document.getElementById('lobby-status').style.color = '#0f0';
        document.getElementById('start-btn').style.display = 'block';
        document.getElementById('start-btn').disabled = false;
        document.getElementById('start-btn').style.background = '#a83232';
        
        // Let the host change the map
        document.getElementById('lobby-map-select').style.display = 'block';
        document.getElementById('lobby-map-display-client').style.display = 'none';
    } else if (Network.mode === 'CLIENT') {
        document.getElementById('lobby-status').innerText = "Connected! Waiting for Host to start...";
        document.getElementById('lobby-status').style.color = "#0f0";
        document.getElementById('start-btn').style.display = 'none';
        
        // Keep map locked for client, but display chosen layout name
        document.getElementById('lobby-map-select').style.display = 'none';
        const clientMapDisplay = document.getElementById('lobby-map-display-client');
        clientMapDisplay.style.display = 'block';
        
        const mapName = (typeof playableMaps !== 'undefined' && playableMaps[stats.selectedMapIdx]) ? playableMaps[stats.selectedMapIdx].name : "Unknown Map";
        clientMapDisplay.innerText = mapName;
    }
}

function updateUI() {
    document.getElementById('round-box').innerText = stats.round;

    // Player 1 HUD
    const p1 = players['p1'];
    if (p1) {
        document.getElementById('hud-p1').style.display = 'block';
        document.getElementById('p1-name').innerText = p1.name || "P1";
        document.getElementById('p1-score').innerHTML = p1.score + ' <span style="font-size:16px">⛃</span>';
        
        const gun1 = p1.inventory[p1.weapIdx];
        if (gun1) {
            document.getElementById('p1-gun-name').innerText = gun1.name;
            document.getElementById('p1-ammo-text').innerText = p1.reloading ? "RELOADING" : `${gun1.clip} / ${gun1.ammo}`;
        }
        document.getElementById('p1-icon-jug').style.display = p1.hasJug ? 'block' : 'none';
    } else {
        document.getElementById('hud-p1').style.display = 'none';
    }

    // Player 2 HUD
    const p2 = players['p2'];
    if (p2) {
        document.getElementById('hud-p2').style.display = 'block';
        document.getElementById('p2-name').innerText = p2.name || "Player 2";
        document.getElementById('p2-score').innerHTML = p2.score + ' <span style="font-size:16px">⛃</span>';
        
        const gun2 = p2.inventory[p2.weapIdx];
        if (gun2) {
            document.getElementById('p2-gun-name').innerText = gun2.name;
            document.getElementById('p2-ammo-text').innerText = p2.reloading ? "RELOADING" : `${gun2.clip} / ${gun2.ammo}`;
        }
        document.getElementById('p2-icon-jug').style.display = p2.hasJug ? 'block' : 'none';
    } else {
        document.getElementById('hud-p2').style.display = 'none';
    }
}

// Keep: Lobby Copy Trigger Helpers for Clipboard copy
function copyHostId() {
    const display = document.getElementById('host-id-display');
    if (!display) return;
    
    let idText = display.innerText.replace("ID: ", "").trim();
    if (idText === "Generating..." || idText === "") return;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(idText).then(() => {
            feedbackCopyButton();
        }).catch(() => fallbackCopy(idText));
    } else {
        fallbackCopy(idText);
    }
}

function fallbackCopy(text) {
    const tempInput = document.createElement("input");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
        document.execCommand("copy");
        feedbackCopyButton();
    } catch (e) {
        alert("Copy failed. Your Host ID is: " + text);
    }
    document.body.removeChild(tempInput);
}

function feedbackCopyButton() {
    const btn = document.getElementById('copy-id-btn');
    if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = "✅ Copied!";
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
    }
}

init();