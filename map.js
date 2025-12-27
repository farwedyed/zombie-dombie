/* --- MAP DATA: THE FACILITY --- */
const mapData = {
    rooms: [
        // 0. SPAWN ROOM (Center) - Dark Grey
        { id: 0, name: "Spawn", unlocked: true, price: 0, color: "#2c3e50", x: 0, y: 0, w: 800, h: 800 },
        
        // 1. EAST HALLWAY - Dark
        { id: 1, name: "East Hall", unlocked: false, price: 750, color: "#1a1a1a", x: 800, y: 200, w: 600, h: 400, 
          door: { x: 760, y: 300, w: 40, h: 200 } }, // Door connecting to Spawn
          
        // 2. WAREHOUSE (East End) - Brown/Industrial
        { id: 2, name: "Warehouse", unlocked: false, price: 1000, color: "#3e2723", x: 1400, y: -200, w: 1200, h: 1200, 
          door: { x: 1360, y: 300, w: 40, h: 200 } }, // Door connecting to Hall
          
        // 3. WEST LAB (West) - Blue/Clinical
        { id: 3, name: "Laboratory", unlocked: false, price: 1500, color: "#1f2a36", x: -1000, y: 0, w: 1000, h: 800, 
          door: { x: 0, y: 300, w: 40, h: 200 } }, // Door connecting to Spawn (Left side)

        // 4. NORTH COURTYARD (North) - Green/Grass
        { id: 4, name: "Courtyard", unlocked: false, price: 1250, color: "#152215", x: 0, y: -1000, w: 800, h: 1000, 
          door: { x: 300, y: 0, w: 200, h: 40 } } // Door connecting to Spawn (Top side)
    ],

    walls: [
        // --- SPAWN WALLS ---
        { x: 0, y: 0, w: 300, h: 40 }, { x: 500, y: 0, w: 300, h: 40 }, // Top (Gap for Courtyard)
        { x: 0, y: 760, w: 800, h: 40 }, // Bottom (Solid)
        { x: 0, y: 0, w: 40, h: 300 }, { x: 0, y: 500, w: 40, h: 300 }, // Left (Gap for Lab)
        { x: 760, y: 0, w: 40, h: 300 }, { x: 760, y: 500, w: 40, h: 300 }, // Right (Gap for Hall)

        // --- EAST HALL WALLS ---
        { x: 800, y: 200, w: 600, h: 40 }, // Top
        { x: 800, y: 560, w: 600, h: 40 }, // Bottom

        // --- WAREHOUSE WALLS ---
        { x: 1400, y: -200, w: 40, h: 500 }, { x: 1400, y: 500, w: 40, h: 500 }, // Left Entry
        { x: 1400, y: -200, w: 1200, h: 40 }, // Top
        { x: 2560, y: -200, w: 40, h: 1200 }, // Far Right
        { x: 1400, y: 960, w: 1200, h: 40 }, // Bottom

        // --- LAB WALLS ---
        { x: -1000, y: 0, w: 1000, h: 40 }, // Top
        { x: -1000, y: 760, w: 1000, h: 40 }, // Bottom
        { x: -1000, y: 0, w: 40, h: 800 }, // Far Left

        // --- COURTYARD WALLS ---
        { x: 0, y: -1000, w: 40, h: 1000 }, // Left
        { x: 760, y: -1000, w: 40, h: 1000 }, // Right
        { x: 0, y: -1000, w: 800, h: 40 }, // Top
    ],

    windows: [
        // Spawn Windows
        { x: 200, y: 760, w: 100, h: 40, boards: 6, max: 6, orientation: 'H' }, // Bottom
        { x: 500, y: 760, w: 100, h: 40, boards: 6, max: 6, orientation: 'H' }, // Bottom
        
        // East Hall Window
        { x: 1100, y: 200, w: 100, h: 40, boards: 6, max: 6, orientation: 'H' }, // Top

        // Warehouse Windows
        { x: 2000, y: -200, w: 100, h: 40, boards: 6, max: 6, orientation: 'H' }, // Top
        { x: 2000, y: 960, w: 100, h: 40, boards: 6, max: 6, orientation: 'H' }, // Bottom
        { x: 2560, y: 400, w: 40, h: 100, boards: 6, max: 6, orientation: 'V' }, // Right

        // Lab Windows
        { x: -500, y: 0, w: 100, h: 40, boards: 6, max: 6, orientation: 'H' }, // Top
        { x: -500, y: 760, w: 100, h: 40, boards: 6, max: 6, orientation: 'H' }, // Bottom

        // Courtyard Windows
        { x: 0, y: -500, w: 40, h: 100, boards: 6, max: 6, orientation: 'V' }, // Left
        { x: 760, y: -500, w: 40, h: 100, boards: 6, max: 6, orientation: 'V' }, // Right
    ],

    furniture: [
        // Spawn Pillars
        { x: 200, y: 200, w: 50, h: 50, color: "#111" },
        { x: 550, y: 200, w: 50, h: 50, color: "#111" },
        { x: 200, y: 550, w: 50, h: 50, color: "#111" },
        { x: 550, y: 550, w: 50, h: 50, color: "#111" },

        // Warehouse Crates
        { x: 1600, y: 100, w: 200, h: 200, color: "#5d4037" },
        { x: 2200, y: 500, w: 200, h: 200, color: "#5d4037" },
        { x: 1800, y: 600, w: 100, h: 100, color: "#4e342e" },

        // Lab Tables
        { x: -800, y: 200, w: 400, h: 50, color: "#ccc" },
        { x: -800, y: 550, w: 400, h: 50, color: "#ccc" },
        
        // Courtyard Rock
        { x: 300, y: -600, w: 200, h: 150, color: "#222" }
    ],

    interactables: [
        // SPAWN
        { x: 100, y: 100, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Olympia" },
        { x: 700, y: 100, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "M1911" }, // Extra ammo
        
        // EAST HALL
        { x: 1000, y: 250, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP40" },

        // WAREHOUSE
        { x: 2400, y: 0, w: 40, h: 40, type: 'WALLBUY', price: 1200, label: "Stakeout" },
        { x: 1800, y: 800, w: 60, h: 60, type: 'BOX', price: 950, color: '#8e44ad', label: "?" }, // MYSTERY BOX

        // LAB
        { x: -900, y: 400, w: 50, h: 50, type: 'PERK', price: 2500, color: '#c0392b', label: "JUG" }, // JUGGERNOG
        { x: -200, y: 100, w: 40, h: 40, type: 'WALLBUY', price: 1500, label: "MP5k" },

        // COURTYARD
        { x: 400, y: -800, w: 40, h: 40, type: 'WALLBUY', price: 1800, label: "AK-47" },
        { x: 100, y: -200, w: 40, h: 40, type: 'WALLBUY', price: 3000, label: "Galil" }
    ],

    spawnPoints: [
        { x: 400, y: 400, roomId: 0 }, // Spawn
        { x: 1100, y: 400, roomId: 1 }, // Hall
        { x: 2000, y: 400, roomId: 2 }, // Warehouse Center
        { x: 2400, y: 800, roomId: 2 }, // Warehouse Corner
        { x: -500, y: 400, roomId: 3 }, // Lab
        { x: 400, y: -500, roomId: 4 }  // Courtyard
    ]
};