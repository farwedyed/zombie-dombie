/* --- CENTRAL MAP DATABASE --- */

const playableMaps = [
    // --- MAP 0: THE FACILITY (CLASSIC - EXPANDED TO 7 ROOMS WITH FIXED WINDOW LAYOUTS) ---
    {
        name: "The Facility (Classic)",
        desc: "An abandoned scientific complex featuring laboratory corridors, supply wings, and deep power rooms.",
        rooms: [
            { id: 0, name: "Spawn", unlocked: true, price: 0, color: "#2c3e50", x: 0, y: 0, w: 800, h: 800 },
            { id: 1, name: "East Hall", unlocked: false, price: 750, color: "#1a1a1a", x: 800, y: 200, w: 600, h: 400, 
              door: { x: 760, y: 300, w: 40, h: 200 } },
            { id: 2, name: "Warehouse", unlocked: false, price: 1000, color: "#3e2723", x: 1400, y: -200, w: 1000, h: 1000, 
              door: { x: 1360, y: 300, w: 40, h: 200 } },
            { id: 3, name: "Laboratory", unlocked: false, price: 1500, color: "#1f2a36", x: -800, y: 0, w: 800, h: 800, 
              door: { x: 0, y: 300, w: 40, h: 200 } },
            { id: 4, name: "Courtyard", unlocked: false, price: 1250, color: "#152215", x: 0, y: -800, w: 800, h: 800, 
              door: { x: 300, y: 0, w: 200, h: 40 } },
            // Generator Room (Connection: Laboratory Left)
            { id: 5, name: "Generator Room", unlocked: false, price: 1250, color: "#27ae60", x: -1600, y: 200, w: 800, h: 400, 
              door: { x: -820, y: 300, w: 40, h: 150 } },
            // Supply Office (Connection: Warehouse Right)
            { id: 6, name: "Supply Office", unlocked: false, price: 1000, color: "#2980b9", x: 2400, y: 0, w: 600, h: 600, 
              door: { x: 2380, y: 200, w: 40, h: 150 } }
        ],
        walls: [
            // Spawn Room (Room 0) boundaries
            { x: 0, y: 0, w: 300, h: 40 }, { x: 500, y: 0, w: 300, h: 40 }, 
            { x: 0, y: 760, w: 200, h: 40 }, { x: 300, y: 760, w: 200, h: 40 }, { x: 600, y: 760, w: 200, h: 40 }, 
            { x: 0, y: 0, w: 40, h: 300 }, { x: 0, y: 500, w: 40, h: 300 }, 
            { x: 760, y: 0, w: 40, h: 300 }, { x: 760, y: 500, w: 40, h: 300 }, 

            // East Hall (Room 1) boundaries
            { x: 800, y: 200, w: 300, h: 40 }, { x: 1200, y: 200, w: 200, h: 40 }, 
            { x: 800, y: 560, w: 600, h: 40 }, 
            { x: 1360, y: 200, w: 40, h: 100 }, { x: 1360, y: 500, w: 40, h: 100 }, 

            // Warehouse (Room 2) boundaries
            { x: 1400, y: -200, w: 500, h: 40 }, { x: 2100, y: -200, w: 300, h: 40 }, 
            { x: 1400, y: 760, w: 500, h: 40 }, { x: 2100, y: 760, w: 300, h: 40 }, 
            { x: 1400, y: -200, w: 40, h: 500 }, { x: 1400, y: 500, w: 40, h: 300 }, 
            // Fixed Warehouse-to-Supply-Office dividing wall (centered on x:2380, no window overlaps)
            { x: 2380, y: -200, w: 40, h: 400 }, { x: 2380, y: 350, w: 40, h: 450 }, 

            // Laboratory (Room 3) boundaries
            { x: -800, y: 0, w: 300, h: 40 }, { x: -300, y: 0, w: 300, h: 40 }, 
            { x: -800, y: 760, w: 300, h: 40 }, { x: -300, y: 760, w: 300, h: 40 }, 
            // Fixed Laboratory-to-Generator dividing wall (aligned correctly to x:-820)
            { x: -820, y: 0, w: 40, h: 300 }, { x: -820, y: 450, w: 40, h: 350 }, 
            { x: -40, y: 0, w: 40, h: 300 }, { x: -40, y: 500, w: 40, h: 300 }, 

            // Courtyard (Room 4) boundaries
            { x: 0, y: -800, w: 40, h: 300 }, { x: 0, y: -300, w: 40, h: 300 }, 
            { x: 760, y: -800, w: 40, h: 300 }, { x: 760, y: -300, w: 40, h: 300 }, 
            { x: 0, y: -800, w: 800, h: 40 }, 
            { x: 0, y: -40, w: 300, h: 40 }, { x: 500, y: -40, w: 300, h: 40 },

            // Generator Room (Room 5) boundaries
            { x: -1600, y: 200, w: 800, h: 40 },
            { x: -1600, y: 560, w: 800, h: 40 },
            { x: -1600, y: 200, w: 40, h: 400 },

            // Supply Office (Room 6) boundaries (Right wall split cleanly to make room for window)
            { x: 2400, y: 0, w: 600, h: 40 },
            { x: 2400, y: 560, w: 600, h: 40 },
            { x: 2960, y: 0, w: 40, h: 200 }, { x: 2960, y: 400, w: 40, h: 200 }
        ],
        windows: [
            { x: 200, y: 760, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 250, entryY: 700 }, 
            { x: 500, y: 760, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 550, entryY: 700 }, 
            { x: 1100, y: 200, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 1150, entryY: 300 }, 
            { x: 1900, y: -200, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 2000, entryY: -100 },
            { x: 1900, y: 760, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 2000, entryY: 660 },
            { x: -500, y: 0, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: -400, entryY: 100 },
            { x: -500, y: 760, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: -400, entryY: 660 },
            { x: 0, y: -500, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 100, entryY: -400 },
            { x: 760, y: -500, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 660, entryY: -400 },
            // Relocated outer window to the new exterior wall of Room 6 (Supply Office)
            { x: 2960, y: 200, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 2850, entryY: 300 }
        ],
        furniture: [
            { x: 200, y: 200, w: 50, h: 50, color: "#111" },
            { x: 550, y: 200, w: 50, h: 50, color: "#111" }
        ],
        interactables: [
            { x: 100, y: 100, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Olympus" },
            { x: 700, y: 100, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Model 1911" },
            { x: 1000, y: 250, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP-Retro" },
            { x: 1800, y: 300, w: 40, h: 40, type: 'WALLBUY', price: 1200, label: "Enforcer" },
            { x: -1400, y: 300, w: 40, h: 40, type: 'WALLBUY', price: 1500, label: "Arctic Bolt" },
            { x: 2700, y: 250, w: 40, h: 40, type: 'WALLBUY', price: 2000, label: "Bazooka" },
            { x: 1700, y: 100, w: 60, h: 60, type: 'BOX', price: 950, color: '#8e44ad', label: "?" },
            { x: -600, y: 400, w: 50, h: 50, type: 'PERK', price: 2500, color: '#c0392b', label: "VIG" }
        ],
        spawnPoints: [
            { x: 250, y: 900, roomId: 0 }, { x: 550, y: 900, roomId: 0 }, // Spawn Room windows
            { x: 1150, y: 100, roomId: 1 },                               // East Hall window
            { x: 2000, y: -350, roomId: 2 }, { x: 2000, y: 900, roomId: 2 }, // Warehouse windows
            { x: -400, y: -100, roomId: 3 }, { x: -400, y: 900, roomId: 3 }, // Laboratory windows
            { x: -100, y: -400, roomId: 4 }, { x: 900, y: -400, roomId: 4 }, // Courtyard windows
            { x: 3100, y: 300, roomId: 6 }                                 // Supply Office window
        ]
    },

    // --- MAP 1: BUNKER OUTPOST (EXPANDED TO 5 ROOMS) ---
    {
        name: "Bunker Outpost",
        desc: "A sprawling concrete subterranean stronghold configured with mess halls and armoury vaults.",
        rooms: [
            { id: 0, name: "Bunker Command", unlocked: true, price: 0, color: "#2d3436", x: 0, y: 0, w: 600, h: 600 },
            { id: 1, name: "Storage Sector", unlocked: false, price: 600, color: "#1e272e", x: 0, y: -500, w: 600, h: 500,
              door: { x: 200, y: -20, w: 200, h: 40 } },
            { id: 2, name: "West Platform Zone", unlocked: false, price: 800, color: "#1d2a44", x: -500, y: 0, w: 500, h: 600,
              door: { x: -20, y: 200, w: 40, h: 200 } },
            // Mess Hall (Connection: Storage Sector Left)
            { id: 3, name: "Mess Hall", unlocked: false, price: 750, color: "#34495e", x: -600, y: -500, w: 600, h: 500, 
              door: { x: -20, y: -350, w: 40, h: 150 } },
            // Armoury Vault (Connection: West Platform Left)
            { id: 4, name: "Armoury Vault", unlocked: false, price: 1200, color: "#7f8c8d", x: -1100, y: 100, w: 600, h: 400, 
              door: { x: -520, y: 200, w: 40, h: 150 } }
        ],
        walls: [
            // Spawn Room (Bunker Command) boundaries
            { x: 0, y: 560, w: 200, h: 40 }, { x: 400, y: 560, w: 200, h: 40 }, 
            { x: 560, y: 0, w: 40, h: 200 }, { x: 560, y: 400, w: 40, h: 200 }, 
            { x: 0, y: -20, w: 200, h: 40 }, { x: 400, y: -20, w: 200, h: 40 }, 
            { x: -20, y: 0, w: 40, h: 200 }, { x: -20, y: 400, w: 40, h: 200 }, 

            // Storage Sector (Room 1) boundaries (Fixed Mess Hall dividing wall gap alignment)
            { x: 0, y: -500, w: 200, h: 40 }, { x: 400, y: -500, w: 200, h: 40 }, 
            { x: -20, y: -500, w: 40, h: 150 }, { x: -20, y: -200, w: 40, h: 200 }, 
            { x: 560, y: -500, w: 40, h: 500 }, 

            // West Platform (Room 2) boundaries (Fixed Vault dividing wall gap alignment)
            { x: -500, y: 0, w: 500, h: 40 }, 
            { x: -500, y: 560, w: 500, h: 40 }, 
            { x: -520, y: 0, w: 40, h: 200 }, { x: -520, y: 350, w: 40, h: 250 }, 

            // Mess Hall (Room 3) boundaries (Fixed Left Wall overlapping the window)
            { x: -600, y: -500, w: 600, h: 40 },
            { x: -600, y: -40, w: 600, h: 40 },
            { x: -600, y: -500, w: 40, h: 250 }, { x: -600, y: -150, w: 40, h: 150 },

            // Armoury Vault (Room 4) boundaries
            { x: -1100, y: 100, w: 600, h: 40 },
            { x: -1100, y: 460, w: 600, h: 40 },
            { x: -1100, y: 100, w: 40, h: 400 }
        ],
        windows: [
            { x: 200, y: 560, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 300, entryY: 500 },
            { x: 560, y: 200, w: 40, h: 200, boards: 6, max: 6, orientation: 'V', entryX: 500, entryY: 300 },
            { x: 200, y: -500, w: 200, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 300, entryY: -450 },
            { x: -600, y: -250, w: 40, h: 100, boards: 6, max: 6, orientation: 'V', entryX: -550, entryY: -200 }
        ],
        furniture: [
            { x: 150, y: 150, w: 100, h: 100, color: "#111" }
        ],
        interactables: [
            { x: 80, y: 80, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Model 1911" },
            { x: 480, y: 80, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP-Retro" },
            { x: -350, y: 100, w: 40, h: 40, type: 'WALLBUY', price: 1200, label: "Enforcer" },
            { x: -1000, y: 200, w: 40, h: 40, type: 'WALLBUY', price: 2000, label: "Bazooka" }, 
            { x: -450, y: -400, w: 40, h: 40, type: 'WALLBUY', price: 1500, label: "Arctic Bolt" }, 
            { x: -400, y: 400, w: 50, h: 50, type: 'PERK', price: 2500, color: '#c0392b', label: "VIG" }
        ],
        spawnPoints: [
            { x: 300, y: 700, roomId: 0 },   // Room 0 Bottom window
            { x: 700, y: 300, roomId: 0 },   // Room 0 Right window
            { x: 300, y: -600, roomId: 1 },  // Room 1 Top window
            { x: -750, y: -200, roomId: 3 }  // Room 3 Left window
        ]
    },

    // --- MAP 2: SECTOR-9 LAB MAZE (EXPANDED TO 5 ROOMS) ---
    {
        name: "Sector-9 Lab Maze",
        desc: "An intricate quarantine testing zone composed of narrow labyrinths and ventilation escape pads.",
        rooms: [
            { id: 0, name: "Main Junction", unlocked: true, price: 0, color: "#130f40", x: 0, y: 0, w: 500, h: 500 },
            { id: 1, name: "North Asylum Wing", unlocked: false, price: 600, color: "#2c3a47", x: 0, y: -500, w: 500, h: 500,
              door: { x: 200, y: -20, w: 100, h: 40 } },
            { id: 2, name: "East Lab Chambers", unlocked: false, price: 800, color: "#303952", x: 500, y: 0, w: 500, h: 500,
              door: { x: 480, y: 200, w: 40, h: 100 } },
            // Testing Chamber B (Connection: North Asylum Wing Left)
            { id: 3, name: "Testing Chamber B", unlocked: false, price: 900, color: "#16a085", x: -500, y: -500, w: 500, h: 500, 
              door: { x: -20, y: -300, w: 40, h: 150 } },
            // Extraction Vent (Connection: East Lab Chambers Right)
            { id: 4, name: "Extraction Vent", unlocked: false, price: 1100, color: "#2c3e50", x: 1000, y: 0, w: 500, h: 500, 
              door: { x: 980, y: 200, w: 40, h: 150 } }
        ],
        walls: [
            // Spawn Room (Central Junction)
            { x: 0, y: 460, w: 200, h: 40 }, { x: 300, y: 460, w: 200, h: 40 }, 
            { x: 0, y: 0, w: 40, h: 500 }, 
            { x: 0, y: -20, w: 200, h: 40 }, { x: 300, y: -20, w: 200, h: 40 }, 
            { x: 480, y: 0, w: 40, h: 200 }, { x: 480, y: 300, w: 40, h: 200 }, 

            // North Asylum Wing (Room 1) (Fixed Top Wall overlapping the window)
            { x: 0, y: -500, w: 200, h: 40 }, { x: 300, y: -500, w: 200, h: 40 }, 
            { x: -20, y: -500, w: 40, h: 200 }, { x: -20, y: -150, w: 40, h: 150 }, // (Fixed dividing wall gap alignment)
            { x: 460, y: -500, w: 40, h: 500 }, 

            // East Lab Chambers (Room 2) (Fixed Extraction dividing wall gap alignment)
            { x: 500, y: 0, w: 500, h: 40 }, 
            { x: 500, y: 460, w: 500, h: 40 }, 
            { x: 960, y: 0, w: 40, h: 200 }, { x: 960, y: 350, w: 40, h: 150 },

            // Testing Chamber B (Room 3) boundaries
            { x: -500, y: -500, w: 500, h: 40 },
            { x: -500, y: -40, w: 500, h: 40 },
            { x: -500, y: -500, w: 40, h: 500 },

            // Extraction Vent (Room 4) boundaries (Fixed Right Wall overlapping the window)
            { x: 1000, y: 0, w: 500, h: 40 },
            { x: 1000, y: 460, w: 500, h: 40 },
            { x: 1460, y: 0, w: 40, h: 200 }, { x: 1460, y: 300, w: 40, h: 200 }
        ],
        windows: [
            { x: 200, y: 460, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 250, entryY: 400 },
            { x: 200, y: -500, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 250, entryY: -450 },
            { x: 1460, y: 200, w: 40, h: 100, boards: 6, max: 6, orientation: 'V', entryX: 1380, entryY: 250 }
        ],
        furniture: [
            { x: 100, y: 100, w: 100, h: 100, color: "#111" },
            { x: 650, y: 200, w: 100, h: 100, color: "#222" }
        ],
        interactables: [
            { x: 350, y: 60, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Olympus" },
            { x: 60, y: 300, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP-Retro" },
            { x: 650, y: 60, w: 40, h: 40, type: 'WALLBUY', price: 1200, label: "Enforcer" },
            { x: -300, y: -300, w: 40, h: 40, type: 'WALLBUY', price: 1500, label: "Arctic Bolt" }, 
            { x: 1200, y: 350, w: 40, h: 40, type: 'WALLBUY', price: 2000, label: "Bazooka" }, 
            { x: 850, y: 350, w: 50, h: 50, type: 'PERK', price: 2500, color: '#c0392b', label: "VIG" }
        ],
        spawnPoints: [
            { x: 250, y: 600, roomId: 0 },   // Room 0 Bottom window
            { x: 250, y: -600, roomId: 1 },  // Room 1 Top window
            { x: 1550, y: 250, roomId: 4 }   // Room 4 Right window (Zombies will now spawn outside)
        ]
    },

    // --- MAP 3: SECTOR-12 CITY (NEW SPRAWLING INFECTION MAP) ---
    {
        name: "Sector-12 City",
        desc: "A massive multi-tiered metropolis sector featuring intersecting streets, blockades, alleys, and commercial holdout spots.",
        rooms: [
            { id: 0, name: "Central Plaza", unlocked: true, price: 0, color: "#1a1a1d", x: 1000, y: 1000, w: 800, h: 800 },
            { id: 1, name: "Main Street North", unlocked: false, price: 750, color: "#0f172a", x: 1000, y: 200, w: 800, h: 800, 
              door: { x: 1350, y: 980, w: 100, h: 40 } },
            { id: 2, name: "Commercial Sector East", unlocked: false, price: 1000, color: "#1e1e24", x: 1800, y: 1000, w: 800, h: 800, 
              door: { x: 1780, y: 1350, w: 40, h: 100 } },
            { id: 3, name: "Medical Center West", unlocked: false, price: 1250, color: "#13222d", x: 200, y: 1000, w: 800, h: 800, 
              door: { x: 980, y: 1350, w: 40, h: 100 } },
            { id: 4, name: "Safehouse Alley South", unlocked: false, price: 1500, color: "#1b1424", x: 1000, y: 1800, w: 800, h: 800, 
              door: { x: 1350, y: 1780, w: 100, h: 40 } }
        ],
        walls: [
            // --- ROOM 0: CENTRAL PLAZA WALLS (Leaves 4 connecting door gaps) ---
            { x: 1000, y: 1000, w: 350, h: 40 }, { x: 1450, y: 1000, w: 350, h: 40 }, // North boundary split
            { x: 1000, y: 1760, w: 350, h: 40 }, { x: 1450, y: 1760, w: 350, h: 40 }, // South boundary split
            { x: 1000, y: 1000, w: 40, h: 350 }, { x: 1000, y: 1450, w: 40, h: 350 }, // West boundary split
            { x: 1760, y: 1000, w: 40, h: 350 }, { x: 1760, y: 1450, w: 40, h: 350 }, // East boundary split

            // --- ROOM 1: MAIN STREET NORTH WALLS ---
            { x: 1000, y: 200, w: 350, h: 40 }, { x: 1450, y: 200, w: 350, h: 40 },   // Exterior North wall (split for window)
            { x: 1000, y: 200, w: 40, h: 800 },                                      // West boundary
            { x: 1760, y: 200, w: 40, h: 800 },                                      // East boundary
            { x: 1000, y: 960, w: 350, h: 40 }, { x: 1450, y: 960, w: 350, h: 40 },   // dividing South wall

            // --- ROOM 2: COMMERCIAL SECTOR EAST WALLS ---
            { x: 1800, y: 1000, w: 800, h: 40 },                                      // North boundary
            { x: 1800, y: 1760, w: 800, h: 40 },                                      // South boundary
            { x: 1800, y: 1000, w: 40, h: 350 }, { x: 1800, y: 1450, w: 40, h: 350 }, // dividing West wall
            { x: 2560, y: 1000, w: 40, h: 350 }, { x: 2560, y: 1450, w: 40, h: 350 }, // Exterior East wall (split for window)

            // --- ROOM 3: MEDICAL CENTER WEST WALLS ---
            { x: 200, y: 1000, w: 800, h: 40 },                                       // North boundary
            { x: 200, y: 1760, w: 800, h: 40 },                                       // South boundary
            { x: 200, y: 1000, w: 40, h: 350 }, { x: 200, y: 1450, w: 40, h: 350 },   // Exterior West wall (split for window)
            { x: 960, y: 1000, w: 40, h: 350 }, { x: 960, y: 1450, w: 40, h: 350 },   // dividing East wall

            // --- ROOM 4: SAFEHOUSE ALLEY SOUTH WALLS ---
            { x: 1000, y: 1800, w: 350, h: 40 }, { x: 1450, y: 1800, w: 350, h: 40 }, // dividing North wall
            { x: 1000, y: 1800, w: 40, h: 800 },                                      // West boundary
            { x: 1760, y: 1800, w: 40, h: 800 },                                      // East boundary
            { x: 1000, y: 2560, w: 350, h: 40 }, { x: 1450, y: 2560, w: 350, h: 40 }  // Exterior South wall (split for window)
        ],
        windows: [
            // Peripheral barricade entry windows wrapping around outer streets
            { x: 1350, y: 200, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 1400, entryY: 100 },   // North street outer window
            { x: 2560, y: 1350, w: 40, h: 100, boards: 6, max: 6, orientation: 'V', entryX: 2660, entryY: 1400 }, // East street outer window
            { x: 200, y: 1350, w: 40, h: 100, boards: 6, max: 6, orientation: 'V', entryX: 100, entryY: 1400 },  // West street outer window
            { x: 1350, y: 2560, w: 100, h: 40, boards: 6, max: 6, orientation: 'H', entryX: 1400, entryY: 2660 }  // South street outer window
        ],
        furniture: [
            // Urban barriers/crates scattered around the plaza and buildings for pathfinding layouts
            { x: 1350, y: 1350, w: 100, h: 100, color: "#333" }, // Central Plaza monument
            { x: 1200, y: 400, w: 80, h: 150, color: "#111" },   // Overturned city bus
            { x: 2100, y: 1200, w: 120, h: 60, color: "#222" },  // Commercial counter desk
            { x: 400, y: 1500, w: 150, h: 60, color: "#222" },   // Triage medical tables
            { x: 1500, y: 2100, w: 60, h: 140, color: "#444" }   // Alleyway dumpster blockades
        ],
        interactables: [
            // Abundant layout of buy options across all city blocks
            { x: 1380, y: 1100, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Model 1911" },
            { x: 1380, y: 1650, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Olympus" },
            { x: 1100, y: 400, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP-Retro" },
            { x: 2300, y: 1100, w: 40, h: 40, type: 'WALLBUY', price: 1200, label: "Enforcer" },
            { x: 400, y: 1100, w: 40, h: 40, type: 'WALLBUY', price: 1500, label: "Galilee" },
            { x: 1100, y: 2300, w: 40, h: 40, type: 'WALLBUY', price: 2000, label: "LMG-21" },
            { x: 1600, y: 2300, w: 40, h: 40, type: 'WALLBUY', price: 2000, label: "Bazooka" },
            { x: 1480, y: 1370, w: 60, h: 60, type: 'BOX', price: 950, color: '#8e44ad', label: "?" },
            { x: 1375, y: 1950, w: 50, h: 50, type: 'PERK', price: 2500, color: '#c0392b', label: "VIG" }
        ],
        spawnPoints: [
            { x: 1400, y: 50, roomId: 1 },    // Spawn outside North building
            { x: 2700, y: 1400, roomId: 2 },  // Spawn outside East building
            { x: 50, y: 1400, roomId: 3 },    // Spawn outside West building
            { x: 1400, y: 2750, roomId: 4 }   // Spawn outside South building
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
        { x: 580, y: 60, w: 40, h: 40, type: 'WALLBUY', price: 0, label: "Olympus" }
    ],
    spawnPoints: [
        { x: 1050, y: 450, roomId: 2 }
    ]
};