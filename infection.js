/* --- MULTIPLAYER INFECTION MODE MODULE --- */

const InfectionMode = {
    isActive: false,
    state: 'WAITING', // 'WAITING' (countdown to selection), 'ACTIVE' (match in progress), 'ROUND_OVER'
    timer: 180 * 60,  // 3-minute match duration (180 seconds @ 60 FPS)
    countdown: 15 * 60, // 15-second grace period before choosing Alpha Infected
    alphaId: null,      // ID of the first selected zombie
    infectedIds: new Set(), // Set of active infected player IDs
    respawnQueue: [], // Track players waiting to respawn: { id, timer, spawnX, spawnY }

    // Constants for balancing
    HUMAN_BASE_SPEED: 7.2,
    INFECTED_BASE_SPEED: 8.2,
    ALPHA_BASE_SPEED: 8.8,
    INFECTED_HP: 150,
    ALPHA_HP: 350,
    MELEE_COOLDOWN: 30, // Frames between claw slashes (~0.5 seconds)
    MELEE_RANGE: 48,    // Collision reach in pixels
    MELEE_DAMAGE: 45,

    init: function() {
        if (Network.mode === 'OFFLINE' || Network.mode === 'LOCAL_COOP') {
            console.warn("Infection mode is designed exclusively for multiplayer sessions.");
            this.isActive = false;
            return;
        }

        this.isActive = true;
        this.state = 'WAITING';
        this.timer = 180 * 60;
        this.countdown = 15 * 60;
        this.alphaId = null;
        this.infectedIds.clear();
        this.respawnQueue = [];

        // All active players initially start as survivors
        Object.values(players).forEach(p => {
            p.state = 'ALIVE';
            p.hp = p.maxHp = 100;
            p.speedMultiplier = 1.0;
            p.isSlashing = false;
            p.slashTimer = 0;
            p.meleeCooldown = 0;
            
            // Give humans their starting gear
            p.inventory = [{ ...weaponDB[0], clip: 8, ammo: 32 }];
            p.weapIdx = 0;
        });

        // SAFEGUARD: Gracefully handle cases where 'me' is not yet initialized during first-tick reset loops
        const startTextX = (typeof me !== 'undefined' && me) ? me.x : 1400;
        const startTextY = (typeof me !== 'undefined' && me) ? me.y - 100 : 1300;

        addText(startTextX, startTextY, "INFECTION RUN: RUN & HIDE!", "#3498db");
        if (typeof SoundSystem !== 'undefined') {
            SoundSystem.play('round_start');
        }
    },

    update: function() {
        if (!this.isActive || !gameActive) return;

        // 1. Process Infected Respawns (Host only authoritative over state changes)
        if (Network.mode !== 'CLIENT') {
            for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
                const r = this.respawnQueue[i];
                r.timer--;
                if (r.timer <= 0) {
                    this.respawnPlayer(r.id);
                    this.respawnQueue.splice(i, 1);
                }
            }
        }

        // 2. Handle State Machine Progression
        if (this.state === 'WAITING') {
            this.countdown--;
            if (this.countdown <= 0) {
                this.selectAlphaInfected();
            }
        } else if (this.state === 'ACTIVE') {
            this.timer--;
            
            // Host checks game termination states
            if (Network.mode !== 'CLIENT') {
                this.checkWinConditions();
            }
        }

        // 3. Process Player Melee/Claw slashes & cooldowns
        Object.values(players).forEach(p => {
            if (p.meleeCooldown && p.meleeCooldown > 0) p.meleeCooldown--;
            if (p.isSlashing) {
                p.slashTimer--;
                if (p.slashTimer <= 0) {
                    p.isSlashing = false;
                }
            }
        });
    },

    selectAlphaInfected: function() {
        this.state = 'ACTIVE';
        
        if (Network.mode === 'CLIENT') return;

        const activePlayerIds = Object.keys(players).filter(id => players[id].state === 'ALIVE');
        if (activePlayerIds.length === 0) return;

        // Choose one random survivor to turn into the Alpha Zombie
        const chosenId = activePlayerIds[Math.floor(Math.random() * activePlayerIds.length)];
        this.infectPlayer(chosenId, true);
        this.alphaId = chosenId;

        addText(players[chosenId].x, players[chosenId].y - 80, "⚠️ INFECTED PATIENT ZERO SELECTED!", "#e74c3c");
        if (typeof SoundSystem !== 'undefined') {
            SoundSystem.play('zombie_hurt');
        }

        // Broadcast conversion to all clients
        if (Network.mode === 'HOST') {
            Network.broadcastToAll({
                type: 'INF_SELECT_ALPHA',
                alphaId: chosenId
            });
        }
    },

    infectPlayer: function(id, isAlpha) {
        const p = players[id];
        if (!p) return;

        this.infectedIds.add(id);
        
        p.hp = p.maxHp = isAlpha ? this.ALPHA_HP : this.INFECTED_HP;
        p.state = 'ALIVE';
        p.hasVigor = false;
        p.reloading = false;
        
        // Remove standard weapons and equip them with custom invisible claw weapons
        p.inventory = [{ 
            name: isAlpha ? "Alpha Claws" : "Zombie Claws", 
            dmg: this.MELEE_DAMAGE, 
            rpm: this.MELEE_COOLDOWN, 
            auto: true, 
            type: 'melee', 
            mag: 0, 
            reserve: 0, 
            clip: 0, 
            ammo: 0, 
            reload: 0, 
            color: '#2ecc71' 
        }];
        p.weapIdx = 0;

        // Adjust speed constraints
        const speed = isAlpha ? this.ALPHA_BASE_SPEED : this.INFECTED_BASE_SPEED;
        p.speedMultiplier = speed / GameBalanceConfig.PLAYER_BASE_SPEED;

        // Visual feedback
        spawnParticles(p.x, p.y, '#27ae60', 15);
        addText(p.x, p.y, isAlpha ? "☣️ PATIENT ZERO!" : "☣️ INFECTED!", "#2ecc71");
    },

    triggerMeleeSlash: function(p) {
        if (p.meleeCooldown && p.meleeCooldown > 0) return;

        p.meleeCooldown = this.MELEE_COOLDOWN;
        p.isSlashing = true;
        p.slashTimer = 10; // Visual slash trail visible for 10 ticks

        if (typeof SoundSystem !== 'undefined') {
            SoundSystem.play('zombie_hurt');
        }

        // Host handles physical impact checking
        if (Network.mode !== 'CLIENT') {
            this.checkMeleeHits(p);
        }
    },

    checkMeleeHits: function(attacker) {
        // Evaluate close range cone in front of the attacking zombie
        Object.values(players).forEach(victim => {
            if (victim.id === attacker.id || victim.state !== 'ALIVE') return;
            if (this.infectedIds.has(victim.id)) return; // Skip friendly infected players

            const dist = Math.hypot(victim.x - attacker.x, victim.y - attacker.y);
            if (dist < this.MELEE_RANGE) {
                // Verify victim is within a 90-degree frontal view cone (~0.7 radians)
                const angleToVictim = Math.atan2(victim.y - attacker.y, victim.x - attacker.x);
                let diff = Math.abs(attacker.angle - angleToVictim);
                while (diff > Math.PI) diff = Math.PI * 2 - diff;

                if (diff < 0.78) { // ~45 degrees left or right from look vector
                    this.damageHuman(victim, this.MELEE_DAMAGE, attacker.id);
                }
            }
        });
    },

    damageHuman: function(victim, damage, attackerId) {
        if (victim.invincibleTimer && victim.invincibleTimer > 0) return;

        victim.hp -= damage;
        victim.invincibleTimer = GameBalanceConfig.PLAYER_INVINCIBILITY_FRAMES;
        addText(victim.x, victim.y, `-${damage} HP`, "#ff4757");

        if (victim.hp <= 0) {
            victim.hp = 0;
            // No downed states in Infection mode. Turn them directly into zombies.
            addText(victim.x, victim.y, "☣️ TURNED!", "#2ecc71");
            this.infectPlayer(victim.id, false);
            
            // Broadcast the infection event to synchronize clients
            if (Network.mode === 'HOST') {
                Network.broadcastToAll({
                    type: 'INF_TURN',
                    victimId: victim.id
                });
            }
        }
    },

    handleInfectedDeath: function(id) {
        const p = players[id];
        if (!p) return;

        p.state = 'SPECTATING'; // Soft death transition during respawn loop
        p.hp = 0;

        // Feed the respawn system with a 3-second delay
        this.respawnQueue.push({
            id: id,
            timer: 180, // 3 seconds @ 60 FPS
        });

        addText(p.x, p.y, "💀 DEAD - RESPAWNING...", "#fff");
    },

    respawnPlayer: function(id) {
        const p = players[id];
        if (!p) return;

        // Locate random unlocked room to gather balanced coordinates
        let spawnX = 200, spawnY = 200;
        if (activeMap && activeMap.rooms) {
            const unlockedRooms = activeMap.rooms.filter(r => r.unlocked);
            if (unlockedRooms.length > 0) {
                const r = unlockedRooms[Math.floor(Math.random() * unlockedRooms.length)];
                spawnX = r.x + Math.random() * (r.w - 80) + 40;
                spawnY = r.y + Math.random() * (r.h - 80) + 40;
            }
        }

        p.x = spawnX;
        p.y = spawnY;
        p.state = 'ALIVE';
        p.hp = p.maxHp = (id === this.alphaId) ? this.ALPHA_HP : this.INFECTED_HP;
        p.invincibleTimer = 60; // 1-second spawn shield

        spawnParticles(p.x, p.y, '#2ecc71', 10);
        addText(p.x, p.y, "☣️ RESPAWNED!", "#2ecc71");

        // Broadcast the respawn packet
        if (Network.mode === 'HOST') {
            Network.broadcastToAll({
                type: 'INF_RESPAWN',
                playerId: id,
                x: spawnX,
                y: spawnY
            });
        }
    },

    checkWinConditions: function() {
        if (this.state !== 'ACTIVE') return;

        const totalPlayers = Object.keys(players);
        const infectedCount = this.infectedIds.size;
        const humanCount = totalPlayers.length - infectedCount;

        // Condition A: All players have been infected
        if (humanCount === 0) {
            this.endMatch('ZOMBIES_WIN');
        }
        // Condition B: Timer reached zero (Survivors held off the horde)
        else if (this.timer <= 0) {
            this.endMatch('HUMANS_WIN');
        }
    },

    endMatch: function(result) {
        this.state = 'ROUND_OVER';

        // Process score and coin updates before displaying final screen
        if (result === 'HUMANS_WIN') {
            Object.keys(players).forEach(id => {
                if (!this.infectedIds.has(id)) {
                    players[id].score += 1500; // Bonus points for surviving
                    if (id === window.myPlayerId) { // <--- FIXED: Dynamic coin check
                        saveData.lobbyCoins = (saveData.lobbyCoins || 0) + 40; // Bonus coins
                    }
                }
            });
        } else {
            // Zombies Win: Give bonuses to infected based on infect conversions
            Object.keys(players).forEach(id => {
                if (this.infectedIds.has(id)) {
                    players[id].score += 500;
                    if (id === window.myPlayerId) { // <--- FIXED: Dynamic coin check
                        saveData.lobbyCoins = (saveData.lobbyCoins || 0) + 15;
                    }
                }
            });
        }

        // Mirror locally
        localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));

        if (Network.mode === 'HOST') {
            Network.broadcastToAll({
                type: 'INF_GAME_OVER',
                result: result,
                stats: stats
            });
            Network.broadcastGameOver(stats);
        }

        this.displayGameOverScreen(result);
    },

    displayGameOverScreen: function(result) {
        gameOver(); // Triggers standard cinematic sequences

        // Inject custom headers on top of standard game over ui elements
        const titleEl = document.getElementById('over-title');
        if (titleEl) {
            if (result === 'HUMANS_WIN') {
                titleEl.innerText = "SURVIVORS ESCAPED!";
                titleEl.style.color = "#3498db";
            } else {
                titleEl.innerText = "HORDE INFECTED ALL!";
                titleEl.style.color = "#2ecc71";
            }
        }
    },

    drawMeleeSwipe: function(p, targetCtx) {
        if (!p.isSlashing) return;

        targetCtx.save();
        targetCtx.translate(p.x, p.y);
        targetCtx.rotate(p.angle);

        // Draw a clean, neon green crescent slash line ahead of player direction
        targetCtx.strokeStyle = (p.id === this.alphaId) ? 'rgba(231, 76, 60, 0.75)' : 'rgba(46, 204, 113, 0.75)';
        targetCtx.lineWidth = 4;
        targetCtx.lineCap = 'round';
        targetCtx.shadowBlur = 8;
        targetCtx.shadowColor = (p.id === this.alphaId) ? '#e74c3c' : '#2ecc71';

        targetCtx.beginPath();
        targetCtx.arc(10, 0, this.MELEE_RANGE - 8, -0.6, 0.6);
        targetCtx.stroke();
        targetCtx.restore();
    },

    drawHUD: function(targetCtx) {
        if (!this.isActive || !gameActive) return;

        targetCtx.save();

        // 1. Draw survivors vs infected fraction counter on the side
        const total = Object.keys(players).length;
        const infected = this.infectedIds.size;
        const survivors = total - infected;

        targetCtx.font = "bold 13px monospace";
        targetCtx.textAlign = 'left';
        
        // Survivors counter (Blue)
        const survText = `HUMANS: ${survivors}`;
        targetCtx.fillStyle = '#3498db';
        targetCtx.strokeText(survText, 25, 140);
        targetCtx.fillText(survText, 25, 140);

        // Infected counter (Green)
        const infText = `INFECTED: ${infected}`;
        targetCtx.fillStyle = '#2ecc71';
        targetCtx.strokeText(infText, 25, 160);
        targetCtx.fillText(infText, 25, 160);

        targetCtx.restore();
    }
};