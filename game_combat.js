/* --- COMBAT SYSTEMS: BULLET PHYSICS, EXPLOSIVES & POWER-UPS --- */

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; 
        if (!b) continue; 
        b.x += b.vx; 
        b.y += b.vy; 
        b.life--; 
        let hit = false;
        if (RoomSystem.checkCollision(b.x, b.y, false)) { 
            hit = true; 
            if (b.type === 'explosive') triggerExplosion(b); 
            else spawnSparks(b.x, b.y, b.vx, b.vy); 
        }

        if (!hit && typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
            Object.values(players).forEach(p => {
                if (!hit && p.state === 'ALIVE' && InfectionMode.infectedIds.has(p.id) && Math.hypot(b.x - p.x, b.y - p.y) < p.r + 5) {
                    hit = true;
                    if (b.type === 'explosive') {
                        triggerExplosion(b);
                    } else {
                        p.hp -= b.dmg;
                        p.hitTimer = 4;
                        spawnParticles(p.x, p.y, '#2ecc71', 4);

                        if (p.hp <= 0) {
                            InfectionMode.handleInfectedDeath(p.id);
                            
                            const shooter = players[b.ownerId];
                            if (shooter) {
                                shooter.score += GameBalanceConfig.SCORE_ZOMBIE_KILL;
                                shooter.kills++;
                                addPlayerXP(shooter, GameBalanceConfig.XP_ZOMBIE_KILL);
                                if (b.ownerId === 'p1') {
                                    saveData.lobbyCoins = (saveData.lobbyCoins || 0) + GameBalanceConfig.LOBBY_COINS_PER_KILL;
                                }
                            }
                        }
                    }
                }
            });
        }

        if (!hit) zombies.forEach((z) => {
            if (!z || z.dead || z.hp <= 0) return;
            if (!hit && Math.hypot(b.x - z.x, b.y - z.y) < z.r + 5) {
                hit = true; 
                if (b.type === 'explosive') triggerExplosion(b);
                else {
                    let dmgValue = b.dmg; 
                    if (window.instaKillTimer > 0) dmgValue = z.hp; 
                    z.hp -= dmgValue; 
                    z.hitTimer = 4; 
                    spawnParticles(z.x, z.y, '#800', 3); 
                    if (typeof SoundSystem !== 'undefined') SoundSystem.play('zombie_hurt'); 
                    if (Math.random() < 0.45) { 
                        window.bloodStains.push({ 
                            x: z.x + (Math.random() - 0.5) * 12, 
                            y: z.y + (Math.random() - 0.5) * 12, 
                            r: 4 + Math.random() * 12, 
                            color: 'rgba(139, 0, 0, ' + (0.3 + Math.random() * 0.35) + ')' 
                        }); 
                        if (window.bloodStains.length > 150) window.bloodStains.shift(); 
                    }
                    if (!z.lastHitPointFrame || z.lastHitPointFrame !== stats.frame) {
                        z.lastHitPointFrame = stats.frame; 
                        let pointsHit = GameBalanceConfig.SCORE_ZOMBIE_HIT; 
                        if (window.doublePointsTimer > 0) pointsHit *= 2;
                        if (players[b.ownerId]) { 
                            players[b.ownerId].score += pointsHit; 
                            stats.score += pointsHit; 
                            addPlayerXP(players[b.ownerId], GameBalanceConfig.XP_ZOMBIE_HIT); 
                        }
                        if (me && b.ownerId === me.id) addText(z.x, z.y, "+" + pointsHit, "#fff"); 
                    }
                    if (z.hp <= 0) {
                        z.dead = true; 
                        let pointsKill = GameBalanceConfig.SCORE_ZOMBIE_KILL; 
                        if (window.doublePointsTimer > 0) pointsKill *= 2; 
                        stats.score += pointsKill; 
                        stats.zombiesAlive--;
                        if (players[b.ownerId]) { 
                            players[b.ownerId].score += pointsKill; 
                            players[b.ownerId].kills++; 
                            addPlayerXP(players[b.ownerId], GameBalanceConfig.XP_ZOMBIE_KILL); 
                            if (b.ownerId === 'p1') saveData.lobbyCoins = (saveData.lobbyCoins || 0) + GameBalanceConfig.LOBBY_COINS_PER_KILL; 
                        }
                        if (me && b.ownerId === me.id) { 
                            stats.sessionKills++; 
                            checkAchievements(); 
                            addText(me.x, me.y - 40, "+" + pointsKill, "#ff0"); 
                        }
                        if (typeof ZombieVariants !== 'undefined') { 
                            ZombieVariants.handleSplittingOnDeath(z); 
                            if (z.isBoss && window.activeBoss && window.activeBoss.id === z.id) { 
                                window.activeBoss = null; 
                                addText(z.x, z.y - 40, "BOSS SLAIN!", "#f1c40f"); 
                                if (typeof defeatBoss === 'function') defeatBoss(z.type); 
                            } 
                        }
                        if (Network.mode !== 'CLIENT') {
                            if (Math.random() < GameBalanceConfig.POWERUP_DROP_CHANCE) {
                                const powerups = ['MAX_AMMO', 'NUKE', 'DOUBLE_POINTS', 'INSTA_KILL'];
                                const selected = powerups[Math.floor(Math.random() * powerups.length)];
                                window.drops.push({ x: z.x, y: z.y, type: selected, life: GameBalanceConfig.POWERUP_DURATION_FRAMES }); 
                                addText(z.x, z.y, "POWER-UP!", "#ffd700");
                            }
                        }
                    }
                }
            }
        });
        if (hit || b.life <= 0) bullets.splice(i, 1);
    }
    zombies = zombies.filter(z => z && !z.dead);
}

function triggerExplosion(b) {
    const explosionRadius = 150;
    
    zombies.forEach(z => {
        if (z.dead || z.hp <= 0) return; 
        let dist = Math.hypot(b.x - z.x, b.y - z.y);
        if (dist < explosionRadius) {
            let falloff = 1 - (dist / explosionRadius);
            let bulletDmg = b.dmg; 
            if (window.instaKillTimer > 0) bulletDmg = z.hp; 
            let splashDmg = Math.floor(bulletDmg * falloff);
            if (splashDmg > 0) {
                z.hp -= splashDmg; 
                z.hitTimer = 6; 
                spawnParticles(z.x, z.y, '#e67e22', 3);
                if (!z.lastHitPointFrame || z.lastHitPointFrame !== stats.frame) {
                    z.lastHitPointFrame = stats.frame; 
                    let pointsHit = GameBalanceConfig.SCORE_ZOMBIE_HIT; 
                    if (window.doublePointsTimer > 0) pointsHit *= 2;
                    if (players[b.ownerId]) { 
                        players[b.ownerId].score += pointsHit; 
                        stats.score += pointsHit; 
                        addPlayerXP(players[b.ownerId], GameBalanceConfig.XP_ZOMBIE_HIT); 
                    }
                }
                if (z.hp <= 0) {
                    z.dead = true; 
                    let pointsKill = GameBalanceConfig.SCORE_ZOMBIE_KILL; 
                    if (window.doublePointsTimer > 0) pointsKill *= 2; 
                    stats.score += pointsKill; 
                    stats.zombiesAlive--;
                    if (players[b.ownerId]) { 
                        players[b.ownerId].score += pointsKill; 
                        players[b.ownerId].kills++; 
                        addPlayerXP(players[b.ownerId], GameBalanceConfig.XP_ZOMBIE_KILL); 
                        if (b.ownerId === 'p1') saveData.lobbyCoins = (saveData.lobbyCoins || 0) + GameBalanceConfig.LOBBY_COINS_PER_KILL; 
                    }
                    if (me && b.ownerId === me.id) { 
                        stats.sessionKills++; 
                        checkAchievements(); 
                        addText(me.x, me.y - 40, "+" + pointsKill, "#ff0"); 
                    }
                    if (typeof ZombieVariants !== 'undefined') { 
                        ZombieVariants.handleSplittingOnDeath(z); 
                        if (z.isBoss && window.activeBoss && window.activeBoss.id === z.id) { 
                            window.activeBoss = null; 
                            addText(z.x, z.y - 40, "BOSS SLAIN!", "#f1c40f"); 
                            if (typeof defeatBoss === 'function') defeatBoss(z.type); 
                        } 
                    }
                    if (Network.mode !== 'CLIENT') {
                        if (Math.random() < GameBalanceConfig.POWERUP_DROP_CHANCE) {
                            const powerups = ['MAX_AMMO', 'NUKE', 'DOUBLE_POINTS', 'INSTA_KILL'];
                            const selected = powerups[Math.floor(Math.random() * powerups.length)];
                            window.drops.push({ x: z.x, y: z.y, type: selected, life: GameBalanceConfig.POWERUP_DURATION_FRAMES }); 
                            addText(z.x, z.y, "POWER-UP!", "#ffd700");
                        }
                    }
                }
            }
        }
    });

    if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
        Object.values(players).forEach(p => {
            if (InfectionMode.infectedIds.has(p.id) && p.state === 'ALIVE') {
                let dist = Math.hypot(b.x - p.x, b.y - p.y);
                if (dist < explosionRadius) {
                    let falloff = 1 - (dist / explosionRadius);
                    let splashDmg = Math.floor(b.dmg * falloff);
                    if (splashDmg > 0) {
                        p.hp -= splashDmg;
                        p.hitTimer = 6;
                        spawnParticles(p.x, p.y, '#2ecc71', 6);

                        if (p.hp <= 0) {
                            InfectionMode.handleInfectedDeath(p.id);
                            
                            const shooter = players[b.ownerId];
                            if (shooter) {
                                shooter.score += GameBalanceConfig.SCORE_ZOMBIE_KILL;
                                shooter.kills++;
                                addPlayerXP(shooter, GameBalanceConfig.XP_ZOMBIE_KILL);
                                if (b.ownerId === 'p1') {
                                    saveData.lobbyCoins = (saveData.lobbyCoins || 0) + GameBalanceConfig.LOBBY_COINS_PER_KILL;
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    spawnExplosionVisuals(b.x, b.y);
}

function spawnExplosionVisuals(x, y) {
    spawnParticles(x, y, '#e67e22', 12); 
    spawnParticles(x, y, '#ffd700', 12); 
    spawnParticles(x, y, '#7f8c8d', 10);
    for (let j = 0; j < 5; j++) { 
        window.bloodStains.push({ 
            x: x + (Math.random() - 0.5) * 80, 
            y: y + (Math.random() - 0.5) * 80, 
            r: 8 + Math.random() * 20, 
            color: 'rgba(139, 0, 0, ' + (0.4 + Math.random() * 0.4) + ')' 
        }); 
    }
    if (window.bloodStains.length > 150) {
        window.bloodStains.splice(0, window.bloodStains.length - 150); 
    }
    addText(x, y, "BOOM!", "#e74c3c");
}

function applyPowerup(type, picker) {
    if (typeof SoundSystem !== 'undefined') SoundSystem.play('powerup');
    if (type === 'MAX_AMMO') { 
        Object.values(players).forEach(p => { 
            if (p.inventory) { 
                p.inventory.forEach(gun => { 
                    gun.ammo = gun.reserve; 
                    gun.clip = gun.mag; 
                }); 
            } 
        }); 
        addText(picker.x, picker.y - 40, "MAX AMMO!", "#2ecc71"); 
    } else if (type === 'NUKE') {
        let nukeReward = GameBalanceConfig.NUKE_POINTS_REWARD; 
        if (window.doublePointsTimer > 0) nukeReward *= 2; 
        zombies.forEach(z => { 
            z.dead = true; 
            stats.zombiesAlive--; 
            if (picker) picker.kills++; 
        }); 
        zombies = [];
        Object.values(players).forEach(p => { 
            p.score += nukeReward; 
            addText(p.x, p.y - 40, "NUKE! +" + nukeReward, "#e74c3c"); 
        }); 
        stats.score += nukeReward;
    } else if (type === 'DOUBLE_POINTS') { 
        window.doublePointsTimer = GameBalanceConfig.POWERUP_DURATION_FRAMES; 
        Object.values(players).forEach(p => addText(p.x, p.y - 40, "DOUBLE POINTS!", "#f39c12")); 
    } else if (type === 'INSTA_KILL') { 
        window.instaKillTimer = GameBalanceConfig.POWERUP_DURATION_FRAMES; 
        Object.values(players).forEach(p => addText(p.x, p.y - 40, "INSTA-KILL!", "#9b59b6")); 
    }
}