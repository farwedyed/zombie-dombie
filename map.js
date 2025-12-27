/* --- MAP DATA: THE FACILITY --- */
const mapData = {
    rooms: [
        // 0. SPAWN ROOM (Center)
        { id: 0, name: "Spawn", unlocked: true, price: 0, color: "#2c3e50", x: 0, y: 0, w: 800, h: 800 },
        
        // 1. EAST HALLWAY (Connects to Warehouse)
        { id: 1, name: "East Hall", unlocked: false, price: 750, color: "#1a1a1a", x: 800, y: 200, w: 600, h: 400, 
          door: { x: 760, y: 300, w: 40, h: 200 } },
          
        // 2. WAREHOUSE (Contains Mystery Box)
        { id: 2, name: "Warehouse", unlocked: false, price: 1000, color: "#3e2723", x: 1400, y: -200, w: 1200, h: 1200, 
          door: { x: 1360, y: 300, w: 40, h: 200 } },
          
        // 3. WEST LAB (Contains Juggernog)
        { id: 3, name: "Laboratory", unlocked: false, price: 1500, color: "#1f2a36", x: -1000, y: 0, w: 1000, h: 800, 
          door: { x: 0, y: 300, w: 40, h: 200 } },

        // 4. NORTH COURTYARD (Open Space)
        { id: 4, name: "Courtyard", unlocked: false, price: 1250, color: "#152215", x: 0, y: -1000, w: 800, h: 1000, 
          door: { x: 300, y: 0, w: 200, h: 40 } }
    ],

    walls: [
        // --- SPAWN ROOM WALLS (Split for Windows & Doors) ---
        { x: 0, y: 0, w: 300, h: 40 }, { x: 500, y: 0, w: 300, h: 40 }, // Top (Gap for Courtyard)
        { x: 0, y: 760, w: 200, h: 40 }, { x: 300, y: 760, w: 200, h: 40 }, { x: 600, y: 760, w: 200, h: 40 }, // Bottom (Gaps for Windows)
        { x: 0, y: 0, w: 40, h: 300 }, { x: 0, y: 500, w: 40, h: 300 }, // Left (Gap for Lab)
        { x: 760, y: 0, w: 40, h: 300 }, { x: 760, y: 500, w: 40, h: 300 }, // Right (Gap for Hall)

        // --- EAST HALL WALLS ---
        { x: 800, y: 200, w: 300, h: 40 }, { x: 1200, y: 200, w: 200, h: 40 }, // Top (Gap for Window)
        { x: 800, y: 560, w: 600, h: 40 }, // Bottom (Solid)

        // --- WAREHOUSE WALLS ---
        { x: 1400, y: -200, w: 600, h: 40 }, { x: 2100, y: -200, w: 500, h: 40 }, // Top (Gap for Window)
        { x: 1400, y: 960, w: 600, h: 40 }, { x: 2100, y: 960, w: 500, h: 40 }, // Bottom (Gap for Window)
        { x: 1400, y: -200, w: 40, h: 500 }, { x: 1400, y: 500, w: 40, h: 500 }, // Left
        { x: 2560, y: -200, w: 40, h: 600 }, { x: 2560, y: 500, w: 40, h: 500 }, // Right (Gap for Window)

        // --- LAB WALLS ---
        { x: -1000, y: 0, w: 500, h: 40 }, { x: -400, y: 0, w: 400, h: 40 }, // Top (Gap for Window)
        { x: -1000, y: 760, w: 500, h: 40 }, { x: -400, y: 760, w: 400, h: 40 }, // Bottom (Gap for Window)
        { x: -1000, y: 0, w: 40, h: 800 }, // Far Left (Solid)

        // --- COURTYARD WALLS ---
        { x: 0, y: -1000, w: 40, h: 500 }, { x: 0, y: -400, w: 40, h: 400 }, // Left (Gap for Window)
        { x: 760, y: -1000, w: 40, h: 500 }, { x: 760, y: -400, w: 40, h: 400 }, // Right (Gap for Window)
        { x: 0, y: -1000, w: 800, h: 40 }, // Top (Solid)
    ],

    windows: [
        // SPAWN (Bottom windows, so entry point is ABOVE the window)
        { x: 200, y: 760, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 250, entryY: 700 }, 
        { x: 500, y: 760, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 550, entryY: 700 }, 
        
        // HALL (Top window, so entry point is BELOW the window)
        { x: 1100, y: 200, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 1150, entryY: 300 }, 
        
        // WAREHOUSE
        { x: 2000, y: -200, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 2050, entryY: -100 }, // Top
        { x: 2000, y: 960, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 2050, entryY: 860 }, // Bottom
        { x: 2560, y: 400, w: 40, h: 100, boards: 6, max: 6, orientation: 'V', entryX: 2460, entryY: 450 }, // Right
        
        // LAB
        { x: -500, y: 0, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: -450, entryY: 100 }, // Top
        { x: -500, y: 760, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: -450, entryY: 660 }, // Bottom
        
        // COURTYARD
        { x: 0, y: -500, w: 40, h: 100, boards: 6, max: 6, orientation: 'V', entryX: 100, entryY: -450 }, // Left
        { x: 760, y: -500, w: 40, h: 100, boards: 6, max: 6, orientation: 'V', entryX: 660, entryY: -450 }, // Right
    ],

    furniture: [
        { x: 200, y: 200, w: 50, h: 50, color: "#111" },
        { x: 550, y: 200, w: 50, h: 50, color: "#111" },
        { x: 200, y: 550, w: 50, h: 50, color: "#111" },
        { x: 550, y: 550, w: 50, h: 50, color: "#111" },
        { x: 1600, y: 100, w: 200, h: 200, color: "#5d4037" },
        { x: 2200, y: 500, w: 200, h: 200, color: "#5d4037" },
        { x: 1800, y: 600, w: 100, h: 100, color: "#4e342e" },
        { x: -800, y: 200, w: 400, h: 50, color: "#ccc" },
        { x: -800, y: 550, w: 400, h: 50, color: "#ccc" },
        { x: 300, y: -600, w: 200, h: 150, color: "#222" }
    ],

    interactables: [
        { x: 100, y: 100, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Olympia" },
        { x: 700, y: 100, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "M1911" },
        { x: 1000, y: 250, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP40" },
        { x: 2400, y: 0, w: 40, h: 40, type: 'WALLBUY', price: 1200, label: "Stakeout" },
        { x: 1800, y: 800, w: 60, h: 60, type: 'BOX', price: 950, color: '#8e44ad', label: "?" },
        { x: -900, y: 400, w: 50, h: 50, type: 'PERK', price: 2500, color: '#c0392b', label: "JUG" },
        { x: -200, y: 100, w: 40, h: 40, type: 'WALLBUY', price: 1500, label: "MP5k" },
        { x: 400, y: -800, w: 40, h: 40, type: 'WALLBUY', price: 1800, label: "AK-47" },
        { x: 100, y: -200, w: 40, h: 40, type: 'WALLBUY', price: 3000, label: "Galil" }
    ],

    spawnPoints: [
        { x: 250, y: 900, roomId: 0 }, { x: 550, y: 900, roomId: 0 },
        { x: 1150, y: 100, roomId: 1 },
        { x: 2050, y: -350, roomId: 2 }, { x: 2050, y: 1100, roomId: 2 }, { x: 2700, y: 450, roomId: 2 },
        { x: -500, y: -150, roomId: 3 }, { x: -500, y: 950, roomId: 3 },
        { x: -150, y: -450, roomId: 4 }, { x: 900, y: -450, roomId: 4 }
    ]
};