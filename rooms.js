/* --- ROOM & PHYSICS SYSTEM --- */
const RoomSystem = {
    
    checkCollision: function(x, y, isPlayer) {
        // 1. WINDOW CHECK (Priority)
        // If a zombie/bullet is in a window with 0 boards, they SHOULD pass.
        // If it has boards, it blocks them.
        for(let w of mapData.windows) {
            if(x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) {
                if(isPlayer) return true; // Players can NEVER walk through windows
                if(w.boards > 0) return true; // Blocked by boards
                return false; // Boards are gone, treat as empty space!
            }
        }

        // 2. PHYSICAL WALLS
        for(let w of mapData.walls) {
            // We use a small buffer (8px) for collision
            if(x + 8 > w.x && x - 8 < w.x + w.w && y + 8 > w.y && y - 8 < w.y + w.h) {
                return true;
            }
        }

        // 3. FURNITURE
        for(let f of mapData.furniture) {
            if(x + 8 > f.x && x - 8 < f.x + f.w && y + 8 > f.y && y - 8 < f.y + f.h) {
                return true;
            }
        }

        // 4. LOCKED DOORS
        for(let r of mapData.rooms) {
            if(!r.unlocked && r.door) {
                let d = r.door;
                if(x + 8 > d.x && x - 8 < d.x + d.w && y + 8 > d.y && y - 8 < d.y + d.h) {
                    return true;
                }
            }
        }

        return false;
    },

    getNearbyInteractable: function(x, y) {
        // Windows (Repair)
        for(let w of mapData.windows) {
            if(w.boards < w.max && Math.hypot(x - (w.x + w.w / 2), y - (w.y + w.h / 2)) < 70) {
                return { type: 'WINDOW', obj: w, label: `[F] Repair (+10)` };
            }
        }

        // Doors (Open)
        for(let r of mapData.rooms) {
            if(!r.unlocked && r.door && Math.hypot(x - (r.door.x + r.door.w / 2), y - (r.door.y + r.door.h / 2)) < 80) {
                return { type: 'DOOR', obj: r, label: `[F] Open ${r.name} (${r.price} ⛃)` };
            }
        }

        // Items (Buy)
        for(let i of mapData.interactables) {
            if(Math.hypot(x - (i.x + i.w / 2), y - (i.y + i.h / 2)) < 60) {
                let txt = "";
                if(i.type === 'WALLBUY') txt = `[F] Buy ${i.label} (${i.price} ⛃)`;
                else if(i.type === 'BOX') txt = `[F] Box (950 ⛃)`;
                else if(i.type === 'PERK') txt = `[F] Jug (2500 ⛃)`;
                return { type: i.type, obj: i, label: txt };
            }
        }
        return null;
    }
};