/* --- CENTRAL MAP DATABASE --- */

const playableMaps = [
    // --- MAP 0: THE GRAND FACILITY (CLASSIC - MASSIVE EDITION) ---
    {
        name: "The Grand Facility",
        desc: "An enormous, sprawling facility with massive warehouses, long corridors, and endless space to kite zombies.",
        rooms: [
            { id: 0, name: "Central Command", unlocked: true, price: 0, color: "#2c3e50", x: 0, y: 0, w: 1600, h: 1600 },
            { id: 1, name: "East Hallway Corridor", unlocked: false, price: 750, color: "#1a1a1a", x: 1600, y: 400, w: 1200, h: 800, 
              door: { x: 1560, y: 600, w: 40, h: 300 } },
            { id: 2, name: "Supply Warehouse", unlocked: false, price: 1000, color: "#3e2723", x: 2800, y: -400, w: 2400, h: 2400, 
              door: { x: 2760, y: 600, w: 40, h: 300 } },
            { id: 3, name: "Laboratory Sectors", unlocked: false, price: 1500, color: "#1f2a36", x: -2000, y: 0, w: 2000, h: 1600, 
              door: { x: 0, y: 600, w: 40, h: 300 } },
            { id: 4, name: "Courtyard Plaza", unlocked: false, price: 1250, color: "#152215", x: 0, y: -2000, w: 1600, h: 2000, 
              door: { x: 600, y: 0, w: 400, h: 40 } }
        ],
        walls: [
            // Spawn Room (Central Command)
            { x: 0, y: 0, w: 600, h: 40 }, { x: 1000, y: 0, w: 600, h: 40 }, // Top wall (Door gap Room 4)
            { x: 0, y: 1560, w: 300, h: 40 }, { x: 500, y: 1560, w: 600, h: 40 }, { x: 1300, y: 1560, w: 300, h: 40 }, // Bottom wall (Windows gaps)
            { x: 0, y: 0, w: 40, h: 600 }, { x: 0, y: 900, w: 40, h: 700 }, // Left wall (Door gap Room 3)
            { x: 1560, y: 0, w: 40, h: 600 }, { x: 1560, y: 900, w: 40, h: 700 }, // Right wall (Door gap Room 1)

            // East Hallway Corridor
            { x: 1600, y: 400, w: 1200, h: 40 }, // Top wall
            { x: 1600, y: 1160, w: 1200, h: 40 }, // Bottom wall
            { x: 2760, y: 400, w: 40, h: 200 }, { x: 2760, y: 900, w: 40, h: 300 }, // Right wall (Door gap Room 2)

            // Supply Warehouse
            { x: 2800, y: -400, w: 1200, h: 40 }, { x: 4200, y: -400, w: 1000, h: 40 }, // Top wall (Window gap)
            { x: 2800, y: 1960, w: 1200, h: 40 }, { x: 4200, y: 1960, w: 1000, h: 40 }, // Bottom wall (Window gap)
            { x: 2800, y: -400, w: 40, h: 1000 }, { x: 2800, y: 900, w: 40, h: 1100 }, // Left wall
            { x: 5160, y: -400, w: 40, h: 1200 }, { x: 5160, y: 1000, w: 40, h: 1000 }, // Right wall (Window gap)

            // Laboratory Sectors
            { x: -2000, y: 0, w: 1000, h: 40 }, { x: -800, y: 0, w: 800, h: 40 }, // Top wall (Window gap)
            { x: -2000, y: 1560, w: 1000, h: 40 }, { x: -800, y: 1560, w: 800, h: 40 }, // Bottom wall (Window gap)
            { x: -2000, y: 0, w: 40, h: 1600 }, // Left wall (Solid)
            { x: -40, y: 0, w: 40, h: 600 }, { x: -40, y: 900, w: 40, h: 700 }, // Right wall

            // Courtyard Plaza
            { x: 0, y: -2000, w: 40, h: 1000 }, { x: 0, y: -800, w: 40, h: 800 }, // Left wall (Window gap)
            { x: 1560, y: -2000, w: 40, h: 1000 }, { x: 1560, y: -800, w: 40, h: 800 }, // Right wall (Window gap)
            { x: 0, y: -2000, w: 1600, h: 40 }, // Top wall (Solid)
            { x: 0, y: -40, w: 600, h: 40 }, { x: 1000, y: -40, w: 600, h: 40 } // Bottom wall
        ],
        windows: [
            { x: 300, y: 1560, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 400, entryY: 1450 }, 
            { x: 1100, y: 1560, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 1200, entryY: 1450 }, 
            { x: 4000, y: -400, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 4100, entryY: -300 },
            { x: 4000, y: 1960, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 4100, entryY: 1850 },
            { x: 5160, y: 800, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 5050, entryY: 900 },
            { x: -1000, y: 0, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: -900, entryY: 100 },
            { x: -1000, y: 1560, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: -900, entryY: 1450 },
            { x: 0, y: -1000, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 100, entryY: -900 },
            { x: 1560, y: -1000, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 1450, entryY: -900 }
        ],
        furniture: [
            { x: 300, y: 300, w: 100, h: 100, color: "#111" },
            { x: 1200, y: 300, w: 100, h: 100, color: "#111" },
            { x: 300, y: 1200, w: 100, h: 100, color: "#111" },
            { x: 1200, y: 1200, w: 100, h: 100, color: "#111" }
        ],
        interactables: [
            { x: 200, y: 200, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Olympia" },
            { x: 1400, y: 200, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "M1911" },
            { x: 2200, y: 500, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP40" },
            { x: 4000, y: 1000, w: 40, h: 40, type: 'WALLBUY', price: 1200, label: "Stakeout" },
            { x: 3500, y: 200, w: 60, h: 60, type: 'BOX', price: 950, color: '#8e44ad', label: "?" },
            { x: -1800, y: 800, w: 50, h: 50, type: 'PERK', price: 2500, color: '#c0392b', label: "JUG" }
        ],
        spawnPoints: [
            { x: 400, y: 1700, roomId: 0 }, { x: 1200, y: 1700, roomId: 0 },
            { x: 4100, y: -550, roomId: 2 }, { x: 4100, y: 2100, roomId: 2 },
            { x: 5300, y: 900, roomId: 2 }, { x: -900, y: -150, roomId: 3 },
            { x: -150, y: -900, roomId: 4 }
        ]
    },

    // --- MAP 1: BUNKER OUTPOST (MASSIVE OUTPOST EDITION) ---
    {
        name: "Bunker Outpost",
        desc: "An upgraded, massive bunker complex with three huge rooms, vast fields outside, and optimized choke points.",
        rooms: [
            { id: 0, name: "Bunker Command", unlocked: true, price: 0, color: "#2d3436", x: 0, y: 0, w: 1600, h: 1600 },
            { id: 1, name: "Storage Sector", unlocked: false, price: 600, color: "#1e272e", x: 0, y: -1600, w: 1600, h: 1600,
              door: { x: 700, y: -20, w: 200, h: 40 } },
            { id: 2, name: "West Platform Zone", unlocked: false, price: 800, color: "#1d2a44", x: -1600, y: 0, w: 1600, h: 1600,
              door: { x: -20, y: 700, w: 40, h: 200 } }
        ],
        walls: [
            // Central Command (Room 0) boundaries
            { x: 0, y: 1560, w: 700, h: 40 }, { x: 900, y: 1560, w: 700, h: 40 }, // Bottom wall split for window
            { x: 1560, y: 0, w: 40, h: 700 }, { x: 1560, y: 900, w: 40, h: 700 }, // Right wall split for window
            // Segmented separators to allow door placement
            { x: 0, y: -20, w: 700, h: 40 }, { x: 900, y: -20, w: 700, h: 40 }, // Top wall divider split (Door gap)
            { x: -20, y: 0, w: 40, h: 700 }, { x: -20, y: 900, w: 40, h: 700 }, // Left wall divider split (Door gap)

            // Storage Sector (Room 1) boundaries
            { x: 0, y: -1600, w: 700, h: 40 }, { x: 900, y: -1600, w: 700, h: 40 }, // Top wall split for window
            { x: 0, y: -1600, w: 40, h: 1600 }, // Left wall (Solid)
            { x: 1560, y: -1600, w: 40, h: 1600 }, // Right wall (Solid)

            // West Platform (Room 2) boundaries
            { x: -1600, y: 0, w: 40, h: 700 }, { x: -1600, y: 900, w: 40, h: 700 }, // Left wall split for window
            { x: -1600, y: 0, w: 1600, h: 40 }, // Top wall (Solid)
            { x: -1600, y: 1560, w: 1600, h: 40 } // Bottom wall (Solid)
        ],
        windows: [
            { x: 700, y: 1560, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 800, entryY: 1450 },
            { x: 1560, y: 700, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 1450, entryY: 800 },
            { x: 700, y: -1600, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 800, entryY: -1450 },
            { x: -1600, y: 700, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: -1450, entryY: 800 }
        ],
        furniture: [
            { x: 300, y: 300, w: 200, h: 200, color: "#111" },
            { x: 1100, y: 1100, w: 200, h: 200, color: "#111" }
        ],
        interactables: [
            { x: 200, y: 200, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "M1911" },
            { x: 1300, y: 200, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP40" },
            { x: -800, y: 200, w: 40, h: 40, type: 'WALLBUY', price: 1200, label: "Stakeout" },
            { x: -1200, y: 1000, w: 50, h: 50, type: 'PERK', price: 2500, color: '#c0392b', label: "JUG" }
        ],
        spawnPoints: [
            { x: 800, y: 1750, roomId: 0 },
            { x: 1750, y: 800, roomId: 0 },
            { x: -1750, y: 800, roomId: 2 },
            { x: 800, y: -1750, roomId: 1 }
        ]
    },

    // --- MAP 2: SECTOR-9 LAB MAZE (GIANT SURVIVAL MAZE) ---
    {
        name: "Sector-9 Lab Maze",
        desc: "A sprawling complex structured like a labyrinth. Fast corners, blind spots, and narrow pathways.",
        rooms: [
            { id: 0, name: "Main Junction", unlocked: true, price: 0, color: "#130f40", x: 0, y: 0, w: 1200, h: 1200 },
            { id: 1, name: "North Asylum Wing", unlocked: false, price: 600, color: "#2c3a47", x: 0, y: -1200, w: 1200, h: 1200,
              door: { x: 500, y: -20, w: 200, h: 40 } },
            { id: 2, name: "East Lab Chambers", unlocked: false, price: 800, color: "#303952", x: 1200, y: 0, w: 1200, h: 1200,
              door: { x: 1180, y: 500, w: 40, h: 200 } }
        ],
        walls: [
            // Spawn Room (Central Junction)
            { x: 0, y: 1160, w: 500, h: 40 }, { x: 700, y: 1160, w: 500, h: 40 }, // Bottom wall split for window
            { x: 0, y: 0, w: 40, h: 1200 }, // Left wall (Solid)
            // Separator walls with door segments
            { x: 0, y: -20, w: 500, h: 40 }, { x: 700, y: -20, w: 500, h: 40 }, // Top divider (Door gap)
            { x: 1180, y: 0, w: 40, h: 500 }, { x: 1180, y: 700, w: 40, h: 500 }, // Right divider (Door gap)

            // North Asylum Wing (Room 1)
            { x: 0, y: -1200, w: 500, h: 40 }, { x: 700, y: -1200, w: 500, h: 40 }, // Top wall split for window
            { x: 0, y: -1200, w: 40, h: 1200 }, // Left wall
            { x: 1160, y: -1200, w: 40, h: 1200 }, // Right wall

            // East Lab Chambers (Room 2)
            { x: 1200, y: 0, w: 1200, h: 40 }, // Top wall
            { x: 1200, y: 1160, w: 1200, h: 40 }, // Bottom wall
            { x: 2360, y: 0, w: 40, h: 500 }, { x: 2360, y: 700, w: 40, h: 500 } // Right wall split for window
        ],
        windows: [
            { x: 500, y: 1160, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 600, entryY: 1050 },
            { x: 500, y: -1200, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 600, entryY: -1050 },
            { x: 2360, y: 500, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 2250, entryY: 600 }
        ],
        furniture: [
            { x: 200, y: 200, w: 150, h: 150, color: "#111" },
            { x: 1600, y: 400, w: 200, h: 200, color: "#222" }
        ],
        interactables: [
            { x: 800, y: 200, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Olympia" },
            { x: 200, y: 800, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP40" },
            { x: 1500, y: 200, w: 40, h: 40, type: 'WALLBUY', price: 1200, label: "Stakeout" },
            { x: 2000, y: 800, w: 50, h: 50, type: 'PERK', price: 2500, color: '#c0392b', label: "JUG" }
        ],
        spawnPoints: [
            { x: 600, y: 1350, roomId: 0 },
            { x: 600, y: -1350, roomId: 1 },
            { x: 2500, y: 600, roomId: 2 }
        ]
    }
];

// --- DEDICATED BOOT CAMP (TUTORIAL) LINEAR MAP ---
const tutorialMapData = {
    rooms: [
        { id: 0, name: "Movement Room", unlocked: true, price: 0, color: "#111a24", x: 0, y: 0, w: 400, h: 400 },
        { id: 1, name: "Armory Room", unlocked: false, price: 0, color: "#1c1c1c", x: 400, y: 0, w: 400, h: 400,
          door: { x: 360, y: 150, w: 40, h: 100 } },
        { id: 2, name: "Defend Room", unlocked: false, price: 0, color: "#2d1f10", x: 800, y: 0, w: 400, h: 400,
          door: { x: 760, y: 150, w: 40, h: 100 } },
        { id: 3, name: "Escape Corridor", unlocked: false, price: 200, color: "#112211", x: 1200, y: 0, w: 400, h: 400,
          door: { x: 1160, y: 150, w: 40, h: 100 } }
    ],
    walls: [
        { x: 0, y: 0, w: 40, h: 400 }, { x: 0, y: 0, w: 400, h: 40 }, { x: 0, y: 360, w: 400, h: 40 },
        { x: 360, y: 0, w: 40, h: 150 }, { x: 360, y: 250, w: 40, h: 150 },
        { x: 400, y: 0, w: 400, h: 40 }, { x: 400, y: 360, w: 400, h: 40 },
        { x: 760, y: 0, w: 40, h: 150 }, { x: 760, y: 250, w: 40, h: 150 },
        { x: 800, y: 0, w: 400, h: 40 }, { x: 800, y: 360, w: 200, h: 40 }, { x: 1100, y: 360, w: 100, h: 40 },
        { x: 1160, y: 0, w: 40, h: 150 }, { x: 1160, y: 250, w: 40, h: 150 },
        { x: 1200, y: 0, w: 400, h: 40 }, { x: 1200, y: 360, w: 400, h: 40 },
        { x: 1560, y: 0, w: 40, h: 400 }
    ],
    windows: [
        { x: 1000, y: 360, w: 100, h: 40, boards: 0, max: 6, orientation: 'H', entryX: 1050, entryY: 300 }
    ],
    furniture: [
        { x: 100, y: 100, w: 60, h: 60, color: "#111" }
    ],
    interactables: [
        { x: 580, y: 60, w: 40, h: 40, type: 'WALLBUY', price: 0, label: "Olympia" }
    ],
    spawnPoints: [
        { x: 1050, y: 450, roomId: 2 }
    ]
};

// Default current map
let activeMap = playableMaps[0];