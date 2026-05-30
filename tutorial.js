/* --- MODULAR TUTORIAL SYSTEM --- */
const Tutorial = {
    isActive: false,
    currentStep: 0,
    steps: [
        {
            title: "Basic Movement",
            text: "Welcome to Boot Camp, Survivor. Use WASD (or Arrow keys for P2) on PC, or the left virtual joystick on Mobile to move. Find the open door at the right wall.",
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
            title: "Chalk Wallbuys",
            text: "Good movement! Move into the Armory room and walk up to the Olympia shotgun chalk outline. Press [F] on PC or tap [INT] on Mobile to purchase it for free.",
            check: () => {
                return me && me.inventory.some(w => w.name === "Olympia");
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
            title: "Weapon Switching",
            text: "Excellent! Notice your HUD has updated. You now hold the Olympia! Press [Q] (or scroll your mouse wheel) on PC, or tap the blue [GUN] button on Mobile, to switch back to your starting pistol.",
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
            title: "Defensive Barricades",
            text: "Nicely swapped. Now proceed right into the Defend Room. Rebuild the wooden window barrier (repair all 6 logs) by holding down [F] on PC or [INT] on Mobile.",
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
            title: "Eliminate the Threat",
            text: "A zombie has spawned outside! Watch it tear down your window boards and smash through. Aim and fire your weapon to eliminate it.",
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
            title: "Rounds & Wave Progression",
            text: "The threat is clear! Notice the top box has transitioned to Round 2. In real matches, rounds advance only when all active waves are defeated, making zombies faster and tougher.",
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
            title: "Replenishing Ammunition",
            text: "Click! You ran out of ammunition. Walk back to the Olympia outline and buy cheap Ammo refills for half price (0 ⛃ in tutorial) using [F] or [INT].",
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
            title: "Unlock Doors & Proceed",
            text: "You have enough coins! Barricades and zombie kills grant resources. Walk up to the locked door on your right and purchase passage (cost: 200 ⛃).",
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
            title: "Escape Corridor",
            text: "Final Objective: Run down the Escape Corridor and reach the safety extraction pad at the end of the room.",
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
            title: "Survival Master",
            text: "Boot Camp complete! Return to the menu to try solo waves or host/join cooperative multiplayer online matches. Excellent work!",
            check: () => false, // Terminal success step
            onStart: () => {
                addText(me.x, me.y - 40, "YOU ESCAPED!", "#0f0");
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

    start: function() {
        this.isActive = true;
        this.currentStep = 0;
        this._startPos = null;
        this._windowRepaired = false;
        this._ammoPurchased = false;
        this._roundChangeTimer = 0;
        
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
            case 1: // Buy Step -> Point to the Olympia wallbuy
                drawFloatingArrow(580, 60, '#f1c40f');
                break;
            case 2: // Switch Weapon -> Draw bouncing arrow directly above the player model on screen [3]
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
            case 6: // Ammo Step -> Point to Olympia wallbuy again
                drawFloatingArrow(580, 60, '#3498db');
                break;
            case 7: // Clear Door Step -> Point to locked Door and HTML Coins
                drawFloatingArrow(1160, 200, '#f1c40f');
                break;
            case 8: // Escape Step -> Point to the exit pad
                drawFloatingArrow(1480, 200, '#2ecc71');
                break;
        }
    }
};