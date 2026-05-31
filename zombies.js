/* --- CUSTOM ZOMBIE VARIANTS & BOSS SYSTEM --- */
window.activeBoss = null;
window.zombieArrows = [];

// Environmental Boss Hazard Containers
window.acidPools = [];
window.toxicClouds = [];
window.mortarTargets = [];
window.fireZones = [];
window.groundSmashes = [];
window.screenShake = 0;
window.spawnedBossTypes = []; 

// Helper to verify coordinates are both collision-free and inside unlocked rooms using dynamic radius bounds
function isPointInUnlockedArea(x, y, radius) {
    if (!activeMap || !activeMap.rooms) return false;
    let buf = radius !== undefined ? radius : 16;
    if (RoomSystem.checkCollision(x, y, false, buf)) return false;
    
    let insideAnyRoom = false;
    let unlocked = false;
    for (let r of activeMap.rooms) {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
            insideAnyRoom = true;
            if (r.unlocked) {
                unlocked = true;
                break;
            }
        }
    }
    return insideAnyRoom ? unlocked : false;
}

// Raycast to check for straight line-of-sight between two entities [2]
function hasLineOfSight(fromX, fromY, toX, toY) {
    if (!activeMap) return false;
    let dist = Math.hypot(toX - fromX, toY - fromY);
    let stepSize = 30;
    let steps = Math.ceil(dist / stepSize);
    for (let i = 1; i < steps; i++) {
        let t = i / steps;
        let checkX = fromX + (toX - fromX) * t;
        let checkY = fromY + (toY - fromY) * t;
        if (RoomSystem.checkCollision(checkX, checkY, false, 14)) {
            return false; 
        }
    }
    return true; 
}

const ZombieVariants = {
    getAvailableTypes: function(round) {
        const pool = ['standard'];
        if (round >= 3) pool.push('purple');
        if (round >= 5) pool.push('red');
        if (round >= 7) pool.push('blue');
        if (round >= 9) pool.push('yellow');
        return pool;
    },

    initializeVariant: function(z, hp, baseSpeed) {
        const pool = this.getAvailableTypes(stats.round);
        const selectedType = pool[Math.floor(Math.random() * pool.length)];
        
        z.type = selectedType;
        z.color = '#3a4a38';
        
        if (selectedType === 'purple') {
            z.color = '#8e44ad';
            z.hp = Math.floor(hp * 0.8);
            z.maxHp = z.hp;
        } else if (selectedType === 'red') {
            z.color = '#e74c3c';
            z.hp = Math.floor(hp * 0.9);
            z.maxHp = z.hp;
            z.shootCooldown = 150 + Math.random() * 100;
        } else if (selectedType === 'blue') {
            z.color = '#2980b9';
            z.hp = Math.floor(hp * 2.5);
            z.maxHp = z.hp;
            z.speed = baseSpeed * 0.55;
            z.r = 20;
        } else if (selectedType === 'yellow') {
            z.color = '#f1c40f';
            z.hp = Math.floor(hp * 0.20);
            z.maxHp = z.hp;
            z.speed = baseSpeed * 1.5;
            z.r = 13;
        }
    },

    handleSplittingOnDeath: function(z) {
        if (z.type === 'purple') {
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
    },

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
        
        const multiplier = 1 + (round - 5) * 0.20;

        const bossPool = [
            { type: 'boss_logbreaker', name: "The Golem Smasher", baseHp: 2000, speed: 1.9, r: 30, color: '#ffffff' },
            { type: 'boss_blink', name: "The Warp Phantom", baseHp: 1600, speed: 2.4, r: 24, color: '#9b59b6' },
            { type: 'boss_miasma', name: "The Miasma Horror", baseHp: 2200, speed: 2.2, r: 28, color: '#27ae60' },
            { type: 'boss_rampager', name: "The Rampager", baseHp: 2400, speed: 1.6, r: 32, color: '#e74c3c' },
            { type: 'boss_decayer', name: "The Decayer", baseHp: 1900, speed: 2.1, r: 26, color: '#2ecc71' },
            { type: 'boss_pyromaniac', name: "The Pyromaniac", baseHp: 1800, speed: 1.4, r: 28, color: '#d35400' }
        ];

        if (!window.spawnedBossTypes) window.spawnedBossTypes = [];
        let availableBosses = bossPool.filter(b => !window.spawnedBossTypes.includes(b.type));
        
        if (availableBosses.length === 0) {
            window.spawnedBossTypes = [];
            availableBosses = bossPool;
        }

        const selected = availableBosses[Math.floor(Math.random() * availableBosses.length)];
        window.spawnedBossTypes.push(selected.type);

        boss.type = selected.type;
        boss.name = selected.name;
        boss.maxHp = Math.floor(selected.baseHp * multiplier);
        boss.hp = boss.maxHp;
        boss.speed = selected.speed;
        boss.r = selected.r;
        boss.color = selected.color;

        if (boss.type === 'boss_logbreaker') boss.smashCooldown = 100;
        if (boss.type === 'boss_blink') boss.teleportCooldown = 60;
        if (boss.type === 'boss_miasma') {
            boss.sprayTimer = 100;
            boss.sprayAngle = 0;
            boss.isSpraying = false;
            boss.sprayAttackType = 'FOCUSED';
            boss.rotateDirection = 1;
        }
        if (boss.type === 'boss_rampager') {
            boss.chargeState = 'WALK';
            boss.chargeTimer = 100;
            boss.chargeAttackType = 'HEAVY';
            boss.rapidCount = 0;
        }
        if (boss.type === 'boss_decayer') {
            boss.poolTimer = 15;
            boss.spitTimer = 90;
        }
        if (boss.type === 'boss_pyromaniac') boss.mortarTimer = 120;

        zombies.push(boss);
        window.activeBoss = boss;
        stats.zombiesToSpawn = 0;
        stats.zombiesAlive = 1;
        
        if (typeof discoverBoss === 'function') {
            discoverBoss(boss.type);
        }
        
        addText(me.x, me.y - 120, `⚠️ BOSS INCOMING: ${boss.name}!`, "#e74c3c");
    },

    updateSpecialBehaviors: function(z) {
        // 1. Golem Smasher: Viewport shockwaves & alabaster earth fractures
        if (z.type === 'boss_logbreaker') {
            if (z.smashCooldown === undefined) z.smashCooldown = 100;
            z.smashCooldown--;
            
            // Process sequential seismic fracture wave
            if (z.activeFissures) {
                for (let i = z.activeFissures.length - 1; i >= 0; i--) {
                    let f = z.activeFissures[i];
                    f.timer--;
                    if (f.timer <= 0) {
                        // Spawns a custom alabaster shockwave fracture expanding ring
                        window.groundSmashes.push({ 
                            x: f.x, y: f.y, r: 5, maxR: 110, life: 25, 
                            color: 'rgba(236, 240, 241, ALPHA)' 
                        });
                        window.screenShake = 15; // Camera shake pop per fissure step
                        
                        // Deal damage along this specific fissure point
                        if (!f.damageDealt) {
                            f.damageDealt = true;
                            Object.values(players).forEach(pl => {
                                if (pl.state === 'ALIVE' && Math.hypot(pl.x - f.x, pl.y - f.y) < 110) {
                                    if (pl.invincibleTimer && pl.invincibleTimer > 0) return; 

                                    pl.hp -= 25;
                                    pl.invincibleTimer = 35; 
                                    addText(pl.x, pl.y, "-25 HP (Seismic Fracture!)", "#e74c3c");
                                    if (pl.hp <= 0) {
                                        pl.state = 'DOWNED';
                                        pl.reviveTimer = pl.hasVigor ? 300 : -1;
                                    }
                                }
                            });
                        }
                        
                        // Generate white/light-grey rock dust explosion particles
                        if (typeof spawnParticles === 'function') {
                            spawnParticles(f.x, f.y, '#ffffff', 8);
                        }
                        z.activeFissures.splice(i, 1);
                    }
                }
            }

            if (z.smashCooldown <= 0) {
                z.smashCooldown = 160 + Math.random() * 80;
                
                let target = null, minDist = 9999;
                Object.values(players).forEach(p => {
                    if (p.state === 'ALIVE') {
                        let d = Math.hypot(p.x - z.x, p.y - z.y);
                        if (d < minDist) { minDist = d; target = p; }
                    }
                });

                if (target) {
                    let angle = Math.atan2(target.y - z.y, target.x - z.x);
                    z.activeFissures = [];
                    
                    // Creates 7 shockwaves moving away from the boss toward target player
                    for (let step = 0; step < 7; step++) {
                        z.activeFissures.push({
                            x: z.x + Math.cos(angle) * (step * 65),
                            y: z.y + Math.sin(angle) * (step * 65),
                            timer: step * 7, // Sequence staggered by 7 frames per step
                            damageDealt: false
                        });
                    }
                    addText(z.x, z.y, "❄️ SEISMIC FRACTURE TRAIL!", "#ffffff");
                    if (typeof SoundSystem !== 'undefined') SoundSystem.play('zombie_hurt');
                }
            }
        }

        // 2. Warp Phantom: Teleports around, locked until hasEntered === true
        if (z.type === 'boss_blink') {
            if (z.hasEntered) {
                if (z.teleportCooldown === undefined) z.teleportCooldown = 60;
                z.teleportCooldown--;
                if (z.teleportCooldown <= 0) {
                    z.teleportCooldown = 100 + Math.random() * 60;
                    
                    let target = null, minDist = 9999;
                    Object.values(players).forEach(p => {
                        if (p.state === 'ALIVE') {
                            let d = Math.hypot(p.x - z.x, p.y - z.y);
                            if (d < minDist) { minDist = d; target = p; }
                        }
                    });
                    
                    if (target) {
                        let warpX = 0, warpY = 0, foundSpot = false;
                        
                        for (let attempts = 0; attempts < 25; attempts++) {
                            const angle = Math.random() * Math.PI * 2;
                            const offset = 80 + Math.random() * 120;
                            const testX = target.x + Math.cos(angle) * offset;
                            const testY = target.y + Math.sin(angle) * offset;
                            
                            if (isPointInUnlockedArea(testX, testY, z.r)) {
                                warpX = testX;
                                warpY = testY;
                                foundSpot = true;
                                break;
                            }
                        }
                        
                        if (foundSpot) {
                            spawnParticles(z.x, z.y, '#9b59b6', 15);
                            z.x = warpX;
                            z.y = warpY;
                            spawnParticles(z.x, z.y, '#3498db', 10);
                            addText(z.x, z.y, "💫 WARP!", "#9b59b6");
                        }
                    }
                }
            }
        }

        // 3. Miasma Horror: OVERHAULED Stationary focused spray & Rotating typhoons with physical vacuum pulls
        if (z.type === 'boss_miasma') {
            if (z.sprayTimer === undefined) {
                z.sprayTimer = 100;
                z.sprayAngle = 0;
                z.isSpraying = false;
                z.sprayAttackType = 'FOCUSED';
                z.rotateDirection = 1;
            }
            
            if (z.isSpraying) {
                z.speed = 0; // Stays stationary during attacks
                z.sprayTimer--;
                
                let target = null, minDist = 9999;
                Object.values(players).forEach(p => {
                    if (p.state === 'ALIVE') {
                        let d = Math.hypot(p.x - z.x, p.y - z.y);
                        if (d < minDist) { minDist = d; target = p; }
                    }
                });
                
                if (z.sprayAttackType === 'ROTATING') {
                    // Randomly whip-reverse spinning directions mid-typhoon every 60 frames
                    if (z.sprayTimer % 60 === 0) {
                        z.rotateDirection *= -1;
                        addText(z.x, z.y - 45, "🔄 REVERSING!", "#ff4757");
                    }
                    
                    z.sprayAngle += 0.075 * z.rotateDirection; // Rapid rotational speed
                    
                    // Spray 6 dense opposing sweeping beams
                    if (z.sprayTimer % 2 === 0) {
                        for (let j = 0; j < 6; j++) {
                            const angle = z.sprayAngle + (j * Math.PI * 2 / 6);
                            window.toxicClouds.push({
                                x: z.x,
                                y: z.y,
                                vx: Math.cos(angle) * 12.5,
                                vy: Math.sin(angle) * 12.5,
                                r: 10,
                                life: 25 // Dissipate instantly to maintain rotating hazard gaps
                            });
                        }
                    }
                    
                    // ACCELERATIVE VACUUM PULL: Drag players within a 450px radius towards the rotating hazard core
                    Object.values(players).forEach(pl => {
                        if (pl.state === 'ALIVE') {
                            let d = Math.hypot(pl.x - z.x, pl.y - z.y);
                            if (d < 450) {
                                let pullAngle = Math.atan2(z.y - pl.y, z.x - pl.x);
                                let pullSpeed = 2.4; 
                                if (!RoomSystem.checkCollision(pl.x + Math.cos(pullAngle) * pullSpeed, pl.y, true)) {
                                    pl.x += Math.cos(pullAngle) * pullSpeed;
                                }
                                if (!RoomSystem.checkCollision(pl.x, pl.y + Math.sin(pullAngle) * pullSpeed, true)) {
                                    pl.y += Math.sin(pullAngle) * pullSpeed;
                                }
                                // Draw atmospheric vacuum lines
                                if (Math.random() < 0.15) {
                                    particles.push({
                                        x: pl.x,
                                        y: pl.y,
                                        vx: Math.cos(pullAngle) * 5,
                                        vy: Math.sin(pullAngle) * 5,
                                        life: 15,
                                        color: '#27ae60'
                                    });
                                }
                            }
                        }
                    });
                } else {
                    // FOCUSED BLAST: Focus a direct high-speed flamethrower cone at players
                    if (target) {
                        let targetAngle = Math.atan2(target.y - z.y, target.x - z.x);
                        z.angle = targetAngle; 
                        
                        if (z.sprayTimer % 2 === 0) {
                            const angle = targetAngle + (Math.random() - 0.5) * 0.25; // Narrow cone
                            window.toxicClouds.push({
                                x: z.x,
                                y: z.y,
                                vx: Math.cos(angle) * 14.5, // Extreme lunge velocity
                                vy: Math.sin(angle) * 14.5,
                                r: 12,
                                life: 90 
                            });
                        }
                    }
                }
                
                if (z.sprayTimer <= 0) {
                    z.isSpraying = false;
                    z.sprayTimer = 120 + Math.random() * 40; 
                }
            } else {
                z.speed = 2.4; 
                z.sprayTimer--;
                if (z.sprayTimer <= 0) {
                    z.isSpraying = true;
                    z.sprayAttackType = Math.random() < 0.5 ? 'FOCUSED' : 'ROTATING';
                    
                    if (z.sprayAttackType === 'ROTATING') {
                        z.sprayTimer = 180; // Cyclone sweep timer
                        z.sprayAngle = Math.random() * Math.PI * 2;
                        addText(z.x, z.y, "🤢 MIASMA CYCLONE + PULL!", "#27ae60");
                    } else {
                        z.sprayTimer = 110; // Focused burst timer
                        addText(z.x, z.y, "🤢 MIASMA STREAM!", "#27ae60");
                    }
                }
            }
        }

        // 4. The Rampager: standard pathfinding navigation + LOS-based charges
        if (z.type === 'boss_rampager') {
            // PASSIVE ANTI-STUCK: Gently nudges the Rampager if he is ever inside a wall
            if (RoomSystem.checkCollision(z.x, z.y, false, z.r - 4)) {
                let target = null, minDist = 9999;
                Object.values(players).forEach(p => {
                    if (p.state === 'ALIVE') {
                        let d = Math.hypot(p.x - z.x, p.y - z.y);
                        if (d < minDist) { minDist = d; target = p; }
                    }
                });
                if (target) {
                    let escapeAngle = Math.atan2(target.y - z.y, target.x - z.x);
                    z.x += Math.cos(escapeAngle) * 2;
                    z.y += Math.sin(escapeAngle) * 2;
                }
            }

            if (z.chargeState === undefined) {
                z.chargeState = 'WALK';
                z.chargeTimer = 100;
                z.chargeAttackType = 'HEAVY';
                z.rapidCount = 0;
            }
            
            if (z.chargeState === 'WALK') {
                z.chargeTimer--;
                let target = null, minDist = 9999;
                Object.values(players).forEach(p => {
                    if (p.state === 'ALIVE') {
                        let d = Math.hypot(p.x - z.x, p.y - z.y);
                        if (d < minDist) { minDist = d; target = p; }
                    }
                });
                
                if (target) {
                    // Only begin charging once a clear Line-Of-Sight is secured [2]
                    if (z.chargeTimer <= 0 && hasLineOfSight(z.x, z.y, target.x, target.y)) {
                        z.chargeAttackType = Math.random() < 0.5 ? 'HEAVY' : 'RAPID';
                        
                        if (z.chargeAttackType === 'RAPID') {
                            z.rapidCount = 3;
                            z.chargeState = 'TELEGRAPH';
                            z.chargeTimer = 15;
                            z.chargeAngle = Math.atan2(target.y - z.y, target.x - z.x);
                            addText(z.x, z.y, "🐂 RAPID CHARGE COMBO!", "#ffaa00");
                        } else {
                            z.chargeState = 'TELEGRAPH';
                            z.chargeTimer = 40;
                            z.chargeAngle = Math.atan2(target.y - z.y, target.x - z.x);
                            addText(z.x, z.y, "⚠️ LOCKING ON...", "#e74c3c");
                        }
                    } else if (z.chargeTimer <= 0) {
                        z.chargeTimer = 25; // Reset timer to allow corner navigation
                    }
                } else z.chargeTimer = 40;
            }
            else if (z.chargeState === 'TELEGRAPH') {
                z.chargeTimer--;
                z.speed = 0;
                if (z.chargeTimer <= 0) {
                    z.chargeState = 'CHARGE';
                    z.chargeTimer = (z.chargeAttackType === 'RAPID') ? 18 : 35;
                }
            }
            else if (z.chargeState === 'CHARGE') {
                z.speed = 0;
                const ramSpeed = (z.chargeAttackType === 'RAPID') ? 20 : 24;
                const nextX = z.x + Math.cos(z.chargeAngle) * ramSpeed;
                const nextY = z.y + Math.sin(z.chargeAngle) * ramSpeed;
                
                z.chargeTimer--;
                
                // Optimized collision radius for smoother movement
                let collisionRadius = 18;
                let directCollision = RoomSystem.checkCollision(nextX, nextY, false, collisionRadius);
                let hitWall = false;

                if (!directCollision) {
                    z.x = nextX;
                    z.y = nextY;
                } else {
                    // Direct path blocked! Check perpendicular shifts (slide left or right)
                    let slideLeftAngle = z.chargeAngle - Math.PI / 2;
                    let slideRightAngle = z.chargeAngle + Math.PI / 2;
                    let slideDist = 12;

                    let leftX = z.x + Math.cos(slideLeftAngle) * slideDist;
                    let leftY = z.y + Math.sin(slideLeftAngle) * slideDist;
                    let rightX = z.x + Math.cos(slideRightAngle) * slideDist;
                    let rightY = z.y + Math.sin(slideRightAngle) * slideDist;

                    let canSlideLeft = !RoomSystem.checkCollision(leftX, leftY, false, collisionRadius) &&
                                       !RoomSystem.checkCollision(leftX + Math.cos(z.chargeAngle) * ramSpeed, leftY + Math.sin(z.chargeAngle) * ramSpeed, false, collisionRadius);

                    let canSlideRight = !RoomSystem.checkCollision(rightX, rightY, false, collisionRadius) &&
                                        !RoomSystem.checkCollision(rightX + Math.cos(z.chargeAngle) * ramSpeed, rightY + Math.sin(z.chargeAngle) * ramSpeed, false, collisionRadius);

                    if (canSlideLeft && canSlideRight) {
                        // Choose perpendicular slide direction that targets the closest survivor
                        let target = null, minDist = 9999;
                        Object.values(players).forEach(p => {
                            if (p.state === 'ALIVE') {
                                let d = Math.hypot(p.x - z.x, p.y - z.y);
                                if (d < minDist) { minDist = d; target = p; }
                            }
                        });
                        if (target) {
                            let dLeft = Math.hypot(target.x - leftX, target.y - leftY);
                            let dRight = Math.hypot(target.x - rightX, target.y - rightY);
                            if (dLeft < dRight) {
                                z.x = leftX + Math.cos(z.chargeAngle) * ramSpeed;
                                z.y = leftY + Math.sin(z.chargeAngle) * ramSpeed;
                            } else {
                                z.x = rightX + Math.cos(z.chargeAngle) * ramSpeed;
                                z.y = rightY + Math.sin(z.chargeAngle) * ramSpeed;
                            }
                        } else {
                            z.x = leftX + Math.cos(z.chargeAngle) * ramSpeed;
                            z.y = leftY + Math.sin(z.chargeAngle) * ramSpeed;
                        }
                    } else if (canSlideLeft) {
                        z.x = leftX + Math.cos(z.chargeAngle) * ramSpeed;
                        z.y = leftY + Math.sin(z.chargeAngle) * ramSpeed;
                    } else if (canSlideRight) {
                        z.x = rightX + Math.cos(z.chargeAngle) * ramSpeed;
                        z.y = rightY + Math.sin(z.chargeAngle) * ramSpeed;
                    } else {
                        // Completely blocked both sideways and forward -> HALT AND STUN
                        hitWall = true;
                    }
                }
                
                if (hitWall || z.chargeTimer <= 0) {
                    if (z.chargeAttackType === 'RAPID') {
                        z.rapidCount--;
                        
                        // Push away from obstacles to prevent getting stuck
                        if (hitWall) {
                            const bDist = z.r + 5;
                            const bX = z.x - Math.cos(z.chargeAngle) * bDist;
                            const bY = z.y - Math.sin(z.chargeAngle) * bDist;
                            if (isPointInUnlockedArea(bX, bY, z.r)) {
                                z.x = bX; z.y = bY;
                            } else {
                                let moved = false;
                                for (let offset = 0; offset < Math.PI * 2; offset += Math.PI / 4) {
                                    const testX = z.x + Math.cos(z.chargeAngle + Math.PI + offset) * bDist;
                                    const testY = z.y + Math.sin(z.chargeAngle + Math.PI + offset) * bDist;
                                    if (isPointInUnlockedArea(testX, testY, z.r)) {
                                        z.x = testX; z.y = testY; moved = true; break;
                                    }
                                }
                                if (!moved) {
                                    z.x += (Math.random() - 0.5) * 30;
                                    z.y += (Math.random() - 0.5) * 30;
                                }
                            }
                        }
                        
                        if (z.rapidCount > 0) {
                            let target = null, minDist = 9999;
                            Object.values(players).forEach(p => {
                                if (p.state === 'ALIVE') {
                                    let d = Math.hypot(p.x - z.x, p.y - z.y);
                                    if (d < minDist) { minDist = d; target = p; }
                                }
                            });
                            
                            z.chargeState = 'TELEGRAPH';
                            z.chargeTimer = 12;
                            if (target) {
                                z.chargeAngle = Math.atan2(target.y - z.y, target.x - z.x);
                            } else {
                                z.chargeAngle += (Math.random() - 0.5) * 1.5;
                            }
                            addText(z.x, z.y, "⚡ NEXT CHARGE!", "#ffaa00");
                        } else {
                            z.chargeState = 'COOLDOWN';
                            z.chargeTimer = 35;
                            addText(z.x, z.y, "😵 TIRED...", "#ffd700");
                        }
                    } else {
                        z.chargeState = 'COOLDOWN';
                        z.chargeTimer = 50;
                        window.screenShake = 14;
                        addText(z.x, z.y, "😵 STUNNED!", "#ffd700");
                        
                        // Push away from obstacles to prevent getting stuck
                        if (hitWall) {
                            const bDist = z.r + 8;
                            const bX = z.x - Math.cos(z.chargeAngle) * bDist;
                            const bY = z.y - Math.sin(z.chargeAngle) * bDist;
                            if (isPointInUnlockedArea(bX, bY, z.r)) {
                                z.x = bX; z.y = bY;
                            } else {
                                let moved = false;
                                for (let offset = 0; offset < Math.PI * 2; offset += Math.PI / 4) {
                                    const testX = z.x + Math.cos(z.chargeAngle + Math.PI + offset) * bDist;
                                    const testY = z.y + Math.sin(z.chargeAngle + Math.PI + offset) * bDist;
                                    if (isPointInUnlockedArea(testX, testY, z.r)) {
                                        z.x = testX; z.y = testY; moved = true; break;
                                    }
                                }
                                if (!moved) {
                                    z.x += (Math.random() - 0.5) * 40;
                                    z.y += (Math.random() - 0.5) * 40;
                                }
                            }
                        }
                    }
                } else {
                    Object.values(players).forEach(pl => {
                        if (pl.state === 'ALIVE' && Math.hypot(pl.x - z.x, pl.y - z.y) < z.r + pl.r) {
                            if (pl.invincibleTimer && pl.invincibleTimer > 0) return; 

                            if (z.chargeAttackType === 'RAPID') {
                                pl.hp -= 15;
                                pl.invincibleTimer = 35; 
                                pl.x += Math.cos(z.chargeAngle) * 20;
                                pl.y += Math.sin(z.chargeAngle) * 20;
                                addText(pl.x, pl.y, "-15 HP (Trampled!)", "#ffaa00");
                            } else {
                                pl.hp -= 45;
                                pl.invincibleTimer = 45; 
                                pl.x += Math.cos(z.chargeAngle) * 55;
                                pl.y += Math.sin(z.chargeAngle) * 55;
                                addText(pl.x, pl.y, "-45 HP (Rammed!)", "#ff4757");
                            }
                            if (pl.hp <= 0) {
                                pl.state = 'DOWNED';
                                pl.reviveTimer = pl.hasVigor ? 300 : -1;
                            }
                        }
                    });
                }
            }
            else if (z.chargeState === 'COOLDOWN') {
                z.speed = 0;
                z.chargeTimer--;
                if (z.chargeTimer <= 0) {
                    z.chargeState = 'WALK';
                    z.chargeTimer = 80 + Math.random() * 40;
                    z.speed = 1.6;
                }
            }
        }

        // 5. The Decayer: Passive acid trails + active Acid Spit attack glob
        if (z.type === 'boss_decayer') {
            if (z.poolTimer === undefined) z.poolTimer = 15;
            z.poolTimer--;
            if (z.poolTimer <= 0) {
                z.poolTimer = 15;
                window.acidPools.push({ x: z.x, y: z.y, r: 35, life: 360 });
            }

            if (z.spitTimer === undefined) z.spitTimer = 90;
            z.spitTimer--;
            if (z.spitTimer <= 0) {
                z.spitTimer = 90 + Math.random() * 50;
                let target = null, minDist = 9999;
                Object.values(players).forEach(p => {
                    if (p.state === 'ALIVE') {
                        let d = Math.hypot(p.x - z.x, p.y - z.y);
                        if (d < minDist) { minDist = d; target = p; }
                    }
                });
                if (target) {
                    let angle = Math.atan2(target.y - z.y, target.x - z.x);
                    window.zombieArrows.push({
                        x: z.x, y: z.y,
                        vx: Math.cos(angle) * 8.5,
                        vy: Math.sin(angle) * 8.5,
                        life: 120,
                        isAcidSpit: true
                    });
                    addText(z.x, z.y, "🤢 ACID SPIT!", "#2ecc71");
                }
            }
        }

        // 6. The Pyromaniac: Launches fast high-angle dual mortar shells
        if (z.type === 'boss_pyromaniac') {
            if (z.mortarTimer === undefined) z.mortarTimer = 120;
            z.mortarTimer--;
            z.speed = (z.mortarTimer < 45) ? 0 : 1.4;
            
            if (z.mortarTimer <= 0) {
                z.mortarTimer = 120 + Math.random() * 60;
                
                let activeTargets = Object.values(players).filter(p => p.state === 'ALIVE');
                if (activeTargets.length >= 2) {
                    window.mortarTargets.push({ x: activeTargets[0].x, y: activeTargets[0].y, delay: 50, r: 55 });
                    window.mortarTargets.push({ x: activeTargets[1].x, y: activeTargets[1].y, delay: 50, r: 55 });
                } else if (activeTargets.length === 1) {
                    let p = activeTargets[0];
                    window.mortarTargets.push({ x: p.x, y: p.y, delay: 50, r: 55 });
                    
                    let angle = Math.random() * Math.PI * 2;
                    let dist = 140 + Math.random() * 90;
                    let adjX = p.x + Math.cos(angle) * dist;
                    let adjY = p.y + Math.sin(angle) * dist;
                    
                    if (isPointInUnlockedArea(adjX, adjY, z.r)) {
                        window.mortarTargets.push({ x: adjX, y: adjY, delay: 50, r: 55 });
                    } else {
                        window.mortarTargets.push({ x: p.x + (Math.random() - 0.5) * 140, y: p.y + (Math.random() - 0.5) * 140, delay: 50, r: 55 });
                    }
                }
                addText(z.x, z.y, "🔥 DUAL MORTAR!", "#e67e22");
            }
        }

        // Archer Projectile logic (standard Red variants only)
        if (z.type === 'red') {
            z.shootCooldown--;
            if (z.shootCooldown <= 0) {
                let target = null, minDist = 9999;
                Object.values(players).forEach(p => {
                    if (p.state === 'ALIVE') {
                        let d = Math.hypot(p.x - z.x, p.y - z.y);
                        if (d < minDist) { minDist = d; target = p; }
                    }
                });
                if (target) {
                    let angle = Math.atan2(target.y - z.y, target.x - z.x);
                    window.zombieArrows.push({ x: z.x, y: z.y, vx: Math.cos(angle) * 7.5, vy: Math.sin(angle) * 7.5, life: 180 });
                    z.shootCooldown = 180 + Math.random() * 120;
                    addText(z.x, z.y, "🏹", "#e74c3c");
                }
            }
        }
    },

    updateProjectiles: function() {
        for (let i = window.zombieArrows.length - 1; i >= 0; i--) {
            let a = window.zombieArrows[i];
            a.x += a.vx;
            a.y += a.vy;
            a.life--;
            
            let hit = false;
            if (RoomSystem.checkCollision(a.x, a.y, false)) hit = true;
            
            Object.values(players).forEach(p => {
                if (!hit && p.state === 'ALIVE' && Math.hypot(p.x - a.x, p.y - a.y) < p.r + 4) {
                    if (p.invincibleTimer && p.invincibleTimer > 0) return; 
                    hit = true;
                    p.hp -= a.isAcidSpit ? 10 : 15;
                    p.invincibleTimer = 20; 
                    if (p === me) {
                        const flash = document.getElementById('damage-flash');
                        if (flash) {
                            flash.style.boxShadow = "inset 0 0 80px rgba(180, 0, 0, 0.9)";
                            flash.style.border = "12px solid rgba(180, 0, 0, 0.7)";
                            flash.style.background = "rgba(180, 0, 0, 0.15)";
                            setTimeout(() => {
                                flash.style.boxShadow = "none"; flash.style.border = "none"; flash.style.background = "transparent";
                            }, 150);
                        }
                    }
                    if (p.hp <= 0) {
                        p.state = 'DOWNED';
                        p.reviveTimer = p.hasVigor ? 300 : -1;
                        if (p.hasVigor) addText(p.x, p.y, "VIGOR SAVED YOU!", "#f00");
                        else addText(p.x, p.y, "DOWNED!", "#f00");
                    }
                }
            });
            
            if (hit || a.life <= 0) {
                if (a.isAcidSpit) {
                    window.acidPools.push({ x: a.x, y: a.y, r: 40, life: 360 });
                    if (typeof spawnParticles === 'function') spawnParticles(a.x, a.y, '#2ecc71', 8);
                }
                window.zombieArrows.splice(i, 1);
            }
        }
    }
};