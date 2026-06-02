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

window.addEventListener('resize', function () { 
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight; 
});

/* --- CORE GAME STATE --- */
let activeMap = null; // Declared globally here to prevent ReferenceErrors
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
    gameMode: "SURVIVAL", 
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

window.startingUnlockedBosses = [];
window.startingDefeatedBosses = [];

/* --- INPUT HANDLING --- */
window.addEventListener('keydown', function (e) { 
    if (e.code === 'Tab') { 
        e.preventDefault(); 
        showScoreboard = true; 
    } else {
        keys[e.code] = true; 
        
        if (gameActive && me && me.state === 'SPECTATING') {
            if (e.code === 'KeyQ' || e.code === 'ArrowRight' || e.code === 'KeyD') {
                cycleSpectator(1);
            }
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                cycleSpectator(-1);
            }
        } else {
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
    if (gameActive && me) {
        if (me.state === 'SPECTATING') {
            cycleSpectator(e.deltaY > 0 ? 1 : -1);
            return;
        }
        if (me.inventory.length > 1) {
            if (e.deltaY > 0) {
                me.weapIdx = (me.weapIdx + 1) % me.inventory.length;
            } else {
                me.weapIdx = (me.weapIdx - 1 + me.inventory.length) % me.inventory.length;
            }
            addText(me.x, me.y - 40, me.inventory[me.weapIdx].name, "#fff");
        }
    }
}, { passive: true });

window.addEventListener('mousemove', function (e) { 
    mouse.x = e.clientX; 
    mouse.y = e.clientY; 
});

window.addEventListener('mousedown', function (e) { 
    if (e.button === 0) {
        mouse.down = true; 
        if (gameActive && me && me.state === 'SPECTATING') {
            cycleSpectator(1);
        }
    }
});

window.addEventListener('mouseup', function () { 
    mouse.down = false; 
    mouse.pressHandled = false; 
});

/* --- MOBILE JOYSTICK CONTROLS SETUP --- */
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
        if (gameActive && me) {
            if (me.state === 'SPECTATING') {
                cycleSpectator(1);
                return;
            }
            if (me.inventory.length > 1) {
                const now = Date.now();
                if (now - (me.lastSwitchTime || 0) < 300) return;
                me.lastSwitchTime = now;

                me.weapIdx = (me.weapIdx + 1) % me.inventory.length;
                addText(me.x, me.y - 40, me.inventory[me.weapIdx].name, "#fff");
                if (Network.mode === 'CLIENT') {
                    Network.sendClientData(me); 
                }
            }
        }
    });
}

/* --- BASIC VISUAL UTILITIES --- */
function spawnParticles(x, y, c, n) { 
    for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 20, color: c }); 
}

function addText(x, y, t, c) { 
    texts.push({ x, y, text: t, color: c, life: 60 }); 
}