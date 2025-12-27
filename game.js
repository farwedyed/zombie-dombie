/* --- GAME LOGIC --- */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// STATE
let camera = { x: 0, y: 0 };
let gameActive = false;
let showScoreboard = false;

// GLOBAL DATA
let stats = { score: 500, round: 1, zombiesToSpawn: 6, zombiesAlive: 0, frame: 0, sessionKills: 0 };
let players = {};
let me = null;
let bullets = [], zombies = [], particles = [], texts = [];
let zombieIdCounter = 0; 
let myUsername = "Survivor"; // Store local username

// INPUTS
const keys = {};
const mouse = { x: 0, y: 0, down: false, pressHandled: false };

document.oncontextmenu = () => false;

function init() {
    document.getElementById('menu-kills').innerText = saveData.kills;
    if(document.getElementById('menu-round')) {
        document.getElementById('menu-round').innerText = saveData.highestRound;
    }
    
    window.addEventListener('keydown', e => { 
        if(e.code === 'Tab') { e.preventDefault(); showScoreboard = true; }
        else {
            keys[e.code] = true; 
            if(gameActive && e.code==='KeyR') handleReload(); 
            if(gameActive && e.code==='KeyF') handleInteractAction(); 
        }
    });
    window.addEventListener('keyup', e => { 
        if(e.code === 'Tab') showScoreboard = false;
        else keys[e.code] = false; 
    });
    
    window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mousedown', (e) => { if(e.button===0) mouse.down = true; });
    window.addEventListener('mouseup', () => { mouse.down = false; mouse.pressHandled = false; });
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
function startOffline() { Network.mode = 'OFFLINE'; launchGame(); }
function enterLobbyHost() { document.getElementById('main-menu').style.display = 'none'; document.getElementById('lobby-screen').style.display = 'flex'; Network.mode = 'HOST'; Network.init((id) => { document.getElementById('host-id-display').innerText = id; }); }
function enterLobbyJoin() { 
    let id = document.getElementById('join-input').value; 
    if(!id) return alert("Please enter the Host ID"); 
    
    document.getElementById('lobby-status').innerText = "Connecting to Peer Server...";
    
    // Switch to Lobby Screen immediately so the user knows something is happening
    document.getElementById('main-menu').style.display = 'none'; 
    document.getElementById('lobby-screen').style.display = 'flex'; 
    document.getElementById('start-btn').style.display = 'none'; // Hide start button for guest

    Network.init(() => { 
        document.getElementById('lobby-status').innerText = "Locating Host...";
        Network.join(id, () => { 
            document.getElementById('lobby-status').innerText = "Connected! Waiting for Host to start..."; 
            document.getElementById('lobby-status').style.color = "#0f0";
        }); 
    }); 
}
function updateLobbyUI(connected) { if(connected) { document.getElementById('lobby-status').style.color = '#0f0'; document.getElementById('lobby-status').innerText = "PLAYER 2 JOINED!"; document.getElementById('start-btn').disabled = false; document.getElementById('start-btn').style.background = '#a83232'; } }
function hostStartGame() { Network.conn.send({ type: 'START' }); launchGame(); }

function launchGame() {
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    
    resetSession();
    
    // Get Username from Input (safeguard if element missing)
    let nameInput = document.getElementById('username-input');
    myUsername = nameInput ? (nameInput.value || "Survivor") : "Survivor";
    // Trim to 12 chars
    myUsername = myUsername.substring(0, 12);

    players = {};
    
    // Setup Player 1
    // If I am Host/Offline, use my name. If I am Client, P1 name will be synced from network later.
    let p1Name = (Network.mode === 'CLIENT') ? "Host" : myUsername;
    players['p1'] = createPlayer('p1', 400, 300, '#3498db', p1Name);
    
    if(Network.mode !== 'OFFLINE') {
        // Setup Player 2
        // If I am Client, use my name. If I am Host, P2 name will be synced from network later.
        let p2Name = (Network.mode === 'CLIENT') ? myUsername : "Player 2";
        players['p2'] = createPlayer('p2', 450, 300, '#e67e22', p2Name);
    }

    me = (Network.mode === 'CLIENT') ? players['p2'] : players['p1'];

    gameActive = true;
    loop();
}

function requestRestart() { if(Network.mode === 'CLIENT') return; if(Network.mode === 'HOST') Network.conn.send({ type: 'START' }); launchGame(); }

// UPDATED: Added 'name' parameter
function createPlayer(id, x, y, color, name) { 
    return { 
        id: id, name: name, x: x, y: y, r: 15, hp: 100, maxHp: 100, state: 'ALIVE', 
        inventory: [{ ...weaponDB[0], clip: 8, ammo: 32 }], 
        weapIdx: 0, angle: 0, reloading: false, reloadTimer: 0, hasJug: false, reviveTimer: 0, 
        color: color, kills: 0, score: 500, 
        triggerShoot: false, triggerReload: false, triggerInteract: false 
    }; 
}

/* --- LOOP --- */
function loop() {
    if(!gameActive) return;
    
    if(me) updatePlayerPhysics(me, true);

    if(Network.mode === 'CLIENT') {
        Network.sendClientData(me);
        // Client Smoothing
        zombies.forEach(z => {
            if(z.serverX !== undefined) {
                z.x += (z.serverX - z.x) * 0.2;
                z.y += (z.serverY - z.y) * 0.2;
            }
        });
    } else {
        stats.frame++;
        if(stats.frame % 60 === 0) Object.values(players).forEach(p => { if(p.state === 'ALIVE' && p.hp < p.maxHp) p.hp++; });

        if(players['p2']) {
            if(players['p2'].triggerReload) forceReload(players['p2']);
            players['p2'].triggerReload = false;
            updatePlayerPhysics(players['p2'], false);
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

    particles.forEach((p,i) => { p.x+=p.vx; p.y+=p.vy; p.life--; if(p.life<=0) particles.splice(i,1); });
    texts.forEach((t,i) => { t.y-=1; t.life--; if(t.life<=0) texts.splice(i,1); });
    if(showScoreboard) drawScoreboard(); else document.getElementById('scoreboard').style.display='none';

    requestAnimationFrame(loop);
}

function updatePlayerPhysics(p, isLocal) {
    if(p.state === 'DOWNED') {
        if(p.reviveTimer > 0) { p.reviveTimer--; if(p.reviveTimer === 0) { p.state = 'ALIVE'; p.hp = p.maxHp; p.hasJug = false; addText(p.x, p.y, "REVIVED!", "#0f0"); } }
        return;
    }
    if(isLocal) {
        let dx = 0, dy = 0;
        if(keys['KeyW']) dy = -1; if(keys['KeyS']) dy = 1;
        if(keys['KeyA']) dx = -1; if(keys['KeyD']) dx = 1;
        if(dx||dy) {
            let len = Math.hypot(dx,dy); dx/=len; dy/=len; let speed = 4;
            if(!RoomSystem.checkCollision(p.x+(dx*speed), p.y, true)) p.x += dx*speed;
            if(!RoomSystem.checkCollision(p.x, p.y+(dy*speed), true)) p.y += dy*speed;
        }
        p.angle = Math.atan2((mouse.y + camera.y) - p.y, (mouse.x + camera.x) - p.x);
        let gun = p.inventory[p.weapIdx];
        if(mouse.down) {
            if(gun.auto) p.triggerShoot = true;
            else if(!mouse.pressHandled) { p.triggerShoot = true; mouse.pressHandled = true; }
        } else mouse.pressHandled = false;
    }
    const gun = p.inventory[p.weapIdx];
    if(p.reloading) {
        p.reloadTimer--;
        if(p.reloadTimer <= 0) { let needed = gun.mag - gun.clip; let take = Math.min(needed, gun.ammo); gun.clip += take; gun.ammo -= take; p.reloading = false; }
    }
}

function shootGun(p) {
    if(p.state !== 'ALIVE') return;
    const gun = p.inventory[p.weapIdx];
    if(stats.frame - (gun.lastShot||0) >= (60/(gun.rpm/60 * 10))) {
        gun.lastShot = stats.frame;
        if(gun.clip > 0) {
            gun.clip--;
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
    let interact = RoomSystem.getNearbyInteractable(me.x, me.y);
    if(interact) { msg.style.display = 'block'; msg.innerText = interact.label; me.interactionTarget = interact; }
}
function handleInteractAction() { if(me.state !== 'ALIVE') return; if(Network.mode === 'CLIENT') Network.sendInteract(); else processInteraction(me); }

function processInteraction(p) {
    let teammate = Object.values(players).find(pl => pl !== p && pl.state === 'DOWNED');
    if(teammate && Math.hypot(p.x - teammate.x, p.y - teammate.y) < 50) { teammate.state = 'ALIVE'; teammate.hp = teammate.maxHp; teammate.hasJug = false; addText(teammate.x, teammate.y, "REVIVED!", "#0f0"); return; }
    let interact = RoomSystem.getNearbyInteractable(p.x, p.y);
    if(interact) {
        let t = interact;
        if(t.type==='WINDOW') { t.obj.boards++; p.score+=10; addText(t.obj.x+20, t.obj.y, "+10", "#fff"); }
        else if(t.type==='DOOR' && p.score >= t.obj.price) { p.score-=t.obj.price; t.obj.unlocked=true; }
        else if(t.type==='WALLBUY' && p.score >= t.obj.price) { p.score-=t.obj.price; if(p===me) unlockGun(t.obj.label); let ext = p.inventory.find(w=>w.name===t.obj.label); if(ext) { ext.ammo=ext.reserve; addText(p.x, p.y, "MAX AMMO", "#fff"); } else { let b=weaponDB.find(w=>w.name===t.obj.label); p.inventory.push({...b, clip:b.mag, ammo:b.reserve}); p.weapIdx=p.inventory.length-1; addText(p.x, p.y, b.name, "#fff"); } }
        else if(t.type==='BOX' && p.score>=950) { p.score-=950; let rnd=weaponDB[Math.floor(Math.random()*weaponDB.length)]; p.inventory.push({...rnd, clip:rnd.mag, ammo:rnd.reserve}); p.weapIdx=p.inventory.length-1; addText(p.x, p.y, rnd.name+"!", "#0ff"); }
        else if(t.type==='PERK' && p.score>=t.obj.price && !p.hasJug) { p.score-=t.obj.price; p.hasJug=true; p.maxHp=250; p.hp=250; if(p===me) checkAchievements(); addText(p.x, p.y, "JUGGERNOG!", "#c0392b"); }
    }
}

function checkAllDead() { if(Network.mode === 'CLIENT') return; let allDown = Object.values(players).every(p => p.state === 'DOWNED'); if(allDown && !Object.values(players).some(p => p.reviveTimer > 0)) gameOver(); }

function updateZombies() {
    // Spawning logic
    if (stats.zombiesToSpawn > 0 && stats.frame % 100 === 0 && stats.zombiesAlive < 24) {
        let valid = mapData.spawnPoints.filter(sp => mapData.rooms[sp.roomId].unlocked);
        if (valid.length > 0) {
            let sp = valid[Math.floor(Math.random() * valid.length)];
            let hp = 100 + (stats.round * 30);
            zombieIdCounter++;
            
            // NEW: Zombies start with hasEntered = false
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
            mapData.windows.forEach(w => {
                let d = Math.hypot(z.x - w.entryX, z.y - w.entryY);
                if (d < minDist) { minDist = d; closestWin = w; }
            });

            // Head to that window's INSIDE point
            targetX = closestWin.entryX;
            targetY = closestWin.entryY;

            // If zombie reaches the inside point, switch to player-chasing forever
            if (Math.hypot(z.x - targetX, z.y - targetY) < 15) {
                z.hasEntered = true;
            }
        } else {
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
        for (let w of mapData.windows) {
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
    if(stats.zombiesAlive <= 0 && stats.zombiesToSpawn <= 0 && !stats.changingRound) {
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

// UPDATED: Now displays player name
function drawScoreboard() {
    const board = document.getElementById('scoreboard'); board.style.display = 'block';
    const tbody = document.getElementById('score-body'); tbody.innerHTML = '';
    Object.values(players).forEach(p => {
        let ping = (p.id === me.id) ? "0ms" : "35ms";
        let status = p.state === 'ALIVE' ? '<span style="color:#0f0">ALIVE</span>' : '<span style="color:#f00">DOWN</span>';
        tbody.innerHTML += `<tr><td style="color:${p.color}">${p.name}</td><td>${p.kills}</td><td>${p.score}</td><td>${status}</td><td>${ping}</td></tr>`;
    });
}

function resetSession() { stats = { score: 0, round: 1, zombiesToSpawn: 6, zombiesAlive: 0, frame: 0, sessionKills: 0 }; zombies = []; bullets = []; particles = []; texts = []; zombieIdCounter = 0; mapData.rooms.forEach(r => r.unlocked = (r.id === 0)); mapData.windows.forEach(w => w.boards = w.max); }
function spawnParticles(x, y, c, n) { for(let i=0; i<n; i++) particles.push({x, y, vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5, life:20, color:c}); }
function addText(x, y, t, c) { texts.push({x, y, text:t, color:c, life:60}); }
function gameOver() { if(!gameActive) return; gameActive = false; if(Network.mode === 'HOST') Network.broadcastGameOver(stats); let msg = ""; try { msg = saveGame(stats.round, stats.sessionKills, me.score); } catch(e) {} document.getElementById('game-ui').style.display='none'; document.getElementById('game-over').style.display='flex'; document.getElementById('death-msg').innerText="Survived to Round "+stats.round; if(document.getElementById('perf-msg')) document.getElementById('perf-msg').innerText = msg; }

init();