/* --- ROOM & PHYSICS SYSTEM --- */
const RoomSystem = {
    
    checkCollision: function(x, y, isPlayer) {
        // Safe Guard: If activeMap or its window arrays haven't initialized
        if (!activeMap || !activeMap.windows) return false;

        // 1. WINDOW CHECK (Priority)
        // If a zombie/bullet is in a window with 0 boards, they SHOULD pass.
        // If it has boards, it blocks them.
        for(let w of activeMap.windows) {
            if(x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) {
                if(isPlayer) return true; // Players can NEVER walk through windows
                if(w.boards > 0) return true; // Blocked by boards
                return false; // Boards are gone, treat as empty space!
            }
        }

        // 2. PHYSICAL WALLS
        if (activeMap.walls) {
            for(let w of activeMap.walls) {
                // We use a small buffer (8px) for collision
                if(x + 8 > w.x && x - 8 < w.x + w.w && y + 8 > w.y && y - 8 < w.y + w.h) {
                    return true;
                }
            }
        }

        // 3. FURNITURE
        if (activeMap.furniture) {
            for(let f of activeMap.furniture) {
                if(x + 8 > f.x && x - 8 < f.x + f.w && y + 8 > f.y && y - 8 < f.y + f.h) {
                    return true;
                }
            }
        }

        // 4. LOCKED DOORS
        if (activeMap.rooms) {
            for(let r of activeMap.rooms) {
                if(!r.unlocked && r.door) {
                    let d = r.door;
                    if(x + 8 > d.x && x - 8 < d.x + d.w && y + 8 > d.y && y - 8 < d.y + d.h) {
                        return true;
                    }
                }
            }
        }

        return false;
    },

    getNearbyInteractable: function(x, y, p) {
        if (!activeMap) return null;

        // Windows (Repair)
        if (activeMap.windows) {
            for(let w of activeMap.windows) {
                if(w.boards < w.max && Math.hypot(x - (w.x + w.w / 2), y - (w.y + w.h / 2)) < 70) {
                    return { type: 'WINDOW', obj: w, label: `[F] Repair (+10)` };
                }
            }
        }

        // Doors (Open)
        if (activeMap.rooms) {
            for(let r of activeMap.rooms) {
                if(!r.unlocked && r.door && Math.hypot(x - (r.door.x + r.door.w / 2), y - (r.door.y + r.door.h / 2)) < 80) {
                    return { type: 'DOOR', obj: r, label: `[F] Open ${r.name} (${r.price} ⛃)` };
                }
            }
        }

        // Items (Buy)
        if (activeMap.interactables) {
            for(let i of activeMap.interactables) {
                if(Math.hypot(x - (i.x + i.w / 2), y - (i.y + i.h / 2)) < 60) {
                    let txt = "";
                    if(i.type === 'WALLBUY') {
                        // Check if player already has this weapon in their inventory
                        const hasWeapon = p && p.inventory && p.inventory.some(w => w.name === i.label);
                        if (hasWeapon) {
                            const ammoPrice = Math.floor(i.price / 2);
                            txt = `[F] Buy Ammo for ${i.label} (${ammoPrice} ⛃)`;
                        } else {
                            txt = `[F] Buy ${i.label} (${i.price} ⛃)`;
                        }
                    }
                    else if(i.type === 'BOX') txt = `[F] Box (950 ⛃)`;
                    else if(i.type === 'PERK') txt = `[F] Vigor-Up (2500 ⛃)`;
                    return { type: i.type, obj: i, label: txt };
                }
            }
        }
        return null;
    }
};