/* --- GLOBAL ON-SCREEN DEBUG LOGGER --- */
window.addEventListener('error', function(e) {
    showOnScreenDebug(e.message, e.filename, e.lineno, e.colno);
});
window.addEventListener('unhandledrejection', function(e) {
    showOnScreenDebug("Promise Rejected: " + e.reason, "", 0, 0);
});

function showOnScreenDebug(msg, file, line, col) {
    console.error("CRASH CAPTURED:", msg, file, line);
    let dbg = document.getElementById('debug-console-overlay');
    if (!dbg) {
        dbg = document.createElement('div');
        dbg.id = 'debug-console-overlay';
        dbg.style.position = 'absolute';
        dbg.style.bottom = '10px';
        dbg.style.left = '10px';
        dbg.style.right = '10px';
        dbg.style.maxHeight = '140px';
        dbg.style.background = 'rgba(180, 0, 0, 0.95)';
        dbg.style.color = '#fff';
        dbg.style.fontFamily = 'monospace';
        dbg.style.fontSize = '12px';
        dbg.style.padding = '10px';
        dbg.style.zIndex = '99999';
        dbg.style.overflowY = 'auto';
        dbg.style.border = '2px solid white';
        dbg.style.borderRadius = '4px';
        dbg.style.pointerEvents = 'auto';
        document.body.appendChild(dbg);
    }
    const cleanFile = file ? file.substring(file.lastIndexOf('/') + 1) : "unknown";
    const logMsg = document.createElement('div');
    logMsg.style.marginBottom = '5px';
    logMsg.style.borderBottom = '1px dashed rgba(255,255,255,0.3)';
    logMsg.style.paddingBottom = '3px';
    logMsg.innerHTML = `<strong>CRASH:</strong> ${msg}<br><span style="color:#ffd700;">File: ${cleanFile} | Line: ${line}:${col}</span>`;
    dbg.appendChild(logMsg);
    dbg.scrollTop = dbg.scrollHeight;
}

/* --- GAME LOGIC STATE --- */
if (!window.lobbyPlayers) {
    window.lobbyPlayers = { p1: "Survivor", p2: "", p3: "", p4: "" };
}
if (!window.myPlayerId) {
    window.myPlayerId = "p1";
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// STATE
let camera = { x: 0, y: 0 };
let gameActive = false;
let showScoreboard = false;
let animationFrameId = null;

// FIXED TIMESTEP VARIABLES
let lastLoopTime = performance.now();
let accumulator = 0;
const tickRate = 1000 / 60; // Locked 60Hz logic loop

// GLOBAL DATA
let stats = { score: 500, round: 1, zombiesToSpawn: 6, zombiesAlive: 0, frame: 0, sessionKills: 0, selectedMapIdx: 0, difficulty: "medium" };
let players = {};
let me = null;
let bullets = [], zombies = [], particles = [], texts = [];
window.bloodStains = [];
let zombieIdCounter = 0; 
let myUsername = "Survivor";

// POWERUP DROP CONFIGURATIONS
window.drops = [];
window.doublePointsTimer = 0;
window.instaKillTimer = 0;

// LOCAL CO-OP CONFIGURATION
let p2InputConfig = 'keyboard';
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
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    // Keyboard Listeners
    window.addEventListener('keydown', e => { 
        if(e.code === 'Tab') { e.preventDefault(); showScoreboard = true; }
        else {
            keys[e.code] = true; 
            if(gameActive && e.code==='KeyR') handleReload(); 
            if(gameActive && e.code==='KeyF') handleInteractAction(); 
            
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
    
    // Scroll Wheel Switch Weapons
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

    let nameInput = document.getElementById('username-input');
    if (nameInput) {
        let savedName = localStorage.getItem('zombieUsername');
        if (savedName) {
            nameInput.value = savedName;
        }
    }

    checkTouchDevice();
}

/* --- MOBILE DETECTION & JOYSTICKS --- */
function checkTouchDevice() {
    isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
        document.getElementById('mobile-overlay').style.display = 'block';
        document.getElementById('controls-hint').style.display = 'none';
        setupTouchControls();
    }
}

function setupTouchControls() {
    const stickLeft = document.getElementById('touch-stick-left');
    const knobLeft = document.getElementById('touch-knob-left');
    const stickRight = document.getElementById('touch-stick-right');
    const knobRight = document.getElementById('touch-knob-right');
    
    const maxRadius = 45;
    
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
            
            if (me) {
                me.angle = Math.atan2(dy, dx);
            }
            
            if (dist > maxRadius * 0.40) {
                mouse.down = true;
            } else {
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

/* --- PROFILE & HANDSHAKE HELPERS --- */
function saveLocalUsername() {
    let nameInput = document.getElementById('username-input');
    if (nameInput) {
        let nameVal = nameInput.value.trim();
        if (nameVal) {
            localStorage.setItem('zombieUsername', nameVal);
        }
    }
}

function validateOnlineName() {
    let nameInput = document.getElementById('username-input');
    let nameVal = nameInput ? nameInput.value.trim() : "";
    if (!nameVal) {
        if (nameInput) {
            nameInput.classList.remove('shake-anim');
            void nameInput.offsetWidth;
            nameInput.classList.add('shake-anim');
            nameInput.focus();
            setTimeout(() => nameInput.classList.remove('shake-anim'), 400);
        }
        return false;
    }
    saveLocalUsername();
    return true;
}

/* --- LOBBY SYSTEMS --- */
function startOffline() { 
    Network.mode = 'OFFLINE'; 
    window.myPlayerId = 'p1';
    window.lobbyPlayers = { p1: "Survivor", p2: "", p3: "", p4: "" };
    
    const selectDiff = document.getElementById('menu-diff-select');
    stats.difficulty = selectDiff ? selectDiff.value : "medium";

    saveLocalUsername();

    const select = document.getElementById('map-select');
    const mapIdx = select ? parseInt(select.value) : 0;
    activeMap = playableMaps[mapIdx];
    launchGame(); 
}
function startLocalCoop() {
    p2InputConfig = document.getElementById('p2-input-select').value;
    closeMenu('coop-modal');
    Network.mode = 'LOCAL_COOP';
    window.myPlayerId = 'p1';
    window.lobbyPlayers = { p1: "Survivor", p2: "Player 2", p3: "", p4: "" };
    
    const selectDiff = document.getElementById('menu-diff-select');
    stats.difficulty = selectDiff ? selectDiff.value : "medium";

    saveLocalUsername();

    const select = document.getElementById('map-select');
    const mapIdx = select ? parseInt(select.value) : 0;
    activeMap = playableMaps[mapIdx];
    launchGame();
}
function startTutorial() {
    Network.mode = 'OFFLINE';
    window.myPlayerId = 'p1';
    window.lobbyPlayers = { p1: "Survivor", p2: "", p3: "", p4: "" };
    stats.difficulty = "medium";
    
    saveLocalUsername();

    if (typeof Tutorial !== 'undefined') {
        Tutorial.isActive = true;
    }
    activeMap = tutorialMapData;
    launchGame();
    if (typeof Tutorial !== 'undefined') {
        Tutorial.start();
    }
}
function enterLobbyHost() { 
    if (!validateOnlineName()) return;

    const select = document.getElementById('map-select');
    stats.selectedMapIdx = select ? parseInt(select.value) : 0;
    stats.difficulty = "medium";

    const lobbySelect = document.getElementById('lobby-map-select');
    if (lobbySelect) {
        lobbySelect.value = stats.selectedMapIdx;
    }

    const diffSelect = document.getElementById('lobby-diff-select');
    if (diffSelect) {
        diffSelect.value = stats.difficulty;
    }

    document.getElementById('lobby-map-select').style.display = 'block';
    document.getElementById('lobby-map-display-client').style.display = 'none';

    document.getElementById('lobby-diff-select').style.display = 'block';
    document.getElementById('lobby-diff-display-client').style.display = 'none';

    let nameInput = document.getElementById('username-input');
    myUsername = nameInput ? (nameInput.value || "Survivor") : "Survivor";
    myUsername = myUsername.substring(0, 12);

    window.myPlayerId = 'p1';
    window.lobbyPlayers = { p1: myUsername, p2: "", p3: "", p4: "" };
    updateLobbyPlayersList();

    document.getElementById('main-menu').style.display = 'none'; 
    document.getElementById('lobby-screen').style.display = 'flex'; 
    Network.mode = 'HOST'; 
    Network.init((id) => { document.getElementById('host-id-display').innerText = id; }); 
}
function enterLobbyJoin() { 
    if (!validateOnlineName()) return;

    let id = document.getElementById('join-input').value; 
    if(!id) return alert("Please enter the Host ID"); 
    
    document.getElementById('lobby-status').innerText = "Connecting to Peer Server...";
    
    document.getElementById('main-menu').style.display = 'none'; 
    document.getElementById('lobby-screen').style.display = 'flex'; 
    document.getElementById('start-btn').style.display = 'none';

    document.getElementById('host-id-display').innerText = "ID: " + id;

    document.getElementById('lobby-map-select').style.display = 'none';
    const clientMapDisplay = document.getElementById('lobby-map-display-client');
    clientMapDisplay.style.display = 'block';
    clientMapDisplay.innerText = "Retrieving map...";

    document.getElementById('lobby-diff-select').style.display = 'none';
    const clientDiffDisplay = document.getElementById('lobby-diff-display-client');
    clientDiffDisplay.style.display = 'block';
    clientDiffDisplay.innerText = "Retrieving difficulty...";

    let nameInput = document.getElementById('username-input');
    myUsername = nameInput ? (nameInput.value || "Survivor") : "Survivor";
    myUsername = myUsername.substring(0, 12);

    window.lobbyPlayers = { p1: "Host", p2: "", p3: "", p4: "" };
    updateLobbyPlayersList();

    Network.init(() => { 
        document.getElementById('lobby-status').innerText = "Locating Host...";
        Network.join(id, () => { 
            document.getElementById('lobby-status').innerText = "Connected! Waiting for Host to start..."; 
            document.getElementById('lobby-status').style.color = "#0f0";
        }); 
    }); 
}

function lobbyChangeMap() {
    const select = document.getElementById('lobby-map-select');
    if (!select) return;
    stats.selectedMapIdx = parseInt(select.value);
    
    if (Network.mode === 'HOST') {
        try {
            Network.broadcastToAll({
                type: 'LOBBY_MAP_CHANGE',
                mapIndex: stats.selectedMapIdx
            });
        } catch (e) {
            console.warn("Failed to broadcast map change:", e);
        }
    }
}

function lobbyChangeDifficulty() {
    const select = document.getElementById('lobby-diff-select');
    if (!select) return;
    stats.difficulty = select.value;
    
    if (Network.mode === 'HOST') {
        try {
            Network.broadcastToAll({
                type: 'LOBBY_DIFF_CHANGE',
                difficulty: stats.difficulty
            });
        } catch (e) {
            console.warn("Failed to broadcast difficulty change:", e);
        }
    }
}

function updateLobbyPlayersList() {
    const listEl = document.getElementById('player-list');
    if (!listEl) return;
    let html = `<div style="text-align: left; background: rgba(255,255,255,0.05); padding: 15px; border: 1px solid #333; border-radius: 4px; min-width: 280px; box-sizing: border-box;">`;
    html += `<div style="border-bottom: 1px solid #444; padding-bottom: 5px; margin-bottom: 10px; font-weight: bold; color: #a83232;">LOBBY survivors:</div>`;
    
    html += `<div style="color: #3498db; font-size: 15px; margin-bottom: 5px;">👑 P1 (Host): <strong>${window.lobbyPlayers.p1 || "Survivor"}</strong></div>`;
    
    ['p2', 'p3', 'p4'].forEach((pId, idx) => {
        const pName = window.lobbyPlayers[pId];
        const pColor = getPlayerColor(pId);
        if (pName && pName !== "Reserved") {
            html += `<div style="color: ${pColor}; font-size: 15px; margin-bottom: 5px;">👤 P${idx+2}: <strong>${pName}</strong></div>`;
        } else if (pName === "Reserved") {
            html += `<div style="color: #888; font-size: 14px; margin-bottom: 5px; font-style: italic;">👤 P${idx+2}: Connecting...</div>`;
        } else {
            html += `<div style="color: #666; font-size: 14px; margin-bottom: 5px; font-style: italic;">👤 P${idx+2}: Open Slot</div>`;
        }
    });
    
    html += `</div>`;
    listEl.innerHTML = html;
}

function updateLobbyUI(connected) { 
    if(connected) { 
        document.getElementById('lobby-status').style.color = '#0f0'; 
        document.getElementById('lobby-status').innerText = "PLAYERS CONNECTED!"; 
        document.getElementById('start-btn').disabled = false; 
        document.getElementById('start-btn').style.background = '#a83232'; 
    } 
}
function hostStartGame() { 
    try {
        Network.broadcastToAll({ type: 'START', mapIndex: stats.selectedMapIdx });
    } catch (e) {
        console.warn("Failed to broadcast START match packet:", e);
    }
    activeMap = playableMaps[stats.selectedMapIdx];
    launchGame(); 
}

function launchGame() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    
    if (typeof Tutorial !== 'undefined' && Tutorial.isActive) {
        activeMap = tutorialMapData;
    } else {
        if (typeof Tutorial !== 'undefined') Tutorial.end();
    }

    resetSession();
    
    let nameInput = document.getElementById('username-input');
    myUsername = nameInput ? (nameInput.value || "Survivor") : "Survivor";
    myUsername = myUsername.substring(0, 12);

    players = {};
    
    let spawnX = 200, spawnY = 200;
    if (activeMap === playableMaps[0]) { spawnX = 400; spawnY = 400; }
    else if (activeMap === playableMaps[1]) { spawnX = 300; spawnY = 300; }
    else if (activeMap === playableMaps[2]) { spawnX = 250; spawnY = 250; }
    
    if (Network.mode === 'CLIENT') {
        me = createPlayer(window.myPlayerId, spawnX, spawnY, getPlayerColor(window.myPlayerId), myUsername);
        players[window.myPlayerId] = me;
    } else {
        players['p1'] = createPlayer('p1', spawnX, spawnY, getPlayerColor('p1'), myUsername);
        me = players['p1'];

        if (Network.mode === 'HOST') {
            ['p2', 'p3', 'p4'].forEach((pId, idx) => {
                if (window.lobbyPlayers[pId] && window.lobbyPlayers[pId] !== "Reserved") {
                    players[pId] = createPlayer(pId, spawnX + 40 * (idx + 1), spawnY, getPlayerColor(pId), window.lobbyPlayers[pId]);
                }
            });
        } else if (Network.mode === 'LOCAL_COOP') {
            players['p2'] = createPlayer('p2', spawnX + 40, spawnY, getPlayerColor('p2'), "Player 2");
        }
    }

    lastLoopTime = performance.now();
    accumulator = 0;

    gameActive = true;
    loop();
}

function requestRestart() { 
    if(Network.mode === 'CLIENT') return; 
    if(Network.mode === 'HOST') {
        try {
            Network.broadcastToAll({ type: 'START', mapIndex: stats.selectedMapIdx }); 
        } catch (e) {
            console.warn("Failed to broadcast restart match:", e);
        }
    }
    launchGame(); 
}

function createPlayer(id, x, y, color, name) { 
    const currentDiff = stats.difficulty || 'medium';
    let startingHp = 100;
    if (currentDiff === 'easy') startingHp = 150;

    return { 
        id: id, name: name, x: x, y: y, r: 15, hp: startingHp, maxHp: startingHp, state: 'ALIVE', 
        inventory: [{ ...weaponDB[0], clip: 8, ammo: 32 }], 
        weapIdx: 0, angle: 0, reloading: false, reloadTimer: 0, hasJug: false, reviveTimer: 0, 
        color: color, kills: 0, score: 500, 
        isShooting: false,
        pressHandled: false,
        lastRepairTime: 0,
        invincibleTimer: 0,
        muzzleFlash: 0
    }; 
}

function goToLobbyScreen() {
    gameActive = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('lobby-screen').style.display = 'flex';
    
    zombies = [];
    bullets = [];
    particles = [];
    texts = [];
    window.bloodStains = [];
    window.drops = [];
    window.doublePointsTimer = 0;
    window.instaKillTimer = 0;
    
    if (Network.mode === 'HOST') {
        document.getElementById('lobby-status').innerText = "LOBBY ACTIVE!";
        document.getElementById('lobby-status').style.color = '#0f0';
        document.getElementById('start-btn').style.display = 'block';
        document.getElementById('start-btn').disabled = false;
        document.getElementById('start-btn').style.background = '#a83232';
        
        document.getElementById('lobby-map-select').style.display = 'block';
        document.getElementById('lobby-map-display-client').style.display = 'none';
    } else if (Network.mode === 'CLIENT') {
        document.getElementById('lobby-status').innerText = "Connected! Waiting for Host to start...";
        document.getElementById('lobby-status').style.color = "#0f0";
        document.getElementById('start-btn').style.display = 'none';
        
        document.getElementById('lobby-map-select').style.display = 'none';
        const clientMapDisplay = document.getElementById('lobby-map-display-client');
        clientMapDisplay.style.display = 'block';
        
        const mapName = (typeof playableMaps !== 'undefined' && playableMaps[stats.selectedMapIdx]) ? playableMaps[stats.selectedMapIdx].name : "Unknown Map";
        clientMapDisplay.innerText = mapName;
    }
}

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