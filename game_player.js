/* --- PLAYER SYSTEMS: PROGRESSION, PHYSICS, WEAPONS & INTERACTION --- */

function addPlayerXP(p, amount) {
    if (!p || p.state !== 'ALIVE') return;
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
    if (p.state === 'SPECTATING') return; 
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
            const scale = window.getGameScale();
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
    if (p.state === 'SPECTATING') return; 
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

    // --- MELEE SWIPE REDIRECT FOR PvP INFECTION MODE ---
    if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive && InfectionMode.infectedIds.has(p.id)) {
        InfectionMode.triggerMeleeSlash(p);
        return;
    }

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
        } else if (gun.ammo > 0) {
            forceReload(p); 
        } else {
            if (stats.frame - (gun.lastDryFire || 0) >= 35) {
                gun.lastDryFire = stats.frame;
                if (typeof SoundSystem !== 'undefined') {
                    if (p === me || (Network.mode === 'LOCAL_COOP' && p.id === 'p2')) {
                        SoundSystem.play('dry_fire');
                    }
                }
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
    if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive && InfectionMode.infectedIds.has(p.id)) return;
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

    if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
        if (InfectionMode.infectedIds.has(me.id)) return;
    }

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
    if (Network.mode === 'CLIENT') {
        Network.sendInteract(); 
    } else {
        processInteraction(me); 
    }
}

function processInteraction(p) {
    if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive && InfectionMode.infectedIds.has(p.id)) return;

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
                    p.justPurchasedWeapon = b.name; // Apply lock to prevent rollback
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