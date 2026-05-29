/* --- CUSTOM ZOMBIE VARIANTS & BOSS SYSTEM --- */
window.activeBoss = null;
window.zombieArrows = [];

const ZombieVariants = {
    // Return allowed types based on progressive rounds
    getAvailableTypes: function(round) {
        const pool = ['standard'];
        if (round >= 3) pool.push('purple');
        if (round >= 5) pool.push('red');
        if (round >= 7) pool.push('blue');
        if (round >= 9) pool.push('yellow');
        return pool;
    },

    // Helper to format/scale zombie properties dynamically during spawn
    initializeVariant: function(z, hp, baseSpeed) {
        const pool = this.getAvailableTypes(stats.round);
        const selectedType = pool[Math.floor(Math.random() * pool.length)];
        
        z.type = selectedType;
        z.color = '#3a4a38'; // Default green
        
        if (selectedType === 'purple') {
            z.color = '#8e44ad'; // Royal Purple
            z.hp = Math.floor(hp * 0.8);
            z.maxHp = z.hp;
        } else if (selectedType === 'red') {
            z.color = '#e74c3c'; // Fire Red (Archer)
            z.hp = Math.floor(hp * 0.9);
            z.maxHp = z.hp;
            z.shootCooldown = 150 + Math.random() * 100;
        } else if (selectedType === 'blue') {
            z.color = '#2980b9'; // Blue (Slow Tank)
            z.hp = Math.floor(hp * 2.5);
            z.maxHp = z.hp;
            z.speed = baseSpeed * 0.55;
            z.r = 20; // Bigger body radius
        } else if (selectedType === 'yellow') {
            z.color = '#f1c40f'; // Yellow (Swift Runner)
            z.hp = Math.floor(hp * 0.20); // Reduced to 0.20 so they die very quickly!
            z.maxHp = z.hp;
            z.speed = baseSpeed * 1.5;
            z.r = 13; // Smaller, harder to hit
        }
    },

    // Triggers the splitting sequence for purple zombies and hydras on death
    handleSplittingOnDeath: function(z) {
        if (z.type === 'purple') {
            // Split into two fast mini-zombies
            for (let k = 0; k < 2; k++) {
                zombieIdCounter++;
                zombies.push({
                    id: zombieIdCounter,
                    x: z.x + (Math.random() - 0.5) * 20,
                    y: z.y + (Math.random() - 0.5) * 20,
                    hp: Math.floor(z.maxHp * 0.4),
                    maxHp: Math.floor(z.maxHp * 0.4),
                    speed: z.speed * 1.35,
                    r: 10,
                    hasEntered: true,
                    type: 'purple_mini',
                    color: '#a55eea'
                });
                stats.zombiesAlive++;
            }
            addText(z.x, z.y, "SPLIT!", "#8e44ad");
        } 
        else if (z.type === 'boss_hydra') {
            // Splits into 3 medium hydras
            for (let k = 0; k < 3; k++) {
                zombieIdCounter++;
                zombies.push({
                    id: zombieIdCounter,
                    x: z.x + (Math.random() - 0.5) * 35,
                    y: z.y + (Math.random() - 0.5) * 35,
                    hp: Math.floor(z.maxHp * 0.4),
                    maxHp: Math.floor(z.maxHp * 0.4),
                    speed: z.speed * 1.15,
                    r: 22,
                    hasEntered: true,
                    type: 'boss_hydra_split',
                    color: '#9b59b6'
                });
                stats.zombiesAlive++;
            }
            addText(z.x, z.y, "HYDRA DIVIDING!", "#8e44ad");
        } 
        else if (z.type === 'boss_hydra_split') {
            // Splits into 3 mini purple zombies
            for (let k = 0; k < 3; k++) {
                zombieIdCounter++;
                zombies.push({
                    id: zombieIdCounter,
                    x: z.x + (Math.random() - 0.5) * 20,
                    y: z.y + (Math.random() - 0.5) * 20,
                    hp: Math.floor(z.maxHp * 0.35),
                    maxHp: Math.floor(z.maxHp * 0.35),
                    speed: z.speed * 1.35,
                    r: 11,
                    hasEntered: true,
                    type: 'purple_mini',
                    color: '#a55eea'
                });
                stats.zombiesAlive++;
            }
        }
    },

    // Standardized boss spawning mechanism
    spawnBoss: function(round) {
        let valid = activeMap.spawnPoints.filter(sp => activeMap.rooms[sp.roomId].unlocked);
        if (valid.length === 0) valid = [activeMap.spawnPoints[0]];
        let sp = valid[Math.floor(Math.random() * valid.length)];
        
        zombieIdCounter++;
        let boss = {
            id: zombieIdCounter,
            x: sp.x,
            y: sp.y,
            hasEntered: false,
            isBoss: true
        };
        
        if (round === 10) {
            boss.type = 'boss_logbreaker';
            boss.name = "The Logbreaker";
            boss.maxHp = 1500;
            boss.hp = 1500;
            boss.speed = 1.5;
            boss.r = 30;
            boss.color = '#d35400'; // Orange-Red
        } else if (round === 15) {
            boss.type = 'boss_broodmother';
            boss.name = "The Broodmother";
            boss.maxHp = 2500;
            boss.hp = 2500;
            boss.speed = 1.3;
            boss.r = 32;
            boss.color = '#10ac84'; // Dark Teal Green
            boss.spawnMinionCooldown = 180;
        } else if (round === 20) {
            boss.type = 'boss_hydra';
            boss.name = "The Hydra Omega";
            boss.maxHp = 4000;
            boss.hp = 4000;
            boss.speed = 1.7;
            boss.r = 34;
            boss.color = '#8e44ad'; // Purple
        }
        
        zombies.push(boss);
        window.activeBoss = boss;
        stats.zombiesToSpawn = 0;
        stats.zombiesAlive = 1;
        
        addText(me.x, me.y - 120, `⚠️ BOSS INCOMING: ${boss.name}!`, "#e74c3c");
    },

    // Processes archery and minion spawns inside the 60Hz loop
    updateSpecialBehaviors: function(z) {
        // Ranged Archer shooting logic
        if (z.type === 'red') {
            z.shootCooldown--;
            if (z.shootCooldown <= 0) {
                let target = null;
                let minDist = 9999;
                Object.values(players).forEach(p => {
                    if (p.state === 'ALIVE') {
                        let d = Math.hypot(p.x - z.x, p.y - z.y);
                        if (d < minDist) { minDist = d; target = p; }
                    }
                });
                if (target) {
                    let angle = Math.atan2(target.y - z.y, target.x - z.x);
                    window.zombieArrows.push({
                        x: z.x,
                        y: z.y,
                        vx: Math.cos(angle) * 7.5,
                        vy: Math.sin(angle) * 7.5,
                        life: 180
                    });
                    z.shootCooldown = 180 + Math.random() * 120;
                    addText(z.x, z.y, "🏹", "#e74c3c");
                }
            }
        }
        
        // Broodmother minion spawning logic
        if (z.type === 'boss_broodmother') {
            z.spawnMinionCooldown--;
            if (z.spawnMinionCooldown <= 0) {
                z.spawnMinionCooldown = 240 + Math.random() * 120; // 4-6 seconds
                zombieIdCounter++;
                zombies.push({
                    id: zombieIdCounter,
                    x: z.x + (Math.random() - 0.5) * 40,
                    y: z.y + (Math.random() - 0.5) * 40,
                    hp: 150 + stats.round * 10,
                    maxHp: 150 + stats.round * 10,
                    speed: 2.2,
                    r: 14,
                    hasEntered: true,
                    type: 'standard',
                    color: '#2ecc71' // Green standard minions
                });
                stats.zombiesAlive++;
                addText(z.x, z.y, "SPAWNED!", "#2ecc71");
            }
        }
    },

    // Update and resolve arrow collisions
    updateProjectiles: function() {
        for (let i = window.zombieArrows.length - 1; i >= 0; i--) {
            let a = window.zombieArrows[i];
            a.x += a.vx;
            a.y += a.vy;
            a.life--;
            
            let hit = false;
            if (RoomSystem.checkCollision(a.x, a.y, false)) {
                hit = true;
            }
            
            Object.values(players).forEach(p => {
                if (!hit && p.state === 'ALIVE' && Math.hypot(p.x - a.x, p.y - a.y) < p.r + 4) {
                    if (p.invincibleTimer && p.invincibleTimer > 0) return;
                    
                    hit = true;
                    p.hp -= 15; // Archer arrow deals 15 damage
                    if (p === me) {
                        const flash = document.getElementById('damage-flash');
                        if (flash) {
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
                    if (p.hp <= 0) {
                        p.state = 'DOWNED';
                        p.reviveTimer = p.hasJug ? 300 : -1;
                        if (p.hasJug) addText(p.x, p.y, "JUG SAVED YOU!", "#f00");
                        else addText(p.x, p.y, "DOWNED!", "#f00");
                    }
                }
            });
            
            if (hit || a.life <= 0) {
                window.zombieArrows.splice(i, 1);
            }
        }
    }
};