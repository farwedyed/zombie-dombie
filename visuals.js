/* --- VISUALS MODULE --- */

function drawGame() {
    // 1. Clear Screen
    ctx.fillStyle = '#000'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    // Apply Camera
    ctx.translate(-camera.x, -camera.y);

    // 2. Draw Rooms (Floor)
    mapData.rooms.forEach(r => {
        ctx.fillStyle = r.color;
        
        // Locked rooms are darker/transparent
        if(r.unlocked) {
            ctx.globalAlpha = 1.0;
        } else {
            ctx.globalAlpha = 0.2; 
        }
        
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.globalAlpha = 1.0; // Reset alpha
    });

    // 3. Draw Furniture
    mapData.furniture.forEach(f => {
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x, f.y, f.w, f.h);
    });

    // 4. Draw Walls
    ctx.fillStyle = '#444';
    mapData.walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

    // 5. Draw Windows
    mapData.windows.forEach(w => {
        // Frame
        ctx.strokeStyle = '#666'; 
        ctx.lineWidth = 2;
        ctx.strokeRect(w.x, w.y, w.w, w.h);
        
        // Boards
        ctx.fillStyle = '#8B4513';
        if(w.boards > 0) {
            for(let i=0; i<w.boards; i++) {
                if(w.orientation === 'H') {
                    ctx.fillRect(w.x + (i*15) + 5, w.y, 10, w.h);
                } else {
                    ctx.fillRect(w.x, w.y + (i*15) + 5, w.w, 10);
                }
            }
        }
    });

    // 6. Draw Doors
    mapData.rooms.forEach(r => {
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
    mapData.interactables.forEach(i => {
        ctx.fillStyle = i.type === 'BOX' ? i.color : '#555';
        ctx.fillRect(i.x, i.y, i.w, i.h);
        
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
        
        // Body Color (Jug makes you redder)
        ctx.fillStyle = p.hasJug ? '#c0392b' : p.color;
        
        // Draw Circle Body
        ctx.beginPath(); 
        ctx.arc(0, 0, p.r, 0, Math.PI*2); 
        ctx.fill();
        
        // Draw Gun Barrel
        ctx.fillStyle = p.inventory[p.weapIdx].color;
        ctx.fillRect(0, -5, 25, 10);
        
        ctx.restore();
    });

    // 9. Draw Zombies
    zombies.forEach(z => {
        // Body
        ctx.fillStyle = '#3a4a38';
        ctx.beginPath(); 
        ctx.arc(z.x, z.y, z.r, 0, Math.PI*2); 
        ctx.fill();
        
        // Red Eyes
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
        ctx.fillStyle = b.color;
        ctx.beginPath(); 
        ctx.arc(b.x, b.y, 4, 0, Math.PI*2); 
        ctx.fill();
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

    ctx.restore();
}

function updateUI() {
    if(!me) return;
    
    document.getElementById('score-box').innerHTML = me.score + ' <span style="font-size:20px">⛃</span>';
    document.getElementById('round-box').innerText = stats.round;
    
    const gun = me.inventory[me.weapIdx];
    document.getElementById('gun-name').innerText = gun.name;
    
    document.getElementById('ammo-text').innerText = me.reloading ? "RELOADING" : `${gun.clip} / ${gun.ammo}`;
    
    document.getElementById('icon-jug').style.display = me.hasJug ? 'block' : 'none';
}