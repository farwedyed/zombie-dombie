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

function drawGame() {
    if (!activeMap) return;

    // 1. Clear Screen
    ctx.fillStyle = '#050505'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
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

    // 3. Draw Furniture
    activeMap.furniture.forEach(f => {
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x, f.y, f.w, f.h);
    });

    // 4. Draw Walls
    ctx.fillStyle = '#2c3e50'; // Concrete metallic wall colour
    activeMap.walls.forEach(w => {
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = '#34495e';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(w.x, w.y, w.w, w.h);
    });

    // 5. Draw Windows (With Dynamic Board/Log Scaling)
    activeMap.windows.forEach(w => {
        // Frame
        ctx.strokeStyle = '#666'; 
        ctx.lineWidth = 2;
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
                } else {
                    ctx.fillRect(w.x, w.y + (i * boardSpacing) + padding, w.w, boardWidth);
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
            
            // Door Detail (Knob/Bar)
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(r.door.x + 5, r.door.y + r.door.h/2 - 2, r.door.w - 10, 4);

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
        
        ctx.fillStyle = '#fff'; 
        ctx.textAlign = 'center';
        
        if(i.type === 'WALLBUY') { 
            ctx.font = "10px Arial"; 
            ctx.fillText("GUN", i.x+20, i.y+20); 
        }
        else if (i.type === 'PERK') { // Typo fixed from "perk === i.type"
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
        
        // --- DRAW USERNAME (New) ---
        if(p.state === 'ALIVE' && p.name) {
            ctx.fillStyle = "#fff";
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "center";
            ctx.shadowColor = "black";
            ctx.shadowBlur = 2;
            ctx.fillText(p.name, 0, -45); // Float above head
            ctx.shadowBlur = 0;
        }

        // --- DRAW DOWNED VISUALS (Restored) ---
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
        
        // Body Color (Jug makes you redder)
        ctx.fillStyle = p.hasJug ? '#c0392b' : p.color;
        
        // Draw Circle Body
        ctx.beginPath(); 
        ctx.arc(0, 0, p.r, 0, Math.PI*2); 
        ctx.fill();
        
        // Draw Gun Barrel (Includes safety checks to prevent thread crashes)
        const activeGunColor = p.gunColor || (p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx].color : '#999');
        ctx.fillStyle = activeGunColor;
        ctx.fillRect(0, -5, 25, 10);
        
        ctx.restore();
    });

    // 9. Draw Zombies (Hands & arms removed as requested. Classic static circles restored)
    zombies.forEach(z => {
        // Body
        ctx.fillStyle = '#3a4a38';
        ctx.beginPath(); 
        ctx.arc(z.x, z.y, z.r, 0, Math.PI*2); 
        ctx.fill();
        
        // Red Eyes (Static alignment restored as requested)
        ctx.fillStyle = '#f00';
        ctx.beginPath(); 
        ctx.arc(z.x - 5, z.y - 5, 2, 0, Math.PI*2); 
        ctx.arc(z.x + 5, z.y - 5, 2, 0, Math.PI*2); 
        ctx.fill();
        
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
        ctx.fillStyle = p.color; 
        ctx.fillRect(p.x, p.y, 3, 3); 
    });

    // 13. Draw Bouncing Guidance Indicators during Tutorial Mode
    if (typeof Tutorial !== 'undefined' && Tutorial.isActive && me) {
        Tutorial.drawIndicators();
    }

    ctx.restore();
}

function updateUI() {
    document.getElementById('round-box').innerText = stats.round;

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