/* --- TIMESTEP LOGIC, PLAYER ACTIONS, & GAMEPLAY LOOP --- */

let bulletIdCounter = 0; // Incremental ID counter for synchronized bullet dead-reckoning

function loop(currentTime) {
    if(!gameActive) return;

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
    if (accumulator >= tickRate) {
        accumulator = 0;
    }

    let camTarget = me;
    if(me && me.state !== 'ALIVE') {
        let survivor = Object.values(players).find(p => p.state === 'ALIVE');
        if(survivor) camTarget = survivor;
    }

    if(camTarget) {
        const baseHeight = 900;
        const scale = canvas.height / baseHeight;
        camera.x = camTarget.x - (canvas.width / scale) / 2; 
        camera.y = camTarget.y - (canvas.height / scale) / 2;
        drawGame(); updateUI();
    } else {
        ctx.fillStyle = "black"; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = "white"; ctx.font = "20px monospace"; ctx.fillText("GAME OVER...", 100, 100);
    }

    if(showScoreboard) drawScoreboard(); else document.getElementById('scoreboard').style.display='none';

    animationFrameId = requestAnimationFrame(loop);
}

function updateGameLogic() {
    if(me) updatePlayerPhysics(me, true);

    Object.values(players).forEach(p => {
        if (p !== me && p.serverX !== undefined) {
            p.x += (p.serverX - p.x) * 0.15;
            p.y += (p.serverY - p.y) * 0.15;
        }

        if (p.invincibleTimer > 0) {
            p.invincibleTimer--;
        }
    });
    
    if (typeof Tutorial !== 'undefined' && Tutorial.isActive) {
        Tutorial.update();
    }

    if (Network.mode !== 'CLIENT') {
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

            if (pickedUp || d.life <= 0) {
                window.drops.splice(i, 1);
            }
        }
    } else {
        if (window.doublePointsTimer > 0) window.doublePointsTimer--;
        if (window.instaKillTimer > 0) window.instaKillTimer--;
    }

    if(Network.mode === 'CLIENT') {
        Network.sendClientData(me);
        
        zombies.forEach(z => {
            if(z.serverX !== undefined) {
                z.x += (z.serverX - z.x) * 0.15;
                z.y += (z.serverY - z.y) * 0.15;
            }
        });

        // Smoothly progress visual bullets locally on guest client POV
        bullets.forEach(b => {
            b.x += b.vx;
            b.y += b.vy;
        });
    } else {
        stats.frame++;
        if(stats.frame % 60 === 0) Object.values(players).forEach(p => { if(p.state === 'ALIVE' && p.hp < p.maxHp) p.hp++; });

        ['p2', 'p3', 'p4'].forEach(pId => {
            const p = players[pId];
            if (p) {
                if (p.triggerReload) forceReload(p);
                p.triggerReload = false;
                
                if (Network.mode === 'LOCAL_COOP' && pId === 'p2') {
                    updateLocalCoopP2(p);
                } else {
                    updatePlayerPhysics(p, false);
                }
                
                if (p.triggerInteract) { processInteraction(p); p.triggerInteract = false; }
            }
        });

        updateZombies();
        updateBullets();
        
        stats.zombiesAlive = zombies.length;

        checkGameFlow();
        checkAllDead(); 
        
        Object.values(players).forEach(p => {
            if (p.isShooting) {
                const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null;
                if (gun && gun.auto) {
                    shootGun(p);
                } else {
                    if (!p.pressHandled) {
                        shootGun(p);
                        p.pressHandled = true;
                    }
                }
            } else {
                p.pressHandled = false;
            }
        });

        if(Network.mode === 'HOST') Network.broadcastState();
    }

    checkInteractUI();

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        if (p.type === 'shell') {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= p.friction;
            p.vy *= p.friction;
            p.angle += p.rotSpeed;
            p.rotSpeed *= 0.95;
        } else {
            p.x += p.vx;
            p.y += p.vy;
        }
        p.life--;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    for (let i = texts.length - 1; i >= 0; i--) {
        let t = texts[i];
        t.y -= 1;
        t.life--;
        if (t.life <= 0) {
            texts.splice(i, 1);
        }
    }
}

function addPlayerXP(p, amount) {
    if (!p || p.state !== 'ALIVE' || Network.mode === 'CLIENT') return;
    
    // XP and persistent coins are rewarded in real-time to the local active player profile
    if (p === me) {
        if (saveData.xp === undefined) saveData.xp = 0;
        if (saveData.lobbyCoins === undefined) saveData.lobbyCoins = 0;
        
        const oldLevel = Math.floor(saveData.xp / 1000) + 1;
        saveData.xp += amount;
        const newLevel = Math.floor(saveData.xp / 1000) + 1;
        
        if (newLevel > oldLevel) {
            addText(p.x, p.y - 100, `LEVEL UP! LEVEL ${newLevel} 🎉`, "#ffd700");
            
            // Level Up persistent Coins bonus
            saveData.lobbyCoins += 50;
            addText(p.x, p.y - 130, `+50 COINS 🪙`, "#e67e22");
            
            // Instantly update their name tag
            const baseName = p.name.split(" [Lv. ")[0];
            p.name = `${baseName} [Lv. ${newLevel}]`;
            
            // Sync nickname configuration changes to remote clients
            if (Network.mode === 'HOST') {
                window.lobbyPlayers.p1 = p.name;
                Network.broadcastToAll({
                    type: 'LOBBY_UPDATE',
                    lobbyPlayers: window.lobbyPlayers
                });
            }
        }
        
        localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));

        if (typeof AccountSystem !== 'undefined' && AccountSystem.currentUser) {
            AccountSystem.pushProfileData();
        }
    }
}

function updatePlayerPhysics(p, isLocal) {
    if(p.state === 'DOWNED') {
        if(p.reviveTimer > 0) { p.reviveTimer--; if(p.reviveTimer === 0) { p.state = 'ALIVE'; p.hp = p.maxHp; p.hasJug = false; p.invincibleTimer = 120; addText(p.x, p.y, "REVIVED (+INVINCIBLE!)", "#0f0"); } }
        return;
    }
    if(isLocal) {
        let dx = 0, dy = 0;
        
        if(keys['KeyW']) dy = -1; if(keys['KeyS']) dy = 1;
        if(keys['KeyA']) dx = -1; if(keys['KeyD']) dx = 1;
        
        if (dx || dy) {
            let len = Math.hypot(dx,dy); 
            dx /= len; 
            dy /= len;
        } else if (isTouchDevice && isMovingTouch) {
            dx = touchMoveVector.x;
            dy = touchMoveVector.y;
        }
        
        if(dx||dy) {
            let speed = 7;
            if(!RoomSystem.checkCollision(p.x+(dx*speed), p.y, true)) p.x += dx*speed;
            if(!RoomSystem.checkCollision(p.x, p.y+(dy*speed), true)) p.y += dy*speed;
        }
        
        if (isTouchDevice && isAimingTouch) {
            p.angle = Math.atan2(touchAimVector.y, touchAimVector.x);
        } else {
            const baseHeight = 900;
            const scale = canvas.height / baseHeight;
            const worldMouseX = (mouse.x / scale) + camera.x;
            const worldMouseY = (mouse.y / scale) + camera.y;
            p.angle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
        }
        
        p.isShooting = mouse.down;
    }
    
    const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null;
    if(p.reloading && gun) {
        p.reloadTimer--;
        if(p.reloadTimer <= 0) { 
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
                p.hasJug = false;
                p.invincibleTimer = 120;
                addText(p.x, p.y, "REVIVED!", "#0f0");
            }
        }
        return;
    }

    let dx = 0;
    let dy = 0;
    let isShooting = false;
    let isReloading = false;
    let isInteracting = false;

    if (p2InputConfig === 'keyboard') {
        if (keys['ArrowUp']) dy = -1;
        if (keys['ArrowDown']) dy = 1;
        if (keys['ArrowLeft']) dx = -1;
        if (keys['ArrowRight']) dx = 1;

        isShooting = keys['Slash'] || keys['Numpad0'];
        isReloading = keys['Period'] || keys['NumpadDecimal'];
        isInteracting = keys['Comma'] || keys['NumpadEnter'];

        let targetZ = null;
        let minDist = 350;
        zombies.forEach(z => {
            let dist = Math.hypot(z.x - p.x, z.y - p.y);
            if (dist < minDist) {
                minDist = dist;
                targetZ = z;
            }
        });

        if (targetZ) {
            p.angle = Math.atan2(targetZ.y - p.y, targetZ.x - p.x);
        } else if (dx !== 0 || dy !== 0) {
            p.angle = Math.atan2(dy, dx);
        }
    } else {
        const gpIdx = p2InputConfig === 'gamepad0' ? 0 : 1;
        const gamepads = navigator.getGamepads();
        const gp = gamepads[gpIdx];

        if (gp) {
            let ax0 = gp.axes[0] || 0;
            let ax1 = gp.axes[1] || 0;

            if (Math.abs(ax0) > 0.15) dx = ax0;
            if (Math.abs(ax1) > 0.15) dy = ax1;

            if (dx === 0 && dy === 0) {
                if (gp.buttons[12] && gp.buttons[12].pressed) dy = -1;
                if (gp.buttons[13] && gp.buttons[13].pressed) dy = 1;
                if (gp.buttons[14] && gp.buttons[14].pressed) dx = -1;
                if (gp.buttons[15] && gp.buttons[15].pressed) dx = 1;
            }

            let ax2 = gp.axes[2] || 0;
            let ax3 = gp.axes[3] || 0;
            if (Math.abs(ax2) > 0.2 || Math.abs(ax3) > 0.2) {
                p.angle = Math.atan2(ax3, ax2);
            } else {
                let targetZ = null;
                let minDist = 350;
                zombies.forEach(z => {
                    let dist = Math.hypot(z.x - p.x, z.y - p.y);
                    if (dist < minDist) {
                        minDist = dist;
                        targetZ = z;
                    }
                });
                if (targetZ) {
                    p.angle = Math.atan2(targetZ.y - p.y, targetZ.x - p.x);
                } else if (dx !== 0 || dy !== 0) {
                    p.angle = Math.atan2(dy, dx);
                }
            }

            isShooting = (gp.buttons[7] && gp.buttons[7].pressed) || 
                         (gp.buttons[5] && gp.buttons[5].pressed) || 
                         (gp.buttons[0] && gp.buttons[0].pressed);
            
            isReloading = (gp.buttons[2] && gp.buttons[2].pressed);
            
            isInteracting = (gp.buttons[3] && gp.buttons[3].pressed) || 
                            (gp.buttons[1] && gp.buttons[1].pressed);
        }
    }

    if (dx !== 0 || dy !== 0) {
        let len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        let speed = 7;
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
        }
    }

    if (isInteracting && !p2PrevButtons.interact) {
        p.triggerInteract = true;
    }

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
    if(p.state !== 'ALIVE' || p.reloading) return; 
    const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null;
    if (!gun) return;
    
    if(stats.frame - (gun.lastShot||0) >= gun.rpm) {
        const isInfinite = (typeof Tutorial !== 'undefined' && Tutorial.isActive && Tutorial.currentStep < 4);

        if(gun.clip > 0 || isInfinite) {
            gun.lastShot = stats.frame;
            p.muzzleFlash = 4;
            
            // Only spawn spent cartridge casings on successful ammunition discharge
            if (gun.name !== "Bazooka") {
                spawnShellCasing(p.x, p.y, p.angle);
            }

            if (!isInfinite) {
                gun.clip--;
            }
            if(me && p === me) { camera.x += (Math.random()-0.5)*5; camera.y += (Math.random()-0.5)*5; }
            let pellets = gun.type === 'shotgun' ? gun.pellets : 1;
            if(Network.mode !== 'CLIENT') {
                for(let i=0; i<pellets; i++) {
                    let a = p.angle + (Math.random()-0.5) * (gun.type==='shotgun'?0.2:0.05);
                    bulletIdCounter++; // Increment global bullet ID
                    bullets.push({ 
                        id: bulletIdCounter,
                        x: p.x, y: p.y, 
                        vx: Math.cos(a)*20, vy: Math.sin(a)*20, 
                        dmg: gun.dmg, color: gun.color, life: 50, ownerId: p.id,
                        type: gun.type === 'explosive' ? 'explosive' : 'normal'
                    });
                }
            }
        } else if (gun.ammo > 0) {
            forceReload(p);
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

// Keep helper functions synchronized
function handleReload() { forceReload(me); }
function forceReload(p) { let gun = p.inventory[p.weapIdx]; if(!p.reloading && gun.clip < gun.mag && gun.ammo > 0) { p.reloading = true; p.reloadTimer = gun.reload; addText(p.x, p.y-40, "RELOADING...", "#fff"); } }

function checkInteractUI() {
    if (!me) return;
    let msg = document.getElementById('interact-msg'); 
    if (msg) msg.style.display = 'none'; 
    me.interactionTarget = null;
    if(me.state !== 'ALIVE') return;
    
    let downed = Object.values(players).find(p => p !== me && p.state === 'DOWNED' && Math.hypot(me.x - p.x, me.y - p.y) < 50);
    if(downed) { 
        if (msg) {
            msg.style.display = 'block'; 
            msg.innerText = "[F] REVIVE " + (downed.name || "TEAMMATE"); 
        }
        me.interactionTarget = { type: 'REVIVE', obj: downed }; 
        return; 
    }
    
    let interact = RoomSystem.getNearbyInteractable(me.x, me.y, me);
    if(interact && msg) { msg.style.display = 'block'; msg.innerText = interact.label; me.interactionTarget = interact; }
}
function handleInteractAction() { if(me.state !== 'ALIVE') return; if(Network.mode === 'CLIENT') Network.sendInteract(); else processInteraction(me); }

function processInteraction(p) {
    let teammate = Object.values(players).find(pl => pl !== p && pl.state === 'DOWNED' && Math.hypot(p.x - pl.x, p.y - pl.y) < 50);
    if(teammate) { 
        teammate.state = 'ALIVE'; 
        teammate.hp = teammate.maxHp; 
        teammate.hasJug = false; 
        teammate.invincibleTimer = 120;
        addText(teammate.x, teammate.y, "REVIVED (+INVINCIBLE!)", "#0f0"); 
        return; 
    }
    let interact = RoomSystem.getNearbyInteractable(p.x, p.y, p);
    if(interact) {
        let t = interact;
        if(t.type==='WINDOW') { 
            const now = Date.now();
            if (now - (p.lastRepairTime || 0) < 500) return;
            p.lastRepairTime = now;

            t.obj.boards++; 
            
            let pointsToGive = 10;
            if (window.doublePointsTimer > 0) pointsToGive *= 2;
            
            p.score += pointsToGive; 
            addText(t.obj.x+20, t.obj.y, "+" + pointsToGive, "#fff");
            
            // Add real-time XP for board repair
            addPlayerXP(p, 15);
            
            if (typeof Tutorial !== 'undefined') {
                Tutorial.onWindowRepaired();
            }
        }
        else if(t.type==='DOOR' && p.score >= t.obj.price) { p.score-=t.obj.price; t.obj.unlocked=true; }
        else if(t.type==='WALLBUY') {
            const hasWeapon = p.inventory.some(w => w.name === t.obj.label);
            const cost = hasWeapon ? Math.floor(t.obj.price / 2) : t.obj.price;
            
            if (p.score >= cost) {
                p.score -= cost;
                if (hasWeapon) {
                    let ext = p.inventory.find(w => w.name === t.obj.label);
                    if (ext) {
                        ext.ammo = ext.reserve;
                        addText(p.x, p.y, "MAX AMMO", "#fff");
                        
                        if (typeof Tutorial !== 'undefined') {
                            Tutorial.onAmmoPurchased();
                        }
                    }
                } else {
                    if (p === me) unlockGun(t.obj.label);
                    let b = weaponDB.find(w => w.name === t.obj.label);
                    p.inventory.push({ ...b, clip: b.mag, ammo: b.reserve });
                    p.weapIdx = p.inventory.length - 1;
                    addText(p.x, p.y, b.name, "#fff");
                }
            }
        }
        else if(t.type==='BOX' && p.score>=950) { p.score-=950; let rnd=weaponDB[Math.floor(Math.random()*weaponDB.length)]; p.inventory.push({...rnd, clip:rnd.mag, ammo:rnd.reserve}); p.weapIdx=p.inventory.length-1; addText(p.x, p.y, rnd.name+"!", "#0ff"); }
        else if(t.type==='PERK' && p.score>=t.obj.price && !p.hasJug) { 
            p.score-=t.obj.price; 
            p.hasJug=true; 
            
            const currentDiff = stats.difficulty || 'medium';
            let jugHp = 250;
            if (currentDiff === 'easy') jugHp = 350;
            p.maxHp=jugHp; 
            p.hp=jugHp; 

            if(p===me) checkAchievements(); 
            addText(p.x, p.y, "JUGGERNOG!", "#c0392b"); 
        }
    }
}

function checkAllDead() { if(Network.mode === 'CLIENT') return; let allDown = Object.values(players).every(p => p.state === 'DOWNED'); if(allDown && !Object.values(players).some(p => p.reviveTimer > 0)) gameOver(); }

function updateZombies() {
    const currentDiff = stats.difficulty || 'medium';
    let spawnRate = 100;
    if (currentDiff === 'easy') spawnRate = 130;
    else if (currentDiff === 'hard') spawnRate = 70;

    if (activeMap !== tutorialMapData && stats.zombiesToSpawn > 0 && stats.frame % spawnRate === 0 && stats.zombiesAlive < 24) {
        let valid = activeMap.spawnPoints.filter(sp => activeMap.rooms[sp.roomId].unlocked);
        if (valid.length > 0) {
            let sp = valid[Math.floor(Math.random() * valid.length)];
            
            let hpMultiplier = 1.0;
            if (currentDiff === 'easy') hpMultiplier = 0.7;
            else if (currentDiff === 'hard') hpMultiplier = 1.3;
            let hp = Math.floor((100 + (stats.round * 30)) * hpMultiplier);
            
            let speedMin = 1.8, speedMax = 4.5;
            if (currentDiff === 'easy') { speedMin = 1.2; speedMax = 2.5; }
            else if (currentDiff === 'hard') { speedMin = 2.5; speedMax = 5.5; }
            let zombieSpeed = speedMin + (Math.random() * (speedMax - speedMin));

            zombieIdCounter++;
            zombies.push({ 
                id: zombieIdCounter, x: sp.x, y: sp.y, hp: hp, maxHp: hp, 
                speed: zombieSpeed, r: 16, hasEntered: false 
            });
            stats.zombiesToSpawn--; stats.zombiesAlive++;
        }
    }

    zombies.forEach((z, i) => {
        let targetX, targetY;

        if (!z.hasEntered) {
            let closestWin = null;
            let minDist = 999999;
            activeMap.windows.forEach(w => {
                let d = Math.hypot(z.x - w.entryX, z.y - w.entryY);
                if (d < minDist) { minDist = d; closestWin = w; }
            });

            if (closestWin) {
                targetX = closestWin.entryX;
                targetY = closestWin.entryY;

                if (Math.hypot(z.x - targetX, z.y - targetY) < 15) {
                    z.hasEntered = true;
                }
            } else {
                z.hasEntered = true;
            }
        }
        
        if (z.hasEntered) {
            let target = null;
            let minDist = 9999;
            Object.values(players).forEach(p => {
                if (p.state === 'ALIVE') {
                    let d = Math.hypot(p.x - z.x, p.y - z.y);
                    if (d < minDist) { minDist = d; target = p; }
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
                    attackingWindow = w; break;
                }
            }
        }

        if (attackingWindow) {
            if (stats.frame % 60 === 0) { 
                attackingWindow.boards--; 
                spawnParticles(attackingWindow.x + attackingWindow.w / 2, attackingWindow.y + attackingWindow.h / 2, '#8B4513', 2);
            }
        } else {
            let a = Math.atan2(targetY - z.y, targetX - z.x);
            let mx = Math.cos(a) * z.speed;
            let my = Math.sin(a) * z.speed;
            
            if (!RoomSystem.checkCollision(z.x + mx, z.y, false)) z.x += mx;
            if (!RoomSystem.checkCollision(z.x, z.y + my, false)) z.y += my;
        }

        for (let j = i + 1; j < zombies.length; j++) {
            let z2 = zombies[j];
            let dist = Math.hypot(z.x - z2.x, z.y - z2.y);
            if (dist < 20 && dist > 0) {
                let push = (20 - dist) / 2;
                let ax = ((z.x - z2.x) / dist) * push * 0.5;
                let ay = ((z.y - z2.y) / dist) * push * 0.5;
                if (!RoomSystem.checkCollision(z.x + ax, z.y + ay, false)) { z.x += ax; z.y += ay; }
                if (!RoomSystem.checkCollision(z2.x - ax, z2.y - ay, false)) { z2.x -= ax; z2.y -= ay; }
            }
        }

        Object.values(players).forEach(p => {
            if (Math.hypot(p.x - z.x, p.y - z.y) < 30 && p.state === 'ALIVE') {
                if (p.invincibleTimer && p.invincibleTimer > 0) return;

                p.hp -= 5;
                if (p.hp <= 0) {
                    p.state = 'DOWNED';
                    p.reviveTimer = p.hasJug ? 300 : -1;
                    if (p.hasJug) addText(p.x, p.y, "JUG SAVED YOU!", "#f00");
                    else addText(p.x, p.y, "DOWNED!", "#f00");
                }
            }
        });
    });
}

function updateBullets() {
    for(let i=bullets.length-1; i>=0; i--) {
        let b = bullets[i]; 
        if (!b) continue;
        b.x+=b.vx; b.y+=b.vy; b.life--; let hit = false;
        if(RoomSystem.checkCollision(b.x, b.y, false)) {
            hit = true;
            if (b.type === 'explosive') {
                triggerExplosion(b);
            } else {
                spawnSparks(b.x, b.y, b.vx, b.vy);
            }
        }
        if(!hit) zombies.forEach((z, zi) => {
            if (!z) return;
            // Prevent spent bullet tracers and explosive splash logic from applying to already dead zombies
            if (z.dead || z.hp <= 0) return;
            
            if(!hit && Math.hypot(b.x-z.x, b.y-z.y) < z.r+5) {
                hit = true; 
                
                if (b.type === 'explosive') {
                    triggerExplosion(b);
                } else {
                    let dmgValue = b.dmg;
                    if (window.instaKillTimer > 0) {
                        dmgValue = z.hp;
                    }

                    z.hp -= dmgValue; 
                    z.hitTimer = 4;
                    spawnParticles(z.x, z.y, '#800', 3);
                    
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

                        let pointsHit = 10;
                        if (window.doublePointsTimer > 0) pointsHit *= 2;

                        if(players[b.ownerId]) { 
                            players[b.ownerId].score += pointsHit; 
                            stats.score += pointsHit;
                            addPlayerXP(players[b.ownerId], 5); // Add real-time XP on hit
                        }
                        if(me && b.ownerId === me.id) { 
                            addText(z.x, z.y, "+" + pointsHit, "#fff"); 
                        }
                    }

                    if(z.hp <= 0) {
                        z.dead = true;
                        
                        let pointsKill = 50;
                        if (window.doublePointsTimer > 0) pointsKill *= 2;

                        stats.score += pointsKill; 
                        stats.zombiesAlive--;
                        
                        if(players[b.ownerId]) { 
                            players[b.ownerId].score += pointsKill; 
                            players[b.ownerId].kills++; 
                            addPlayerXP(players[b.ownerId], 25); // Add real-time XP on kill

                            // Award real-time Lobby Coin to local player on zombie kill
                            if (b.ownerId === 'p1') {
                                saveData.lobbyCoins = (saveData.lobbyCoins || 0) + 1;
                            }
                        }
                        if(me && b.ownerId === me.id) { 
                            stats.sessionKills++; 
                            checkAchievements(); 
                            addText(z.x, z.y, "+" + pointsKill, "#ff0"); 
                        }

                        if (Network.mode !== 'CLIENT') {
                            if (Math.random() < 0.015) { // 1.5% chance drop
                                const powerups = ['MAX_AMMO', 'NUKE', 'DOUBLE_POINTS', 'INSTA_KILL'];
                                const selected = powerups[Math.floor(Math.random() * powerups.length)];
                                window.drops.push({
                                    x: z.x,
                                    y: z.y,
                                    type: selected,
                                    life: 1800
                                });
                                addText(z.x, z.y, "POWER-UP!", "#ffd700");
                            }
                        }
                    }
                }
            }
        });
        if(hit || b.life<=0) bullets.splice(i,1);
    }

    zombies = zombies.filter(z => z && !z.dead);
}

function triggerExplosion(b) {
    const explosionRadius = 150;
    zombies.forEach(z => {
        // Prevent damage calculations on already dead zombies inside splash radius
        if (z.dead || z.hp <= 0) return;
        
        let dist = Math.hypot(b.x - z.x, b.y - z.y);
        if (dist < explosionRadius) {
            let falloff = 1 - (dist / explosionRadius);
            
            let bulletDmg = b.dmg;
            if (window.instaKillTimer > 0) {
                bulletDmg = z.hp;
            }

            let splashDmg = Math.floor(bulletDmg * falloff);
            if (splashDmg > 0) {
                z.hp -= splashDmg;
                z.hitTimer = 6;
                spawnParticles(z.x, z.y, '#e67e22', 3);
                
                if (!z.lastHitPointFrame || z.lastHitPointFrame !== stats.frame) {
                    z.lastHitPointFrame = stats.frame;

                    let pointsHit = 10;
                    if (window.doublePointsTimer > 0) pointsHit *= 2;

                    if(players[b.ownerId]) { 
                        players[b.ownerId].score += pointsHit; 
                        stats.score += pointsHit;
                        addPlayerXP(players[b.ownerId], 5); // Add real-time XP on explosive splash hit
                    }
                }

                if (z.hp <= 0) {
                    z.dead = true;
                    
                    let pointsKill = 50;
                    if (window.doublePointsTimer > 0) pointsKill *= 2;

                    stats.score += pointsKill;
                    stats.zombiesAlive--;
                    
                    if(players[b.ownerId]) { 
                        players[b.ownerId].score += pointsKill; 
                        players[b.ownerId].kills++; 
                        addPlayerXP(players[b.ownerId], 25); // Add real-time XP on explosive splash kill

                        // Award real-time Lobby Coin to local player on explosive kill
                        if (b.ownerId === 'p1') {
                            saveData.lobbyCoins = (saveData.lobbyCoins || 0) + 1;
                        }
                    }
                    if(me && b.ownerId === me.id) { 
                        stats.sessionKills++; 
                        checkAchievements(); 
                        addText(z.x, z.y, "+" + pointsKill, "#ff0"); 
                    }

                    if (Network.mode !== 'CLIENT') {
                        if (Math.random() < 0.015) { // 1.5% chance drop
                            const powerups = ['MAX_AMMO', 'NUKE', 'DOUBLE_POINTS', 'INSTA_KILL'];
                            const selected = powerups[Math.floor(Math.random() * powerups.length)];
                            window.drops.push({
                                x: z.x,
                                y: z.y,
                                type: selected,
                                life: 1800
                            });
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
    if (window.bloodStains.length > 150) window.bloodStains.splice(0, window.bloodStains.length - 150);

    addText(x, y, "BOOM!", "#e74c3c");
}

function applyPowerup(type, picker) {
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
        let nukeReward = 400;
        if (window.doublePointsTimer > 0) nukeReward *= 2;

        zombies.forEach(z => {
            z.dead = true;
            stats.zombiesAlive--;
            if (picker) {
                picker.kills++;
            }
        });
        zombies = [];

        Object.values(players).forEach(p => {
            p.score += nukeReward;
            addText(p.x, p.y - 40, "NUKE! +" + nukeReward, "#e74c3c");
        });
        stats.score += nukeReward;
    } else if (type === 'DOUBLE_POINTS') {
        window.doublePointsTimer = 1800;
        Object.values(players).forEach(p => {
            addText(p.x, p.y - 40, "DOUBLE POINTS!", "#f39c12");
        });
    } else if (type === 'INSTA_KILL') {
        window.instaKillTimer = 1800;
        Object.values(players).forEach(p => {
            addText(p.x, p.y - 40, "INSTA-KILL!", "#9b59b6");
        });
    }
}

function checkGameFlow() {
    if(activeMap !== tutorialMapData && stats.zombiesAlive <= 0 && stats.zombiesToSpawn <= 0 && !stats.changingRound) {
        stats.changingRound = true;
        setTimeout(() => {
            stats.round++; 
            
            const currentDiff = stats.difficulty || 'medium';
            let spawnScalar = 1.15;
            let spawnMultiplier = 6;
            if (currentDiff === 'easy') { spawnMultiplier = 4; spawnScalar = 1.10; }
            else if (currentDiff === 'hard') { spawnMultiplier = 10; spawnScalar = 1.25; }

            stats.zombiesToSpawn = Math.floor(spawnMultiplier * Math.pow(spawnScalar, stats.round)); 
            stats.changingRound = false; 
            
            addText(me ? me.x : 200, (me ? me.y : 200) - 100, "ROUND "+stats.round, "#a83232"); 
            checkAchievements();
            Object.values(players).forEach(p => {
                if(p.state !== 'ALIVE') {
                    p.state = 'ALIVE'; p.hp = 100; p.maxHp = 100; p.hasJug = false;
                    let survivor = Object.values(players).find(pl => pl.state === 'ALIVE' && pl !== p);
                    if(survivor) { p.x = survivor.x; p.y = survivor.y; }
                    addText(p.x, p.y, "RESPAWNED!", "#0ff");
                }
            });
        }, 4000);
    }
}

function drawScoreboard() {
    const board = document.getElementById('scoreboard'); board.style.display = 'block';
    const tbody = document.getElementById('score-body'); tbody.innerHTML = '';
    Object.values(players).forEach(p => {
        let ping = (p.id === me.id) ? "0ms" : "35ms";
        let status = p.state === 'ALIVE' ? '<span style="color:#0f0">ALIVE</span>' : '<span style="color:#f00">DOWN</span>';
        tbody.innerHTML += `<tr><td style="color:${p.color}">${p.name}</td><td>${p.kills}</td><td>${p.score}</td><td>${status}</td><td>${ping}</td></tr>`;
    });
}

function resetSession() { 
    const currentMapIdx = stats.selectedMapIdx !== undefined ? stats.selectedMapIdx : 0;
    const currentDiff = stats.difficulty || 'medium';
    
    let zombiesToSpawnBase = 6;
    if (currentDiff === 'easy') zombiesToSpawnBase = 4;
    else if (currentDiff === 'hard') zombiesToSpawnBase = 10;

    stats = { 
        score: 0, 
        round: 1, 
        zombiesToSpawn: zombiesToSpawnBase, 
        zombiesAlive: 0, 
        frame: 0, 
        sessionKills: 0, 
        selectedMapIdx: currentMapIdx,
        difficulty: currentDiff
    }; 

    zombies = []; bullets = []; particles = []; texts = []; window.bloodStains = []; zombieIdCounter = 0; 
    
    window.drops = [];
    window.doublePointsTimer = 0;
    window.instaKillTimer = 0;

    activeMap.rooms.forEach(r => r.unlocked = (r.id === 0)); 
    
    if (activeMap === tutorialMapData) {
        activeMap.windows.forEach(w => w.boards = 0);
    } else {
        activeMap.windows.forEach(w => w.boards = w.max);
    }
}
function spawnParticles(x, y, c, n) { for(let i=0; i<n; i++) particles.push({x, y, vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5, life:20, color:c}); }
function addText(x, y, t, c) { texts.push({x, y, text:t, color:c, life:60}); }
function gameOver() { 
    if(!gameActive) return; 
    gameActive = false; 
    if(Network.mode === 'HOST') Network.broadcastGameOver(stats); 
    
    if (typeof Tutorial !== 'undefined' && Tutorial.isActive) {
        Tutorial.resetOnDeath();
        return;
    }

    let msg = ""; 
    try { msg = saveGame(stats.round, stats.sessionKills, me.score); } catch(e) {} 
    document.getElementById('game-ui').style.display='none'; 
    document.getElementById('game-over').style.display='flex'; 
    document.getElementById('death-msg').innerText="Survived to Round "+stats.round; 
    if(document.getElementById('perf-msg')) document.getElementById('perf-msg').innerText = msg; 

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
        } else {
            returnLobbyBtn.style.display = 'none';
        }
    }
}

function returnToLobby() {
    if (Network.mode === 'HOST') {
        try {
            Network.broadcastToAll({ type: 'RETURN_TO_LOBBY' });
        } catch (e) {
            console.warn("Failed to broadcast return to lobby:", e);
        }
    }
    goToLobbyScreen();
}

function updateUI() {
    document.getElementById('round-box').innerText = stats.round;

    const badgeDouble = document.getElementById('badge-double');
    const badgeInsta = document.getElementById('badge-instakill');
    if (badgeDouble) {
        badgeDouble.style.display = (window.doublePointsTimer > 0) ? 'block' : 'none';
    }
    if (badgeInsta) {
        badgeInsta.style.display = (window.instaKillTimer > 0) ? 'block' : 'none';
    }

    // Dynamic Local Damage-Flash Vignette Overlay Tracker
    if (me) {
        if (me.lastHp === undefined) {
            me.lastHp = me.hp;
        }
        if (me.hp < me.lastHp) {
            const flash = document.getElementById('damage-flash');
            if (flash) {
                flash.style.zIndex = "9999";       // Force rendering on top of the canvas
                flash.style.boxSizing = "border-box"; // Prevent screen scrollbar flickering
                flash.style.boxShadow = "inset 0 0 80px rgba(180, 0, 0, 0.9)";
                flash.style.border = "12px solid rgba(180, 0, 0, 0.7)";
                flash.style.background = "rgba(180, 0, 0, 0.15)";
                setTimeout(() => {
                    flash.style.boxShadow = "none";
                    flash.style.border = "none";
                    flash.style.background = "transparent";
                }, 150); // Kept on screen for 150ms
            }
        }
        me.lastHp = me.hp;
    }

    ['p1', 'p2', 'p3', 'p4'].forEach(pId => {
        const p = players[pId];
        const hud = document.getElementById('hud-' + pId);
        if (hud) {
            if (p) {
                hud.style.display = 'block';
                document.getElementById(pId + '-name').innerText = p.name || pId.toUpperCase();
                document.getElementById(pId + '-score').innerHTML = p.score + ' <span style="font-size:16px">⛃</span>';
                
                const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null;
                const gunName = p.gunName || (gun ? gun.name : "M1911");
                const ammoText = p.reloading ? "RELOADING" : (p.clip !== undefined && p.ammo !== undefined ? `${p.clip} / ${p.ammo}` : (gun ? `${gun.clip} / ${gun.ammo}` : "8 / 32"));
                
                document.getElementById(pId + '-gun-name').innerText = gunName;
                document.getElementById(pId + '-ammo-text').innerText = ammoText;
                document.getElementById(pId + '-icon-jug').style.display = p.hasJug ? 'block' : 'none';
            } else {
                hud.style.display = 'none';
            }
        }
    });
}

// Start game initialization once all scripting dependencies have loaded
init();