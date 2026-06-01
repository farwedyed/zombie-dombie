/* --- MODULAR TUTORIAL SYSTEM --- */
const Tutorial = {
    isActive: false,
    currentStep: 0,
    steps: [
        {
            title: "Walk Around",
            text: "Let's learn how to walk! Use WASD (or Arrow keys) to move around. Go through the open door on your right!",
            check: () => {
                if (!Tutorial._startPos && me) {
                    Tutorial._startPos = { x: me.x, y: me.y };
                }
                if (me) {
                    const dist = Math.hypot(me.x - Tutorial._startPos.x, me.y - Tutorial._startPos.y);
                    return dist > 100; // Step complete once player moves 100px
                }
                return false;
            },
            onStart: () => {
                // Clear locked gates
                activeMap.rooms[1].unlocked = false;
                activeMap.rooms[2].unlocked = false;
                activeMap.rooms[3].unlocked = false;
                
                // Show Left Stick Arrow on mobile
                Tutorial.toggleGuideArrow('tut-guide-left-stick', true);
            }
        },
        {
            title: "Get a Blaster",
            text: "Great! Walk up to the chalk drawing of the Olympus blaster and press [F] (or tap [INT]) to get it for free!",
            check: () => {
                return me && me.inventory.some(w => w.name === "Olympus");
            },
            onStart: () => {
                // Automatically open Door 1 leading to the Armory
                activeMap.rooms[1].unlocked = true;
                
                // Hide Left Stick arrow and show Interact arrow on mobile
                Tutorial.toggleGuideArrow('tut-guide-left-stick', false);
                Tutorial.toggleGuideArrow('tut-guide-interact', true);
            }
        },
        {
            title: "Swap Blasters",
            text: "Cool blaster! Press [Q] (or tap the blue [GUN] button) to switch back to your starting water pistol.",
            check: () => {
                return me && me.weapIdx === 0; // Back to starting pistol slot (index 0)
            },
            onStart: () => {
                // Hide Interact arrow and show Switch Gun arrow on mobile
                Tutorial.toggleGuideArrow('tut-guide-interact', false);
                Tutorial.toggleGuideArrow('tut-guide-switch', true);
            }
        },
        {
            title: "Fix the Window",
            text: "Let's block the window! Go right, stand near the broken window, and hold [F] (or [INT]) to build wooden boards.",
            check: () => {
                const win = activeMap.windows[0];
                return win && win.boards >= win.max; // Requires all 6 boards to complete step
            },
            onStart: () => {
                // Automatically open Door 2 leading to the Defend Room
                activeMap.rooms[2].unlocked = true;
                
                // Hide Switch Gun arrow and show Interact arrow on mobile
                Tutorial.toggleGuideArrow('tut-guide-switch', false);
                Tutorial.toggleGuideArrow('tut-guide-interact', true);
            }
        },
        {
            title: "Blast the Zombie",
            text: "Look out! A silly zombie is coming! Aim and blast it to keep yourself safe!",
            check: () => {
                return stats.sessionKills >= 1; // Completed once player kills the training zombie
            },
            onStart: () => {
                // Hide Interact arrow and show Right Stick (Aim/Fire) arrow on mobile
                Tutorial.toggleGuideArrow('tut-guide-interact', false);
                Tutorial.toggleGuideArrow('tut-guide-right-stick', true);

                // Spawn training zombie OUTSIDE the bottom window (y: 450)
                zombieIdCounter++;
                zombies.push({
                    id: zombieIdCounter, x: 1050, y: 450, hp: 50, maxHp: 50,
                    speed: 0.8, r: 16, hasEntered: false
                });
                stats.zombiesAlive = 1;
                stats.zombiesToSpawn = 0; // Lock random rounds during tutorial
            }
        },
        {
            title: "Watch the Rounds",
            text: "You did it! See the round number go up? Zombies get a little faster each round, so watch out!",
            check: () => {
                if (!Tutorial._roundChangeTimer) Tutorial._roundChangeTimer = Date.now();
                return (Date.now() - Tutorial._roundChangeTimer > 4000); // 4-second reading timer
            },
            onStart: () => {
                Tutorial._roundChangeTimer = 0;
                
                // Hide Right Stick arrow
                Tutorial.toggleGuideArrow('tut-guide-right-stick', false);

                // Simulate round transition mechanics
                stats.round = 2;
                document.getElementById('round-box').innerText = "2";
                if (typeof SoundSystem !== 'undefined') {
                    SoundSystem.play('round_start');
                }
                addText(me ? me.x : 200, (me ? me.y : 200) - 100, "ROUND 2!", "#a83232");
            }
        },
        {
            title: "Get More Ammo",
            text: "Oh no! Your blaster is empty. Walk back to the chalk drawing and buy more reload juice for free!",
            check: () => {
                return Tutorial._ammoPurchased === true;
            },
            onStart: () => {
                Tutorial._ammoPurchased = false;
                if (me) {
                    // Completely drain ammunition to force the buying event
                    me.inventory.forEach(gun => {
                        gun.clip = 0;
                        gun.ammo = 0;
                    });
                }
                
                // Show Interact button arrow on mobile
                Tutorial.toggleGuideArrow('tut-guide-interact', true);
            }
        },
        {
            title: "Drink Vigor-Up",
            text: "Time to get super strong! Go to the red juice machine and buy some sweet Vigor-Up to get extra hearts!",
            check: () => {
                return me && me.hasVigor;
            },
            onStart: () => {
                // Dynamically spawn the Vigor machine in Room 2 (Defend Room) if it doesn't exist
                if (activeMap === tutorialMapData) {
                    const hasVig = activeMap.interactables.some(i => i.type === 'PERK');
                    if (!hasVig) {
                        activeMap.interactables.push({ x: 920, y: 60, w: 50, h: 50, type: 'PERK', price: 0, color: '#c0392b', label: "VIG" });
                    }
                }
                Tutorial.toggleGuideArrow('tut-guide-interact', true);
            }
        },
        {
            title: "Vigor Rescue",
            text: "A red hazard zone has appeared! Go step inside the red 'DAMAGE' box to drain your health. Vigor-Up will automatically save you and get you right back up!",
            check: () => {
                if (!me) return false;

                if (me.state === 'ALIVE' && !Tutorial._hasBeenDowned) {
                    // Check if player is standing inside the damage box (radius 40px around x: 1000, y: 200)
                    const onBox = Math.hypot(me.x - 1000, me.y - 200) < 40;
                    if (onBox) {
                        Tutorial._vigorStepTimer++;
                        
                        // Inflict damage at paced intervals of 45 frames (~0.75 seconds)
                        if (Tutorial._vigorStepTimer % 45 === 0) {
                            const damageAmount = Math.ceil(me.maxHp / 4);

                            if (me.hp - damageAmount <= 0) {
                                // Fatal hit leads to knockdown
                                me.hp = 0;
                                me.state = 'DOWNED';
                                me.reviveTimer = 180; // 3-second knockdown demo
                                Tutorial._hasBeenDowned = true;
                                addText(me.x, me.y, "VIGOR RESCUE INITIATED!", "#0f0");
                                triggerTutorialDamageFlash();
                            } else {
                                me.hp -= damageAmount;
                                addText(me.x, me.y, `-${damageAmount} HP`, "#ff4757");
                                triggerTutorialDamageFlash();
                            }
                        }
                    }
                    return false;
                } else {
                    // Step completes once Vigor-Up auto-revives player back to ALIVE
                    return Tutorial._hasBeenDowned && me.state === 'ALIVE';
                }
            },
            onStart: () => {
                Tutorial._hasBeenDowned = false;
                Tutorial._vigorStepTimer = 0;
                if (me) {
                    me.hp = me.maxHp; // Start from full health
                }
                Tutorial.toggleGuideArrow('tut-guide-interact', false);
            }
        },
        {
            title: "Unlock the Door",
            text: "Let's escape! Walk up to the locked door on your right and press [F] or [INT] to open it with your points.",
            check: () => {
                // Complete when Room 3 door is opened using points
                return activeMap.rooms[3].unlocked === true;
            },
            onStart: () => {
                // Show visual HTML guidance arrow pointing directly to coin balance HUD
                const coinArrow = document.getElementById('tutorial-coin-arrow');
                if (coinArrow) coinArrow.style.display = 'block';
                
                // Keep Interact button arrow visible on mobile
                Tutorial.toggleGuideArrow('tut-guide-interact', true);
            }
        },
        {
            title: "Run to Safety",
            text: "Almost there! Run down the hallway to the glowing safe zone to win!",
            check: () => {
                return me && me.x > 1400; // Trigger completion once reaching exit pad coordinates
            },
            onStart: () => {
                // Hide HTML HUD coin pointer arrow and mobile button overlays
                const coinArrow = document.getElementById('tutorial-coin-arrow');
                if (coinArrow) coinArrow.style.display = 'none';
                Tutorial.toggleGuideArrow('tut-guide-interact', false);
            }
        },
        {
            title: "Zombie Master!",
            text: "Hooray! You are now a Zombie Master! Return to the menu to try solo matches or play with friends.",
            check: () => false, // Terminal success step
            onStart: () => {
                addText(me.x, me.y - 40, "YOU ESCAPED!", "#0f0");
                localStorage.setItem('zombieTutorialSkippedOrCompleted', 'true'); // Save tutorial completion!
                setTimeout(() => {
                    Tutorial.end();
                    location.reload(); // Return to main menu
                }, 7000);
            }
        }
    ],

    _startPos: null,
    _windowRepaired: false,
    _ammoPurchased: false,
    _roundChangeTimer: 0,
    _hasBeenDowned: false,
    _vigorStepTimer: 0,

    start: function() {
        this.isActive = true;
        this.currentStep = 0;
        this._startPos = null;
        this._windowRepaired = false;
        this._ammoPurchased = false;
        this._roundChangeTimer = 0;
        this._hasBeenDowned = false;
        this._vigorStepTimer = 0;
        
        const hud = document.getElementById('tutorial-hud');
        if (hud) hud.style.display = 'block';
        
        const coinArrow = document.getElementById('tutorial-coin-arrow');
        if (coinArrow) coinArrow.style.display = 'none';

        // Hide all mobile pointers on init
        const guides = ['tut-guide-left-stick', 'tut-guide-right-stick', 'tut-guide-interact', 'tut-guide-reload', 'tut-guide-switch'];
        guides.forEach(gId => {
            Tutorial.toggleGuideArrow(gId, false);
        });

        if (this.steps[0].onStart) this.steps[0].onStart();
        this.updateUI();
    },

    end: function() {
        this.isActive = false;
        const hud = document.getElementById('tutorial-hud');
        if (hud) hud.style.display = 'none';
        const coinArrow = document.getElementById('tutorial-coin-arrow');
        if (coinArrow) coinArrow.style.display = 'none';

        // Hide all mobile pointers safely
        const guides = ['tut-guide-left-stick', 'tut-guide-right-stick', 'tut-guide-interact', 'tut-guide-reload', 'tut-guide-switch'];
        guides.forEach(gId => {
            Tutorial.toggleGuideArrow(gId, false);
        });
    },

    // Safely exits the session and reloads back to the main menu
    skip: function() {
        localStorage.setItem('zombieTutorialSkippedOrCompleted', 'true'); // Set skip flag to bypass auto-launch loops!
        this.end();
        location.reload();
    },

    update: function() {
        if (!this.isActive || !me) return;
        
        const step = this.steps[this.currentStep];
        if (step && step.check()) {
            this.nextStep();
        }
    },

    nextStep: function() {
        this.currentStep++;
        if (this.currentStep < this.steps.length) {
            const step = this.steps[this.currentStep];
            if (step.onStart) step.onStart();
            this.updateUI();
            addText(me.x, me.y - 60, "OBJECTIVE COMPLETED!", "#0f0");
        } else {
            this.end();
        }
    },

    updateUI: function() {
        if (!this.isActive) return;
        const step = this.steps[this.currentStep];
        if (step) {
            document.getElementById('tutorial-title').innerText = `Boot Camp: ${step.title}`;
            document.getElementById('tutorial-text').innerText = step.text;
            document.getElementById('tutorial-progress').innerText = `Step ${this.currentStep + 1} / ${this.steps.length}`;
        }
    },

    onWindowRepaired: function() {
        if (this.isActive && this.currentStep === 3) {
            this._windowRepaired = true;
        }
    },

    onAmmoPurchased: function() {
        if (this.isActive && this.currentStep === 6) {
            this._ammoPurchased = true;
        }
    },

    // Safely toggles visual pointing arrows on mobile devices
    toggleGuideArrow: function(elementId, show) {
        const el = document.getElementById(elementId);
        if (el) {
            el.style.display = (show && isTouchDevice) ? 'block' : 'none';
        }
    },

    // Instantly resets state, heals character, and restarts steps on death
    resetOnDeath: function() {
        addText(me.x, me.y, "DEATH IS NOT THE END!", "#f00");
        setTimeout(() => {
            // Restore character health and starter gear setup
            me.hp = me.maxHp;
            me.state = 'ALIVE';
            me.x = 200;
            me.y = 200;
            me.inventory = [{ ...weaponDB[0], clip: 8, ammo: 32 }];
            me.weapIdx = 0;
            me.score = 500;
            
            // Clean active map threats
            zombies = [];
            bullets = [];
            stats.zombiesAlive = 0;
            stats.sessionKills = 0;
            
            // Restart tutorial session
            gameActive = true;
            this.start();
        }, 1500);
    },

    // Handles the bouncing arrow drawings on canvas
    drawIndicators: function() {
        if (!this.isActive || !me) return;
        
        switch (this.currentStep) {
            case 0: // Move Step -> Point to the open door on the right
                drawFloatingArrow(360, 200, '#2ecc71');
                break;
            case 1: // Buy Step -> Point to the Olympus wallbuy
                drawFloatingArrow(580, 60, '#f1c40f');
                break;
            case 2: // Switch Weapon -> Draw bouncing arrow directly above the player model on screen
                if (me) {
                    drawFloatingArrow(me.x, me.y, '#ffd700');
                    
                    ctx.save();
                    ctx.fillStyle = '#ffd700';
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 3;
                    ctx.font = 'bold 15px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    
                    const promptText = isTouchDevice ? "TAP [GUN] BUTTON" : "PRESS [Q] TO SWITCH";
                    ctx.strokeText(promptText, me.x, me.y - 50);
                    ctx.fillText(promptText, me.x, me.y - 50);
                    ctx.restore();
                }
                break;
            case 3: // Repair Step -> Point to Room 2 Window
                drawFloatingArrow(1000, 360, '#f1c40f');
                break;
            case 4: // Kill Step -> Point to target zombie
                if (zombies.length > 0) {
                    zombies.forEach(z => {
                        drawFloatingArrow(z.x, z.y, '#e74c3c');
                    });
                } else {
                    drawFloatingArrow(1000, 360, '#e74c3c');
                }
                break;
            case 5: // Read Round explanation -> No target
                break;
            case 6: // Ammo Step -> Point to Olympus wallbuy again
                drawFloatingArrow(580, 60, '#3498db');
                break;
            case 7: // Drink Vigor-Up -> Point to newly spawned red Perk machine
                drawFloatingArrow(920, 60, '#e74c3c');
                break;
            case 8: // Vigor Rescue Demonstration -> Stand in the red damage hazard zone
                if (me && me.state === 'ALIVE') {
                    ctx.save();
                    // Draw a semi-transparent red damage hazard box
                    ctx.fillStyle = 'rgba(231, 76, 60, 0.4)';
                    ctx.strokeStyle = '#e74c3c';
                    ctx.lineWidth = 3;
                    ctx.fillRect(970, 170, 60, 60);
                    ctx.strokeRect(970, 170, 60, 60);
                    
                    // Draw centered "DAMAGE" text label
                    ctx.fillStyle = '#ffffff';
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 2.5;
                    ctx.font = 'bold 12px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.strokeText("DAMAGE", 1000, 200);
                    ctx.fillText("DAMAGE", 1000, 200);
                    ctx.restore();

                    // Point directly to the damage area
                    drawFloatingArrow(1000, 200, '#e74c3c');
                }
                break;
            case 9: // Clear Door Step -> Point to locked Door and HTML Coins
                drawFloatingArrow(1160, 200, '#f1c40f');
                break;
            case 10: // Escape Step -> Point to the exit pad
                drawFloatingArrow(1480, 200, '#2ecc71');
                break;
        }
    }
};

// Isolated helper function to play tutorial damage impacts cleanly
function triggerTutorialDamageFlash() {
    const flash = document.getElementById('damage-flash');
    if (flash) {
        flash.style.boxShadow = "inset 0 0 120px rgba(180, 0, 0, 0.95)";
        flash.style.border = "16px solid rgba(180, 0, 0, 0.8)";
        flash.style.background = "rgba(180, 0, 0, 0.2)";
        setTimeout(() => {
            flash.style.boxShadow = "none"; 
            flash.style.border = "none"; 
            flash.style.background = "transparent";
        }, 250); // Slightly longer flash duration for heavy impact feel
    }
    if (typeof SoundSystem !== 'undefined') {
        SoundSystem.play('zombie_hurt'); // Clean local grunt on hit
    }
}