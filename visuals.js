/* --- VISUALS MODULE --- */

// Draw an arcade-style floating/bouncing guidance arrow pointing to objectives
function drawFloatingArrow(x, y, color = '#ffd700') {
    const bounce = Math.sin(Date.now() / 150) * 8;
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.translate(x, y + bounce - 25);
    
    ctx.beginPath();
    ctx.moveTo(-10, -20);
    ctx.lineTo(10, -20);
    ctx.lineTo(10, -10);
    ctx.lineTo(18, -10);
    ctx.lineTo(0, 8);
    ctx.lineTo(-18, -10);
    ctx.lineTo(-10, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
}

function drawBackCosmetic(id, r, targetCtx = ctx) {
    const cos = cosmeticDB.find(c => c.id === id);
    if (!cos) return;

    targetCtx.save();
    targetCtx.fillStyle = cos.color;
    targetCtx.strokeStyle = '#000';
    targetCtx.lineWidth = 2;

    if (cos.type === 'cone') {
        targetCtx.beginPath();
        targetCtx.moveTo(-r + 2, -10);
        targetCtx.lineTo(-r - 20, 0);
        targetCtx.lineTo(-r + 2, 10);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
    } else if (cos.type === 'backpack') {
        targetCtx.fillRect(-r - 12, -8, 12, 16);
        targetCtx.strokeRect(-r - 12, -8, 12, 16);
    } else if (cos.type === 'cape') {
        targetCtx.beginPath();
        targetCtx.moveTo(-r + 3, -12);
        targetCtx.lineTo(-r - 24, -18);
        targetCtx.lineTo(-r - 24, 18);
        targetCtx.lineTo(-r + 3, 12);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
    } else if (cos.type === 'jetpack') {
        targetCtx.fillStyle = '#7f8c8d';
        targetCtx.fillRect(-r - 10, -10, 10, 20);
        targetCtx.strokeRect(-r - 10, -10, 10, 20);
        
        targetCtx.fillStyle = cos.color;
        targetCtx.fillRect(-r - 14, -8, 4, 5);
        targetCtx.strokeRect(-r - 14, -8, 4, 5);
        targetCtx.fillRect(-r - 14, 3, 4, 5);
        targetCtx.strokeRect(-r - 14, 3, 4, 5);
        
        if (Math.random() < 0.6) {
            targetCtx.fillStyle = '#ff3300';
            targetCtx.fillRect(-r - 22, -7, 8, 3);
            targetCtx.fillRect(-r - 22, 4, 8, 3);
            targetCtx.fillStyle = '#ffaa00';
            targetCtx.fillRect(-r - 18, -6, 4, 1);
            targetCtx.fillRect(-r - 18, 5, 4, 1);
        }
    } else if (cos.type === 'wings') {
        const flap = Math.sin(Date.now() / 100) * 0.25;
        
        targetCtx.save();
        targetCtx.translate(-r + 2, -6);
        targetCtx.rotate(-Math.PI / 4 + flap);
        
        targetCtx.fillStyle = '#0f0f0f';
        targetCtx.strokeStyle = cos.color;
        targetCtx.lineWidth = 2.5;
        targetCtx.beginPath();
        targetCtx.moveTo(0, 0);
        targetCtx.lineTo(-14, -30);
        targetCtx.lineTo(-5, -34);
        targetCtx.lineTo(6, -10);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        
        targetCtx.strokeStyle = '#ffffff';
        targetCtx.lineWidth = 1;
        targetCtx.beginPath();
        targetCtx.moveTo(-6, -15);
        targetCtx.lineTo(-2, -26);
        targetCtx.moveTo(-2, -10);
        targetCtx.lineTo(2, -20);
        targetCtx.stroke();
        targetCtx.restore();

        targetCtx.save();
        targetCtx.translate(-r + 2, 6);
        targetCtx.rotate(Math.PI / 4 - flap);
        
        targetCtx.fillStyle = '#0f0f0f';
        targetCtx.strokeStyle = cos.color;
        targetCtx.lineWidth = 2.5;
        targetCtx.beginPath();
        targetCtx.moveTo(0, 0);
        targetCtx.lineTo(-14, 30);
        targetCtx.lineTo(-5, 34);
        targetCtx.lineTo(6, 10);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        
        targetCtx.strokeStyle = '#ffffff';
        targetCtx.lineWidth = 1;
        targetCtx.beginPath();
        targetCtx.moveTo(-6, 15);
        targetCtx.lineTo(-2, 26);
        targetCtx.moveTo(-2, 10);
        targetCtx.lineTo(2, 20);
        targetCtx.stroke();
        targetCtx.restore();
    } else if (cos.type === 'halo') {
        targetCtx.save();
        const pulse = 1 + Math.sin(Date.now() / 150) * 0.08;
        
        targetCtx.shadowBlur = 12;
        targetCtx.shadowColor = cos.color;
        targetCtx.strokeStyle = cos.color;
        targetCtx.lineWidth = 3;
        
        targetCtx.beginPath();
        targetCtx.ellipse(-r * 0.2, 0, r * 0.8 * pulse, r * 0.4 * pulse, 0, 0, Math.PI * 2);
        targetCtx.stroke();
        targetCtx.restore();
    }

    targetCtx.restore();
}

function drawGame() {
    if (!activeMap) return;

    ctx.fillStyle = '#050505'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();

    // Adjust scale base dynamically depending on device types to manage viewport dimensions [1]
    const baseHeight = isTouchDevice ? 520 : 900;
    const scale = canvas.height / baseHeight;
    ctx.scale(scale, scale);

    let shakeX = 0;
    let shakeY = 0;
    if (window.screenShake > 0) {
        shakeX = (Math.random() - 0.5) * window.screenShake;
        shakeY = (Math.random() - 0.5) * window.screenShake;
        window.screenShake *= 0.88;
        if (window.screenShake < 0.4) window.screenShake = 0;
    }

    ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

    activeMap.rooms.forEach(r => {
        ctx.fillStyle = r.color;
        if (r.unlocked) {
            ctx.globalAlpha = 1.0;
        } else {
            ctx.globalAlpha = 0.15; 
        }
        ctx.fillRect(r.x, r.y, r.w, r.h);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.lineWidth = 1;
        for (let gx = r.x; gx < r.x + r.w; gx += 80) {
            ctx.beginPath();
            ctx.moveTo(gx, r.y);
            ctx.lineTo(gx, r.y + r.h);
            ctx.stroke();
        }
        for (let gy = r.y; gy < r.y + r.h; gy += 80) {
            ctx.beginPath();
            ctx.moveTo(r.x, gy);
            ctx.lineTo(r.x + r.w, gy);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    });

    if (window.bloodStains) {
        window.bloodStains.forEach(s => {
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    if (window.acidPools) {
        window.acidPools.forEach(p => {
            ctx.save();
            ctx.fillStyle = 'rgba(46, 204, 113, 0.22)';
            ctx.strokeStyle = '#2ecc71';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(46, 204, 113, 0.4)';
            for (let j = 0; j < 3; j++) {
                const bubbleX = p.x + Math.sin((Date.now() / 200) + j) * (p.r * 0.45);
                const bubbleY = p.y + Math.cos((Date.now() / 250) + j) * (p.r * 0.45);
                ctx.beginPath();
                ctx.arc(bubbleX, bubbleY, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });
    }

    if (window.toxicClouds) {
        window.toxicClouds.forEach(c => {
            ctx.save();
            const grad = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r);
            grad.addColorStop(0, 'rgba(39, 174, 96, 0.45)');
            grad.addColorStop(0.7, 'rgba(46, 204, 113, 0.18)');
            grad.addColorStop(1, 'rgba(46, 204, 113, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    if (window.fireZones) {
        window.fireZones.forEach(fz => {
            ctx.save();
            ctx.fillStyle = 'rgba(230, 126, 34, 0.18)';
            ctx.beginPath();
            ctx.arc(fz.x, fz.y, fz.r, 0, Math.PI * 2);
            ctx.fill();
            
            for (let j = 0; j < 6; j++) {
                const angle = (j * Math.PI * 2) / 6 + (Date.now() / 800);
                const offsetDist = (fz.r * 0.55) * (0.4 + 0.6 * Math.sin((Date.now() / 120) + j));
                const fx = fz.x + Math.cos(angle) * offsetDist;
                const fy = fz.y + Math.sin(angle) * offsetDist;
                const h = 10 + Math.random() * 12;
                ctx.fillStyle = j % 2 === 0 ? '#e67e22' : '#e74c3c';
                ctx.fillRect(fx - 2, fy - h, 4, h);
            }
            ctx.restore();
        });
    }

    if (window.mortarTargets) {
        window.mortarTargets.forEach(t => {
            ctx.save();
            const pulse = 1 + Math.sin(Date.now() / 70) * 0.08;
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.85)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r * pulse, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)';
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r + 10, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.6)';
            ctx.beginPath();
            ctx.moveTo(t.x - 20, t.y); ctx.lineTo(t.x + 20, t.y);
            ctx.moveTo(t.x, t.y - 20); ctx.lineTo(t.x, t.y + 20);
            ctx.stroke();
            ctx.restore();
        });
    }

    if (window.groundSmashes) {
        window.groundSmashes.forEach(s => {
            ctx.save();
            let alpha = s.life / 25;
            if (alpha < 0) alpha = 0; if (alpha > 1) alpha = 1;
            
            ctx.strokeStyle = s.color ? s.color.replace('ALPHA', alpha) : `rgba(211, 84, 0, ${alpha})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });
    }

    // --- DRAW RAMPAGER CHARGING PATH LINE ---
    zombies.forEach(z => {
        if (z.type === 'boss_rampager' && z.chargeState === 'TELEGRAPH') {
            ctx.save();
            ctx.strokeStyle = 'rgba(192, 57, 43, 0.15)';
            ctx.lineWidth = z.r * 2;
            ctx.lineCap = 'round';
            
            const speed = (z.chargeAttackType === 'RAPID') ? 20 : 24;
            const ticks = (z.chargeAttackType === 'RAPID') ? 18 : 35;
            const chargeLen = speed * ticks;
            
            ctx.beginPath();
            ctx.moveTo(z.x, z.y);
            ctx.lineTo(z.x + Math.cos(z.chargeAngle) * chargeLen, z.y + Math.sin(z.chargeAngle) * chargeLen);
            ctx.stroke();
            
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([12, 6]);
            ctx.beginPath();
            ctx.moveTo(z.x + Math.cos(z.chargeAngle + Math.PI/2)*z.r, z.y + Math.sin(z.chargeAngle + Math.PI/2)*z.r);
            ctx.lineTo(z.x + Math.cos(z.chargeAngle + Math.PI/2)*z.r + Math.cos(z.chargeAngle) * chargeLen, z.y + Math.sin(z.chargeAngle + Math.PI/2)*z.r + Math.sin(z.chargeAngle) * chargeLen);
            ctx.moveTo(z.x - Math.cos(z.chargeAngle + Math.PI/2)*z.r, z.y - Math.sin(z.chargeAngle + Math.PI/2)*z.r);
            ctx.lineTo(z.x - Math.cos(z.chargeAngle + Math.PI/2)*z.r + Math.cos(z.chargeAngle) * chargeLen, z.y - Math.sin(z.chargeAngle + Math.PI/2)*z.r + Math.sin(z.chargeAngle) * chargeLen);
            ctx.stroke();
            ctx.restore();
        }
    });

    if (window.drops) {
        window.drops.forEach(d => {
            ctx.save();
            const isFlickering = d.life < 300 && Math.floor(d.life / 10) % 2 === 0;
            if (!isFlickering) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ffd700';
            }
            const pulse = 1 + Math.sin(Date.now() / 120) * 0.12;
            
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(d.x, d.y, 18 * pulse, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
            ctx.beginPath();
            ctx.arc(d.x, d.y, 15 * pulse, 0, Math.PI * 2);
            ctx.fill();
            
            let symbol = "?";
            let symColor = "#fff";
            if (d.type === 'MAX_AMMO') { symbol = "AMMO"; symColor = "#2ecc71"; }
            else if (d.type === 'NUKE') { symbol = "NUKE"; symColor = "#e74c3c"; }
            else if (d.type === 'DOUBLE_POINTS') { symbol = "2X"; symColor = "#f39c12"; }
            else if (d.type === 'INSTA_KILL') { symbol = "INSTA"; symColor = "#9b59b6"; }
            
            ctx.fillStyle = symColor;
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(symbol, d.x, d.y);
            ctx.restore();
        });
    }

    activeMap.furniture.forEach(f => {
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x, f.y, f.w, f.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(f.x, f.y, f.w, f.h);
    });

    ctx.fillStyle = '#2c3e50'; 
    activeMap.walls.forEach(w => {
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = '#000000'; 
        ctx.lineWidth = 2.5;
        ctx.strokeRect(w.x, w.y, w.w, w.h);
    });

    activeMap.windows.forEach(w => {
        ctx.strokeStyle = '#000000'; 
        ctx.lineWidth = 2.5;
        ctx.strokeRect(w.x, w.y, w.w, w.h);
        
        ctx.fillStyle = '#8B4513';
        if (w.boards > 0) {
            const isHorizontal = (w.orientation === 'H');
            const totalLength = isHorizontal ? w.w : w.h;
            const boardSpacing = totalLength / w.max;
            const boardWidth = boardSpacing * 0.7; 
            const padding = boardSpacing * 0.15; 
            
            for (let i = 0; i < w.boards; i++) {
                if (isHorizontal) {
                    ctx.fillRect(w.x + (i * boardSpacing) + padding, w.y, boardWidth, w.h);
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(w.x + (i * boardSpacing) + padding, w.y, boardWidth, w.h);
                } else {
                    ctx.fillRect(w.x, w.y + (i * boardSpacing) + padding, w.w, boardWidth);
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(w.x, w.y + (i * boardSpacing) + padding, w.w, boardWidth);
                }
            }
        }
    });

    activeMap.rooms.forEach(r => {
        if (!r.unlocked && r.door) {
            ctx.fillStyle = '#8d6e63'; 
            ctx.fillRect(r.door.x, r.door.y, r.door.w, r.door.h);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(r.door.x, r.door.y, r.door.w, r.door.h);
            
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(r.door.x + 5, r.door.y + r.door.h/2 - 2, r.door.w - 10, 4);
            ctx.strokeRect(r.door.x + 5, r.door.y + r.door.h/2 - 2, r.door.w - 10, 4);

            ctx.fillStyle = '#fff'; 
            ctx.textAlign = 'center'; 
            ctx.font = "14px monospace";
            ctx.fillText(r.price + "⛃", r.door.x + r.door.w/2, r.door.y + r.door.h/2 + 25);
        }
    });

    activeMap.interactables.forEach(i => {
        ctx.fillStyle = i.type === 'BOX' ? i.color : '#555';
        ctx.fillRect(i.x, i.y, i.w, i.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(i.x, i.y, i.w, i.h);
        
        ctx.fillStyle = '#fff'; 
        ctx.textAlign = 'center';
        
        if (i.type === 'WALLBUY') { 
            ctx.font = "10px Arial"; 
            ctx.fillText("GUN", i.x+20, i.y+20); 
        } else if (i.type === 'PERK') { 
            ctx.font = "bold 10px Arial"; 
            ctx.fillText("VIG", i.x+25, i.y+25); 
        } else { 
            ctx.font = "30px Arial"; 
            ctx.fillText("?", i.x+30, i.y+40); 
        }
    });

    Object.values(players).forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        
        if (p.state === 'ALIVE' && p.name) {
            ctx.fillStyle = "#fff";
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "center";
            ctx.shadowColor = "black";
            ctx.shadowBlur = 2;
            ctx.fillText(p.name, 0, -45); 
            ctx.shadowBlur = 0;
        }

        if (p.state === 'DOWNED') {
            ctx.globalAlpha = 0.5; 
            if (p.reviveTimer > 0) {
                ctx.fillStyle = "black"; 
                ctx.fillRect(-20, -35, 40, 5);
                ctx.fillStyle = "#0f0"; 
                ctx.fillRect(-20, -35, 40 * (p.reviveTimer/300), 5);
            } else {
                ctx.fillStyle = "red"; 
                ctx.font = "bold 12px Arial"; 
                ctx.textAlign = "center";
                ctx.fillText("NEED HELP", 0, -35);
            }
        }
        
        ctx.rotate(p.angle);
        if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer / 4) % 2 === 0) {
            ctx.globalAlpha = 0.3; 
        }

        const equippedCos = p.equippedCosmetic || (p.id === 'p1' ? saveData.equippedCosmetic : 'none');
        const cosObj = equippedCos !== 'none' ? cosmeticDB.find(c => c.id === equippedCos) : null;
        
        if (cosObj && cosObj.type !== 'halo') {
            drawBackCosmetic(equippedCos, p.r, ctx);
        }
        
        ctx.fillStyle = p.hasVigor ? '#c0392b' : p.color;
        
        ctx.beginPath(); 
        ctx.arc(0, 0, p.r, 0, Math.PI*2); 
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        const activeGunColor = p.gunColor || (p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx].color : '#999');
        ctx.fillStyle = activeGunColor;
        ctx.fillRect(0, -5, 25, 10);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(0, -5, 25, 10);

        if (cosObj && cosObj.type === 'halo') {
            drawBackCosmetic(equippedCos, p.r, ctx);
        }
        ctx.restore();
    });

    zombies.forEach(z => {
        ctx.save();
        if (z.hitTimer && z.hitTimer > 0) {
            ctx.fillStyle = '#ff4757'; 
            z.hitTimer--; 
        } else {
            ctx.fillStyle = z.color || '#3a4a38'; 
        }
        
        ctx.beginPath(); 
        ctx.arc(z.x, z.y, z.r, 0, Math.PI*2); 
        ctx.fill();
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        if (z.isBoss) {
            if (z.type === 'boss_logbreaker') {
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(z.x - 12, z.y - 12); ctx.lineTo(z.x + 12, z.y + 12);
                ctx.moveTo(z.x + 12, z.y - 12); ctx.lineTo(z.x - 12, z.y + 12);
                ctx.stroke();
            } else if (z.type === 'boss_rampager') {
                ctx.strokeStyle = '#7f8c8d';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(z.x, z.y, z.r - 4, 0, Math.PI, true);
                ctx.stroke();
                
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1.5;
                ctx.save();
                ctx.translate(z.x, z.y);
                ctx.rotate(z.chargeAngle || 0);
                ctx.beginPath();
                ctx.moveTo(10, -12); ctx.lineTo(25, -20); ctx.lineTo(14, -5);
                ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(10, 12); ctx.lineTo(25, 20); ctx.lineTo(14, 5);
                ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.restore();
            } else if (z.type === 'boss_decayer') {
                ctx.fillStyle = 'rgba(46, 204, 113, 0.4)';
                ctx.beginPath();
                ctx.arc(z.x - 6, z.y + 6, 5, 0, Math.PI*2);
                ctx.arc(z.x + 8, z.y - 8, 4, 0, Math.PI*2);
                ctx.fill();
            }
        }
        
        ctx.fillStyle = '#f00';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        
        if (z.type === 'boss_blink') {
            ctx.fillStyle = '#00ffff';
            ctx.beginPath(); ctx.arc(z.x - 6, z.y - 4, 2.8, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(z.x + 6, z.y - 4, 2.8, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(z.x, z.y - 10, 3.2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        } else {
            ctx.beginPath(); 
            ctx.arc(z.x - 5, z.y - 5, 2.5, 0, Math.PI*2); 
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(z.x + 5, z.y - 5, 2.5, 0, Math.PI*2); 
            ctx.fill();
            ctx.stroke();
        }
        
        if (z.hp < z.maxHp) {
            ctx.fillStyle = '#000'; 
            ctx.fillRect(z.x - 12, z.y - 25, 24, 4);
            
            ctx.fillStyle = '#f00'; 
            let pct = z.hp / z.maxHp;
            if (pct < 0) pct = 0;
            ctx.fillRect(z.x - 12, z.y - 25, 24 * pct, 4);
        }
        ctx.restore();
    });

    bullets.forEach(b => {
        let bulletColor = b.color;
        const darkColors = ['#000', '#222', '#333', '#444', '#3e2723', '#5c4033', '#2c3e50', '#212f3c', '#555'];
        if (darkColors.includes(bulletColor.toLowerCase())) {
            bulletColor = '#ffd700'; 
        }
        
        ctx.save();
        if (b.type === 'explosive') {
            ctx.fillStyle = '#ff4757';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#e67e22';
            ctx.lineWidth = 2.5;
            ctx.stroke();
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); 
            ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); 
            ctx.fill();
            
            ctx.strokeStyle = bulletColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.restore();
    });

    if (window.zombieArrows) {
        window.zombieArrows.forEach(a => {
            ctx.save();
            ctx.translate(a.x, a.y);
            ctx.rotate(Math.atan2(a.vy, a.vx));
            ctx.fillStyle = '#ff3b30'; 
            ctx.fillRect(-6, -1.5, 12, 3);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(-6, -1.5, 12, 3);
            ctx.restore();
        });
    }

    texts.forEach(t => { 
        ctx.fillStyle = t.color; 
        ctx.textAlign = 'center'; 
        ctx.font = "bold 20px monospace"; 
        ctx.shadowColor = "black";
        ctx.shadowBlur = 2;
        ctx.fillText(t.text, t.x, t.y); 
        ctx.shadowBlur = 0;
    });

    particles.forEach(p => { 
        if (p.type === 'shell') {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = p.color;
            ctx.fillRect(-2, -1, 4, 1.5); 
            ctx.restore();
        } else if (p.type === 'spark') {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 2, 2); 
        } else {
            ctx.fillStyle = p.color; 
            ctx.fillRect(p.x, p.y, 3, 3); 
        }
    });

    if (typeof Tutorial !== 'undefined' && Tutorial.isActive && me) {
        Tutorial.drawIndicators();
    }

    ctx.restore(); 
    
    if (window.activeBoss && window.activeBoss.name) {
        const barW = 400;
        const barH = 16;
        const x = (canvas.width - barW) / 2;
        const y = 170; 
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(x - 4, y - 4, barW + 8, barH + 8);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x - 4, y - 4, barW + 8, barH + 8);
        
        let pct = window.activeBoss.hp / window.activeBoss.maxHp;
        if (pct < 0) pct = 0;
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(x, y, barW * pct, barH);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(x, y, barW * pct, barH / 2);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 13px monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${window.activeBoss.name.toUpperCase()} (${Math.floor(pct * 100)}%)`, x + barW / 2, y + barH / 2);
    }
}