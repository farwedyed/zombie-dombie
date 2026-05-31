/* --- ROOM & PHYSICS SYSTEM --- */
const RoomSystem = {
    
    checkCollision: function(x, y, isPlayer, customBuffer) {
        if (!activeMap || !activeMap.windows) return false;
        
        // Fall back to 8px if no custom buffer is supplied (maintains backward compatibility)
        let buf = (customBuffer !== undefined) ? customBuffer : 8;

        // 1. WINDOW CHECK (Priority)
        for(let w of activeMap.windows) {
            if(x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) {
                if(isPlayer) return true; 
                if(w.boards > 0) return true; 
                return false; 
            }
        }

        // 2. PHYSICAL WALLS
        if (activeMap.walls) {
            for(let w of activeMap.walls) {
                if(x + buf > w.x && x - buf < w.x + w.w && y + buf > w.y && y - buf < w.y + w.h) {
                    return true;
                }
            }
        }

        // 3. FURNITURE
        if (activeMap.furniture) {
            for(let f of activeMap.furniture) {
                if(x + buf > f.x && x - buf < f.x + f.w && y + buf > f.y && y - buf < f.y + f.h) {
                    return true;
                }
            }
        }

        // 4. LOCKED DOORS
        if (activeMap.rooms) {
            for(let r of activeMap.rooms) {
                if(!r.unlocked && r.door) {
                    let d = r.door;
                    if(x + buf > d.x && x - buf < d.x + d.w && y + buf > d.y && y - buf < d.y + d.h) {
                        return true;
                    }
                }
            }
        }

        return false;
    },

    getNearbyInteractable: function(x, y, p) {
        if (!activeMap) return null;

        if (activeMap.windows) {
            for(let w of activeMap.windows) {
                if(w.boards < w.max && Math.hypot(x - (w.x + w.w / 2), y - (w.y + w.h / 2)) < 70) {
                    return { type: 'WINDOW', obj: w, label: `[F] Repair (+10)` };
                }
            }
        }

        if (activeMap.rooms) {
            for(let r of activeMap.rooms) {
                if(!r.unlocked && r.door && Math.hypot(x - (r.door.x + r.door.w / 2), y - (r.door.y + r.door.h / 2)) < 80) {
                    return { type: 'DOOR', obj: r, label: `[F] Open ${r.name} (${r.price} ⛃)` };
                }
            }
        }

        if (activeMap.interactables) {
            for(let i of activeMap.interactables) {
                if(Math.hypot(x - (i.x + i.w / 2), y - (i.y + i.h / 2)) < 60) {
                    let txt = "";
                    if(i.type === 'WALLBUY') {
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