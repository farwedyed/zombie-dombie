/* --- CENTRAL MAP DATABASE --- */

const playableMaps = [
    // --- MAP 0: THE FACILITY (CLASSIC - COMPACT EDITION) ---
    {
        name: "The Facility (Classic)",
        desc: "The classic facility with long corridors, multiple doors, and compact room sizes.",
        rooms: [
            { id: 0, name: "Spawn", unlocked: true, price: 0, color: "#2c3e50", x: 0, y: 0, w: 800, h: 800 },
            { id: 1, name: "East Hall", unlocked: false, price: 750, color: "#1a1a1a", x: 800, y: 200, w: 600, h: 400, 
              door: { x: 760, y: 300, w: 40, h: 200 } },
            { id: 2, name: "Warehouse", unlocked: false, price: 1000, color: "#3e2723", x: 1400, y: -200, w: 1000, h: 1000, 
              door: { x: 1360, y: 300, w: 40, h: 200 } },
            { id: 3, name: "Laboratory", unlocked: false, price: 1500, color: "#1f2a36", x: -800, y: 0, w: 800, h: 800, 
              door: { x: 0, y: 300, w: 40, h: 200 } },
            { id: 4, name: "Courtyard", unlocked: false, price: 1250, color: "#152215", x: 0, y: -800, w: 800, h: 800, 
              door: { x: 300, y: 0, w: 200, h: 40 } }
        ],
        walls: [
            // Spawn Room (Room 0) boundaries
            { x: 0, y: 0, w: 300, h: 40 }, { x: 500, y: 0, w: 300, h: 40 }, // Top wall (Door gap Room 4)
            { x: 0, y: 760, w: 200, h: 40 }, { x: 300, y: 760, w: 200, h: 40 }, { x: 600, y: 760, w: 200, h: 40 }, // Bottom wall (Windows gaps)
            { x: 0, y: 0, w: 40, h: 300 }, { x: 0, y: 500, w: 40, h: 300 }, // Left wall (Door gap Room 3)
            { x: 760, y: 0, w: 40, h: 300 }, { x: 760, y: 500, w: 40, h: 300 }, // Right wall (Door gap Room 1)

            // East Hall (Room 1) boundaries
            { x: 800, y: 200, w: 300, h: 40 }, { x: 1200, y: 200, w: 200, h: 40 }, // Top wall (Window gap)
            { x: 800, y: 560, w: 600, h: 40 }, // Bottom wall
            { x: 1360, y: 200, w: 40, h: 100 }, { x: 1360, y: 500, w: 40, h: 100 }, // Right wall (Door gap Room 2)

            // Warehouse (Room 2) boundaries
            { x: 1400, y: -200, w: 500, h: 40 }, { x: 2100, y: -200, w: 300, h: 40 }, // Top wall (Window gap)
            { x: 1400, y: 760, w: 500, h: 40 }, { x: 2100, y: 760, w: 300, h: 40 }, // Bottom wall (Window gap)
            { x: 1400, y: -200, w: 40, h: 500 }, { x: 1400, y: 500, w: 40, h: 300 }, // Left wall (Door gap)
            { x: 2360, y: -200, w: 40, h: 500 }, { x: 2360, y: 500, w: 40, h: 300 }, // Right wall (Window gap)

            // Laboratory (Room 3) boundaries
            { x: -800, y: 0, w: 300, h: 40 }, { x: -300, y: 0, w: 300, h: 40 }, // Top wall (Window gap)
            { x: -800, y: 760, w: 300, h: 40 }, { x: -300, y: 760, w: 300, h: 40 }, // Bottom wall (Window gap)
            { x: -800, y: 0, w: 40, h: 800 }, // Left wall (Solid)
            { x: -40, y: 0, w: 40, h: 300 }, { x: -40, y: 500, w: 40, h: 300 }, // Right wall (Door gap)

            // Courtyard (Room 4) boundaries
            { x: 0, y: -800, w: 40, h: 300 }, { x: 0, y: -300, w: 40, h: 300 }, // Left wall (Window gap)
            { x: 760, y: -800, w: 40, h: 300 }, { x: 760, y: -300, w: 40, h: 300 }, // Right wall (Window gap)
            { x: 0, y: -800, w: 800, h: 40 }, // Top wall (Solid)
            { x: 0, y: -40, w: 300, h: 40 }, { x: 500, y: -40, w: 300, h: 40 } // Bottom wall (Door gap)
        ],
        windows: [
            { x: 200, y: 760, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 250, entryY: 700 }, 
            { x: 500, y: 760, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 550, entryY: 700 }, 
            { x: 1100, y: 200, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 1150, entryY: 300 }, 
            { x: 1900, y: -200, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 2000, entryY: -100 },
            { x: 1900, y: 760, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 2000, entryY: 660 },
            { x: 2360, y: 300, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 2250, entryY: 400 },
            { x: -500, y: 0, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: -400, entryY: 100 },
            { x: -500, y: 760, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: -400, entryY: 660 },
            { x: 0, y: -500, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 100, entryY: -400 },
            { x: 760, y: -500, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 660, entryY: -400 }
        ],
        furniture: [
            { x: 200, y: 200, w: 50, h: 50, color: "#111" },
            { x: 550, y: 200, w: 50, h: 50, color: "#111" }
        ],
        interactables: [
            { x: 100, y: 100, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Olympia" },
            { x: 700, y: 100, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "M1911" },
            { x: 1000, y: 250, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP40" },
            { x: 1800, y: 300, w: 40, h: 40, type: 'WALLBUY', price: 1200, label: "Stakeout" },
            { x: 1700, y: 100, w: 60, h: 60, type: 'BOX', price: 950, color: '#8e44ad', label: "?" },
            { x: -600, y: 400, w: 50, h: 50, type: 'PERK', price: 2500, color: '#c0392b', label: "JUG" }
        ],
        spawnPoints: [
            { x: 250, y: 900, roomId: 0 }, { x: 550, y: 900, roomId: 0 },
            { x: 1150, y: 100, roomId: 1 },
            { x: 2000, y: -350, roomId: 2 }, { x: 2000, y: 900, roomId: 2 },
            { x: -400, y: -150, roomId: 3 }, { x: -150, y: -450, roomId: 4 }
        ]
    },

    // --- MAP 1: BUNKER OUTPOST (COMPACT & TACTICAL EDITION) ---
    {
        name: "Bunker Outpost",
        desc: "A small, claustrophobic military bunker. Features tight corners and direct entries.",
        rooms: [
            { id: 0, name: "Bunker Command", unlocked: true, price: 0, color: "#2d3436", x: 0, y: 0, w: 600, h: 600 },
            { id: 1, name: "Storage Sector", unlocked: false, price: 600, color: "#1e272e", x: 0, y: -500, w: 600, h: 500,
              door: { x: 200, y: -20, w: 200, h: 40 } },
            { id: 2, name: "West Platform Zone", unlocked: false, price: 800, color: "#1d2a44", x: -500, y: 0, w: 500, h: 600,
              door: { x: -20, y: 200, w: 40, h: 200 } }
        ],
        walls: [
            // Spawn Room (Bunker Command) boundaries
            { x: 0, y: 560, w: 200, h: 40 }, { x: 400, y: 560, w: 200, h: 40 }, // Bottom wall split for window
            { x: 560, y: 0, w: 40, h: 200 }, { x: 560, y: 400, w: 40, h: 200 }, // Right wall split for window
            { x: 0, y: -20, w: 200, h: 40 }, { x: 400, y: -20, w: 200, h: 40 }, // Top wall divider split (Door gap)
            { x: -20, y: 0, w: 40, h: 200 }, { x: -20, y: 400, w: 40, h: 200 }, // Left wall divider split (Door gap)

            // Storage Sector (Room 1) boundaries
            { x: 0, y: -500, w: 200, h: 40 }, { x: 400, y: -500, w: 200, h: 40 }, // Top wall split for window
            { x: 0, y: -500, w: 40, h: 500 }, // Left wall (Solid)
            { x: 560, y: -500, w: 40, h: 500 }, // Right wall (Solid)

            // West Platform (Room 2) boundaries
            { x: -500, y: 0, w: 40, h: 200 }, { x: -500, y: 400, w: 40, h: 200 }, // Left wall split for window
            { x: -500, y: 0, w: 500, h: 40 }, // Top wall (Solid)
            { x: -500, y: 560, w: 500, h: 40 } // Bottom wall (Solid)
        ],
        windows: [
            { x: 200, y: 560, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 300, entryY: 500 },
            { x: 560, y: 200, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 500, entryY: 300 },
            { x: 200, y: -500, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 300, entryY: -450 },
            { x: -500, y: 200, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: -400, entryY: 300 }
        ],
        furniture: [
            { x: 150, y: 150, w: 100, h: 100, color: "#111" }
        ],
        interactables: [
            { x: 80, y: 80, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "M1911" },
            { x: 480, y: 80, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP40" },
            { x: -350, y: 100, w: 40, h: 40, type: 'WALLBUY', price: 1200, label: "Stakeout" },
            { x: -400, y: 400, w: 50, h: 50, type: 'PERK', price: 2500, color: '#c0392b', label: "JUG" }
        ],
        spawnPoints: [
            { x: 300, y: 700, roomId: 0 },
            { x: 700, y: 300, roomId: 0 },
            { x: -700, y: 300, roomId: 2 },
            { x: 300, y: -600, roomId: 1 }
        ]
    },

    // --- MAP 2: SECTOR-9 LAB MAZE (COMPACT MAZE EDITION) ---
    {
        name: "Sector-9 Lab Maze",
        desc: "A sprawling maze layout configured with winding paths, blind corners, and close-range points.",
        rooms: [
            { id: 0, name: "Main Junction", unlocked: true, price: 0, color: "#130f40", x: 0, y: 0, w: 500, h: 500 },
            { id: 1, name: "North Asylum Wing", unlocked: false, price: 600, color: "#2c3a47", x: 0, y: -500, w: 500, h: 500,
              door: { x: 200, y: -20, w: 100, h: 40 } },
            { id: 2, name: "East Lab Chambers", unlocked: false, price: 800, color: "#303952", x: 500, y: 0, w: 500, h: 500,
              door: { x: 480, y: 200, w: 40, h: 100 } }
        ],
        walls: [
            // Spawn Room (Central Junction)
            { x: 0, y: 460, w: 200, h: 40 }, { x: 300, y: 460, w: 200, h: 40 }, // Bottom wall split for window
            { x: 0, y: 0, w: 40, h: 500 }, // Left wall (Solid)
            // Separator walls with door segments
            { x: 0, y: -20, w: 200, h: 40 }, { x: 300, y: -20, w: 200, h: 40 }, // Top divider (Door gap)
            { x: 480, y: 0, w: 40, h: 200 }, { x: 480, y: 300, w: 40, h: 200 }, // Right divider (Door gap)

            // North Asylum Wing (Room 1)
            { x: 0, y: -500, w: 200, h: 40 }, { x: 300, y: -500, w: 200, h: 40 }, // Top wall split for window
            { x: 0, y: -500, w: 40, h: 500 }, // Left wall
            { x: 460, y: -500, w: 40, h: 500 }, // Right wall

            // East Lab Chambers (Room 2)
            { x: 500, y: 0, w: 500, h: 40 }, // Top wall
            { x: 500, y: 460, w: 500, h: 40 }, // Bottom wall
            { x: 960, y: 0, w: 40, h: 200 }, { x: 960, y: 300, w: 40, h: 200 } // Right wall split for window
        ],
        windows: [
            { x: 200, y: 460, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 250, entryY: 400 },
            { x: 200, y: -500, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 250, entryY: -450 },
            { x: 960, y: 200, w: 40, h: 100, boards: 6, max: 6, orientation: 'V', entryX: 900, entryY: 250 }
        ],
        furniture: [
            { x: 100, y: 100, w: 100, h: 100, color: "#111" },
            { x: 650, y: 200, w: 100, h: 100, color: "#222" }
        ],
        interactables: [
            { x: 350, y: 60, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Olympia" },
            { x: 60, y: 300, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP40" },
            { x: 650, y: 60, w: 40, h: 40, type: 'WALLBUY', price: 1200, label: "Stakeout" },
            { x: 850, y: 350, w: 50, h: 50, type: 'PERK', price: 2500, color: '#c0392b', label: "JUG" }
        ],
        spawnPoints: [
            { x: 250, y: 600, roomId: 0 },
            { x: 250, y: -600, roomId: 1 },
            { x: 1100, y: 250, roomId: 2 }
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