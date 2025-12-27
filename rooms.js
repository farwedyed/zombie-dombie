/* --- ROOM & PHYSICS SYSTEM --- */
const RoomSystem = {
    
    // Check if X,Y collides with anything
    // isPlayer: true if checking for player (blocked by solid windows)
    // isPlayer: false if checking for bullets/zombies (can shoot through unlocked doors, broken windows)
    checkCollision: function(x, y, isPlayer) {
        
        // 1. Physical Walls
        for(let w of mapData.walls) {
            if(x+10 > w.x && x-10 < w.x+w.w && y+10 > w.y && y-10 < w.y+w.h) return true;
        }

        // 2. Furniture
        for(let f of mapData.furniture) {
            if(x+10 > f.x && x-10 < f.x+f.w && y+10 > f.y && y-10 < f.y+f.h) return true;
        }

        // 3. Locked Doors
        for(let r of mapData.rooms) {
            if(!r.unlocked && r.door) {
                // If checking for player or zombies, locked doors are solid
                // If checking for bullets, technically could shoot through? But let's keep them solid.
                if(x+10 > r.door.x && x-10 < r.door.x+r.door.w && y+10 > r.door.y && y-10 < r.door.y+r.door.h) return true;
            }
        }

        // 4. Windows
        for(let w of mapData.windows) {
            if(x+10 > w.x && x-10 < w.x+w.w && y+10 > w.y && y-10 < w.y+w.h) {
                if(isPlayer) return true; // Player can never walk through windows
                if(w.boards > 0) return true; // Zombies/Bullets blocked by boards
                // If boards == 0, zombies/bullets pass
            }
        }

        return false;
    },

    // Returns an object containing interact info { type, obj, label } or null
    getNearbyInteractable: function(x, y) {
        
        // Windows (Repair)
        for(let w of mapData.windows) {
            if(w.boards < w.max && Math.hypot(x-(w.x+w.w/2), y-(w.y+w.h/2)) < 60) {
                return { type: 'WINDOW', obj: w, label: `[F] Repair (+10)` };
            }
        }

        // Doors (Open)
        for(let r of mapData.rooms) {
            if(!r.unlocked && r.door && Math.hypot(x-(r.door.x+r.door.w/2), y-(r.door.y+r.door.h/2)) < 80) {
                return { type: 'DOOR', obj: r, label: `[F] Open ${r.name} (${r.price} ⛃)` };
            }
        }

        // Items (Buy)
        for(let i of mapData.interactables) {
            if(Math.hypot(x-(i.x+i.w/2), y-(i.y+i.h/2)) < 60) {
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