/* --- MODULAR TUTORIAL SYSTEM --- */
const Tutorial = {
    isActive: false,
    currentStep: 0,
    steps: [
        {
            title: "Basic Movement",
            text: "Welcome to Boot Camp, Survivor. Use WASD (or Arrow keys for P2) to move your character. Find the open door at the right wall.",
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
            }
        },
        {
            title: "Chalk Wallbuys",
            text: "Good movement! Move into the Armory room and walk up to the Olympia shotgun chalk outline. Press [F] to purchase it for free.",
            check: () => {
                return me && me.inventory.some(w => w.name === "Olympia");
            },
            onStart: () => {
                // Automatically open Door 1 leading to the Armory
                activeMap.rooms[1].unlocked = true;
            }
        },
        {
            title: "Defensive Barricades",
            text: "Excellent. Proceed right into the Defend Room. Fully rebuild the wooden window barrier (repair all 6 boards) by holding down [F].",
            check: () => {
                const win = activeMap.windows[0];
                return win && win.boards >= win.max; // Requires all 6 boards to complete step
            },
            onStart: () => {
                // Automatically open Door 2 leading to the Defend Room
                activeMap.rooms[2].unlocked = true;
            }
        },
        {
            title: "Eliminate the Threat",
            text: "The window is secure! But a zombie has broken through from outside! Aim and fire your Olympia shotgun to eliminate it.",
            check: () => {
                return stats.sessionKills >= 1; // Completed once player kills the training zombie
            },
            onStart: () => {
                // Spawn target training zombie immediately
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
            title: "Replenishing Ammunition",
            text: "Click! You ran out of ammunition after defeating the threat. Walk back to the Olympia outline and buy cheap Ammo refills for half price (0 ⛃ in tutorial).",
            check: () => {
                return Tutorial._ammoPurchased === true;
            },
            onStart: () => {
                Tutorial._ammoPurchased = false;
                if (me) {
                    // Completely drain both starting pistol and new shotgun ammo
                    me.inventory.forEach(gun => {
                        gun.clip = 0;
                        gun.ammo = 0;
                    });
                }
            }
        },
        {
            title: "Rounds & Progression",
            text: "Endless Waves: In real matches, Rounds increase only when every zombie in a wave is defeated. Zombies grow faster and tougher each round! Move right to the locked gate.",
            check: () => {
                return me && me.x > 1100;
            }
        },
        {
            title: "Check Resources & Unlock Doors",
            text: "You have enough coins! Barricades and zombie kills grant resources. Walk up to the locked door on your right and press [F] to purchase passage (cost: 200 ⛃).",
            check: () => {
                // Complete when Room 3 door is opened using points
                return activeMap.rooms[3].unlocked === true;
            },
            onStart: () => {
                // Show floating HTML guidance arrow pointing directly to coin balance HUD
                const coinArrow = document.getElementById('tutorial-coin-arrow');
                if (coinArrow) coinArrow.style.display = 'block';
            }
        },
        {
            title: "Escape Corridor",
            text: "Final Objective: Run down the Escape Corridor and reach the safety extraction pad at the end of the room.",
            check: () => {
                return me && me.x > 1400; // Trigger completion once reaching exit pad coordinates
            },
            onStart: () => {
                // Hide HTML HUD coin pointer arrow
                const coinArrow = document.getElementById('tutorial-coin-arrow');
                if (coinArrow) coinArrow.style.display = 'none';
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

    start: function() {
        this.isActive = true;
        this.currentStep = 0;
        this._startPos = null;
        this._windowRepaired = false;
        this._ammoPurchased = false;
        
        const hud = document.getElementById('tutorial-hud');
        if (hud) hud.style.display = 'block';
        
        const coinArrow = document.getElementById('tutorial-coin-arrow');
        if (coinArrow) coinArrow.style.display = 'none';

        if (this.steps[0].onStart) this.steps[0].onStart();
        this.updateUI();
    },

    end: function() {
        this.isActive = false;
        const hud = document.getElementById('tutorial-hud');
        if (hud) hud.style.display = 'none';
        const coinArrow = document.getElementById('tutorial-coin-arrow');
        if (coinArrow) coinArrow.style.display = 'none';
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
        if (this.isActive && this.currentStep === 2) {
            this._windowRepaired = true;
        }
    },

    onAmmoPurchased: function() {
        if (this.isActive && this.currentStep === 4) {
            this._ammoPurchased = true;
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
            case 2: // Repair Step -> Point to Room 2 Window
                drawFloatingArrow(1050, 360, '#f1c40f');
                break;
            case 3: // Kill Step -> Point to target zombie
                if (zombies.length > 0) {
                    zombies.forEach(z => {
                        drawFloatingArrow(z.x, z.y, '#e74c3c');
                    });
                } else {
                    drawFloatingArrow(1050, 360, '#e74c3c');
                }
                break;
            case 4: // Ammo Step -> Point to Olympia wallbuy again
                drawFloatingArrow(580, 60, '#3498db');
                break;
            case 5: // Explain Rounds -> Point right to locked escape door
                drawFloatingArrow(1160, 200, '#3498db');
                break;
            case 6: // Clear Door Step -> Point to locked Door and HTML Coins
                drawFloatingArrow(1160, 200, '#f1c40f');
                break;
            case 7: // Escape Step -> Point to the exit pad
                drawFloatingArrow(1480, 200, '#2ecc71');
                break;
        }
    }
};