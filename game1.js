/* --- GAMEPLAY BALANCE CONFIGURATION --- */
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
    if (me && me.state !== 'ALIVE') {
        let survivor = Object.values(players).find(p => p.state === 'ALIVE');
        if (survivor) camTarget = survivor;
    }
    if (camTarget) {
        // Updated to dynamically scale camera centering offset to match widescreen viewports [1]
        const baseHeight = isTouchDevice ? 520 : 900;
        const scale = canvas.height / baseHeight;
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
        ['p2', 'p3', 'p4'].forEach(pId => {
            const p = players[pId];
            if (p) {
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
        checkGameFlow(); 
        checkAllDead(); 
        Object.values(players).forEach(p => {
            if (p.isShooting) {
                const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null;
                if (p.isTouch || (gun && gun.auto)) shootGun(p);
                else if (!p.pressHandled) { 
                    shootGun(p); 
                    p.pressHandled = true; 
                }
            } else {
                p.pressHandled = false;
                p.dryFireHandled = false; // Reset out-of-ammo sound trigger
            }
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
                                p.state = 'DOWNED'; 
                                p.reviveTimer = p.hasVigor ? 300 : -1; 
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
                        p.state = 'DOWNED'; 
                        p.reviveTimer = p.hasVigor ? 300 : -1; 
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
                        p.state = 'DOWNED'; 
                        p.reviveTimer = p.hasVigor ? 300 : -1; 
                    } 
                } 
            }
            let inFire = window.fireZones.some(fz => Math.hypot(p.x - fz.x, p.y - fz.y) < fz.r + p.r);
            if (inFire) { 
                if (stats.frame % 30 === 0) { 
                    p.hp -= 8; 
                    addText(p.x, p.y, "-8 HP (Burn)", "#e67e22"); 
                    if (p.hp <= 0) { 
                        p.state = 'DOWNED'; 
                        p.reviveTimer = p.hasVigor ? 300 : -1; 
                    } 
                } 
            }
            p.speedMultiplier = speedFactor;
        });
    }
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

function addPlayerXP(p, amount) {
    if (!p || p.state !== 'ALIVE' || Network.mode === 'CLIENT') return;
    if (p === me) {
        if (saveData.xp === undefined) saveData.xp = 0;
        if (saveData.lobbyCoins === undefined) saveData.lobbyCoins = 0;
        const oldLevel = Math.floor(saveData.xp / 1000) + 1;
        saveData.xp += amount; 
        const newLevel = Math.floor(saveData.xp / 1000) + 1;
        if (newLevel > oldLevel) {
            addText(p.x, p.y - 100, `LEVEL UP! LEVEL ${newLevel} 🎉`, "#ffd700"); 
            saveData.lobbyCoins += 50;
            addText(p.x, p.y - 130, `+50 COINS 🪙`, "#e67e22");
            const baseName = p.name.split(" [Lv. ")[0]; 
            p.name = `${baseName} [Lv. ${newLevel}]`;
            if (Network.mode === 'HOST') { 
                window.lobbyPlayers.p1 = p.name; 
                Network.broadcastToAll({ type: 'LOBBY_UPDATE', lobbyPlayers: window.lobbyPlayers }); 
            }
        }
        localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));
        if (typeof AccountSystem !== 'undefined' && AccountSystem.currentUser) {
            AccountSystem.pushProfileData();
        }
    }
}

function updatePlayerPhysics(p, isLocal) {
    if (p.state === 'DOWNED') {
        if (p.reviveTimer > 0) { 
            p.reviveTimer--; 
            if (p.reviveTimer === 0) { 
                p.state = 'ALIVE'; 
                p.hp = p.maxHp; 
                p.hasVigor = false; 
                p.invincibleTimer = 120; 
                addText(p.x, p.y, "REVIVED (+INVINCIBLE!)", "#0f0"); 
            } 
        }
        return;
    }
    if (isLocal) {
        let dx = 0, dy = 0;
        if (keys['KeyW']) dy = -1; 
        if (keys['KeyS']) dy = 1; 
        if (keys['KeyA']) dx = -1; 
        if (keys['KeyD']) dx = 1;
        if (dx || dy) { 
            let len = Math.hypot(dx, dy); 
            dx /= len; 
            dy /= len; 
        } else if (isTouchDevice && isMovingTouch) { 
            dx = touchMoveVector.x; 
            dy = touchMoveVector.y; 
        }
        if (dx || dy) {
            let speed = GameBalanceConfig.PLAYER_BASE_SPEED * (p.speedMultiplier || 1.0);
            if (!RoomSystem.checkCollision(p.x + (dx * speed), p.y, true)) p.x += dx * speed;
            if (!RoomSystem.checkCollision(p.x, p.y + (dy * speed), true)) p.y += dy * speed;
        }
        if (isTouchDevice && isAimingTouch) {
            p.angle = Math.atan2(touchAimVector.y, touchAimVector.x);
        } else { 
            const baseHeight = 900, scale = canvas.height / baseHeight;
            const worldMouseX = (mouse.x / scale) + camera.x;
            const worldMouseY = (mouse.y / scale) + camera.y; 
            p.angle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x); 
        }
        p.isShooting = mouse.down;
    }
    const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null;
    if (p.reloading && gun) { 
        p.reloadTimer--; 
        if (p.reloadTimer <= 0) { 
            let needed = gun.mag - gun.clip;
            let take = Math.min(needed, gun.ammo); 
            gun.clip += take; 
            gun.ammo -= take; 
            p.reloading = false; 
        } 
    }
}

function updateLocalCoopP2(p) {
    if (p.state === 'DOWNED') { 
        if (p.reviveTimer > 0) { 
            p.reviveTimer--; 
            if (p.reviveTimer === 0) { 
                p.state = 'ALIVE'; 
                p.hp = p.maxHp; 
                p.hasVigor = false; 
                p.invincibleTimer = 120; 
                addText(p.x, p.y, "REVIVED!", "#0f0"); 
            } 
        } 
        return; 
    }
    let dx = 0, dy = 0, isShooting = false, isReloading = false, isInteracting = false;
    if (p2InputConfig === 'keyboard') {
        if (keys['ArrowUp']) dy = -1; 
        if (keys['ArrowDown']) dy = 1; 
        if (keys['ArrowLeft']) dx = -1; 
        if (keys['ArrowRight']) dx = 1;
        isShooting = keys['Slash'] || keys['Numpad0']; 
        isReloading = keys['Period'] || keys['NumpadDecimal']; 
        isInteracting = keys['Comma'] || keys['NumpadEnter'];
        let targetZ = null, minDist = 350; 
        zombies.forEach(z => { 
            let dist = Math.hypot(z.x - p.x, z.y - p.y); 
            if (dist < minDist) { 
                minDist = dist; 
                targetZ = z; 
            } 
        });
        if (targetZ) p.angle = Math.atan2(targetZ.y - p.y, targetZ.x - p.x); 
        else if (dx !== 0 || dy !== 0) p.angle = Math.atan2(dy, dx);
    } else {
        const gpIdx = p2InputConfig === 'gamepad0' ? 0 : 1;
        const gamepads = navigator.getGamepads();
        const gp = gamepads[gpIdx];
        if (gp) {
            let ax0 = gp.axes[0] || 0, ax1 = gp.axes[1] || 0; 
            if (Math.abs(ax0) > 0.15) dx = ax0; 
            if (Math.abs(ax1) > 0.15) dy = ax1;
            if (dx === 0 && dy === 0) { 
                if (gp.buttons[12] && gp.buttons[12].pressed) dy = -1; 
                if (gp.buttons[13] && gp.buttons[13].pressed) dy = 1; 
                if (gp.buttons[14] && gp.buttons[14].pressed) dx = -1; 
                if (gp.buttons[15] && gp.buttons[15].pressed) dx = 1; 
            }
            let ax2 = gp.axes[2] || 0, ax3 = gp.axes[3] || 0;
            if (Math.abs(ax2) > 0.2 || Math.abs(ax3) > 0.2) p.angle = Math.atan2(ax3, ax2);
            else { 
                let targetZ = null, minDist = 350; 
                zombies.forEach(z => { 
                    let dist = Math.hypot(z.x - p.x, z.y - p.y); 
                    if (dist < minDist) { 
                        minDist = dist; 
                        targetZ = z; 
                    } 
                }); 
                if (targetZ) p.angle = Math.atan2(targetZ.y - p.y, targetZ.x - p.x); 
                else if (dx !== 0 || dy !== 0) p.angle = Math.atan2(dy, dx); 
            }
            isShooting = (gp.buttons[7] && gp.buttons[7].pressed) || (gp.buttons[5] && gp.buttons[5].pressed) || (gp.buttons[0] && gp.buttons[0].pressed); 
            isReloading = (gp.buttons[2] && gp.buttons[2].pressed); 
            isInteracting = (gp.buttons[3] && gp.buttons[3].pressed) || (gp.buttons[1] && gp.buttons[1].pressed);
        }
    }
    if (dx !== 0 || dy !== 0) { 
        let len = Math.hypot(dx, dy); 
        dx /= len; 
        dy /= len; 
        let speed = GameBalanceConfig.PLAYER_BASE_SPEED * (p.speedMultiplier || 1.0); 
        if (!RoomSystem.checkCollision(p.x + (dx * speed), p.y, true)) p.x += dx * speed; 
        if (!RoomSystem.checkCollision(p.x, p.y + (dy * speed), true)) p.y += dy * speed; 
    }
    const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null; 
    p.isShooting = isShooting;
    if (isReloading && !p2PrevButtons.reload && gun) { 
        if (!p.reloading && gun.clip < gun.mag && gun.ammo > 0) { 
            p.reloading = true; 
            p.reloadTimer = gun.reload; 
            addText(p.x, p.y - 40, "RELOADING...", "#fff"); 
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('reload'); 
        } 
    }
    if (isInteracting && !p2PrevButtons.interact) p.triggerInteract = true;
    if (p.reloading && gun) { 
        p.reloadTimer--; 
        if (p.reloadTimer <= 0) { 
            let needed = gun.mag - gun.clip;
            let take = Math.min(needed, gun.ammo); 
            gun.clip += take; 
            gun.ammo -= take; 
            p.reloading = false; 
        } 
    }
    p2PrevButtons.shoot = isShooting; 
    p2PrevButtons.reload = isReloading; 
    p2PrevButtons.interact = isInteracting;
}

function shootGun(p) {
    if (p.state !== 'ALIVE' || p.reloading) return; 
    const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null; 
    if (!gun) return;
    if (stats.frame - (gun.lastShot || 0) >= gun.rpm) {
        const isInfinite = (typeof Tutorial !== 'undefined' && Tutorial.isActive && Tutorial.currentStep < 4);
        if (gun.clip > 0 || isInfinite) {
            gun.lastShot = stats.frame; 
            p.muzzleFlash = 4; 
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('shoot'); 
            if (gun.name !== "Bazooka") spawnShellCasing(p.x, p.y, p.angle); 
            if (!isInfinite) gun.clip--;
            if (me && p === me) { 
                camera.x += (Math.random() - 0.5) * 5; 
                camera.y += (Math.random() - 0.5) * 5; 
            }
            let pellets = gun.type === 'shotgun' ? gun.pellets : 1;
            if (Network.mode !== 'CLIENT') {
                for (let i = 0; i < pellets; i++) {
                    let a = p.angle + (Math.random() - 0.5) * (gun.type === 'shotgun' ? 0.2 : 0.05); 
                    bulletIdCounter++; 
                    bullets.push({ 
                        id: bulletIdCounter, 
                        x: p.x, 
                        y: p.y, 
                        vx: Math.cos(a) * 20, 
                        vy: Math.sin(a) * 20, 
                        dmg: gun.dmg, 
                        color: gun.color, 
                        life: 50, 
                        ownerId: p.id, 
                        type: gun.type === 'explosive' ? 'explosive' : 'normal' 
                    });
                }
            }
        } else if (gun.ammo > 0) forceReload(p); 
        else if (typeof SoundSystem !== 'undefined') {
            if (!p.dryFireHandled) {
                SoundSystem.play('dry_fire');
                p.dryFireHandled = true;
            }
        }
    }
}

function spawnShellCasing(x, y, playerAngle) {
    let ejectAngle = playerAngle - Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    let speed = 2 + Math.random() * 2;
    particles.push({ 
        x: x, 
        y: y, 
        vx: Math.cos(ejectAngle) * speed, 
        vy: Math.sin(ejectAngle) * speed, 
        life: 60 + Math.random() * 30, 
        color: '#f1c40f', 
        type: 'shell', 
        angle: Math.random() * Math.PI * 2, 
        rotSpeed: (Math.random() - 0.5) * 0.2, 
        friction: 0.93 
    });
}

function spawnSparks(x, y, bulletVx, bulletVy) {
    let baseAngle = Math.atan2(-bulletVy, -bulletVx);
    for (let i = 0; i < 4; i++) { 
        let a = baseAngle + (Math.random() - 0.5) * 1.0;
        let speed = 2 + Math.random() * 4; 
        particles.push({ 
            x: x, 
            y: y, 
            vx: Math.cos(a) * speed, 
            vy: Math.sin(a) * speed, 
            life: 10 + Math.random() * 10, 
            color: '#e67e22', 
            type: 'spark' 
        }); 
    }
}

function handleReload() { 
    forceReload(me); 
}

function forceReload(p) { 
    let gun = p.inventory[p.weapIdx]; 
    if (!p.reloading && gun.clip < gun.mag && gun.ammo > 0) { 
        p.reloading = true; 
        p.reloadTimer = gun.reload; 
        addText(p.x, p.y - 40, "RELOADING...", "#fff"); 
        if (typeof SoundSystem !== 'undefined') SoundSystem.play('reload'); 
    } 
}

function checkInteractUI() {
    if (!me) return; 
    let msg = document.getElementById('interact-msg'); 
    if (msg) msg.style.display = 'none'; 
    me.interactionTarget = null; 
    if (me.state !== 'ALIVE') return;
    let downed = Object.values(players).find(p => p !== me && p.state === 'DOWNED' && Math.hypot(me.x - p.x, p.y - p.y) < 50);
    if (downed) { 
        if (msg) { 
            msg.style.display = 'block'; 
            msg.innerText = "[F] REVIVE " + (downed.name || "TEAMMATE"); 
        } 
        me.interactionTarget = { type: 'REVIVE', obj: downed }; 
        return; 
    }
    let interact = RoomSystem.getNearbyInteractable(me.x, me.y, me); 
    if (interact && msg) { 
        msg.style.display = 'block'; 
        msg.innerText = interact.label; 
        me.interactionTarget = interact; 
    }
}

function handleInteractAction() { 
    if (me.state !== 'ALIVE') return; 
    if (Network.mode === 'CLIENT') Network.sendInteract(); 
    else processInteraction(me); 
}

function processInteraction(p) {
    let teammate = Object.values(players).find(pl => pl !== p && pl.state === 'DOWNED' && Math.hypot(p.x - pl.x, p.y - pl.y) < 50);
    if (teammate) { 
        teammate.state = 'ALIVE'; 
        teammate.hp = teammate.maxHp; 
        teammate.hasVigor = false; 
        teammate.invincibleTimer = 120; 
        addText(teammate.x, teammate.y, "REVIVED (+INVINCIBLE!)", "#0f0"); 
        return; 
    }
    let interact = RoomSystem.getNearbyInteractable(p.x, p.y, p);
    if (interact) {
        let t = interact;
        if (t.type === 'WINDOW') { 
            const now = Date.now(); 
            if (now - (p.lastRepairTime || 0) < GameBalanceConfig.WINDOW_REPAIR_COOLDOWN_MS) return; 
            p.lastRepairTime = now; 
            t.obj.boards++; 
            let pointsToGive = GameBalanceConfig.SCORE_WINDOW_REPAIR; 
            if (window.doublePointsTimer > 0) pointsToGive *= 2; 
            p.score += pointsToGive; 
            addText(t.obj.x + 20, t.obj.y, "+" + pointsToGive, "#fff"); 
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('purchase'); 
            addPlayerXP(p, GameBalanceConfig.XP_WINDOW_REPAIR); 
            if (typeof Tutorial !== 'undefined') Tutorial.onWindowRepaired();
        } else if (t.type === 'DOOR' && p.score >= t.obj.price) { 
            p.score -= t.obj.price; 
            t.obj.unlocked = true; 
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('purchase'); 
        } else if (t.type === 'WALLBUY') {
            const hasWeapon = p.inventory.some(w => w.name === t.obj.label);
            const cost = hasWeapon ? Math.floor(t.obj.price / 2) : t.obj.price;
            if (p.score >= cost) {
                p.score -= cost; 
                if (typeof SoundSystem !== 'undefined') SoundSystem.play('purchase');
                if (hasWeapon) { 
                    let ext = p.inventory.find(w => w.name === t.obj.label); 
                    if (ext) { 
                        ext.ammo = ext.reserve; 
                        addText(p.x, p.y, "MAX AMMO", "#fff"); 
                        if (typeof Tutorial !== 'undefined') Tutorial.onAmmoPurchased(); 
                    } 
                } else { 
                    if (p === me) unlockGun(t.obj.label); 
                    let b = weaponDB.find(w => w.name === t.obj.label); 
                    p.inventory.push({ ...b, clip: b.mag, ammo: b.reserve }); 
                    p.weapIdx = p.inventory.length - 1; 
                    addText(p.x, p.y, b.name, "#fff"); 
                }
            }
        } else if (t.type === 'BOX' && p.score >= 950) { 
            p.score -= 950; 
            let rnd = weaponDB[Math.floor(Math.random() * weaponDB.length)]; 
            p.inventory.push({ ...rnd, clip: rnd.mag, ammo: rnd.reserve }); 
            p.weapIdx = p.inventory.length - 1; 
            addText(p.x, p.y, rnd.name + "!", "#0ff"); 
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('purchase'); 
        } else if (t.type === 'PERK' && p.score >= t.obj.price && !p.hasVigor) { 
            p.score -= t.obj.price; 
            p.hasVigor = true; 
            const currentDiff = stats.difficulty || 'medium'; 
            let vigorHp = 250; 
            if (currentDiff === 'easy') vigorHp = 350;
            p.maxHp = vigorHp; 
            p.hp = vigorHp; 
            if (p === me) checkAchievements(); 
            addText(p.x, p.y, "VIGOR-UP!", "#c0392b"); 
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('purchase');
        }
    }
}

function checkAllDead() { 
    if (Network.mode === 'CLIENT') return; 
    let allDown = Object.values(players).every(p => p.state === 'DOWNED'); 
    if (allDown && !Object.values(players).some(p => p.reviveTimer > 0)) gameOver(); 
}

function updateZombies() {
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
            if (Math.hypot(p.x - z.x, p.y - z.y) < 30 && p.state === 'ALIVE') {
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

function checkGameFlow() {
    if (activeMap !== tutorialMapData && stats.zombiesAlive <= 0 && stats.zombiesToSpawn <= 0 && !stats.changingRound) {
        stats.changingRound = true;
        setTimeout(() => {
            stats.round++; 
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
            if (typeof SoundSystem !== 'undefined') SoundSystem.play('round_start'); 
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
        let ping = (p.id === me.id) ? "0ms" : "35ms", status = p.state === 'ALIVE' ? '<span style="color:#0f0">ALIVE</span>' : '<span style="color:#f00">DOWN</span>';
        tbody.innerHTML += `<tr><td style="color:${p.color}">${p.name}</td><td>${p.kills}</td><td>${p.score}</td><td>${status}</td><td>${ping}</td></tr>`;
    });
}

function resetSession() { 
    const currentMapIdx = stats.selectedMapIdx !== undefined ? stats.selectedMapIdx : 0, currentDiff = stats.difficulty || 'medium';
    let zombiesToSpawnBase = GameBalanceConfig.WAVE_BASE_MEDIUM; 
    if (currentDiff === 'easy') zombiesToSpawnBase = GameBalanceConfig.WAVE_BASE_EASY; 
    else if (currentDiff === 'hard') zombiesToSpawnBase = GameBalanceConfig.WAVE_BASE_HARD;
    stats = { score: 0, round: 1, zombiesToSpawn: zombiesToSpawnBase, zombiesAlive: 0, frame: 0, sessionKills: 0, selectedMapIdx: currentMapIdx, difficulty: currentDiff }; 
    zombies = []; bullets = []; particles = []; texts = []; window.bloodStains = []; zombieIdCounter = 0; window.drops = []; window.doublePointsTimer = 0; window.instaKillTimer = 0;
    window.activeBoss = null; window.zombieArrows = []; window.acidPools = []; window.toxicClouds = []; window.fireZones = []; window.mortarTargets = []; window.groundSmashes = []; window.screenShake = 0; window.spawnedBossTypes = []; 
    activeMap.rooms.forEach(r => r.unlocked = (r.id === 0)); 
    if (activeMap === tutorialMapData) activeMap.windows.forEach(w => w.boards = 0); 
    else activeMap.windows.forEach(w => w.boards = w.max);
}

function spawnParticles(x, y, c, n) { 
    for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 20, color: c }); 
}

function addText(x, y, t, c) { 
    texts.push({ x, y, text: t, color: c, life: 60 }); 
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
        // Draw locked circle
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
        // Render discovered sprite profiles
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
            c.arc(27 + 4, 27 - 1.5, 2, 0, Math.PI * 2); 
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
            c.moveTo(27 - 7, 27 - 8); 
            c.lineTo(27 - 12, 27 - 15); 
            c.lineTo(27 - 3, 27 - 10); 
            c.fill(); 
            c.stroke();
            c.beginPath(); 
            c.moveTo(27 + 7, 27 - 8); 
            c.lineTo(27 + 12, 27 - 15); 
            c.lineTo(27 + 3, 27 - 10); 
            c.fill(); 
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
            c.arc(27 - 4, 27 - 4, 2, 0, Math.PI * 2); 
            c.fill(); 
            c.stroke();
            c.beginPath(); 
            c.arc(27 + 4, 27 - 4, 2, 0, Math.PI * 2); 
            c.fill(); 
            c.stroke();
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
    
    // Draw Defeated Slash line
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

    let oldXP = window.matchStartingXP !== undefined ? window.matchStartingXP : (saveData.xp || 0);
    let oldCoins = window.matchStartingCoins !== undefined ? window.matchStartingCoins : (saveData.lobbyCoins || 0);
    let msg = ""; 
    try { 
        msg = saveGame(stats.round, stats.sessionKills, me.score); 
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

    // Dynamic UI data injections inside pre-rendered containers
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

    // High-speed sequential stagger reveal (0.75s interval paces)
    const staggerSequence = [
        { id: "over-title", delay: 200, sound: "zombie_hurt", shake: 14 },
        { id: "over-round-box", delay: 950, sound: "zombie_hurt", shake: 16 },
        { id: "card-stats", delay: 1700, sound: "shoot", shake: 10, action: animateStats },
        { id: "perf-msg", delay: 2450, sound: "purchase", shake: 4 },
        { id: "card-xp", delay: 3200, sound: "shoot", shake: 10, action: animateXP },
        { id: "card-boss", delay: 3950, sound: "shoot", shake: 10, action: animateBoss },
        { id: "card-cosmetic", delay: 4700, sound: "shoot", shake: 10, action: animateCosmetic },
        { id: "over-controls", delay: 5450, sound: "purchase", shake: 6 }
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
        const row = document.getElementById('over-bosses-row');
        if (!row) return;
        row.innerHTML = ""; // Clear
        
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
                        <!-- Flash Overlay for juice -->
                        <div id="over-boss-flash-${b.id}" style="position: absolute; inset: 0; border-radius: 50%; background: #fff; opacity: 0; pointer-events: none; transition: opacity 0.15s ease-out;"></div>
                    </div>
                    <span id="over-boss-status-${b.id}" style="font-size: 8px; color: ${statusColor}; font-weight: bold; text-transform: uppercase; text-align: center; line-height: 1.2; letter-spacing: 0.5px;">${statusText}</span>
                </div>
            `;
            row.insertAdjacentHTML('beforeend', slotHtml);
            
            // Draw initial frames
            if (defeated && isNewDefeat) {
                drawOverBossIcon(b.id, discovered, true, 0); // Animate strike progress later
            } else {
                drawOverBossIcon(b.id, discovered, defeated, 1);
            }
        });
        
        // Sequentially stagger scale pop each boss slot
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
                
                // --- NEW DISCOVERY JUICE ---
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
                
                // --- NEW DEFEAT ANIMATED STRIKE ---
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
                
            }, 300 + idx * 250); // Stagger interval (250ms)
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

        // Generate spinning preview of the locked cosmetic target
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
                const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null, gunName = p.gunName || (gun ? gun.name : "Model 1911");
                const ammoText = p.reloading ? "RELOADING" : (p.clip !== undefined && p.ammo !== undefined ? `${p.clip} / ${p.ammo}` : (gun ? `${gun.clip} / ${gun.ammo}` : "8 / 32"));
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
}

init();