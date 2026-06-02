/* --- GAMEPLAY BALANCE CONFIGURATION & LOOP ENGINE --- */
window.GameBalanceConfig = {
    PLAYER_BASE_SPEED: 7.0, PLAYER_REGEN_INTERVAL: 60, PLAYER_INVINCIBILITY_FRAMES: 20,
    ZOMBIE_BASE_DAMAGE: 10, ZOMBIE_DAMAGE_ROUND_SCALE: 4.5, ZOMBIE_DAMAGE_MAX_CAP: 65,
    SCORE_ZOMBIE_HIT: 10, SCORE_ZOMBIE_KILL: 50, XP_ZOMBIE_HIT: 5, XP_ZOMBIE_KILL: 25, LOBBY_COINS_PER_KILL: 1,
    SCORE_WINDOW_REPAIR: 10, XP_WINDOW_REPAIR: 15, WINDOW_REPAIR_COOLDOWN_MS: 500,
    MAX_ZOMBIES_ON_SCREEN: 24, ROUND_TRANSITION_DELAY_MS: 4000, POWERUP_DROP_CHANCE: 0.015,
    POWERUP_DURATION_FRAMES: 1800, NUKE_POINTS_REWARD: 400,
    SPAWN_RATE_EASY: 130, SPAWN_RATE_MEDIUM: 100, SPAWN_RATE_HARD: 70,
    HP_MULTIPLIER_EASY: 0.7, HP_MULTIPLIER_MEDIUM: 1.0, HP_MULTIPLIER_HARD: 1.3,
    WAVE_BASE_EASY: 4, WAVE_SCALAR_EASY: 1.10, WAVE_BASE_MEDIUM: 6, WAVE_SCALAR_MEDIUM: 1.15, WAVE_BASE_HARD: 10, WAVE_SCALAR_HARD: 1.25,
    SPEED_MIN_EASY: 1.2, SPEED_MAX_EASY: 2.5, SPEED_MIN_MEDIUM: 1.8, SPEED_MAX_MEDIUM: 4.5, SPEED_MIN_HARD: 2.5, SPEED_MAX_HARD: 5.5
};

let bulletIdCounter = 0;

// Global helper to cycle through targets for spectating players
window.cycleSpectator = function(dir = 1) {
    let survivors = Object.values(players).filter(p => {
        if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
            return p.state === 'ALIVE' && !InfectionMode.infectedIds.has(p.id);
        }
        return p.state === 'ALIVE';
    });
    if (survivors.length <= 1) return;
    let currentIdx = survivors.findIndex(p => p.id === window.spectateTargetId);
    if (currentIdx === -1) {
        window.spectateTargetId = survivors[0].id;
    } else {
        let nextIdx = (currentIdx + dir + survivors.length) % survivors.length;
        window.spectateTargetId = survivors[nextIdx].id;
    }
};

function loop(currentTime) {
    if (!gameActive) return;
    if (!currentTime) currentTime = performance.now();
    let elapsed = currentTime - lastLoopTime;
    lastLoopTime = currentTime;
    if (elapsed > 250) elapsed = 250;
    accumulator += elapsed;
    let loopCount = 0;
    while (accumulator >= tickRate && loopCount < 10) { 
        updateGameLogic(); 
        accumulator -= tickRate; 
        loopCount++; 
    }
    if (accumulator >= tickRate) accumulator = 0;
    
    let camTarget = me;
    if (me && (me.state === 'SPECTATING' || me.state === 'DOWNED')) {
        let survivors = Object.values(players).filter(p => {
            if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
                return p.state === 'ALIVE' && !InfectionMode.infectedIds.has(p.id);
            }
            return p.state === 'ALIVE';
        });
        if (survivors.length > 0) {
            if (window.spectateTargetId === undefined || !players[window.spectateTargetId] || players[window.spectateTargetId].state !== 'ALIVE') {
                window.spectateTargetId = survivors[0].id;
            }
            camTarget = players[window.spectateTargetId];
        } else {
            camTarget = me;
        }
    } else if (me && me.state !== 'ALIVE') {
        let survivor = Object.values(players).find(p => p.state === 'ALIVE');
        if (survivor) camTarget = survivor;
    }
    
    if (camTarget) {
        const scale = window.getGameScale();
        camera.x = camTarget.x - (canvas.width / scale) / 2; 
        camera.y = camTarget.y - (canvas.height / scale) / 2;
        drawGame(); 
        updateUI();
    } else {
        ctx.fillStyle = "black"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white"; 
        ctx.font = "20px monospace"; 
        ctx.fillText("GAME OVER...", 100, 100);
    }
    if (showScoreboard) {
        drawScoreboard(); 
    } else {
        document.getElementById('scoreboard').style.display = 'none';
    }
    animationFrameId = requestAnimationFrame(loop);
}

function updateGameLogic() {
    if (me) updatePlayerPhysics(me, true);
    
    Object.values(players).forEach(p => {
        if (p !== me && p.serverX !== undefined) { 
            p.x += (p.serverX - p.x) * 0.15; 
            p.y += (p.serverY - p.y) * 0.15; 
        }
        if (p.invincibleTimer > 0) p.invincibleTimer--;
    });

    if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
        InfectionMode.update();
    }

    if (typeof Tutorial !== 'undefined' && Tutorial.isActive) Tutorial.update();
    const altHeld = keys['AltLeft'] || keys['AltRight'];
    if (altHeld && keys['Digit1']) { keys['Digit1'] = false; skipToBossRound(5); }
    if (altHeld && keys['Digit2']) { keys['Digit2'] = false; skipToBossRound(10); }
    if (altHeld && keys['Digit3']) { keys['Digit3'] = false; skipToBossRound(15); }
    if (altHeld && keys['Digit0']) { 
        keys['Digit0'] = false; 
        if (me) me.score += 5000; 
        addText(me ? me.x : 200, (me ? me.y : 200) - 40, "+5,000 Points Cheat", "#2ecc71"); 
    }
    if (altHeld && keys['Digit9']) { 
        keys['Digit9'] = false; 
        if (me) me.hp = me.maxHp; 
        addText(me ? me.x : 200, (me ? me.y : 200) - 40, "Full Heal Cheat", "#00ffff"); 
    }

    if (Network.mode === 'CLIENT') {
        Network.sendClientData(me); 
        Network.checkHostHeartbeat();
        zombies.forEach(z => { 
            if (z.serverX !== undefined) { 
                z.x += (z.serverX - z.x) * 0.15; 
                z.y += (z.serverY - z.y) * 0.15; 
            } 
        });
        bullets.forEach(b => { b.x += b.vx; b.y += b.vy; });
        if (window.zombieArrows) window.zombieArrows.forEach(a => { a.x += a.vx; a.y += a.vy; });
        if (window.doublePointsTimer > 0) window.doublePointsTimer--;
        if (window.instaKillTimer > 0) window.instaKillTimer--;
    } else {
        stats.frame++;
        if (stats.frame % GameBalanceConfig.PLAYER_REGEN_INTERVAL === 0) {
            Object.values(players).forEach(p => { 
                if (p.state === 'ALIVE' && p.hp < p.maxHp) p.hp++; 
            });
        }
        ['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].forEach(pId => {
            const p = players[pId];
            if (p) {
                if (p.state === 'SPECTATING') return; 
                if (p.triggerReload) forceReload(p); 
                p.triggerReload = false;
                if (Network.mode === 'LOCAL_COOP' && pId === 'p2') updateLocalCoopP2(p);
                else updatePlayerPhysics(p, false);
                if (p.triggerInteract) { 
                    processInteraction(p); 
                    p.triggerInteract = false; 
                }
            }
        });

        updateZombies(); 
        updateBullets(); 
        updateEnvironmentalHazards();
        if (typeof ZombieVariants !== 'undefined') ZombieVariants.updateProjectiles();
        
        stats.zombiesAlive = zombies.length; 

        if (typeof InfectionMode === 'undefined' || !InfectionMode.isActive) {
            checkGameFlow(); 
            checkAllDead(); 
        }

        Object.values(players).forEach(p => {
            if (p.isShooting) {
                const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null;
                if (p.isTouch || (gun && gun.auto)) shootGun(p);
                else if (!p.pressHandled) { 
                    shootGun(p); 
                    p.pressHandled = true; 
                }
            } else p.pressHandled = false;
        });

        if (window.doublePointsTimer > 0) window.doublePointsTimer--;
        if (window.instaKillTimer > 0) window.instaKillTimer--;
        for (let i = window.drops.length - 1; i >= 0; i--) {
            let d = window.drops[i]; 
            d.life--; 
            let pickedUp = false;
            Object.values(players).forEach(p => { 
                if (p.state === 'ALIVE' && Math.hypot(p.x - d.x, p.y - d.y) < 32) { 
                    pickedUp = true; 
                    applyPowerup(d.type, p); 
                } 
            });
            if (pickedUp || d.life <= 0) window.drops.splice(i, 1);
        }
        if (Network.mode === 'HOST') Network.broadcastState();
    }
    checkInteractUI();
    for (let i = particles.length - 1; i >= 0; i--) { 
        let p = particles[i]; 
        p.x += p.vx; 
        p.y += p.vy; 
        p.life--; 
        if (p.life <= 0) particles.splice(i, 1); 
    }
    for (let i = texts.length - 1; i >= 0; i--) { 
        let t = texts[i]; 
        t.y -= 1; 
        t.life--; 
        if (t.life <= 0) texts.splice(i, 1); 
    }
}

function updateEnvironmentalHazards() {
    for (let i = window.acidPools.length - 1; i >= 0; i--) { 
        window.acidPools[i].life--; 
        if (window.acidPools[i].life <= 0) window.acidPools.splice(i, 1); 
    }
    for (let i = window.toxicClouds.length - 1; i >= 0; i--) {
        let cloud = window.toxicClouds[i]; 
        cloud.life--;
        if (cloud.vx !== undefined) { 
            cloud.x += cloud.vx; 
            cloud.y += cloud.vy; 
            cloud.vx *= 0.95; 
            cloud.vy *= 0.95; 
            if (cloud.r < 55) cloud.r += 0.35; 
        } else { 
            if (cloud.r < 60) cloud.r += 0.12; 
        }
        if (cloud.life <= 0) window.toxicClouds.splice(i, 1);
    }
    for (let i = window.fireZones.length - 1; i >= 0; i--) { 
        window.fireZones[i].life--; 
        if (window.fireZones[i].life <= 0) window.fireZones.splice(i, 1); 
    }
    for (let i = window.mortarTargets.length - 1; i >= 0; i--) {
        let t = window.mortarTargets[i]; 
        t.delay--;
        if (t.delay <= 0) {
            if (Network.mode !== 'CLIENT') {
                Object.values(players).forEach(p => {
                    if (p.state === 'ALIVE' && Math.hypot(p.x - t.x, p.y - t.y) < t.r) {
                        if (!p.invincibleTimer || p.invincibleTimer <= 0) { 
                            p.hp -= 35; 
                            addText(p.x, p.y, "-35 HP (Explosion!)", "#ff4757"); 
                            if (p.hp <= 0) { 
                                if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
                                    InfectionMode.infectPlayer(p.id, false);
                                } else {
                                    p.state = 'DOWNED'; 
                                    p.reviveTimer = p.hasVigor ? 300 : -1; 
                                }
                            } 
                        }
                    }
                });
                window.fireZones.push({ x: t.x, y: t.y, r: 42, life: 300 });
                while (window.fireZones.length > 3) { 
                    window.fireZones.shift(); 
                }
            }
            if (typeof spawnExplosionVisuals === 'function') spawnExplosionVisuals(t.x, t.y);
            window.mortarTargets.splice(i, 1);
        }
    }
    for (let i = window.groundSmashes.length - 1; i >= 0; i--) { 
        let s = window.groundSmashes[i]; 
        s.life--; 
        s.r += (s.maxR - s.r) * 0.12; 
        if (s.life <= 0) window.groundSmashes.splice(i, 1); 
    }

    if (Network.mode !== 'CLIENT') {
        Object.values(players).forEach(p => {
            if (p.state !== 'ALIVE') return;
            let speedFactor = 1.0;
            let inAcid = window.acidPools.some(pool => Math.hypot(p.x - pool.x, p.y - pool.y) < pool.r + p.r);
            if (inAcid) { 
                speedFactor = Math.min(speedFactor, 0.30); 
                if (stats.frame % 30 === 0) { 
                    p.hp -= 6; 
                    addText(p.x, p.y, "-6 HP (Acid)", "#2ecc71"); 
                    if (p.hp <= 0) { 
                        if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
                            InfectionMode.infectPlayer(p.id, false);
                        } else {
                            p.state = 'DOWNED'; 
                            p.reviveTimer = p.hasVigor ? 300 : -1; 
                        }
                    } 
                } 
            }
            let inToxic = window.toxicClouds.some(cloud => Math.hypot(p.x - cloud.x, p.y - cloud.y) < cloud.r + p.r);
            if (inToxic) { 
                speedFactor = Math.min(speedFactor, 0.65); 
                if (stats.frame % 30 === 0) { 
                    p.hp -= 10; 
                    addText(p.x, p.y, "-10 HP (Gas)", "#27ae60"); 
                    if (p.hp <= 0) { 
                        if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
                            InfectionMode.infectPlayer(p.id, false);
                        } else {
                            p.state = 'DOWNED'; 
                            p.reviveTimer = p.hasVigor ? 300 : -1; 
                        }
                    } 
                } 
            }
            let inFire = window.fireZones.some(fz => Math.hypot(p.x - fz.x, p.y - fz.y) < fz.r + p.r);
            if (inFire) { 
                if (stats.frame % 30 === 0) { 
                    p.hp -= 8; 
                    addText(p.x, p.y, "-8 HP (Burn)", "#e67e22"); 
                    if (p.hp <= 0) { 
                        if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
                            InfectionMode.infectPlayer(p.id, false);
                        } else {
                            p.state = 'DOWNED'; 
                            p.reviveTimer = p.hasVigor ? 300 : -1; 
                        }
                    } 
                } 
            }
            p.speedMultiplier = speedFactor;
        });
    }
}

function updateZombies() {
    if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
        zombies = [];
        stats.zombiesAlive = 0;
        stats.zombiesToSpawn = 0;
        return;
    }

    const currentDiff = stats.difficulty || 'medium'; 
    let spawnRate = GameBalanceConfig.SPAWN_RATE_MEDIUM; 
    if (currentDiff === 'easy') spawnRate = GameBalanceConfig.SPAWN_RATE_EASY; 
    else if (currentDiff === 'hard') spawnRate = GameBalanceConfig.SPAWN_RATE_HARD;
    if (activeMap !== tutorialMapData && stats.zombiesToSpawn > 0 && stats.frame % spawnRate === 0 && stats.zombiesAlive < GameBalanceConfig.MAX_ZOMBIES_ON_SCREEN) {
        let valid = activeMap.spawnPoints.filter(sp => activeMap.rooms[sp.roomId].unlocked);
        if (valid.length > 0) {
            let sp = valid[Math.floor(Math.random() * valid.length)];
            let hpMultiplier = GameBalanceConfig.HP_MULTIPLIER_MEDIUM; 
            if (currentDiff === 'easy') hpMultiplier = GameBalanceConfig.HP_MULTIPLIER_EASY; 
            else if (currentDiff === 'hard') hpMultiplier = GameBalanceConfig.HP_MULTIPLIER_HARD;
            let hp = Math.floor((100 + (stats.round * 30)) * hpMultiplier);
            let speedMin = GameBalanceConfig.SPEED_MIN_MEDIUM, speedMax = GameBalanceConfig.SPEED_MAX_MEDIUM;
            if (currentDiff === 'easy') { 
                speedMin = GameBalanceConfig.SPEED_MIN_EASY; 
                speedMax = GameBalanceConfig.SPEED_MAX_EASY; 
            } else if (currentDiff === 'hard') { 
                speedMin = GameBalanceConfig.SPEED_MIN_HARD; 
                speedMax = GameBalanceConfig.SPEED_MAX_HARD; 
            }
            let zombieSpeed = speedMin + (Math.random() * (speedMax - speedMin)); 
            zombieIdCounter++;
            let z = { id: zombieIdCounter, x: sp.x, y: sp.y, hp: hp, maxHp: hp, speed: zombieSpeed, r: 16, hasEntered: false };
            if (typeof ZombieVariants !== 'undefined') ZombieVariants.initializeVariant(z, hp, zombieSpeed); 
            zombies.push(z); 
            stats.zombiesToSpawn--; 
            stats.zombiesAlive++;
        }
    }
    zombies.forEach((z, i) => {
        let targetX, targetY;
        if (!z.hasEntered) {
            let closestWin = null, minDist = 999999; 
            activeMap.windows.forEach(w => { 
                let d = Math.hypot(z.x - w.entryX, z.y - w.entryY); 
                if (d < minDist) { 
                    minDist = d; 
                    closestWin = w; 
                } 
            });
            if (closestWin) { 
                targetX = closestWin.entryX; 
                targetY = closestWin.entryY; 
                if (Math.hypot(z.x - targetX, z.y - targetY) < 15) z.hasEntered = true; 
            } else z.hasEntered = true;
        }
        if (z.hasEntered) {
            let target = null, minDist = 9999; 
            Object.values(players).forEach(p => { 
                if (p.state === 'ALIVE') { 
                    let d = Math.hypot(p.x - z.x, p.y - z.y); 
                    if (d < minDist) { 
                        minDist = d; 
                        target = p; 
                    } 
                } 
            });
            if (!target) return; 
            targetX = target.x; 
            targetY = target.y;
        }
        let attackingWindow = null; 
        for (let w of activeMap.windows) { 
            if (w.boards > 0) { 
                if (z.x > w.x - 35 && z.x < w.x + w.w + 35 && z.y > w.y - 35 && z.y < w.y + w.h + 35) { 
                    attackingWindow = w; 
                    break; 
                } 
            } 
        }
        try {
            if (attackingWindow) {
                if (z.isBoss) { 
                    attackingWindow.boards = 0; 
                    spawnParticles(attackingWindow.x + attackingWindow.w / 2, attackingWindow.y + attackingWindow.h / 2, '#8B4513', 12); 
                    addText(attackingWindow.x + attackingWindow.w / 2, attackingWindow.y, "SMASH!", "#f39c12"); 
                    if (typeof SoundSystem !== 'undefined') SoundSystem.play('zombie_hurt'); 
                } else { 
                    if (stats.frame % 60 === 0) { 
                        attackingWindow.boards--; 
                        spawnParticles(attackingWindow.x + attackingWindow.w / 2, attackingWindow.y + attackingWindow.h / 2, '#8B4513', 2); 
                        if (typeof SoundSystem !== 'undefined') SoundSystem.play('zombie_hurt'); 
                    } 
                }
            } else {
                let a = Math.atan2(targetY - z.y, targetX - z.x), mx = Math.cos(a) * z.speed, my = Math.sin(a) * z.speed;
                let radiusBuffer = z.r || 16; 
                if (z.type === 'boss_rampager') radiusBuffer = 18; 
                let testX = z.x + mx, testY = z.y + my;
                if (!RoomSystem.checkCollision(testX, testY, false, radiusBuffer)) { 
                    z.x = testX; 
                    z.y = testY; 
                } else {
                    let canMoveX = !RoomSystem.checkCollision(testX, z.y, false, radiusBuffer);
                    let canMoveY = !RoomSystem.checkCollision(z.x, testY, false, radiusBuffer);
                    if (canMoveX && !canMoveY) { 
                        z.x = testX; 
                    } else if (!canMoveX && canMoveY) { 
                        z.y = testY; 
                    } else {
                        let perpAngle1 = a - Math.PI / 2, perpAngle2 = a + Math.PI / 2;
                        let px1 = z.x + Math.cos(perpAngle1) * z.speed, py1 = z.y + Math.sin(perpAngle1) * z.speed;
                        let px2 = z.x + Math.cos(perpAngle2) * z.speed, py2 = z.y + Math.sin(perpAngle2) * z.speed;
                        let canPerp1 = !RoomSystem.checkCollision(px1, py1, false, radiusBuffer);
                        let canPerp2 = !RoomSystem.checkCollision(px2, py2, false, radiusBuffer);
                        if (canPerp1 && canPerp2) { 
                            let dist1 = Math.hypot(targetX - px1, targetY - py1);
                            let dist2 = Math.hypot(targetX - px2, targetY - py2); 
                            if (dist1 < dist2) { 
                                z.x = px1; 
                                z.y = py1; 
                            } else { 
                                z.x = px2; 
                                z.y = py2; 
                            } 
                        } else if (canPerp1) { 
                            z.x = px1; 
                            z.y = py1; 
                        } else if (canPerp2) { 
                            z.x = px2; 
                            z.y = py2; 
                        } else {
                            let foundPath = false;
                            for (let angleOffset = Math.PI / 6; angleOffset <= Math.PI; angleOffset += Math.PI / 6) {
                                let scanAngle1 = a + angleOffset, scanAngle2 = a - angleOffset;
                                let testX1 = z.x + Math.cos(scanAngle1) * z.speed, testY1 = z.y + Math.sin(scanAngle1) * z.speed;
                                if (!RoomSystem.checkCollision(testX1, testY1, false, radiusBuffer)) { 
                                    z.x = testX1; 
                                    z.y = testY1; 
                                    foundPath = true; 
                                    break; 
                                }
                                let testX2 = z.x + Math.cos(scanAngle2) * z.speed, testY2 = z.y + Math.sin(scanAngle2) * z.speed;
                                if (!RoomSystem.checkCollision(testX2, testY2, false, radiusBuffer)) { 
                                    z.x = testX2; 
                                    z.y = testY2; 
                                    foundPath = true; 
                                    break; 
                                }
                            }
                            if (!foundPath) { 
                                let rx = (Math.random() - 0.5) * z.speed, ry = (Math.random() - 0.5) * z.speed; 
                                if (!RoomSystem.checkCollision(z.x + rx, z.y + ry, false, radiusBuffer)) { 
                                    z.x += rx; 
                                    z.y += ry; 
                                } 
                            }
                        }
                    }
                }
            }
        } catch (err) { 
            console.error(err); 
        }
        for (let j = i + 1; j < zombies.length; j++) {
            let z2 = zombies[j], dist = Math.hypot(z.x - z2.x, z.y - z2.y);
            if (dist < 20 && dist > 0) { 
                let push = (20 - dist) / 2, ax = ((z.x - z2.x) / dist) * push * 0.5, ay = ((z.y - z2.y) / dist) * push * 0.5; 
                if (!RoomSystem.checkCollision(z.x + ax, z.y + ay, false)) { 
                    z.x += ax; 
                    z.y += ay; 
                } 
                if (!RoomSystem.checkCollision(z2.x - ax, z2.y - ay, false)) { 
                    z2.x -= ax; 
                    z2.y -= ay; 
                } 
            }
        }
        if (typeof ZombieVariants !== 'undefined') ZombieVariants.updateSpecialBehaviors(z);
        
        Object.values(players).forEach(p => {
            let px = (p !== me && p.serverX !== undefined) ? p.serverX : p.x;
            let py = (p !== me && p.serverY !== undefined) ? p.serverY : p.y;
            let hitRadius = (p !== me) ? 22 : 30;

            if (Math.hypot(px - z.x, py - z.y) < hitRadius && p.state === 'ALIVE') {
                if (p.invincibleTimer && p.invincibleTimer > 0) return; 
                let baseDmg = GameBalanceConfig.ZOMBIE_BASE_DAMAGE;
                let scaleBonus = Math.floor((stats.round - 1) * GameBalanceConfig.ZOMBIE_DAMAGE_ROUND_SCALE);
                let finalDmg = Math.min(baseDmg + scaleBonus, GameBalanceConfig.ZOMBIE_DAMAGE_MAX_CAP);
                p.hp -= finalDmg; 
                p.invincibleTimer = GameBalanceConfig.PLAYER_INVINCIBILITY_FRAMES; 
                addText(p.x, p.y, `-${finalDmg} HP`, "#ff4757");
                if (p.hp <= 0) { 
                    p.state = 'DOWNED'; 
                    p.reviveTimer = p.hasVigor ? 300 : -1; 
                    if (p.hasVigor) addText(p.x, p.y, "VIGOR SAVED YOU!", "#f00"); 
                    else addText(p.x, p.y, "DOWNED!", "#f00"); 
                }
            }
        });
    });
}

function skipToBossRound(targetRound) {
    if (Network.mode === 'CLIENT') return;
    zombies = []; 
    bullets = []; 
    window.zombieArrows = []; 
    window.activeBoss = null;
    stats.zombiesAlive = 0; 
    stats.zombiesToSpawn = 0; 
    stats.round = targetRound;
    if (typeof ZombieVariants !== 'undefined') ZombieVariants.spawnBoss(targetRound);
    addText(me ? me.x : 200, (me ? me.y : 200) - 80, `SKIP TO ROUND ${targetRound}`, "#f1c40f");
}

function checkAllDead() { 
    if (Network.mode === 'CLIENT') return; 
    let activePlayers = Object.values(players).filter(p => p.state === 'ALIVE' || p.state === 'DOWNED');
    if (activePlayers.length === 0) return; 
    let allDown = activePlayers.every(p => p.state === 'DOWNED'); 
    if (allDown && !activePlayers.some(p => p.reviveTimer > 0)) gameOver(); 
}

function checkGameFlow() {
    if (activeMap !== tutorialMapData && stats.zombiesAlive <= 0 && stats.zombiesToSpawn <= 0 && !stats.changingRound) {
        stats.changingRound = true;
        setTimeout(() => {
            stats.round++; 
            
            // Award Round Survival Coin Bonus to Host/Offline player
            const coinBonus = 10; 
            saveData.lobbyCoins = (saveData.lobbyCoins || 0) + coinBonus;
            if (me) {
                addText(me.x, me.y - 70, `+${coinBonus} ROUND BONUS 🪙`, "#ffd700");
            }

            if (stats.round % 5 === 0) { 
                if (typeof ZombieVariants !== 'undefined') ZombieVariants.spawnBoss(stats.round); 
            } else {
                const currentDiff = stats.difficulty || 'medium'; 
                let spawnScalar = GameBalanceConfig.WAVE_SCALAR_MEDIUM;
                let spawnMultiplier = GameBalanceConfig.WAVE_BASE_MEDIUM;
                if (currentDiff === 'easy') { 
                    spawnMultiplier = GameBalanceConfig.WAVE_BASE_EASY; 
                    spawnScalar = GameBalanceConfig.WAVE_SCALAR_EASY; 
                } else if (currentDiff === 'hard') { 
                    spawnMultiplier = GameBalanceConfig.WAVE_BASE_HARD; 
                    spawnScalar = GameBalanceConfig.WAVE_SCALAR_HARD; 
                }
                stats.zombiesToSpawn = Math.floor(spawnMultiplier * Math.pow(spawnScalar, stats.round)); 
            }
            stats.changingRound = false; 
            addText(me ? me.x : 200, (me ? me.y : 200) - 100, "ROUND " + stats.round, "#a83232"); 
            if (typeof SoundSystem !== 'undefined') {
                SoundSystem.play('round_start'); 
            }
            checkAchievements();
            Object.values(players).forEach(p => { 
                if (p.state !== 'ALIVE') { 
                    p.state = 'ALIVE'; 
                    p.hp = 100; 
                    p.maxHp = 100; 
                    p.hasVigor = false; 
                    let survivor = Object.values(players).find(pl => pl.state === 'ALIVE' && pl !== p); 
                    if (survivor) { 
                        p.x = survivor.x; 
                        p.y = survivor.y; 
                    } 
                    addText(p.x, p.y, "RESPAWNED!", "#0ff"); 
                } 
            });
        }, GameBalanceConfig.ROUND_TRANSITION_DELAY_MS);
    }
}

function drawScoreboard() {
    const board = document.getElementById('scoreboard'); 
    board.style.display = 'block'; 
    const tbody = document.getElementById('score-body'); 
    tbody.innerHTML = '';
    Object.values(players).forEach(p => {
        let ping = (p.id === me.id) ? "0ms" : "35ms";
        let status = p.state === 'ALIVE' ? '<span style="color:#0f0">ALIVE</span>' : '<span style="color:#f00">DOWN</span>';
        
        if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
            status = InfectionMode.infectedIds.has(p.id) ? '<span style="color:#2ecc71">INFECTED</span>' : '<span style="color:#3498db">SURVIVOR</span>';
        }

        tbody.innerHTML += `<tr><td style="color:${p.color}">${p.name}</td><td>${p.kills}</td><td>${p.score}</td><td>${status}</td><td>${ping}</td></tr>`;
    });
}

function resetSession() { 
    const currentMapIdx = stats.selectedMapIdx !== undefined ? stats.selectedMapIdx : 0;
    const currentDiff = stats.difficulty || 'medium';
    
    const currentGameMode = stats.gameMode || 'SURVIVAL';

    let zombiesToSpawnBase = GameBalanceConfig.WAVE_BASE_MEDIUM; 
    if (currentDiff === 'easy') zombiesToSpawnBase = GameBalanceConfig.WAVE_BASE_EASY; 
    else if (currentDiff === 'hard') zombiesToSpawnBase = GameBalanceConfig.WAVE_BASE_HARD;
    
    stats = { 
        score: 0, 
        round: 1, 
        zombiesToSpawn: zombiesToSpawnBase, 
        zombiesAlive: 0, 
        frame: 0, 
        sessionKills: 0, 
        selectedMapIdx: currentMapIdx, 
        difficulty: currentDiff,
        gameMode: currentGameMode
    }; 

    zombies = []; bullets = []; particles = []; texts = []; window.bloodStains = []; zombieIdCounter = 0; window.drops = []; window.doublePointsTimer = 0; window.instaKillTimer = 0;
    window.activeBoss = null; window.zombieArrows = []; window.acidPools = []; window.toxicClouds = []; window.fireZones = []; window.mortarTargets = []; window.groundSmashes = []; window.screenShake = 0; window.spawnedBossTypes = []; 
    
    window.startingUnlockedAch = [...(saveData.unlockedAch || [])];
    
    // Dynamic robust fallback to guarantee activeMap is never null/undefined inside resetSession
    if (!activeMap || !activeMap.rooms) {
        if (typeof playableMaps !== 'undefined' && playableMaps[currentMapIdx]) {
            activeMap = playableMaps[currentMapIdx];
        } else if (typeof playableMaps !== 'undefined' && playableMaps[0]) {
            activeMap = playableMaps[0];
        } else {
            console.error("Critical Error: playableMaps is completely unresolved.");
            return;
        }
    }
    
    activeMap.rooms.forEach(r => {
        if (currentGameMode === 'INFECTION') {
            r.unlocked = true; 
        } else if (activeMap.name === "Sector-12 City") {
            r.unlocked = (r.id === 0 || r.id === 1);
        } else {
            r.unlocked = (r.id === 0);
        }
    });

    if (activeMap === tutorialMapData) activeMap.windows.forEach(w => w.boards = 0); 
    else activeMap.windows.forEach(w => w.boards = w.max);

    if (typeof InfectionMode !== 'undefined' && stats.gameMode === 'INFECTION') {
        InfectionMode.init();
    } else if (typeof InfectionMode !== 'undefined') {
        InfectionMode.isActive = false;
    }
}

// Quick-Equip trigger executed on the Game Over screen
window.buyAndEquipCosmeticOver = function(id, price) {
    if (saveData.lobbyCoins >= price && !saveData.ownedCosmetics.includes(id)) {
        saveData.lobbyCoins -= price; 
        saveData.ownedCosmetics.push(id); 
        saveData.equippedCosmetic = id;
        localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));
        if (typeof AccountSystem !== 'undefined' && AccountSystem.currentUser) {
            AccountSystem.pushProfileData();
        }
        if (me) me.equippedCosmetic = id;
        let btn = document.getElementById('over-cos-btn');
        if (btn) { 
            btn.innerText = "EQUIPPED!"; 
            btn.style.background = "#10ac84"; 
            btn.disabled = true; 
        }
        if (typeof SoundSystem !== 'undefined') SoundSystem.play('purchase');
        addText(window.innerWidth / 2, window.innerHeight / 2, "EQUIPPED! 👕", "#ffd700");
    }
};

function drawOverBossIcon(bId, discovered, defeated, strikeProgress) {
    const cv = document.getElementById("over-boss-cv-" + bId);
    if (!cv) return;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, 54, 54);
    
    const b = bossesDB.find(function (x) {
        return x.id === bId;
    });
    if (!b) return;

    if (!discovered) {
        c.fillStyle = '#151515';
        c.beginPath(); 
        c.arc(27, 27, 14, 0, Math.PI * 2); 
        c.fill();
        c.strokeStyle = '#333';
        c.lineWidth = 1.5;
        c.stroke();
        
        c.fillStyle = '#444';
        c.font = 'bold 16px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('?', 27, 27);
    } else {
        if (b.id === 'boss_logbreaker') {
            c.fillStyle = '#ffffff';
            c.beginPath(); 
            c.arc(27, 27, 15, 0, Math.PI * 2); 
            c.fill();
            c.strokeStyle = '#000'; 
            c.lineWidth = 2; 
            c.stroke();
            
            c.strokeStyle = 'rgba(0,0,0,0.5)'; 
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(27 - 7, 27 - 7); 
            c.lineTo(27 + 7, 27 + 7);
            c.moveTo(27 + 7, 27 - 7); 
            c.lineTo(27 - 7, 27 + 7);
            c.stroke();

            c.fillStyle = '#f00'; 
            c.strokeStyle = '#000'; 
            c.lineWidth = 0.8;
            c.beginPath(); 
            c.arc(27 - 4, 27 - 4, 2, 0, Math.PI * 2); 
            c.fill(); 
            c.stroke();
            c.beginPath(); 
            c.arc(27 + 4, 27 - 4, 2, 0, Math.PI * 2); 
            c.fill(); 
            c.stroke();
        } else if (b.id === 'boss_blink') {
            c.fillStyle = '#9b59b6';
            c.beginPath(); 
            c.arc(27, 27, 13, 0, Math.PI * 2); 
            c.fill();
            c.strokeStyle = '#000'; 
            c.lineWidth = 2; 
            c.stroke();

            c.fillStyle = '#00ffff'; 
            c.strokeStyle = '#000'; 
            c.lineWidth = 0.8;
            c.beginPath(); 
            c.arc(27 - 4, 27 - 1.5, 2, 0, Math.PI * 2); 
            c.fill(); 
            c.stroke();
            c.beginPath(); 
            c.arc(27, 27 - 6, 2.3, 0, Math.PI * 2); 
            c.fill(); 
            c.stroke();
        } else if (b.id === 'boss_miasma') {
            let grad = c.createRadialGradient(27, 27, 2, 27, 27, 24);
            grad.addColorStop(0, 'rgba(39, 174, 96, 0.6)');
            grad.addColorStop(1, 'rgba(39, 174, 96, 0)');
            c.fillStyle = grad;
            c.beginPath(); 
            c.arc(27, 27, 24, 0, Math.PI * 2); 
            c.fill();

            c.fillStyle = '#27ae60';
            c.beginPath(); 
            c.arc(27, 27, 13, 0, Math.PI * 2); 
            c.fill();
            c.strokeStyle = '#000'; 
            c.lineWidth = 2; 
            c.stroke();

            c.fillStyle = '#f00'; 
            c.strokeStyle = '#000'; 
            c.lineWidth = 0.8;
            c.beginPath(); 
            c.arc(27 - 4, 27 - 4, 2, 0, Math.PI * 2); 
            c.fill(); 
            c.stroke();
            c.beginPath(); 
            c.arc(27 + 4, 27 - 4, 2, 0, Math.PI * 2); 
            c.fill(); 
            c.stroke();
        } else if (b.id === 'boss_rampager') {
            c.fillStyle = '#e74c3c';
            c.beginPath(); 
            c.arc(27, 27, 15, 0, Math.PI * 2); 
            c.fill();
            c.strokeStyle = '#000'; 
            c.lineWidth = 2; 
            c.stroke();

            c.strokeStyle = '#7f8c8d'; 
            c.lineWidth = 3;
            c.beginPath(); 
            c.arc(27, 27, 11, 0, Math.PI, true); 
            c.stroke();

            c.fillStyle = '#fff'; 
            c.strokeStyle = '#000'; 
            c.lineWidth = 1.2;
            c.beginPath(); 
            ctx.moveTo(27 - 7, 27 - 8); 
            ctx.lineTo(27 - 12, 27 - 15); 
            ctx.lineTo(27 - 3, 27 - 10); 
            ctx.fill(); 
            ctx.stroke();
            ctx.beginPath(); 
            ctx.moveTo(27 + 7, 27 - 8); 
            ctx.lineTo(27 + 12, 27 - 15); 
            ctx.lineTo(27 + 3, 27 - 10); 
            ctx.fill(); 
            ctx.stroke();

            c.fillStyle = '#f00'; 
            c.strokeStyle = '#000'; 
            c.lineWidth = 0.8;
            c.beginPath(); 
            ctx.arc(27 - 4, 27 - 4, 2, 0, Math.PI * 2); 
            c.fill(); 
            c.stroke();
            c.beginPath(); 
            ctx.arc(27 + 4, 27 - 4, 2, 0, Math.PI * 2); 
            ctx.fill(); 
            ctx.stroke();
        } else if (b.id === 'boss_decayer') {
            c.fillStyle = '#2ecc71';
            c.beginPath(); 
            c.arc(27, 27, 13, 0, Math.PI * 2); 
            c.fill();
            c.strokeStyle = '#000'; 
            c.lineWidth = 2; 
            c.stroke();

            c.fillStyle = 'rgba(46, 204, 113, 0.6)';
            c.beginPath(); 
            c.arc(27 - 4, 27 + 4, 3.2, 0, Math.PI * 2); 
            c.arc(27 + 5, 27 - 5, 2.8, 0, Math.PI * 2); 
            c.fill();

            c.fillStyle = '#f00'; 
            c.strokeStyle = '#000'; 
            c.lineWidth = 0.8;
            c.beginPath(); 
            ctx.arc(27 - 4, 27 - 4, 2, 0, Math.PI * 2); 
            ctx.fill(); 
            ctx.stroke();
            ctx.beginPath(); 
            ctx.arc(27 + 4, 27 - 4, 2, 0, Math.PI * 2); 
            ctx.fill(); 
            ctx.stroke();
        } else if (b.id === 'boss_pyromaniac') {
            c.fillStyle = '#d35400';
            c.beginPath(); 
            c.arc(27, 27, 14, 0, Math.PI * 2); 
            c.fill();
            c.strokeStyle = '#000'; 
            c.lineWidth = 2; 
            c.stroke();

            c.fillStyle = '#e67e22';
            c.beginPath(); 
            c.arc(27, 27, 9, 0, Math.PI * 2); 
            c.fill();
            c.fillStyle = '#f1c40f';
            c.beginPath(); 
            c.arc(27, 27, 5, 0, Math.PI * 2); 
            c.fill();

            c.fillStyle = '#f00'; 
            c.strokeStyle = '#000'; 
            c.lineWidth = 0.8;
            c.beginPath(); 
            ctx.arc(27 - 4, 27 - 4, 2, 0, Math.PI * 2); 
            ctx.fill(); 
            ctx.stroke();
            ctx.beginPath(); 
            ctx.arc(27 + 4, 27 - 4, 2, 0, Math.PI * 2); 
            ctx.fill(); 
            ctx.stroke();
        }
    }
    
    if (defeated && strikeProgress > 0) {
        c.strokeStyle = '#ff4757';
        c.lineWidth = 3;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(6, 6);
        c.lineTo(6 + (42 * strikeProgress), 6 + (42 * strikeProgress));
        c.stroke();
    }
}

function gameOver() { 
    if (!gameActive) return; 
    gameActive = false; 
    if (Network.mode === 'HOST') Network.broadcastGameOver(stats); 
    if (typeof Tutorial !== 'undefined' && Tutorial.isActive) { 
        Tutorial.resetOnDeath(); 
        return; 
    }
    
    if (!saveData.unlockedBosses) saveData.unlockedBosses = [];
    if (!saveData.defeatedBosses) saveData.defeatedBosses = [];
    if (!saveData.ownedCosmetics) saveData.ownedCosmetics = ['none'];
    if (!saveData.unlockedGuns) saveData.unlockedGuns = ['Model 1911'];
    if (saveData.xp === undefined) saveData.xp = 0;
    if (saveData.lobbyCoins === undefined) saveData.lobbyCoins = 0;

    const isInfection = (stats.gameMode === 'INFECTION');
    const cardBoss = document.getElementById('card-boss');
    if (cardBoss) {
        if (isInfection) {
            cardBoss.style.display = 'none';
        } else {
            cardBoss.style.display = 'flex';
        }
    }

    let oldXP = window.matchStartingXP !== undefined ? window.matchStartingXP : (saveData.xp || 0);
    let oldCoins = window.matchStartingCoins !== undefined ? window.matchStartingCoins : (saveData.lobbyCoins || 0);
    let msg = ""; 
    try { 
        // Modified to pass local player's kills and score instead of stats.sessionKills (Host-authoritative)
        msg = saveGame(stats.round, me ? me.kills : 0, me ? me.score : 0); 
    } catch (e) {} 
    let newXP = saveData.xp || 0;
    let newCoins = saveData.lobbyCoins || 0;
    let oldLvl = Math.floor(oldXP / 1000) + 1;

    let cheapestLockedCosmetic = cosmeticDB.filter(c => !saveData.ownedCosmetics.includes(c.id)).sort((a, b) => a.price - b.price)[0];
    let cosmeticName = "ALL UNLOCKED";
    let cosmeticPrice = 1;
    let cosmeticPct = 100;
    let canAffordAndLock = false;
    if (cheapestLockedCosmetic) { 
        cosmeticName = cheapestLockedCosmetic.name; 
        cosmeticPrice = cheapestLockedCosmetic.price; 
        cosmeticPct = Math.min(Math.floor((newCoins / cosmeticPrice) * 100), 100); 
        canAffordAndLock = (newCoins >= cosmeticPrice); 
    }

    document.getElementById('over-round-val').innerText = `Round ${stats.round}`;
    document.getElementById('perf-msg').innerText = msg;
    document.getElementById('level-badge').innerText = `Lv. ${oldLvl}`;
    document.getElementById('xp-details-text').innerText = `${oldXP % 1000} / 1000 XP`;
    document.getElementById('xp-percentage-text').innerText = `${Math.floor((oldXP % 1000) / 10)}%`;
    document.getElementById('xp-bar').style.width = ((oldXP % 1000) / 10) + "%";

    document.getElementById('stat-kills-val').innerText = "0";
    document.getElementById('stat-coins-val').innerText = "0 🪙";
    document.getElementById('cosmetic-bar').style.width = "0%";
    document.getElementById('cosmetic-percentage-text').innerText = "0%";

    const items = ["over-title", "over-round-box", "card-stats", "perf-msg", "card-xp", "card-boss", "card-cosmetic", "over-controls"];
    items.forEach(id => { 
        let el = document.getElementById(id); 
        if (el) el.classList.remove("smash-active"); 
    });
    let rays = document.getElementById('lvl-up-rays'); 
    if (rays) rays.style.display = 'none';

    document.getElementById('over-cosmetic-title').innerText = `NEXT UNLOCK: ${cosmeticName}`;

    let actionArea = document.getElementById('over-cos-action');
    if (actionArea) {
        if (cheapestLockedCosmetic) {
            actionArea.innerHTML = canAffordAndLock ? 
                `<button id="over-cos-btn" onclick="buyAndEquipCosmeticOver('${cheapestLockedCosmetic.id}', ${cheapestLockedCosmetic.price})" style="background:#2ecc71; border:none; color:white; padding:4px 10px; font-size:11px; font-weight:bold; border-radius:3px; cursor:pointer;">BUY & EQUIP</button>` : 
                `<span style="font-size:10px; color:#aaa; font-weight:bold;">Need 🪙 ${cheapestLockedCosmetic.price - newCoins} more Coins</span>`;
        } else {
            actionArea.innerHTML = `<span style="font-size:10px; color:#2ecc71; font-weight:bold;">All Items Unlocked!</span>`;
        }
    }

    document.getElementById('game-ui').style.display = 'none'; 
    document.getElementById('game-over').style.display = 'flex'; 

    const staggerSequence = [
        { id: "over-title", delay: 200, sound: "zombie_hurt", shake: 14 },
        { id: "over-round-box", delay: 950, sound: "zombie_hurt", shake: 16 },
        { id: "card-stats", delay: 1700, sound: "shoot", shake: 10, action: animateStats },
        { id: "perf-msg", delay: 2450, sound: "purchase", shake: 4 },
        { id: "card-xp", delay: 3200, sound: "shoot", shake: 10, action: animateXP },
        ...(isInfection ? [] : [{ id: "card-boss", delay: 3950, sound: "shoot", shake: 10, action: animateBoss }]),
        { id: "card-cosmetic", delay: isInfection ? 3950 : 4700, sound: "shoot", shake: 10, action: animateCosmetic },
        { id: "over-controls", delay: isInfection ? 4700 : 5450, sound: "purchase", shake: 6 }
    ];

    staggerSequence.forEach(step => {
        setTimeout(() => {
            let el = document.getElementById(step.id);
            if (el) {
                el.classList.add("smash-active"); 
                window.screenShake = step.shake;
                if (typeof SoundSystem !== 'undefined' && step.sound) SoundSystem.play(step.sound);
                if (step.action) step.action();
            }
        }, step.delay);
    });

    function animateStats() {
        let currentKills = 0, currentCoins = 0, targetKills = stats.sessionKills, targetCoins = Math.max(newCoins - oldCoins, 0);
        let killsStep = Math.max(Math.ceil(targetKills / 30), 1), coinsStep = Math.max(Math.ceil(targetCoins / 30), 1);
        let statInterval = setInterval(() => {
            if (currentKills < targetKills) { 
                currentKills += killsStep; 
                if (currentKills > targetKills) currentKills = targetKills; 
                let kEl = document.getElementById('stat-kills-val'); 
                if (kEl) kEl.innerText = currentKills; 
            }
            if (currentCoins < targetCoins) { 
                currentCoins += coinsStep; 
                if (currentCoins > targetCoins) currentCoins = targetCoins; 
                let cEl = document.getElementById('stat-coins-val'); 
                if (cEl) cEl.innerText = `${currentCoins} 🪙`; 
            }
            if (currentKills >= targetKills && currentCoins >= targetCoins) clearInterval(statInterval);
        }, 16);
    }

    function animateXP() {
        let currentXP = oldXP, xpRemaining = newXP - oldXP, xpStep = Math.max(Math.ceil(xpRemaining / 60), 1), levelUpTriggered = false;
        let interval = setInterval(() => {
            if (currentXP < newXP) {
                currentXP += xpStep; 
                if (currentXP > newXP) currentXP = newXP;
                let tempLvl = Math.floor(currentXP / 1000) + 1, tempXPVal = currentXP % 1000, tempPct = tempXPVal / 10;
                if (tempLvl > oldLvl && !levelUpTriggered) {
                    levelUpTriggered = true; 
                    let flash = document.getElementById('lvl-up-flash'); 
                    if (flash) { 
                        flash.style.display = 'flex'; 
                        setTimeout(() => { flash.style.display = 'none'; }, 1500); 
                    }
                    let rays = document.getElementById('lvl-up-rays'); 
                    if (rays) rays.style.display = 'block';
                    if (typeof SoundSystem !== 'undefined') SoundSystem.play('powerup'); 
                    window.screenShake = 22;
                }
                let bar = document.getElementById('xp-bar'), details = document.getElementById('xp-details-text'), badge = document.getElementById('level-badge'), pctTxt = document.getElementById('xp-percentage-text');
                if (bar) bar.style.width = tempPct + "%"; 
                if (details) details.innerText = `${tempXPVal} / 1000 XP`; 
                if (badge) badge.innerText = `Lv. ${tempLvl}`; 
                if (pctTxt) pctTxt.innerText = `${Math.floor(tempPct)}%`;
            } else clearInterval(interval);
        }, 16);
    }

    function animateBoss() {
        if (isInfection) return; 
        const row = document.getElementById('over-bosses-row');
        if (!row) return;
        row.innerHTML = ""; 
        
        bossesDB.forEach(function (b) {
            const discovered = saveData.unlockedBosses && saveData.unlockedBosses.includes(b.id);
            const defeated = saveData.defeatedBosses && saveData.defeatedBosses.includes(b.id);
            const isNewDiscovery = discovered && !window.startingUnlockedBosses.includes(b.id);
            const isNewDefeat = defeated && !window.startingDefeatedBosses.includes(b.id);
            
            let statusText = "Locked";
            let statusColor = "#666";
            if (defeated) {
                statusText = "Defeated";
                statusColor = "#ff4757";
            } else if (discovered) {
                statusText = "Discovered";
                statusColor = "#ffd700";
            }
            
            const slotHtml = `
                <div id="over-boss-slot-${b.id}" style="display: flex; flex-direction: column; align-items: center; min-width: 60px; transform: scale(0); opacity: 0; transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.25), opacity 0.4s; position: relative;">
                    <div style="position: relative; width: 54px; height: 54px; margin-bottom: 4px;">
                        <canvas id="over-boss-cv-${b.id}" width="54" height="54" style="background: #080808; border: 1.5px solid ${discovered ? b.color : '#333'}; border-radius: 50%; box-sizing: border-box; display: block; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></canvas>
                        <div id="over-boss-flash-${b.id}" style="position: absolute; inset: 0; border-radius: 50%; background: #fff; opacity: 0; pointer-events: none; transition: opacity 0.15s ease-out;"></div>
                    </div>
                    <span id="over-boss-status-${b.id}" style="font-size: 8px; color: ${statusColor}; font-weight: bold; text-transform: uppercase; text-align: center; line-height: 1.2; letter-spacing: 0.5px;">${statusText}</span>
                </div>
            `;
            row.insertAdjacentHTML('beforeend', slotHtml);
            
            if (defeated && isNewDefeat) {
                drawOverBossIcon(b.id, discovered, true, 0); 
            } else {
                drawOverBossIcon(b.id, discovered, defeated, 1);
            }
        });
        
        bossesDB.forEach(function (b, idx) {
            setTimeout(function () {
                const slot = document.getElementById(`over-boss-slot-${b.id}`);
                if (slot) {
                    slot.style.transform = "scale(1)";
                    slot.style.opacity = "1";
                    if (typeof SoundSystem !== 'undefined') {
                        SoundSystem.play('shoot');
                    }
                }
                
                const discovered = saveData.unlockedBosses && saveData.unlockedBosses.includes(b.id);
                const defeated = saveData.defeatedBosses && saveData.defeatedBosses.includes(b.id);
                const isNewDiscovery = discovered && !window.startingUnlockedBosses.includes(b.id);
                const isNewDefeat = defeated && !window.startingDefeatedBosses.includes(b.id);
                
                if (isNewDiscovery) {
                    setTimeout(function () {
                        const flash = document.getElementById(`over-boss-flash-${b.id}`);
                        if (flash) {
                            flash.style.opacity = "0.9";
                            setTimeout(function () { flash.style.opacity = "0"; }, 150);
                        }
                        if (typeof SoundSystem !== 'undefined') {
                            SoundSystem.play('powerup');
                        }
                        window.screenShake = 6;
                        
                        const statusLabel = document.getElementById(`over-boss-status-${b.id}`);
                        if (statusLabel) {
                            statusLabel.innerHTML = `<span style="color:#ffd700; font-weight:900; animation: shake 0.2s infinite; display: inline-block;">⭐ NEW! ⭐</span>`;
                        }
                    }, 350);
                }
                
                if (isNewDefeat) {
                    setTimeout(function () {
                        let progress = 0;
                        const strikeInterval = setInterval(function () {
                            progress += 0.08;
                            if (progress >= 1) {
                                progress = 1;
                                clearInterval(strikeInterval);
                            }
                            drawOverBossIcon(b.id, discovered, true, progress);
                        }, 16);
                        
                        const flash = document.getElementById(`over-boss-flash-${b.id}`);
                        if (flash) {
                            flash.style.opacity = "0.9";
                            setTimeout(function () { flash.style.opacity = "0"; }, 150);
                        }
                        
                        if (typeof SoundSystem !== 'undefined') {
                            SoundSystem.play('zombie_hurt');
                        }
                        window.screenShake = 8;
                        
                        const statusLabel = document.getElementById(`over-boss-status-${b.id}`);
                        if (statusLabel) {
                            statusLabel.innerHTML = `<span style="color:#ff4757; text-shadow: 0 0 5px rgba(255,71,87,0.8); animation: shake 0.3s infinite; display: inline-block;">DEFEATED</span>`;
                        }
                    }, 400);
                }
                
            }, 300 + idx * 250); 
        });
    }

    function animateCosmetic() {
        let cosmeticTicker = 0;
        let interval = setInterval(() => {
            if (cosmeticTicker < cosmeticPct) {
                cosmeticTicker += Math.max(cosmeticPct / 45, 0.5); 
                if (cosmeticTicker > cosmeticPct) cosmeticTicker = cosmeticPct;
                let cBar = document.getElementById('cosmetic-bar'), cPctTxt = document.getElementById('cosmetic-percentage-text');
                if (cBar) cBar.style.width = cosmeticTicker + "%"; 
                if (cPctTxt) cPctTxt.innerText = `${Math.floor(cosmeticTicker)}%`;
            } else clearInterval(interval);
        }, 16);

        if (cheapestLockedCosmetic) {
            let overCv = document.getElementById('over-cos-preview');
            if (overCv && typeof drawBackCosmetic === 'function') {
                let overCtx = overCv.getContext('2d'), angle = 0;
                function drawOverPreview() {
                    if (!document.getElementById('game-over') || document.getElementById('game-over').style.display === 'none') return;
                    overCtx.clearRect(0, 0, 80, 80); 
                    overCtx.save(); 
                    overCtx.translate(40, 40); 
                    angle += 0.02; 
                    overCtx.rotate(angle);
                    drawBackCosmetic(cheapestLockedCosmetic.id, 20, overCtx);
                    overCtx.fillStyle = '#3498db'; 
                    overCtx.strokeStyle = '#000'; 
                    overCtx.lineWidth = 2;
                    overCtx.beginPath(); 
                    overCtx.arc(0, 0, 13, 0, Math.PI * 2); 
                    overCtx.fill(); 
                    overCtx.stroke(); 
                    overCtx.restore();
                    requestAnimationFrame(drawOverPreview);
                }
                requestAnimationFrame(drawOverPreview);
            }
        }
    }

    window.activeBoss = null; 
    window.zombieArrows = []; 
    window.acidPools = []; 
    window.toxicClouds = []; 
    window.fireZones = []; 
    window.mortarTargets = []; 
    window.groundSmashes = []; 
    window.screenShake = 0;
    const returnLobbyBtn = document.getElementById('return-lobby-btn');
    if (returnLobbyBtn) {
        if (Network.mode === 'HOST') { 
            returnLobbyBtn.style.display = 'block'; 
            returnLobbyBtn.innerText = "RETURN TO LOBBY"; 
            returnLobbyBtn.disabled = false; 
        } else if (Network.mode === 'CLIENT') { 
            returnLobbyBtn.style.display = 'block'; 
            returnLobbyBtn.innerText = "WAITING FOR HOST..."; 
            returnLobbyBtn.disabled = true; 
        } else returnLobbyBtn.style.display = 'none';
    }
}

function returnToLobby() { 
    if (Network.mode === 'HOST') { 
        try { 
            Network.broadcastToAll({ type: 'RETURN_TO_LOBBY' }); 
        } catch (e) { 
            console.warn(e); 
        } 
    } 
    goToLobbyScreen(); 
}

function updateUI() {
    const roundEl = document.getElementById('round-box');
    const isInfection = (typeof InfectionMode !== 'undefined' && InfectionMode.isActive);
    if (roundEl) {
        if (isInfection) {
            const totalSecs = Math.max(0, Math.floor(InfectionMode.timer / 60));
            const mins = Math.floor(totalSecs / 60);
            const secs = totalSecs % 60;
            const timeText = (InfectionMode.state === 'WAITING') 
                ? `PATIENT ZERO IN: ${Math.max(0, Math.floor(InfectionMode.countdown / 60))}s`
                : `TIME REMAINING: ${mins}:${secs.toString().padStart(2, '0')}`;
            
            roundEl.innerText = timeText;
            roundEl.style.fontSize = "22px"; 
            roundEl.style.color = (InfectionMode.state === 'WAITING') ? "#ffd700" : "#2ecc71";
        } else {
            roundEl.innerText = stats.round;
            roundEl.style.fontSize = "50px"; 
            roundEl.style.color = "#a83232"; 
        }
    }
    
    const bTimer = document.getElementById('boss-timer-box');
    if (bTimer) { 
        if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
            bTimer.style.display = 'none';
        } else {
            bTimer.style.display = 'block';
            if (stats.round % 5 === 0) { 
                bTimer.innerText = "⚠️ BOSS ROUND ACTIVE!"; 
                bTimer.style.color = "#ff4757"; 
            } else { 
                bTimer.innerText = `Next Boss in: ${5 - (stats.round % 5)} Round(s)`; 
                bTimer.style.color = "#ffd700"; 
            } 
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

    ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].forEach(pId => {
        const p = players[pId], hud = document.getElementById('hud-' + pId);
        if (hud) {
            if (p) {
                hud.style.display = 'block'; 
                
                const nameEl = document.getElementById(pId + '-name');
                if (nameEl) nameEl.innerText = p.name || pId.toUpperCase(); 
                
                const scoreEl = document.getElementById(pId + '-score');
                if (scoreEl) scoreEl.innerHTML = p.score + ' <span style="font-size:16px">⛃</span>';
                
                const isLocal = (pId === window.myPlayerId);
                const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null;
                
                let gunName = "Model 1911";
                let ammoText = "8 / 32";
                
                if (p.state === 'SPECTATING') {
                    gunName = "SPECTATING";
                    ammoText = "NEXT ROUND";
                } else if (p.state === 'DOWNED') {
                    gunName = "DOWNED";
                    ammoText = "NEED HELP";
                } else if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive && InfectionMode.infectedIds.has(p.id)) {
                    gunName = (p.id === InfectionMode.alphaId) ? "Patient Zero Alpha" : "Infected claws";
                    ammoText = "MELEE";
                } else {
                    // Determine the correct gun name first
                    if (isLocal && gun) {
                        gunName = gun.name;
                    } else {
                        gunName = p.gunName || (gun ? gun.name : "Model 1911");
                    }
                    
                    // Determine the ammunition text next, checking reload state cleanly
                    if (p.reloading) {
                        ammoText = "RELOADING";
                    } else if (isLocal && gun) {
                        ammoText = `${gun.clip} / ${gun.ammo}`;
                    } else {
                        ammoText = (p.clip !== undefined && p.ammo !== undefined) ? `${p.clip} / ${p.ammo}` : (gun ? `${gun.clip} / ${gun.ammo}` : "8 / 32");
                    }
                }
                
                const gunNameEl = document.getElementById(pId + '-gun-name');
                if (gunNameEl) gunNameEl.innerText = gunName; 
                
                const ammoTextEl = document.getElementById(pId + '-ammo-text');
                if (ammoTextEl) ammoTextEl.innerText = ammoText; 
                
                const vigIconEl = document.getElementById(pId + '-icon-vig');
                if (vigIconEl) vigIconEl.style.display = p.hasVigor ? 'block' : 'none';
                
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
}

function resetSession() { 
    const currentMapIdx = stats.selectedMapIdx !== undefined ? stats.selectedMapIdx : 0;
    const currentDiff = stats.difficulty || 'medium';
    
    const currentGameMode = stats.gameMode || 'SURVIVAL';

    let zombiesToSpawnBase = GameBalanceConfig.WAVE_BASE_MEDIUM; 
    if (currentDiff === 'easy') zombiesToSpawnBase = GameBalanceConfig.WAVE_BASE_EASY; 
    else if (currentDiff === 'hard') zombiesToSpawnBase = GameBalanceConfig.WAVE_BASE_HARD;
    
    stats = { 
        score: 0, 
        round: 1, 
        zombiesToSpawn: zombiesToSpawnBase, 
        zombiesAlive: 0, 
        frame: 0, 
        sessionKills: 0, 
        selectedMapIdx: currentMapIdx, 
        difficulty: currentDiff,
        gameMode: currentGameMode
    }; 

    zombies = []; bullets = []; particles = []; texts = []; window.bloodStains = []; zombieIdCounter = 0; window.drops = []; window.doublePointsTimer = 0; window.instaKillTimer = 0;
    window.activeBoss = null; window.zombieArrows = []; window.acidPools = []; window.toxicClouds = []; window.fireZones = []; window.mortarTargets = []; window.groundSmashes = []; window.screenShake = 0; window.spawnedBossTypes = []; 
    
    window.startingUnlockedAch = [...(saveData.unlockedAch || [])];
    
    // Dynamic robust fallback to guarantee activeMap is never null/undefined inside resetSession
    if (!activeMap || !activeMap.rooms) {
        if (typeof playableMaps !== 'undefined' && playableMaps[currentMapIdx]) {
            activeMap = playableMaps[currentMapIdx];
        } else if (typeof playableMaps !== 'undefined' && playableMaps[0]) {
            activeMap = playableMaps[0];
        } else {
            console.error("Critical Error: playableMaps is completely unresolved.");
            return;
        }
    }
    
    activeMap.rooms.forEach(r => {
        if (currentGameMode === 'INFECTION') {
            r.unlocked = true; 
        } else if (activeMap.name === "Sector-12 City") {
            r.unlocked = (r.id === 0 || r.id === 1);
        } else {
            r.unlocked = (r.id === 0);
        }
    });

    if (activeMap === tutorialMapData) activeMap.windows.forEach(w => w.boards = 0); 
    else activeMap.windows.forEach(w => w.boards = w.max);

    if (typeof InfectionMode !== 'undefined' && stats.gameMode === 'INFECTION') {
        InfectionMode.init();
    } else if (typeof InfectionMode !== 'undefined') {
        InfectionMode.isActive = false;
    }
}
