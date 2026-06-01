/* --- GLOBAL DIAGNOSTICS & SCREENSHOT REPORTER --- */
window.addEventListener('error', function (e) {
    showOnScreenDebug(e.message, e.filename, e.lineno, e.colno);
});

window.addEventListener('unhandledrejection', function (e) {
    showOnScreenDebug("Promise Rejected: " + e.reason, "", 0, 0);
});

function showOnScreenDebug(msg, file, line, col) {
    console.error("CRASH:", msg, file, line);
    let dbg = document.getElementById('debug-console-overlay');
    if (!dbg) {
        dbg = document.createElement('div');
        dbg.id = 'debug-console-overlay';
        dbg.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:radial-gradient(circle, rgba(20,0,0,0.95) 0%, rgba(5,0,0,0.98) 100%); color:#fff; font-family:monospace; padding:35px; z-index:999999; box-sizing:border-box; overflow-y:auto; display:flex; flex-direction:column; align-items:center; justify-content:center; border:4px solid #a83232;';
        document.body.appendChild(dbg);
    }
    const cleanFile = file ? file.substring(file.lastIndexOf('/') + 1) : "unknown";
    const rawStack = new Error().stack || "No stack trace recorded.";
    
    dbg.innerHTML = `
        <div style="width:550px; max-width:95%; background:#0c0c0c; border:1px solid #a83232; border-top:5px solid #a83232; border-radius:6px; padding:25px; box-shadow:0 15px 40px rgba(0,0,0,0.9); text-align:center; box-sizing:border-box;">
            <div style="font-size:36px; margin-bottom:10px;">🚨</div>
            <div style="color:#ff4757; font-size:18px; font-weight:bold; margin-bottom:12px; letter-spacing:1px; text-transform:uppercase;">Fatal System Crash</div>
            <p style="color:#bbb; font-size:12px; line-height:1.5; margin-bottom:20px; text-align:left; background:rgba(255,255,255,0.02); padding:10px; border-radius:4px; border:1px solid #222;">
                <strong>INSTRUCTIONS:</strong> Please take a screenshot of this diagnostic report and send it to the developer to help investigate and patch this bug!
            </p>
            <div style="text-align:left; font-size:11px; margin-bottom:20px;">
                <div style="margin-bottom:6px;"><strong style="color:#ffd700;">ERROR:</strong> <span style="color:#ff4757;">${msg}</span></div>
                <div style="margin-bottom:6px;"><strong style="color:#ffd700;">LOCATION:</strong> ${cleanFile} | Line: ${line}:${col}</div>
                <div style="margin-bottom:6px;"><strong style="color:#ffd700;">STACK:</strong></div>
                <textarea readonly style="width:100%; height:90px; background:#050505; color:#888; border:1px solid #222; font-family:inherit; font-size:10px; padding:8px; resize:none; border-radius:4px; box-sizing:border-box;">${rawStack}</textarea>
            </div>
            <div style="display:flex; gap:8px;">
                <button id="btn-copy-crash" onclick="copyCrashToClipboard('${msg}\\nLocation: ${cleanFile} | Line: ${line}:${col}')" style="background:#222; border-color:#444; color:#aaa; padding:10px; font-size:12px; flex:1; margin:0;">📋 Copy Details</button>
                <button onclick="emergencyEscapeCrash()" style="background:#a83232; border-color:#a83232; color:#fff; padding:10px; font-size:12px; flex:1; margin:0;">Emergency Escape</button>
            </div>
        </div>
    `;
}

window.copyCrashToClipboard = function(text) {
    const btn = document.getElementById('btn-copy-crash');
    const copied = function () { 
        if (btn) { 
            btn.innerHTML = "✅ Copied!"; 
            setTimeout(function () { 
                btn.innerHTML = "📋 Copy Details"; 
            }, 2000); 
        } 
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(copied).catch(function () {
            fallbackCopyCrash(text, copied);
        });
    } else {
        fallbackCopyCrash(text, copied);
    }
};

function fallbackCopyCrash(text, cb) {
    const temp = document.createElement("textarea");
    temp.value = text; 
    document.body.appendChild(temp); 
    temp.select();
    try { 
        document.execCommand("copy"); 
        cb(); 
    } catch (e) { 
        alert("Copy failed. Please screenshot details."); 
    }
    document.body.removeChild(temp);
}

window.emergencyEscapeCrash = function() {
    gameActive = false;
    if (animationFrameId) { 
        cancelAnimationFrame(animationFrameId); 
        animationFrameId = null; 
    }
    try { 
        if (Network.peer) {
            Network.peer.destroy(); 
        }
    } catch(e) {}
    Network.peer = null; 
    Network.conn = null; 
    Network.conns = []; 
    Network.mode = 'OFFLINE';
    resetSession();
    const dbg = document.getElementById('debug-console-overlay');
    if (dbg) {
        dbg.remove();
    }
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
};

/* --- CORE CANVAS DECLARATIONS --- */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

/* --- CORE GAME STATE --- */
let camera = { x: 0, y: 0 };
let gameActive = false;
let showScoreboard = false;
let animationFrameId = null;
let lastLoopTime = performance.now();
let accumulator = 0;
const tickRate = 1000 / 60;

let stats = { 
    score: 500, 
    round: 1, 
    zombiesToSpawn: 6, 
    zombiesAlive: 0, 
    frame: 0, 
    sessionKills: 0, 
    selectedMapIdx: 0, 
    difficulty: "medium" 
};
let players = {};
let me = null;
let bullets = [];
let zombies = [];
let particles = [];
let texts = [];
window.bloodStains = [];
let zombieIdCounter = 0;
let myUsername = "Survivor";

window.drops = [];
window.doublePointsTimer = 0;
window.instaKillTimer = 0;

let p2InputConfig = 'keyboard';
let p2PrevButtons = { shoot: false, reload: false, interact: false };

let isTouchDevice = false;
let touchMoveVector = { x: 0, y: 0 };
let touchAimVector = { x: 0, y: 0 };
let isMovingTouch = false;
let isAimingTouch = false;

const keys = {};
const mouse = { x: 0, y: 0, down: false, pressHandled: false };

let previewAngle = 0;
let previewAnimFrame = null;
window.previewCosmeticId = 'none';

let selectedSoloMapIdx = 0;
let selectedSoloDifficulty = 'medium';

window.matchStartingXP = 0;
window.matchStartingCoins = 0;

// Tracking arrays to verify run discovery & defeats
window.startingUnlockedBosses = [];
window.startingDefeatedBosses = [];

// Automated menu leaderboard populate helper on start
async function populateMenuLeaderboard() {
    const menuBoard = document.getElementById('menu-leaderboard-body');
    if (!menuBoard) return;
    try {
        if (typeof db !== 'undefined' && db) {
            const snap = await db.collection("users").orderBy("highestRound", "desc").limit(10).get();
            menuBoard.innerHTML = "";
            if (snap.empty) {
                menuBoard.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:#555; font-size:10px;">No combat logs found.</td></tr>`;
                return;
            }
            let rank = 1;
            snap.forEach(doc => {
                const u = doc.data();
                const name = u.displayName || "Survivor";
                const lvl = Math.floor((u.xp || 0) / 1000) + 1;
                const kills = u.kills !== undefined ? u.kills : 0;
                const round = u.highestRound !== undefined ? u.highestRound : 1;
                menuBoard.innerHTML += `
                    <tr style="border-bottom: 1px solid #222;">
                        <td style="padding:6px; font-weight:bold; color:#ffd700; text-align:center;">#${rank}</td>
                        <td style="padding:6px; color:#fff; font-weight:bold; max-width:115px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${name}">${name} <span style="font-size:9px; color:#555;">[Lv.${lvl}]</span></td>
                        <td style="padding:6px; color:#ffd700; font-weight:bold; text-align:center;">R${round}</td>
                        <td style="padding:6px; color:#ff4757; text-align:center; font-weight:bold;">${kills}</td>
                    </tr>
                `;
                rank++;
            });
        }
    } catch(e) {
        console.warn("Menu leaderboard loading failed gracefully:", e);
        menuBoard.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:#e74c3c; font-size:9px;">Sync failed.</td></tr>`;
    }
}

function init() {
    refreshMainMenuStats();
    populateMenuLeaderboard(); // Pull leaderboard records immediately on load

    window.addEventListener('resize', function () { 
        canvas.width = window.innerWidth; 
        canvas.height = window.innerHeight; 
    });

    window.addEventListener('keydown', function (e) { 
        if (e.code === 'Tab') { 
            e.preventDefault(); 
            showScoreboard = true; 
        } else {
            keys[e.code] = true; 
            if (gameActive && e.code === 'KeyR') {
                handleReload(); 
            }
            if (gameActive && e.code === 'KeyF') {
                handleInteractAction(); 
            }
            if (gameActive && e.code === 'KeyQ') {
                if (me && me.inventory.length > 1) {
                    me.weapIdx = (me.weapIdx + 1) % me.inventory.length;
                    addText(me.x, me.y - 40, me.inventory[me.weapIdx].name, "#fff");
                }
            }
        }
    });
    
    window.addEventListener('keyup', function (e) { 
        if (e.code === 'Tab') {
            showScoreboard = false; 
        } else {
            keys[e.code] = false; 
        }
    });
    
    window.addEventListener('wheel', function (e) {
        if (gameActive && me && me.inventory.length > 1) {
            if (e.deltaY > 0) {
                me.weapIdx = (me.weapIdx + 1) % me.inventory.length;
            } else {
                me.weapIdx = (me.weapIdx - 1 + me.inventory.length) % me.inventory.length;
            }
            addText(me.x, me.y - 40, me.inventory[me.weapIdx].name, "#fff");
        }
    }, { passive: true });
    
    window.addEventListener('mousemove', function (e) { 
        mouse.x = e.clientX; 
        mouse.y = e.clientY; 
    });
    
    window.addEventListener('mousedown', function (e) { 
        if (e.button === 0) {
            mouse.down = true; 
        }
    });
    
    window.addEventListener('mouseup', function () { 
        mouse.down = false; 
        mouse.pressHandled = false; 
    });

    let nameInput = document.getElementById('username-input');
    if (nameInput) {
        let savedName = localStorage.getItem('zombieUsername');
        if (savedName) {
            nameInput.value = savedName;
        }
    }
    checkTouchDevice();

    if (!localStorage.getItem('zombieSaveModular') && !localStorage.getItem('zombieTutorialSkippedOrCompleted')) {
        console.log("Welcome! Automatically launching Boot Camp...");
        setTimeout(function () { 
            startTutorial(); 
        }, 800);
    }

    // Modal restructuring logic
    document.querySelectorAll('.modal').forEach(function (modal) {
        modal.style.overflow = 'hidden';
        modal.style.display = 'none';
        modal.style.flexDirection = 'column';
        
        let closeBtn = modal.querySelector('button[onclick^="closeMenu"]');
        let title = modal.querySelector('h2');
        
        // Define style for the Close Button globally
        if (closeBtn) {
            closeBtn.className = 'close-btn-top';
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = 'position:absolute; top:15px; right:15px; width:30px; height:30px; border-radius:50%; background:#222; border:1px solid #444; color:#aaa; font-size:14px; display:flex; align-items:center; justify-content:center; cursor:pointer; margin:0; padding:0; line-height:1; z-index:1000; font-weight:bold; transition:all 0.15s;';
            closeBtn.onmouseover = function () { 
                closeBtn.style.background = '#a83232'; 
                closeBtn.style.color = '#fff'; 
                closeBtn.style.borderColor = '#a83232'; 
            };
            closeBtn.onmouseout = function () { 
                closeBtn.style.background = '#222'; 
                closeBtn.style.color = '#aaa'; 
                closeBtn.style.borderColor = '#444'; 
            };
        }

        // List of modals with highly customized layout structures that must NOT be dynamically restructured
        const customModals = [
            'cosmetics-modal', 
            'lobby-browser-modal', 
            'coop-modal', 
            'settings-modal', 
            'solo-deployment-modal', 
            'leaderboard-modal'
        ];
        
        if (customModals.includes(modal.id)) {
            return; // Skip structural wrapper modifications for these custom layouts
        }
        
        // Simple vertical lists (ach-modal, gun-modal, bosses-modal) get wrapped
        let listContainer = modal.querySelector('#ach-list, #gun-list, #bosses-list, #player-list');
        
        if (!listContainer) {
            let scrollWrapper = document.createElement('div');
            scrollWrapper.style.cssText = 'overflow-y:auto; flex:1; width:100%; box-sizing:border-box; padding-right:5px; margin-top:10px; margin-bottom:10px;';
            Array.from(modal.childNodes).forEach(function (child) {
                if (child !== title && child !== closeBtn && !child.classList?.contains('close-btn-top') && child.tagName !== 'STYLE') {
                    scrollWrapper.appendChild(child);
                }
            });
            modal.appendChild(scrollWrapper);
        } else {
            listContainer.style.overflowY = 'auto';
            listContainer.style.flex = '1';
            listContainer.style.width = '100%';
            listContainer.style.boxSizing = 'border-box';
            listContainer.style.marginTop = '10px';
            listContainer.style.marginBottom = '10px';
        }
    });
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
    
    if (killsEl) {
        killsEl.innerText = saveData.kills;
    }
    if (roundEl) {
        roundEl.innerText = saveData.highestRound;
    }
    if (levelEl) {
        levelEl.innerText = localLvl;
    }
    if (coinsEl) {
        coinsEl.innerText = localCoins + " 🪙";
    }
    if (xpBarEl) {
        xpBarEl.style.width = percent + "%";
    }
    if (xpTextEl) {
        xpTextEl.innerText = `${currentXPInLevel} / 1000 XP`;
    }
}

/* --- MOBILE & JOYSTICK CONTROLS --- */
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
    let rightTouchId = null;
    let rightStartPos = { x: 0, y: 0 };
    
    stickLeft.addEventListener('touchstart', function (e) {
        e.preventDefault(); 
        if (leftTouchId !== null) return; 
        if (me) me.isTouch = true;
        const touch = e.changedTouches[0]; 
        leftTouchId = touch.identifier;
        const rect = stickLeft.getBoundingClientRect(); 
        leftStartPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        isMovingTouch = true; 
        handleLeftMove(touch.clientX, touch.clientY);
    });
    
    stickLeft.addEventListener('touchmove', function (e) {
        e.preventDefault(); 
        if (leftTouchId === null) return;
        for (let t of e.changedTouches) { 
            if (t.identifier === leftTouchId) {
                handleLeftMove(t.clientX, t.clientY); 
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
        }
        knobLeft.style.transform = `translate(${dx}px, ${dy}px)`;
        touchMoveVector = { x: dx / maxRadius, y: dy / maxRadius };
    }
    
    const endLeft = function (e) {
        e.preventDefault();
        for (let t of e.changedTouches) {
            if (t.identifier === leftTouchId) { 
                leftTouchId = null; 
                isMovingTouch = false; 
                knobLeft.style.transform = `translate(0px, 0px)`; 
                touchMoveVector = { x: 0, y: 0 }; 
            }
        }
    };
    
    stickLeft.addEventListener('touchend', endLeft); 
    stickLeft.addEventListener('touchcancel', endLeft);

    stickRight.addEventListener('touchstart', function (e) {
        e.preventDefault(); 
        if (rightTouchId !== null) return; 
        if (me) me.isTouch = true;
        const touch = e.changedTouches[0]; 
        rightTouchId = touch.identifier;
        const rect = stickRight.getBoundingClientRect(); 
        rightStartPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        isAimingTouch = true; 
        handleRightMove(touch.clientX, touch.clientY);
    });
    
    stickRight.addEventListener('touchmove', function (e) {
        e.preventDefault(); 
        if (rightTouchId === null) return;
        for (let t of e.changedTouches) { 
            if (t.identifier === rightTouchId) {
                handleRightMove(t.clientX, t.clientY); 
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
            touchAimVector = { x: dx / dist, y: dy / dist }; 
            if (me) me.angle = Math.atan2(dy, dx);
            mouse.down = (dist > maxRadius * 0.40);
        } else { 
            mouse.down = false; 
            mouse.pressHandled = false; 
        }
    }
    
    const endRight = function (e) {
        e.preventDefault();
        for (let t of e.changedTouches) {
            if (t.identifier === rightTouchId) { 
                rightTouchId = null; 
                isAimingTouch = false; 
                knobRight.style.transform = `translate(0px, 0px)`; 
                mouse.down = false; 
                mouse.pressHandled = false; 
            }
        }
    };
    
    stickRight.addEventListener('touchend', endRight); 
    stickRight.addEventListener('touchcancel', endRight);

    document.getElementById('btn-touch-interact').addEventListener('touchstart', function (e) { 
        e.preventDefault(); 
        if (me) me.isTouch = true; 
        if (gameActive) handleInteractAction(); 
    });
    
    document.getElementById('btn-touch-reload').addEventListener('touchstart', function (e) { 
        e.preventDefault(); 
        if (me) me.isTouch = true; 
        if (gameActive) handleReload(); 
    });
    
    document.getElementById('btn-touch-switch').addEventListener('touchstart', function (e) {
        e.preventDefault(); 
        if (me) me.isTouch = true;
        if (gameActive && me && me.inventory.length > 1) {
            me.weapIdx = (me.weapIdx + 1) % me.inventory.length;
            addText(me.x, me.y - 40, me.inventory[me.weapIdx].name, "#fff");
            if (Network.mode === 'CLIENT') {
                Network.sendClientData(me); 
            }
        }
    });
}

/* --- UI MODAL DRAWING --- */
window.openMenu = function (id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'flex'; // Fixes display rules from block to flex
    }
    if (id === 'ach-modal') renderAchievements();
    if (id === 'gun-modal') renderGunLibrary();
    if (id === 'cosmetics-modal') { 
        renderCosmeticShop(); 
        startCosmeticPreviewLoop(); 
    }
    if (id === 'lobby-browser-modal') refreshServerBrowser();
    if (id === 'bosses-modal') renderBossesMenu();
};

window.closeMenu = function (id) { 
    document.getElementById(id).style.display = 'none'; 
    if (id === 'cosmetics-modal' && previewAnimFrame) { 
        cancelAnimationFrame(previewAnimFrame); 
        previewAnimFrame = null; 
    }
};

function renderAchievements() {
    const list = document.getElementById('ach-list'); 
    list.innerHTML = "";
    achievements.forEach(function (a) {
        let unlocked = saveData.unlockedAch.includes(a.id);
        list.innerHTML += `<div class="list-item ${unlocked ? 'unlocked' : ''}"><div><div class="item-title">${a.name}</div><div class="item-desc">${a.desc}</div></div><div style="font-size:24px;">${unlocked ? a.icon : '🔒'}</div></div>`;
    });
}

function renderGunLibrary() {
    const list = document.getElementById('gun-list'); 
    list.innerHTML = "";
    weaponDB.forEach(function (w) {
        let unlocked = saveData.unlockedGuns.includes(w.name);
        list.innerHTML += `<div class="list-item ${unlocked ? 'unlocked' : ''}"><div><div class="item-title">${unlocked ? w.name : '???'}</div><div class="item-desc">${unlocked ? (w.type.toUpperCase() + " | DMG: " + w.dmg) : 'Locked'}</div></div><div style="color:${w.color}; font-size:24px;">${unlocked ? '🔫' : '❓'}</div></div>`;
    });
}

function showToast(ach) { 
    const c = document.getElementById('ach-toast-container');
    const d = document.createElement('div'); 
    d.className = 'ach-toast'; 
    d.innerHTML = `<div class="ach-header">UNLOCKED</div><div class="ach-body"><span>${ach.icon}</span> <span>${ach.name}</span></div>`; 
    c.appendChild(d); 
    setTimeout(function () {
        d.remove();
    }, 5000); 
}

function checkAchievements() { 
    achievements.forEach(function (a) { 
        if (me && a.check(stats, me)) { 
            if (unlockAch(a.id)) {
                showToast(a); 
            }
        } 
    }); 
}

function renderCosmeticShop() {
    const list = document.getElementById('cosmetics-list'); 
    list.innerHTML = "";
    if (!saveData.ownedCosmetics) {
        saveData.ownedCosmetics = ['none'];
    }
    if (!saveData.equippedCosmetic) {
        saveData.equippedCosmetic = 'none';
    }
    resetPreviewCosmetic();
    
    const isEquippedNone = saveData.equippedCosmetic === 'none';
    list.innerHTML += `
        <div class="list-item ${isEquippedNone ? 'unlocked' : ''}" style="border-left-color:#555;" onmouseover="setPreviewCosmetic('none')" onmouseout="resetPreviewCosmetic()">
            <div><div class="item-title">Unequip All</div><div class="item-desc">Clear your back slot</div></div>
            <div>${isEquippedNone ? '<span style="color:#2ecc71; font-weight:bold; font-size:14px;">EQUIPPED</span>' : '<button onclick="equipCosmetic(\'none\')" style="width:auto; padding:6px 12px; font-size:12px; margin:0; background:#222;">Equip</button>'}</div>
        </div>
    `;
    cosmeticDB.forEach(function (c) {
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
            <div class="list-item ${isOwned ? 'unlocked' : ''}" style="border-left-color:${c.color};" onmouseover="setPreviewCosmetic('${c.id}')" onmouseout="resetPreviewCosmetic()">
                <div><div class="item-title" style="color:${c.color}">${c.name}</div><div class="item-desc">Style: ${c.type.toUpperCase()}</div></div>
                <div style="display:flex; align-items:center; gap:10px;">${actionHtml}</div>
            </div>
        `;
    });
}

window.setPreviewCosmetic = function (id) {
    window.previewCosmeticId = id; 
    const item = cosmeticDB.find(c => c.id === id);
    const label = document.getElementById('cosmetic-preview-name');
    if (label) { 
        label.innerText = item ? item.name : "Unequipped"; 
        label.style.color = item ? item.color : "#666"; 
    }
};

window.resetPreviewCosmetic = function () {
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
        if (document.getElementById('cosmetics-modal').style.display !== 'flex') { 
            cancelAnimationFrame(previewAnimFrame); 
            previewAnimFrame = null; 
            return; 
        }
        previewCtx.clearRect(0, 0, canvas.width, canvas.height);
        previewCtx.strokeStyle = 'rgba(255, 255, 255, 0.025)'; 
        previewCtx.lineWidth = 1; 
        previewCtx.beginPath(); 
        previewCtx.arc(70, 70, 45, 0, Math.PI * 2); 
        previewCtx.arc(70, 70, 25, 0, Math.PI * 2); 
        previewCtx.stroke();
        
        previewCtx.save(); 
        previewCtx.translate(70, 70); 
        previewAngle += 0.015; 
        previewCtx.rotate(previewAngle);
        
        const currentPreviewId = window.previewCosmeticId || saveData.equippedCosmetic || 'none';
        const radius = 22;
        const cosObj = currentPreviewId !== 'none' ? cosmeticDB.find(c => c.id === currentPreviewId) : null;
        
        if (cosObj && cosObj.type !== 'halo' && typeof drawBackCosmetic === 'function') {
            drawBackCosmetic(currentPreviewId, radius, previewCtx);
        }
        
        previewCtx.fillStyle = '#3498db'; 
        previewCtx.strokeStyle = '#000000'; 
        previewCtx.lineWidth = 2.5; 
        previewCtx.beginPath(); 
        previewCtx.arc(0, 0, radius, 0, Math.PI * 2); 
        previewCtx.fill(); 
        previewCtx.stroke();
        
        previewCtx.fillStyle = '#999'; 
        previewCtx.fillRect(0, -5, 30, 10); 
        previewCtx.strokeStyle = '#000000'; 
        previewCtx.lineWidth = 2.5; 
        previewCtx.strokeRect(0, -5, 30, 10);
        
        if (cosObj && cosObj.type === 'halo' && typeof drawBackCosmetic === 'function') {
            drawBackCosmetic(currentPreviewId, radius, previewCtx);
        }
        
        previewCtx.restore(); 
        previewAnimFrame = requestAnimationFrame(drawPreviewFrame);
    }
    
    if (previewAnimFrame) {
        cancelAnimationFrame(previewAnimFrame);
    }
    previewAnimFrame = requestAnimationFrame(drawPreviewFrame);
}

window.buyCosmetic = function (id) {
    const item = cosmeticDB.find(c => c.id === id); 
    if (!item) return;
    if (saveData.lobbyCoins >= item.price && !saveData.ownedCosmetics.includes(id)) {
        saveData.lobbyCoins -= item.price; 
        saveData.ownedCosmetics.push(id); 
        saveData.equippedCosmetic = id;
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

window.equipCosmetic = function (id) {
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

/* --- MULTIPLAYER SERVER & HANDSHAKE HANDLERS --- */
const LobbyManager = {
    heartbeatInterval: null,
    registerLobby: async function (peerId) {
        if (typeof db === 'undefined' || !db) return;
        const myLvl = Math.floor((saveData.xp || 0) / 1000) + 1;
        const selectVis = document.getElementById('lobby-visibility-select');
        const visibility = selectVis ? selectVis.value : 'public';
        try {
            await db.collection("lobbies").doc(peerId).set({
                peerId: peerId, 
                hostName: myUsername, 
                hostLevel: myLvl, 
                mapIndex: stats.selectedMapIdx, 
                difficulty: stats.difficulty || 'medium',
                visibility: visibility, 
                playerCount: Object.values(window.lobbyPlayers).filter(p => p !== "").length, 
                maxPlayers: 4, 
                status: 'LOBBY', 
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.startHeartbeat(peerId);
        } catch(e) { 
            console.warn("Lobby register failed:", e); 
        }
    },
    startHeartbeat: function (peerId) {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(async () => {
            if (typeof db === 'undefined' || !db || Network.mode !== 'HOST') { 
                this.stopHeartbeat(); 
                return; 
            }
            const selectVis = document.getElementById('lobby-visibility-select');
            const visibility = selectVis ? selectVis.value : 'public';
            try {
                await db.collection("lobbies").doc(peerId).update({
                    playerCount: Object.values(window.lobbyPlayers).filter(p => p !== "").length,
                    mapIndex: stats.selectedMapIdx, 
                    difficulty: stats.difficulty || 'medium', 
                    visibility: visibility, 
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch(e) { 
                console.warn("Lobby heartbeat failed:", e); 
            }
        }, 15000);
    },
    updateLobbyVisibility: async function (visibility) {
        if (typeof db === 'undefined' || !db || Network.mode !== 'HOST') return;
        try { 
            await db.collection("lobbies").doc(Network.peer.id).update({ 
                visibility: visibility, 
                lastActive: firebase.firestore.FieldValue.serverTimestamp() 
            }); 
        } catch(e) { 
            console.warn("Visibility sync fail:", e); 
        }
    },
    stopHeartbeat: function () { 
        if (this.heartbeatInterval) { 
            clearInterval(this.heartbeatInterval); 
            this.heartbeatInterval = null; 
        } 
    },
    unregisterLobby: async function (peerId) { 
        this.stopHeartbeat(); 
        if (typeof db === 'undefined' || !db || !peerId) return; 
        try { 
            await db.collection("lobbies").doc(peerId).delete(); 
        } catch(e){} 
    },
    fetchLobbies: async function (callback) {
        if (typeof db === 'undefined' || !db) {
            if (callback) callback([]);
            return;
        }
        try {
            const now = new Date();
            const threshold = new Date(now.getTime() - 45000);
            
            const snap = await db.collection("lobbies")
                .where("visibility", "==", "public")
                .get();
            
            let lobbies = [];
            snap.forEach(function (doc) {
                const data = doc.data();
                if (data.lastActive) {
                    let ms = 0;
                    if (typeof data.lastActive.toMillis === 'function') {
                        ms = data.lastActive.toMillis();
                    } else if (data.lastActive instanceof Date) {
                        ms = data.lastActive.getTime();
                    } else if (typeof data.lastActive === 'number') {
                        ms = data.lastActive;
                    } else if (data.lastActive.seconds) {
                        ms = data.lastActive.seconds * 1000;
                    }
                    
                    if (ms >= threshold.getTime()) {
                        lobbies.push(data);
                    }
                }
            });
            
            lobbies.sort((a, b) => (b.playerCount || 0) - (a.playerCount || 0));
            if (callback) callback(lobbies);
        } catch(e) {
            console.warn("Failed to fetch lobbies from Firestore:", e);
            if (callback) callback([]);
        }
    }
};

window.lobbyChangeVisibility = function () {
    const select = document.getElementById('lobby-visibility-select'); 
    if (!select) return;
    if (Network.mode === 'HOST') {
        LobbyManager.updateLobbyVisibility(select.value);
        try { 
            Network.broadcastToAll({ type: 'LOBBY_VISIBILITY_CHANGE', visibility: select.value }); 
        } catch(e){}
    }
};

window.kickPlayer = function (pId) {
    if (Network.mode !== 'HOST') return;
    const conn = Network.conns.find(c => c.playerId === pId);
    if (conn) { 
        try { 
            conn.send({ type: 'KICK_BY_HOST' }); 
        } catch(e){} 
        setTimeout(function () { 
            try { 
                conn.close(); 
            } catch(e){} 
        }, 100); 
    }
    window.lobbyPlayers[pId] = ""; 
    updateLobbyPlayersList(); 
    Network.broadcastToAll({ type: 'LOBBY_UPDATE', lobbyPlayers: window.lobbyPlayers });
};

window.refreshServerBrowser = function () {
    const list = document.getElementById('lobby-browser-list');
    const noLobbies = document.getElementById('no-lobbies-msg'); 
    if (!list) return;
    list.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#888;">Scanning active public lobbies...</td></tr>`;
    if (noLobbies) noLobbies.style.display = 'none';
    
    LobbyManager.fetchLobbies(function (lobbies) {
        list.innerHTML = "";
        if (lobbies.length === 0) { 
            if (noLobbies) noLobbies.style.display = 'block'; 
            return; 
        }
        lobbies.forEach(function (lobby) {
            let mapName = "Facility"; 
            if (lobby.mapIndex === 1) {
                mapName = "Bunker"; 
            } else if (lobby.mapIndex === 2) {
                mapName = "Sector-9";
            }
            list.innerHTML += `
                <tr style="border-bottom:1px solid #222;">
                    <td style="padding:10px; color:#3498db; font-weight:bold;">${lobby.hostName || "Host"} <span style="color:#ffd700; font-size:10px;">[Lv.${lobby.hostLevel || 1}]</span></td>
                    <td style="padding:10px; color:#ccc;">${mapName}</td>
                    <td style="padding:10px; color:#e67e22; font-weight:bold;">${lobby.difficulty ? lobby.difficulty.toUpperCase() : "MEDIUM"}</td>
                    <td style="padding:10px; color:#666;">${lobby.playerCount || 1} / ${lobby.maxPlayers || 4}</td>
                    <td style="padding:10px; text-align:right;"><button onclick="joinServerBrowserLobby('${lobby.peerId}')" style="width:auto; margin:0; padding:5px 12px; font-size:12px; background:#a83232; color:#fff; border:none; border-radius:3px;">Connect</button></td>
                </tr>
            `;
        });
    });
};

window.joinServerBrowserLobby = function (peerId) { 
    closeMenu('lobby-browser-modal'); 
    enterLobbyJoinManual(peerId); 
};

window.manualJoinLobby = function () { 
    let id = document.getElementById('manual-join-input').value.trim(); 
    if (!id) return alert("Enter code"); 
    closeMenu('lobby-browser-modal'); 
    enterLobbyJoinManual(id); 
};

function enterLobbyJoinManual(id) {
    if (!validateOnlineName()) return;
    document.getElementById('lobby-status').innerText = "Connecting...";
    document.getElementById('main-menu').style.display = 'none'; 
    document.getElementById('lobby-screen').style.display = 'flex'; 
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('host-id-display').innerText = "ID: " + id;
    
    document.getElementById('lobby-map-select').style.display = 'none';
    document.getElementById('lobby-map-display-client').style.display = 'block';
    document.getElementById('lobby-diff-select').style.display = 'none';
    document.getElementById('lobby-diff-display-client').style.display = 'block';
    document.getElementById('lobby-visibility-select').style.display = 'none';
    document.getElementById('lobby-visibility-display-client').style.display = 'block';

    let nameInput = document.getElementById('username-input'); 
    myUsername = nameInput ? nameInput.value || "Survivor" : "Survivor";
    window.lobbyPlayers = { p1: "Host [Lv. ?]", p2: "", p3: "", p4: "" }; 
    updateLobbyPlayersList();
    Network.init(function () { 
        Network.join(id, function () { 
            document.getElementById('lobby-status').innerText = "Connected! Ready to deploy."; 
        }); 
    });
}

function renderBossesMenu() {
    const list = document.getElementById('bosses-list'); 
    if (!list) return; 
    list.innerHTML = "";
    bossesDB.forEach(function (b) {
        const unlocked = saveData.unlockedBosses && saveData.unlockedBosses.includes(b.id);
        const defeated = saveData.defeatedBosses && saveData.defeatedBosses.includes(b.id);
        list.innerHTML += `
            <div class="list-item ${unlocked ? 'unlocked' : ''}" style="border-left-color:${unlocked ? b.color : '#333'}">
                <div style="flex:1; padding-right:15px;">
                    <div class="item-title" style="color:${unlocked ? b.color : '#666'}">${unlocked ? b.name : "???"} <span style="font-size:11px; color:#888;">(Round ${b.round})</span></div>
                    <div class="item-desc" style="font-size:12px; color:#aaa; margin-top:5px; line-height:1.4;">${unlocked ? b.desc : `Reach Round ${b.round} to unlock portfolio log.`}</div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:90px; gap:8px;">
                    <canvas id="boss-canvas-${b.id}" width="60" height="60" style="background:#111; border:1px solid #2d2d2d; border-radius:50%; width:50px; height:50px; display:block;"></canvas>
                    <div>${defeated ? '<span style="color:#2ecc71; font-weight:bold; font-size:13px;">🏆 SLAYED</span>' : (unlocked ? '<span style="color:#f1c40f; font-weight:bold; font-size:13px;">💀 ENCOUNTERED</span>' : '<span style="color:#666; font-weight:bold; font-size:13px;">🔒 LOCKED</span>')}</div>
                </div>
            </div>
        `;
    });

    bossesDB.forEach(function (b) {
        const unlocked = saveData.unlockedBosses && saveData.unlockedBosses.includes(b.id);
        const cv = document.getElementById(`boss-canvas-${b.id}`);
        if (!cv) return;
        const c = cv.getContext('2d');
        c.clearRect(0, 0, 60, 60);

        if (!unlocked) {
            c.fillStyle = '#222';
            c.strokeStyle = '#333';
            c.lineWidth = 2.5;
            c.beginPath(); 
            c.arc(30, 30, 16, 0, Math.PI * 2); 
            c.fill(); 
            c.stroke();
            
            c.fillStyle = '#444';
            c.fillRect(25, 28, 10, 8);
            c.strokeStyle = '#444';
            c.lineWidth = 1.5;
            c.beginPath(); 
            c.arc(30, 28, 4, Math.PI, 0); 
            c.stroke();
        } else {
            if (b.id === 'boss_logbreaker') {
                c.fillStyle = '#ffffff';
                c.beginPath(); 
                c.arc(30, 30, 18, 0, Math.PI*2); 
                c.fill();
                c.strokeStyle = '#000'; 
                c.lineWidth = 2.5; 
                c.stroke();
                
                c.strokeStyle = 'rgba(0,0,0,0.5)'; 
                c.lineWidth = 2.5;
                c.beginPath();
                c.moveTo(30 - 8, 30 - 8); 
                c.lineTo(30 + 8, 30 + 8);
                c.moveTo(30 + 8, 30 - 8); 
                c.lineTo(30 - 8, 30 + 8);
                c.stroke();

                c.fillStyle = '#f00'; 
                c.strokeStyle = '#000'; 
                c.lineWidth = 1;
                c.beginPath(); 
                c.arc(30 - 5, 30 - 5, 2.5, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
                c.beginPath(); 
                c.arc(30 + 5, 30 - 5, 2.5, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
            } else if (b.id === 'boss_blink') {
                c.fillStyle = '#9b59b6';
                c.beginPath(); 
                c.arc(30, 30, 16, 0, Math.PI*2); 
                c.fill();
                c.strokeStyle = '#000'; 
                c.lineWidth = 2.5; 
                c.stroke();

                c.fillStyle = '#00ffff'; 
                c.strokeStyle = '#000'; 
                c.lineWidth = 1;
                c.beginPath(); 
                c.arc(30 - 5, 30 - 2, 2.5, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
                c.beginPath(); 
                c.arc(30 + 5, 30 - 2, 2.5, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
                c.beginPath(); 
                c.arc(30, 30 - 8, 2.8, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
            } else if (b.id === 'boss_miasma') {
                let grad = c.createRadialGradient(30, 30, 2, 30, 30, 28);
                grad.addColorStop(0, 'rgba(39, 174, 96, 0.6)');
                grad.addColorStop(1, 'rgba(39, 174, 96, 0)');
                c.fillStyle = grad;
                c.beginPath(); 
                c.arc(30, 30, 28, 0, Math.PI*2); 
                c.fill();

                c.fillStyle = '#27ae60';
                c.beginPath(); 
                c.arc(30, 30, 16, 0, Math.PI*2); 
                c.fill();
                c.strokeStyle = '#000'; 
                c.lineWidth = 2.5; 
                c.stroke();

                c.fillStyle = '#f00'; 
                c.strokeStyle = '#000'; 
                c.lineWidth = 1;
                c.beginPath(); 
                c.arc(30 - 5, 30 - 5, 2.5, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
                c.beginPath(); 
                c.arc(30 + 5, 30 - 5, 2.5, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
            } else if (b.id === 'boss_rampager') {
                c.fillStyle = '#e74c3c';
                c.beginPath(); 
                c.arc(30, 30, 18, 0, Math.PI*2); 
                c.fill();
                c.strokeStyle = '#000'; 
                c.lineWidth = 2.5; 
                c.stroke();

                c.strokeStyle = '#7f8c8d'; 
                c.lineWidth = 3;
                c.beginPath(); 
                c.arc(30, 30, 13, 0, Math.PI, true); 
                c.stroke();

                c.fillStyle = '#fff'; 
                c.strokeStyle = '#000'; 
                c.lineWidth = 1.5;
                c.beginPath(); 
                c.moveTo(30 - 8, 30 - 10); 
                c.lineTo(30 - 15, 30 - 18); 
                c.lineTo(30 - 4, 30 - 12); 
                c.fill(); 
                c.stroke();
                
                c.beginPath(); 
                c.moveTo(30 + 8, 30 - 10); 
                c.lineTo(30 + 15, 30 - 18); 
                c.lineTo(30 + 4, 30 - 12); 
                c.fill(); 
                c.stroke();

                c.fillStyle = '#f00'; 
                c.strokeStyle = '#000'; 
                c.lineWidth = 1;
                c.beginPath(); 
                c.arc(30 - 5, 30 - 5, 2.5, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
                c.beginPath(); 
                c.arc(30 + 5, 30 - 5, 2.5, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
            } else if (b.id === 'boss_decayer') {
                c.fillStyle = '#2ecc71';
                c.beginPath(); 
                c.arc(30, 30, 16, 0, Math.PI*2); 
                c.fill();
                c.strokeStyle = '#000'; 
                c.lineWidth = 2.5; 
                c.stroke();

                c.fillStyle = 'rgba(46, 204, 113, 0.6)';
                c.beginPath(); 
                c.arc(30 - 5, 30 + 5, 4, 0, Math.PI*2); 
                c.arc(30 + 6, 30 - 6, 3.5, 0, Math.PI*2); 
                c.fill();

                c.fillStyle = '#f00'; 
                c.strokeStyle = '#000'; 
                c.lineWidth = 1;
                c.beginPath(); 
                c.arc(30 - 5, 30 - 5, 2.5, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
                c.beginPath(); 
                c.arc(30 + 5, 30 - 5, 2.5, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
            } else if (b.id === 'boss_pyromaniac') {
                c.fillStyle = '#d35400';
                c.beginPath(); 
                c.arc(30, 30, 17, 0, Math.PI*2); 
                c.fill();
                c.strokeStyle = '#000'; 
                c.lineWidth = 2.5; 
                c.stroke();

                c.fillStyle = '#e67e22';
                c.beginPath(); 
                c.arc(30, 30, 11, 0, Math.PI*2); 
                c.fill();
                c.fillStyle = '#f1c40f';
                c.beginPath(); 
                c.arc(30, 30, 6, 0, Math.PI*2); 
                c.fill();

                c.fillStyle = '#f00'; 
                c.strokeStyle = '#000'; 
                c.lineWidth = 1;
                c.beginPath(); 
                c.arc(30 - 5, 30 - 5, 2.5, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
                c.beginPath(); 
                c.arc(30 + 5, 30 - 5, 2.5, 0, Math.PI*2); 
                c.fill(); 
                c.stroke();
            }
        }
    });
}

function saveLocalUsername() { 
    let name = document.getElementById('username-input'); 
    if (name && name.value.trim()) {
        localStorage.setItem('zombieUsername', name.value.trim()); 
    }
}

function validateOnlineName() {
    let name = document.getElementById('username-input');
    if (!name || !name.value.trim()) {
        if (name) { 
            name.classList.remove('shake-anim'); 
            void name.offsetWidth; 
            name.classList.add('shake-anim'); 
            name.focus(); 
        }
        return false;
    }
    saveLocalUsername(); 
    return true;
}

function startOffline() { 
    openSoloDeploymentConsole(); 
}

/* --- SOLO MAP CONSOLE & LEADERBOARDS --- */
window.openSoloDeploymentConsole = function () {
    selectedSoloMapIdx = 0; 
    selectedSoloDifficulty = 'medium';
    [0, 1, 2].forEach(function (idx) {
        const el = document.getElementById(`solo-card-${idx}`);
        if (el) { 
            el.classList.remove('selected'); 
            if (idx === 0) {
                el.classList.add('selected'); 
            }
        }
    });
    ['easy', 'medium', 'hard'].forEach(function (d) {
        const el = document.getElementById(`solo-diff-card-${d}`);
        if (el) { 
            el.classList.remove('selected'); 
            if (d === 'medium') {
                el.classList.add('selected'); 
            }
        }
    });
    openMenu('solo-deployment-modal');
};

window.selectSoloMap = function (mapIdx) {
    selectedSoloMapIdx = mapIdx;
    [0, 1, 2].forEach(function (idx) {
        const el = document.getElementById(`solo-card-${idx}`);
        if (el) { 
            el.classList.remove('selected'); 
            if (idx === mapIdx) {
                el.classList.add('selected'); 
            }
        }
    });
};

window.selectSoloDifficulty = function (diffLevel) {
    selectedSoloDifficulty = diffLevel;
    ['easy', 'medium', 'hard'].forEach(function (d) {
        const el = document.getElementById(`solo-diff-card-${d}`);
        if (el) { 
            el.classList.remove('selected'); 
            if (d === diffLevel) {
                el.classList.add('selected'); 
            }
        }
    });
};

window.deploySoloOffline = function () {
    closeMenu('solo-deployment-modal');
    Network.mode = 'OFFLINE'; 
    window.myPlayerId = 'p1'; 
    window.lobbyPlayers = { p1: "Survivor", p2: "", p3: "", p4: "" };
    stats.difficulty = selectedSoloDifficulty; 
    activeMap = playableMaps[selectedSoloMapIdx];
    saveLocalUsername(); 
    launchGame();
};

window.updateSystemVolume = function (val) {
    if (typeof SoundSystem !== 'undefined') {
        SoundSystem.volume = parseFloat(val);
        const percentText = document.getElementById('settings-volume-percent');
        if (percentText) {
            percentText.innerText = Math.round(parseFloat(val) * 100) + "%";
        }
    }
};

window.toggleSystemAudio = function (checked) {
    if (typeof SoundSystem !== 'undefined') {
        SoundSystem.enabled = checked;
        const knob = document.getElementById('toggle-knob');
        if (knob) {
            knob.style.transform = checked ? 'translateX(21px)' : 'translateX(0px)';
        }
    }
};

window.openGlobalLeaderboardConsole = function () {
    if (typeof AccountSystem !== 'undefined' && typeof AccountSystem.fetchLeaderboard === 'function') {
        AccountSystem.fetchLeaderboard();
    }
    openMenu('leaderboard-modal');
};

function startLocalCoop() {
    p2InputConfig = document.getElementById('p2-input-select').value; 
    closeMenu('coop-modal');
    Network.mode = 'LOCAL_COOP'; 
    window.myPlayerId = 'p1'; 
    window.lobbyPlayers = { p1: "Survivor", p2: "Player 2 [Lv. 1]", p3: "", p4: "" };
    stats.difficulty = document.getElementById('menu-diff-select') ? document.getElementById('menu-diff-select').value : "medium";
    saveLocalUsername(); 
    activeMap = playableMaps[document.getElementById('map-select') ? parseInt(document.getElementById('map-select').value) : 0];
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
    stats.selectedMapIdx = document.getElementById('map-select') ? parseInt(document.getElementById('map-select').value) : 0; 
    stats.difficulty = "medium";
    
    if (document.getElementById('lobby-map-select')) {
        document.getElementById('lobby-map-select').value = stats.selectedMapIdx;
    }
    if (document.getElementById('lobby-diff-select')) {
        document.getElementById('lobby-diff-select').value = stats.difficulty;
    }
    
    document.getElementById('lobby-map-select').style.display = 'block'; 
    document.getElementById('lobby-map-display-client').style.display = 'none';
    document.getElementById('lobby-diff-select').style.display = 'block'; 
    document.getElementById('lobby-diff-display-client').style.display = 'none';
    document.getElementById('lobby-visibility-select').style.display = 'block'; 
    document.getElementById('lobby-visibility-display-client').style.display = 'none';
    document.getElementById('lobby-visibility-select').value = 'public';

    myUsername = (document.getElementById('username-input').value || "Survivor").substring(0, 12);
    const myLvl = Math.floor((saveData.xp || 0) / 1000) + 1;
    window.myPlayerId = 'p1'; 
    window.lobbyPlayers = { p1: myUsername + " [Lv. " + myLvl + "]", p2: "", p3: "", p4: "" }; 
    updateLobbyPlayersList();
    
    document.getElementById('main-menu').style.display = 'none'; 
    document.getElementById('lobby-screen').style.display = 'flex';
    Network.mode = 'HOST'; 
    Network.init(function (id) { 
        document.getElementById('host-id-display').innerText = id; 
        if (typeof LobbyManager !== 'undefined') {
            LobbyManager.registerLobby(id); 
        }
    });
}

function enterLobbyJoin() {
    if (!validateOnlineName()) return;
    let id = document.getElementById('join-input').value; 
    if (!id) return alert("Enter Host ID");
    document.getElementById('lobby-status').innerText = "Connecting...";
    document.getElementById('main-menu').style.display = 'none'; 
    document.getElementById('lobby-screen').style.display = 'flex'; 
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('host-id-display').innerText = "ID: " + id;
    
    document.getElementById('lobby-map-select').style.display = 'none'; 
    document.getElementById('lobby-map-display-client').style.display = 'block';
    document.getElementById('lobby-diff-select').style.display = 'none'; 
    document.getElementById('lobby-diff-display-client').style.display = 'block';
    document.getElementById('lobby-visibility-select').style.display = 'none'; 
    document.getElementById('lobby-visibility-display-client').style.display = 'block';

    myUsername = (document.getElementById('username-input').value || "Survivor").substring(0, 12);
    window.lobbyPlayers = { p1: "Host [Lv. ?]", p2: "", p3: "", p4: "" }; 
    updateLobbyPlayersList();
    Network.init(function () { 
        Network.join(id, function () { 
            document.getElementById('lobby-status').innerText = "Ready to Deploy!"; 
        }); 
    });
}

function lobbyChangeMap() {
    const select = document.getElementById('lobby-map-select'); 
    if (!select) return;
    stats.selectedMapIdx = parseInt(select.value);
    if (Network.mode === 'HOST') { 
        try { 
            Network.broadcastToAll({ type: 'LOBBY_MAP_CHANGE', mapIndex: stats.selectedMapIdx }); 
        } catch(e){} 
    }
}

function lobbyChangeDifficulty() {
    const select = document.getElementById('lobby-diff-select'); 
    if (!select) return;
    stats.difficulty = select.value;
    if (Network.mode === 'HOST') { 
        try { 
            Network.broadcastToAll({ type: 'LOBBY_DIFF_CHANGE', difficulty: stats.difficulty }); 
        } catch(e){} 
    }
}

function updateLobbyPlayersList() {
    const listEl = document.getElementById('player-list'); 
    if (!listEl) return;
    let html = `<div style="text-align:left; background:rgba(255,255,255,0.05); padding:15px; border:1px solid #333; border-radius:4px; min-width:280px; box-sizing:border-box;"><div style="border-bottom:1px solid #444; padding-bottom:5px; margin-bottom:10px; font-weight:bold; color:#a83232;">LOBBY survivors:</div>`;
    html += `<div style="color:#3498db; font-size:15px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;"><span>👑 P1 (Host): <strong>${window.lobbyPlayers.p1 || "Survivor"}</strong></span></div>`;
    ['p2', 'p3', 'p4'].forEach(function (pId, idx) {
        const pName = window.lobbyPlayers[pId];
        const pColor = getPlayerColor(pId);
        if (pName && pName !== "Reserved") {
            html += `<div style="color:${pColor}; font-size:15px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;"><span>👤 P${idx+2}: <strong>${pName}</strong></span>`;
            if (Network.mode === 'HOST') {
                html += `<button onclick="kickPlayer('${pId}')" style="width:auto; margin:0; padding:2px 8px; font-size:11px; background:#c0392b; color:#fff; border:1px solid #a83232; border-radius:3px; height:auto;">Kick</button>`;
            }
            html += `</div>`;
        } else if (pName === "Reserved") {
            html += `<div style="color:#888; font-size:14px; margin-bottom:5px; font-style:italic;">👤 P${idx+2}: Connecting...</div>`;
        } else {
            html += `<div style="color:#666; font-size:14px; margin-bottom:5px; font-style:italic;">👤 P${idx+2}: Open Slot</div>`;
        }
    });
    listEl.innerHTML = html + "</div>";
}

function updateLobbyUI(connected) { 
    if (connected) { 
        document.getElementById('lobby-status').style.color = '#0f0'; 
        document.getElementById('lobby-status').innerText = "PLAYERS CONNECTED!"; 
        document.getElementById('start-btn').disabled = false; 
        document.getElementById('start-btn').style.background = '#a83232'; 
    } 
}

function hostStartGame() { 
    try { 
        Network.broadcastToAll({ type: 'START', mapIndex: stats.selectedMapIdx }); 
    } catch(e){} 
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
    } else if (typeof Tutorial !== 'undefined') {
        Tutorial.end();
    }

    if (Network.mode === 'HOST' && Network.peer && typeof LobbyManager !== 'undefined') {
        LobbyManager.unregisterLobby(Network.peer.id);
    }
    resetSession();
    
    myUsername = (document.getElementById('username-input').value || "Survivor").substring(0, 12);
    const myLvl = Math.floor((saveData.xp || 0) / 1000) + 1;
    const displayName = myUsername + " [Lv. " + myLvl + "]";
    
    window.matchStartingXP = saveData.xp || 0;
    window.matchStartingCoins = saveData.lobbyCoins || 0;

    // Capture baseline discovered/defeated structures before run starts
    window.startingUnlockedBosses = [...(saveData.unlockedBosses || [])];
    window.startingDefeatedBosses = [...(saveData.defeatedBosses || [])];

    players = {};
    
    let spawnX = 200;
    let spawnY = 200;
    if (activeMap === playableMaps[0]) { 
        spawnX = 400; 
        spawnY = 400; 
    } else if (activeMap === playableMaps[1]) { 
        spawnX = 300; 
        spawnY = 300; 
    } else if (activeMap === playableMaps[2]) { 
        spawnX = 250; 
        spawnY = 250; 
    }
    
    if (Network.mode === 'CLIENT') {
        me = createPlayer(window.myPlayerId, spawnX, spawnY, getPlayerColor(window.myPlayerId), displayName); 
        players[window.myPlayerId] = me;
    } else {
        players['p1'] = createPlayer('p1', spawnX, spawnY, getPlayerColor('p1'), displayName); 
        me = players['p1'];
        if (Network.mode === 'HOST') {
            ['p2', 'p3', 'p4'].forEach(function (pId, idx) {
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
    if (Network.mode === 'CLIENT') return; 
    if (Network.mode === 'HOST') { 
        try { 
            Network.broadcastToAll({ type: 'START', mapIndex: stats.selectedMapIdx }); 
        } catch(e){} 
    }
    launchGame(); 
}

function createPlayer(id, x, y, color, name) { 
    const startingHp = (stats.difficulty === 'easy') ? 150 : 100;
    return { 
        id: id, 
        name: name, 
        x: x, 
        y: y, 
        r: 15, 
        hp: startingHp, 
        maxHp: startingHp, 
        state: 'ALIVE', 
        inventory: [{ ...weaponDB[0], clip: 8, ammo: 32 }], 
        weapIdx: 0, 
        angle: 0, 
        reloading: false, 
        reloadTimer: 0, 
        hasVigor: false, 
        reviveTimer: 0, 
        color: color, 
        kills: 0, 
        score: 500, 
        isShooting: false, 
        pressHandled: false, 
        lastRepairTime: 0,
        invincibleTimer: 0, 
        muzzleFlash: 0, 
        equippedCosmetic: (id === 'p1') ? (saveData.equippedCosmetic || 'none') : 'none', 
        isTouch: (id === window.myPlayerId) ? isTouchDevice : false
    }; 
}

function goToLobbyScreen() {
    gameActive = false; 
    if (animationFrameId) { 
        cancelAnimationFrame(animationFrameId); 
        animationFrameId = null; 
    }
    if (Network.mode === 'HOST' && Network.peer && typeof LobbyManager !== 'undefined') {
        LobbyManager.unregisterLobby(Network.peer.id);
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
        clientMapDisplay.innerText = (typeof playableMaps !== 'undefined' && playableMaps[stats.selectedMapIdx]) ? playableMaps[stats.selectedMapIdx].name : "Unknown Map";
    }
}

function copyHostId() {
    const display = document.getElementById('host-id-display'); 
    if (!display) return;
    let idText = display.innerText.replace("ID: ", "").trim(); 
    if (idText === "Generating..." || idText === "") return;
    if (navigator.clipboard && navigator.clipboard.writeText) { 
        navigator.clipboard.writeText(idText).then(function () {
            feedbackCopyButton();
        }).catch(function () {
            fallbackCopy(idText);
        }); 
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
        alert("Your Host ID is: " + text); 
    }
    document.body.removeChild(tempInput);
}

function feedbackCopyButton() {
    const btn = document.getElementById('copy-id-btn'); 
    if (btn) { 
        const orig = btn.innerHTML; 
        btn.innerHTML = "✅ Copied!"; 
        setTimeout(function () { 
            btn.innerHTML = orig; 
        }, 2000); 
    }
}

// Override updateUI to solve the weapon switching visual freeze bug in Solo and Tutorial modes
window.updateUI = function() {
    document.getElementById('round-box').innerText = stats.round;
    const bTimer = document.getElementById('boss-timer-box');
    if (bTimer) { 
        if (stats.round % 5 === 0) { 
            bTimer.innerText = "⚠️ BOSS ROUND ACTIVE!"; 
            bTimer.style.color = "#ff4757"; 
        } else { 
            bTimer.innerText = `Next Boss in: ${5 - (stats.round % 5)} Round(s)`; 
            bTimer.style.color = "#ffd700"; 
        } 
    }
    const badgeDouble = document.getElementById('badge-double'), badgeInsta = document.getElementById('badge-instakill');
    if (badgeDouble) badgeDouble.style.display = (window.doublePointsTimer > 0) ? 'block' : 'none';
    if (badgeInsta) badgeInsta.style.display = (window.instaKillTimer > 0) ? 'block' : 'none';

    if (me) {
        if (me.lastHp === undefined) me.lastHp = me.hp;
        if (me.hp < me.lastHp) {
            const flash = document.getElementById('damage-flash');
            if (flash) {
                flash.style.zIndex = "9999"; 
                flash.style.boxSizing = "border-box"; 
                flash.style.boxShadow = "inset 0 0 80px rgba(180, 0, 0, 0.9)"; 
                flash.style.border = "12px solid rgba(180, 0, 0, 0.7)"; 
                flash.style.background = "rgba(180, 0, 0, 0.15)";
                setTimeout(() => { 
                    flash.style.boxShadow = "none"; 
                    flash.style.border = "none"; 
                    flash.style.background = "transparent"; 
                }, 150);
            }
        }
        me.lastHp = me.hp;
    }

    ['p1', 'p2', 'p3', 'p4'].forEach(pId => {
        const p = players[pId], hud = document.getElementById('hud-' + pId);
        if (hud) {
            if (p) {
                hud.style.display = 'block'; 
                document.getElementById(pId + '-name').innerText = p.name || pId.toUpperCase(); 
                document.getElementById(pId + '-score').innerHTML = p.score + ' <span style="font-size:16px">⛃</span>';
                
                // Prioritize local active weapon values, falling back to network structures for remote peers
                const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null;
                let gunName = "Model 1911";
                let ammoText = "8 / 32";
                
                if (p.reloading) {
                    ammoText = "RELOADING";
                } else if (gun) {
                    gunName = gun.name;
                    ammoText = `${gun.clip} / ${gun.ammo}`;
                } else if (p.gunName) {
                    gunName = p.gunName;
                    ammoText = `${p.clip} / ${p.ammo}`;
                }
                
                document.getElementById(pId + '-gun-name').innerText = gunName; 
                document.getElementById(pId + '-ammo-text').innerText = ammoText; 
                document.getElementById(pId + '-icon-vig').style.display = p.hasVigor ? 'block' : 'none';
                const hpBar = document.getElementById(pId + '-hp-bar');
                if (hpBar) {
                    let pct = p.hp / p.maxHp; 
                    if (pct < 0) pct = 0; 
                    if (pct > 1) pct = 1; 
                    hpBar.style.width = (pct * 100) + "%";
                    if (pct > 0.5) hpBar.style.backgroundColor = "#2ecc71"; 
                    else if (pct > 0.25) hpBar.style.backgroundColor = "#f1c40f"; 
                    else hpBar.style.backgroundColor = "#e74c3c";
                }
            } else hud.style.display = 'none';
        }
    });
};

init();