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

// COSMETICS PREVIEW THREAD STATE
let previewAngle = 0;
let previewAnimFrame = null;
window.previewCosmeticId = 'none';

document.oncontextmenu = () => false;

function init() {
    refreshMainMenuStats();
    
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

function refreshMainMenuStats() {
    const xp = saveData.xp || 0;
    const localLvl = Math.floor(xp / 1000) + 1;
    const localCoins = saveData.lobbyCoins || 0;
    const currentXPInLevel = xp % 1000;
    const percent = (currentXPInLevel / 1000) * 100;
    
    const killsEl = document.getElementById('menu-kills');
    const roundEl = document.getElementById('menu-round');
    const levelEl = document.getElementById('menu-level');
    const coinsEl = document.getElementById('menu-coins');
    const xpBarEl = document.getElementById('menu-xp-bar');
    const xpTextEl = document.getElementById('menu-xp-text');
    
    if (killsEl) killsEl.innerText = saveData.kills;
    if (roundEl) roundEl.innerText = saveData.highestRound;
    if (levelEl) levelEl.innerText = localLvl;
    if (coinsEl) coinsEl.innerText = localCoins + " 🪙";
    if (xpBarEl) xpBarEl.style.width = percent + "%";
    if (xpTextEl) xpTextEl.innerText = `${currentXPInLevel} / 1000 XP`;
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
    if(id === 'cosmetics-modal') {
        renderCosmeticShop();
        startCosmeticPreviewLoop();
    }
    if(id === 'lobby-browser-modal') {
        refreshServerBrowser();
    }
};
window.closeMenu = function(id) { 
    document.getElementById(id).style.display = 'none'; 
    if (id === 'cosmetics-modal') {
        if (previewAnimFrame) {
            cancelAnimationFrame(previewAnimFrame);
            previewAnimFrame = null;
        }
    }
};

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

function renderCosmeticShop() {
    const list = document.getElementById('cosmetics-list');
    list.innerHTML = "";
    
    if (!saveData.ownedCosmetics) saveData.ownedCosmetics = ['none'];
    if (!saveData.equippedCosmetic) saveData.equippedCosmetic = 'none';
    
    // Set initial preview state
    resetPreviewCosmetic();
    
    const isEquippedNone = saveData.equippedCosmetic === 'none';
    list.innerHTML += `
        <div class="list-item ${isEquippedNone ? 'unlocked' : ''}" style="border-left-color: #555;" onmouseover="setPreviewCosmetic('none')" onmouseout="resetPreviewCosmetic()">
            <div>
                <div class="item-title">Unequip All</div>
                <div class="item-desc">Clear your back slot</div>
            </div>
            <div>
                ${isEquippedNone ? 
                    '<span style="color:#2ecc71; font-weight:bold; font-size:14px;">EQUIPPED</span>' : 
                    '<button onclick="equipCosmetic(\'none\')" style="width:auto; padding:6px 12px; font-size:12px; margin:0; background:#222;">Equip</button>'}
            </div>
        </div>
    `;
    
    cosmeticDB.forEach(c => {
        const isOwned = saveData.ownedCosmetics.includes(c.id);
        const isEquipped = saveData.equippedCosmetic === c.id;
        
        let actionHtml = "";
        if (isEquipped) {
            actionHtml = `<span style="color:#2ecc71; font-weight:bold; font-size:14px;">EQUIPPED</span>`;
        } else if (isOwned) {
            actionHtml = `<button onclick="equipCosmetic('${c.id}')" style="width:auto; padding:6px 12px; font-size:12px; margin:0; background:#222;">Equip</button>`;
        } else {
            const canAfford = saveData.lobbyCoins >= c.price;
            actionHtml = `<button onclick="buyCosmetic('${c.id}')" ${canAfford ? '' : 'disabled'} style="width:auto; padding:6px 12px; font-size:12px; margin:0; background:${canAfford ? '#e67e22' : '#333'}; color:white; border:none;">Buy (🪙 ${c.price})</button>`;
        }
        
        list.innerHTML += `
            <div class="list-item ${isOwned ? 'unlocked' : ''}" style="border-left-color: ${c.color};" onmouseover="setPreviewCosmetic('${c.id}')" onmouseout="resetPreviewCosmetic()">
                <div>
                    <div class="item-title" style="color:${c.color}">${c.name}</div>
                    <div class="item-desc">Style: ${c.type.toUpperCase()}</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    ${actionHtml}
                </div>
            </div>
        `;
    });
}

window.setPreviewCosmetic = function(id) {
    window.previewCosmeticId = id;
    const item = cosmeticDB.find(c => c.id === id);
    const label = document.getElementById('cosmetic-preview-name');
    if (label) {
        if (item) {
            label.innerText = item.name;
            label.style.color = item.color;
        } else {
            label.innerText = "Unequipped";
            label.style.color = "#666";
        }
    }
};

window.resetPreviewCosmetic = function() {
    window.previewCosmeticId = saveData.equippedCosmetic;
    const label = document.getElementById('cosmetic-preview-name');
    if (label) {
        if (saveData.equippedCosmetic === 'none') {
            label.innerText = "Unequipped";
            label.style.color = "#666";
        } else {
            const item = cosmeticDB.find(c => c.id === saveData.equippedCosmetic);
            if (item) {
                label.innerText = item.name;
                label.style.color = item.color;
            }
        }
    }
};

function startCosmeticPreviewLoop() {
    const canvas = document.getElementById('cosmeticPreviewCanvas');
    if (!canvas) return;
    const previewCtx = canvas.getContext('2d');
    
    function drawPreviewFrame() {
        if (document.getElementById('cosmetics-modal').style.display !== 'block') {
            cancelAnimationFrame(previewAnimFrame);
            previewAnimFrame = null;
            return;
        }

        previewCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Fitting Room grid lines
        previewCtx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        previewCtx.lineWidth = 1;
        previewCtx.beginPath();
        previewCtx.arc(70, 70, 45, 0, Math.PI * 2);
        previewCtx.arc(70, 70, 25, 0, Math.PI * 2);
        previewCtx.stroke();
        
        previewCtx.save();
        previewCtx.translate(70, 70);
        
        // Spin the preview model
        previewAngle += 0.015;
        previewCtx.rotate(previewAngle);
        
        const currentPreviewId = window.previewCosmeticId || saveData.equippedCosmetic || 'none';
        const radius = 22;
        
        // Draw selected hover back cosmetic relative to spin axis
        if (currentPreviewId && currentPreviewId !== 'none' && typeof drawBackCosmetic === 'function') {
            drawBackCosmetic(currentPreviewId, radius, previewCtx);
        }
        
        // Draw player circle body with outlined theme
        previewCtx.fillStyle = '#3498db';
        previewCtx.strokeStyle = '#000000';
        previewCtx.lineWidth = 2.5;
        previewCtx.beginPath();
        previewCtx.arc(0, 0, radius, 0, Math.PI * 2);
        previewCtx.fill();
        previewCtx.stroke();
        
        // Draw Gun Barrel with outlined theme
        previewCtx.fillStyle = '#999';
        previewCtx.fillRect(0, -5, 30, 10);
        previewCtx.strokeStyle = '#000000';
        previewCtx.lineWidth = 2.5;
        previewCtx.strokeRect(0, -5, 30, 10);
        
        previewCtx.restore();
        
        previewAnimFrame = requestAnimationFrame(drawPreviewFrame);
    }
    
    if (previewAnimFrame) cancelAnimationFrame(previewAnimFrame);
    previewAnimFrame = requestAnimationFrame(drawPreviewFrame);
}

window.buyCosmetic = function(id) {
    const item = cosmeticDB.find(c => c.id === id);
    if (!item) return;
    
    if (saveData.lobbyCoins >= item.price && !saveData.ownedCosmetics.includes(id)) {
        saveData.lobbyCoins -= item.price;
        saveData.ownedCosmetics.push(id);
        saveData.equippedCosmetic = id; // Auto equip on purchase
        
        localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));
        
        if (typeof AccountSystem !== 'undefined' && AccountSystem.currentUser) {
            AccountSystem.pushProfileData();
        }
        
        refreshMainMenuStats();
        renderCosmeticShop();
        
        if (me) {
            me.equippedCosmetic = id;
        }
    }
};

window.equipCosmetic = function(id) {
    if (id === 'none' || saveData.ownedCosmetics.includes(id)) {
        saveData.equippedCosmetic = id;
        localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));
        
        if (typeof AccountSystem !== 'undefined' && AccountSystem.currentUser) {
            AccountSystem.pushProfileData();
        }
        
        renderCosmeticShop();
        
        if (me) {
            me.equippedCosmetic = id;
            if (Network.mode === 'CLIENT') {
                Network.sendClientData(me);
            }
        }
    }
};

/* --- SERVER LIST MANAGEMENT --- */
const LobbyManager = {
    heartbeatInterval: null,

    registerLobby: async function(peerId) {
        if (typeof db === 'undefined' || !db) return;
        const myLvl = Math.floor((saveData.xp || 0) / 1000) + 1;
        
        try {
            await db.collection("lobbies").doc(peerId).set({
                peerId: peerId,
                hostName: myUsername,
                hostLevel: myLvl,
                mapIndex: stats.selectedMapIdx,
                difficulty: stats.difficulty || 'medium',
                playerCount: Object.values(window.lobbyPlayers).filter(p => p !== "").length,
                maxPlayers: 4,
                status: 'LOBBY',
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.startHeartbeat(peerId);
        } catch(e) {
            console.warn("Failed to register lobby on Firestore:", e);
        }
    },

    startHeartbeat: function(peerId) {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(async () => {
            if (typeof db === 'undefined' || !db || Network.mode !== 'HOST') {
                this.stopHeartbeat();
                return;
            }
            try {
                await db.collection("lobbies").doc(peerId).update({
                    playerCount: Object.values(window.lobbyPlayers).filter(p => p !== "").length,
                    mapIndex: stats.selectedMapIdx,
                    difficulty: stats.difficulty || 'medium',
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch(e) {
                console.warn("Lobby heartbeat update failed:", e);
            }
        }, 15000); // 15s interval
    },

    stopHeartbeat: function() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    },

    unregisterLobby: async function(peerId) {
        this.stopHeartbeat();
        if (typeof db === 'undefined' || !db || !peerId) return;
        try {
            await db.collection("lobbies").doc(peerId).delete();
        } catch(e) {
            console.warn("Failed to unregister lobby:", e);
        }
    },

    fetchLobbies: async function(onComplete) {
        if (typeof db === 'undefined' || !db) return onComplete([]);
        
        const cutoff = new Date(Date.now() - 45000); // 45 seconds tolerance window
        try {
            const snap = await db.collection("lobbies")
                .where("lastActive", ">=", cutoff)
                .get();
            
            const list = [];
            snap.forEach(doc => {
                list.push(doc.data());
            });
            onComplete(list);
        } catch(e) {
            console.error("Failed to scan lobbies:", e);
            onComplete([]);
        }
    }
};

window.addEventListener('beforeunload', () => {
    if (Network.mode === 'HOST' && Network.peer && typeof LobbyManager !== 'undefined') {
        LobbyManager.unregisterLobby(Network.peer.id);
    }
});

window.refreshServerBrowser = function() {
    const list = document.getElementById('lobby-browser-list');
    const noLobbies = document.getElementById('no-lobbies-msg');
    if (!list) return;
    
    list.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#888;">Scanning active public lobbies...</td></tr>`;
    if (noLobbies) noLobbies.style.display = 'none';

    if (typeof LobbyManager !== 'undefined') {
        LobbyManager.fetchLobbies((lobbies) => {
            list.innerHTML = "";
            if (lobbies.length === 0) {
                if (noLobbies) noLobbies.style.display = 'block';
                return;
            }
            if (noLobbies) noLobbies.style.display = 'none';

            lobbies.forEach(lobby => {
                let mapName = "Facility";
                if (lobby.mapIndex === 1) mapName = "Bunker";
                else if (lobby.mapIndex === 2) mapName = "Sector-9";
                
                let diffLabel = lobby.difficulty ? lobby.difficulty.toUpperCase() : "MEDIUM";
                
                list.innerHTML += `
                    <tr style="border-bottom:1px solid #222;">
                        <td style="padding:10px; color:#3498db; font-weight:bold;">${lobby.hostName || "Host"} <span style="color:#ffd700; font-size:10px;">[Lv.${lobby.hostLevel || 1}]</span></td>
                        <td style="padding:10px; color:#ccc;">${mapName}</td>
                        <td style="padding:10px; color:#e67e22; font-weight:bold;">${diffLabel}</td>
                        <td style="padding:10px; color:#666;">${lobby.playerCount || 1} / ${lobby.maxPlayers || 4}</td>
                        <td style="padding:10px; text-align:right;">
                            <button onclick="joinServerBrowserLobby('${lobby.peerId}')" style="width:auto; margin:0; padding:5px 12px; font-size:12px; background:#a83232; color:white; border:none; border-radius:3px;">Connect</button>
                        </td>
                    </tr>
                `;
            });
        });
    }
};

window.joinServerBrowserLobby = function(peerId) {
    closeMenu('lobby-browser-modal');
    enterLobbyJoinManual(peerId);
};

window.manualJoinLobby = function() {
    let id = document.getElementById('manual-join-input').value.trim();
    if (!id) return alert("Please enter a manual Host ID");
    closeMenu('lobby-browser-modal');
    enterLobbyJoinManual(id);
};

function enterLobbyJoinManual(id) {
    if (!validateOnlineName()) return;
    
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

    window.lobbyPlayers = { p1: "Host [Lv. ?]", p2: "", p3: "", p4: "" };
    updateLobbyPlayersList();

    Network.init(() => { 
        document.getElementById('lobby-status').innerText = "Locating Host...";
        Network.join(id, () => { 
            document.getElementById('lobby-status').innerText = "Connected! Waiting for Host to start..."; 
            document.getElementById('lobby-status').style.color = "#0f0";
        }); 
    });
}

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
    window.lobbyPlayers = { p1: "Survivor", p2: "Player 2 [Lv. 1]", p3: "", p4: "" };
    
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

    const myLvl = Math.floor((saveData.xp || 0) / 1000) + 1;
    const hostDisplayName = myUsername + " [Lv. " + myLvl + "]";

    window.myPlayerId = 'p1';
    window.lobbyPlayers = { p1: hostDisplayName, p2: "", p3: "", p4: "" };
    updateLobbyPlayersList();

    document.getElementById('main-menu').style.display = 'none'; 
    document.getElementById('lobby-screen').style.display = 'flex'; 
    Network.mode = 'HOST'; 
    Network.init((id) => { 
        document.getElementById('host-id-display').innerText = id; 
        if (typeof LobbyManager !== 'undefined') {
            LobbyManager.registerLobby(id);
        }
    }); 
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

    window.lobbyPlayers = { p1: "Host [Lv. ?]", p2: "", p3: "", p4: "" };
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

    if (Network.mode === 'HOST' && Network.peer && typeof LobbyManager !== 'undefined') {
        LobbyManager.unregisterLobby(Network.peer.id); // Unregister so clients cannot connect mid-match
    }

    resetSession();
    
    let nameInput = document.getElementById('username-input');
    myUsername = nameInput ? (nameInput.value || "Survivor") : "Survivor";
    myUsername = myUsername.substring(0, 12);

    const myLvl = Math.floor((saveData.xp || 0) / 1000) + 1;
    const displayName = myUsername + " [Lv. " + myLvl + "]";

    players = {};
    
    let spawnX = 200, spawnY = 200;
    if (activeMap === playableMaps[0]) { spawnX = 400; spawnY = 400; }
    else if (activeMap === playableMaps[1]) { spawnX = 300; spawnY = 300; }
    else if (activeMap === playableMaps[2]) { spawnX = 250; spawnY = 250; }
    
    if (Network.mode === 'CLIENT') {
        me = createPlayer(window.myPlayerId, spawnX, spawnY, getPlayerColor(window.myPlayerId), displayName);
        players[window.myPlayerId] = me;
    } else {
        players['p1'] = createPlayer('p1', spawnX, spawnY, getPlayerColor('p1'), displayName);
        me = players['p1'];

        if (Network.mode === 'HOST') {
            ['p2', 'p3', 'p4'].forEach((pId, idx) => {
                if (window.lobbyPlayers[pId] && window.lobbyPlayers[pId] !== "Reserved") {
                    players[pId] = createPlayer(pId, spawnX + 40 * (idx + 1), spawnY, getPlayerColor(pId), window.lobbyPlayers[pId]);
                }
            });
        } else if (Network.mode === 'LOCAL_COOP') {
            players['p2'] = createPlayer('p2', spawnX + 40, spawnY, getPlayerColor('p2'), "Player 2 [Lv. 1]");
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
        muzzleFlash: 0,
        equippedCosmetic: (id === 'p1') ? (saveData.equippedCosmetic || 'none') : 'none'
    }; 
}

function goToLobbyScreen() {
    gameActive = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (Network.mode === 'HOST' && Network.peer && typeof LobbyManager !== 'undefined') {
        LobbyManager.unregisterLobby(Network.peer.id); // Clear active list mappings if exiting
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
        
        // Re-register to browser once returning back to lobby
        if (Network.peer && typeof LobbyManager !== 'undefined') {
            LobbyManager.registerLobby(Network.peer.id);
        }
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