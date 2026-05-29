/* --- VISUALS MODULE --- */

// Draw an arcade-style floating/bouncing guidance arrow pointing to objectives
function drawFloatingArrow(x, y, color = '#ffd700') {
    const bounce = Math.sin(Date.now() / 150) * 8;
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.translate(x, y + bounce - 25);
    
    // Path drawing for custom downward-pointing 2D arrow
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
    targetCtx.lineWidth = 2; // Bold outline to match theme

    // Based on the game canvas coordinate transformations,
    // the player faces positive X, meaning the "back" is at negative X (-r)
    if (cos.type === 'cone') {
        // Triangular backwards-pointing cone (matches your drawing)
        targetCtx.beginPath();
        targetCtx.moveTo(-r + 2, -10);
        targetCtx.lineTo(-r - 20, 0); // Point extending backwards
        targetCtx.lineTo(-r + 2, 10);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
    } 
    else if (cos.type === 'backpack') {
        // Robust adventure backpack
        targetCtx.fillRect(-r - 12, -8, 12, 16);
        targetCtx.strokeRect(-r - 12, -8, 12, 16);
    } 
    else if (cos.type === 'cape') {
        // Flows backward
        targetCtx.beginPath();
        targetCtx.moveTo(-r + 3, -12);
        targetCtx.lineTo(-r - 24, -18);
        targetCtx.lineTo(-r - 24, 18);
        targetCtx.lineTo(-r + 3, 12);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
    }
    else if (cos.type === 'jetpack') {
        // Steel thruster unit with glowing neon cyan nozzle caps
        targetCtx.fillStyle = '#7f8c8d';
        targetCtx.fillRect(-r - 10, -10, 10, 20);
        targetCtx.strokeRect(-r - 10, -10, 10, 20);
        
        // Thrusters
        targetCtx.fillStyle = cos.color;
        targetCtx.fillRect(-r - 14, -8, 4, 5);
        targetCtx.strokeRect(-r - 14, -8, 4, 5);
        targetCtx.fillRect(-r - 14, 3, 4, 5);
        targetCtx.strokeRect(-r - 14, 3, 4, 5);
        
        // Fire particles flicker
        if (Math.random() < 0.6) {
            targetCtx.fillStyle = '#ff3300';
            targetCtx.fillRect(-r - 22, -7, 8, 3);
            targetCtx.fillRect(-r - 22, 4, 8, 3);
            targetCtx.fillStyle = '#ffaa00';
            targetCtx.fillRect(-r - 18, -6, 4, 1);
            targetCtx.fillRect(-r - 18, 5, 4, 1);
        }
    }

    targetCtx.restore();
}

function drawGame() {
    if (!activeMap) return;

    // 1. Clear Screen
    ctx.fillStyle = '#050505'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();

    // Scale view relative to standard vertical resolution baseline (900px target height)
    const baseHeight = 900;
    const scale = canvas.height / baseHeight;
    ctx.scale(scale, scale);

    // Apply Camera
    ctx.translate(-camera.x, -camera.y);

    // 2. Draw Rooms (Floor Tiles & Concrete Texturing)
    activeMap.rooms.forEach(r => {
        ctx.fillStyle = r.color;
        
        // Locked rooms are darker/transparent
        if(r.unlocked) {
            ctx.globalAlpha = 1.0;
        } else {
            ctx.globalAlpha = 0.15; 
        }
        
        ctx.fillRect(r.x, r.y, r.w, r.h);
        
        // Draw elegant subtle tiled floor lines for tactile texture feedback
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
        
        ctx.globalAlpha = 1.0; // Reset alpha
    });

    // 2.5. Draw Permanent viscerally satisfying Blood Pools on the Floor Layer
    if (window.bloodStains) {
        window.bloodStains.forEach(s => {
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // 2.6. Draw Rare Zombie Power-up Drops
    if (window.drops) {
        window.drops.forEach(d => {
            ctx.save();
            
            // Outer glow based on active drop lifetime (starts flashing faster when decaying)
            const isFlickering = d.life < 300 && Math.floor(d.life / 10) % 2 === 0;
            if (!isFlickering) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ffd700';
            }
            
            // Pulsing geometry animation
            const pulse = 1 + Math.sin(Date.now() / 120) * 0.12;
            
            // Draw glowing golden ring
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(d.x, d.y, 18 * pulse, 0, Math.PI * 2);
            ctx.stroke();
            
            // Fill core base backing
            ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
            ctx.beginPath();
            ctx.arc(d.x, d.y, 15 * pulse, 0, Math.PI * 2);
            ctx.fill();
            
            // Text symbol mapping representation
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

    // 3. Draw Furniture
    activeMap.furniture.forEach(f => {
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x, f.y, f.w, f.h);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(f.x, f.y, f.w, f.h);
    });

    // 4. Draw Walls
    ctx.fillStyle = '#2c3e50'; // Concrete metallic wall colour
    activeMap.walls.forEach(w => {
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = '#000000'; // Crisp bold black border instead of grey
        ctx.lineWidth = 2.5;
        ctx.strokeRect(w.x, w.y, w.w, w.h);
    });

    // 5. Draw Windows (With Dynamic Board/Log Scaling)
    activeMap.windows.forEach(w => {
        // Frame
        ctx.strokeStyle = '#000000'; 
        ctx.lineWidth = 2.5;
        ctx.strokeRect(w.x, w.y, w.w, w.h);
        
        // Boards
        ctx.fillStyle = '#8B4513';
        if(w.boards > 0) {
            const isHorizontal = (w.orientation === 'H');
            const totalLength = isHorizontal ? w.w : w.h;
            const boardSpacing = totalLength / w.max;
            const boardWidth = boardSpacing * 0.7; // 70% of the space is the board, 30% is gap
            const padding = boardSpacing * 0.15; // Centering the board inside its segment
            
            for(let i=0; i<w.boards; i++) {
                if(isHorizontal) {
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

    // 6. Draw Doors
    activeMap.rooms.forEach(r => {
        if(!r.unlocked && r.door) {
            // Door Color
            ctx.fillStyle = '#8d6e63'; 
            ctx.fillRect(r.door.x, r.door.y, r.door.w, r.door.h);
            
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(r.door.x, r.door.y, r.door.w, r.door.h);
            
            // Door Detail (Knob/Bar)
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(r.door.x + 5, r.door.y + r.door.h/2 - 2, r.door.w - 10, 4);
            ctx.strokeRect(r.door.x + 5, r.door.y + r.door.h/2 - 2, r.door.w - 10, 4);

            // Price Tag
            ctx.fillStyle = '#fff'; 
            ctx.textAlign = 'center'; 
            ctx.font="14px monospace";
            ctx.fillText(r.price + "⛃", r.door.x + r.door.w/2, r.door.y + r.door.h/2 + 25);
        }
    });

    // 7. Draw Interactables (Wallbuys, Box, Perks)
    activeMap.interactables.forEach(i => {
        ctx.fillStyle = i.type === 'BOX' ? i.color : '#555';
        ctx.fillRect(i.x, i.y, i.w, i.h);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(i.x, i.y, i.w, i.h);
        
        ctx.fillStyle = '#fff'; 
        ctx.textAlign = 'center';
        
        if(i.type === 'WALLBUY') { 
            ctx.font = "10px Arial"; 
            ctx.fillText("GUN", i.x+20, i.y+20); 
        }
        else if (i.type === 'PERK') { 
            ctx.font = "bold 10px Arial"; 
            ctx.fillText("JUG", i.x+25, i.y+25); 
        }
        else { 
            ctx.font = "30px Arial"; 
            ctx.fillText("?", i.x+30, i.y+40); 
        }
    });

    // 8. Draw Players
    Object.values(players).forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        
        // --- DRAW USERNAME ---
        if(p.state === 'ALIVE' && p.name) {
            ctx.fillStyle = "#fff";
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "center";
            ctx.shadowColor = "black";
            ctx.shadowBlur = 2;
            ctx.fillText(p.name, 0, -45); // Float above head
            ctx.shadowBlur = 0;
        }

        // --- DRAW DOWNED VISUALS ---
        if(p.state === 'DOWNED') {
            ctx.globalAlpha = 0.5; // Transparent if down
            
            if(p.reviveTimer > 0) {
                // Background Bar
                ctx.fillStyle = "black"; 
                ctx.fillRect(-20, -35, 40, 5);
                // Green Progress
                ctx.fillStyle = "#0f0"; 
                ctx.fillRect(-20, -35, 40 * (p.reviveTimer/300), 5);
            } else {
                // "NEED HELP" text
                ctx.fillStyle = "red"; 
                ctx.font = "bold 12px Arial"; 
                ctx.textAlign = "center";
                ctx.fillText("NEED HELP", 0, -35);
            }
        }
        
        // Rotate Player Body
        ctx.rotate(p.angle);
        
        // Render blinking/flashing effect if player is currently invincible
        if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer / 4) % 2 === 0) {
            ctx.globalAlpha = 0.3; 
        }

        // --- DRAW BACK COSMETIC ---
        const equippedCos = p.equippedCosmetic || (p.id === 'p1' ? saveData.equippedCosmetic : 'none');
        if (equippedCos && equippedCos !== 'none') {
            drawBackCosmetic(equippedCos, p.r, ctx);
        }
        
        // Body Color (Jug makes you redder)
        ctx.fillStyle = p.hasJug ? '#c0392b' : p.color;
        
        // Draw Circle Body with Black Outline
        ctx.beginPath(); 
        ctx.arc(0, 0, p.r, 0, Math.PI*2); 
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        // Draw Gun Barrel with Black Outline (Includes safety checks to prevent thread crashes)
        const activeGunColor = p.gunColor || (p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx].color : '#999');
        ctx.fillStyle = activeGunColor;
        ctx.fillRect(0, -5, 25, 10);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(0, -5, 25, 10);
        
        ctx.restore();
    });

    // 9. Draw Zombies
    zombies.forEach(z => {
        // Body (With local damage hit flashing)
        if (z.hitTimer && z.hitTimer > 0) {
            ctx.fillStyle = '#ff4757'; 
            z.hitTimer--; // Decay flash frame locally
        } else {
            ctx.fillStyle = '#3a4a38'; // Standard rotten green
        }
        ctx.beginPath(); 
        ctx.arc(z.x, z.y, z.r, 0, Math.PI*2); 
        ctx.fill();
        
        // Body Outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        // Red Eyes with crisp Black Outlines
        ctx.fillStyle = '#f00';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        
        ctx.beginPath(); 
        ctx.arc(z.x - 5, z.y - 5, 2.5, 0, Math.PI*2); 
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(z.x + 5, z.y - 5, 2.5, 0, Math.PI*2); 
        ctx.fill();
        ctx.stroke();
        
        // Health Bar
        if(z.hp < z.maxHp) {
            ctx.fillStyle = '#000'; 
            ctx.fillRect(z.x - 12, z.y - 25, 24, 4);
            
            ctx.fillStyle = '#f00'; 
            let pct = z.hp / z.maxHp;
            if(pct < 0) pct = 0;
            ctx.fillRect(z.x - 12, z.y - 25, 24 * pct, 4);
        }
    });

    // 10. Draw Bullets
    bullets.forEach(b => {
        // Fallback for dark colors to make bullet tracers highly visible on dark backgrounds
        let bulletColor = b.color;
        const darkColors = ['#000', '#222', '#333', '#444', '#3e2723', '#5c4033', '#2c3e50', '#212f3c', '#555'];
        if (darkColors.includes(bulletColor.toLowerCase())) {
            bulletColor = '#ffd700'; // Bright gold/yellow tracer
        }
        
        ctx.save();
        
        // Draw explosive rockets with a larger glowing green core
        if (b.type === 'explosive') {
            ctx.fillStyle = '#ff4757';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#e67e22';
            ctx.lineWidth = 2.5;
            ctx.stroke();
        } else {
            // Draw a bright white core
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); 
            ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); 
            ctx.fill();
            
            // Draw glowing outer trace using bullet/weapon color
            ctx.strokeStyle = bulletColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        
        ctx.restore();
    });

    // 11. Draw Floating Texts
    texts.forEach(t => { 
        ctx.fillStyle = t.color; 
        ctx.textAlign = 'center'; 
        ctx.font = "bold 20px monospace"; 
        ctx.shadowColor = "black";
        ctx.shadowBlur = 2;
        ctx.fillText(t.text, t.x, t.y); 
        ctx.shadowBlur = 0;
    });

    // 12. Draw Particles
    particles.forEach(p => { 
        if (p.type === 'shell') {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = p.color;
            ctx.fillRect(-2, -1, 4, 1.5); // Ejected rectangular shell casing
            ctx.restore();
        } else if (p.type === 'spark') {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 2, 2); // Friction sparks
        } else {
            ctx.fillStyle = p.color; 
            ctx.fillRect(p.x, p.y, 3, 3); 
        }
    });

    // 13. Draw Bouncing Guidance Indicators during Tutorial Mode
    if (typeof Tutorial !== 'undefined' && Tutorial.isActive && me) {
        Tutorial.drawIndicators();
    }

    ctx.restore();
}

function updateUI() {
    document.getElementById('round-box').innerText = stats.round;

    // Power-up Alerts
    const badgeDouble = document.getElementById('badge-double');
    const badgeInsta = document.getElementById('badge-instakill');
    if (badgeDouble) {
        badgeDouble.style.display = (window.doublePointsTimer > 0) ? 'block' : 'none';
    }
    if (badgeInsta) {
        badgeInsta.style.display = (window.instaKillTimer > 0) ? 'block' : 'none';
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