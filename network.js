/* --- NETWORKING MODULE --- */
if (!window.lobbyPlayers) {
    window.lobbyPlayers = { p1: "Survivor", p2: "", p3: "", p4: "" };
}
if (!window.myPlayerId) {
    window.myPlayerId = "p1"; // Default for host/offline
}

const Network = {
    peer: null,
    conns: [], // Host: Stores up to 3 guest connections (P2, P3, P4)
    conn: null, // Client: Single connection back to the host
    mode: 'OFFLINE', 
    lastUpdate: 0,
    lastClientUpdate: 0, // Throttle client-to-host payloads
    
    init: function(onOpen) {
        // Provider 1: Metered.ca Credentials
        const METERED_USER = "ec41d9c5a5a8f7a1a1b19e9e";
        const METERED_PASS = "rzCBD4AfbDn7JjG8";

        // Provider 2: ExpressTURN Credentials
        const EXPRESSTURN_USER = "000000002095335910";
        const EXPRESSTURN_PASS = "GK3y4yS5fDUutl+1ITp1BTxZgR4=";

        this.peer = new Peer(undefined, { 
            debug: 1,
            config: {
                iceServers: [
                    // --- STUN SERVERS (Discovery) ---
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' },
                    { urls: 'stun:stun.relay.metered.ca:80' },
                    { urls: 'stun:free.expressturn.com:3478' },
                    
                    // --- TURN SERVER GROUP 1: METERED.CA ---
                    { 
                        urls: 'turn:global.relay.metered.ca:80', 
                        username: METERED_USER, 
                        credential: METERED_PASS 
                    },
                    { 
                        urls: 'turn:global.relay.metered.ca:80?transport=tcp', 
                        username: METERED_USER, 
                        credential: METERED_PASS 
                    },
                    { 
                        urls: 'turn:global.relay.metered.ca:443', 
                        username: METERED_USER, 
                        credential: METERED_PASS 
                    },
                    { 
                        urls: 'turns:global.relay.metered.ca:443?transport=tcp', 
                        username: METERED_USER, 
                        credential: METERED_PASS 
                    },

                    // --- TURN SERVER GROUP 2: EXPRESSTURN (Automatic Failover) ---
                    { 
                        urls: 'turn:free.expressturn.com:3478', 
                        username: EXPRESSTURN_USER, 
                        credential: EXPRESSTURN_PASS 
                    },
                    { 
                        urls: 'turn:free.expressturn.com:3478?transport=tcp', 
                        username: EXPRESSTURN_USER, 
                        credential: EXPRESSTURN_PASS 
                    }
                ]
            }
        });

        // Global Signaling Error Boundary
        this.peer.on('error', (err) => {
            console.warn("PeerJS global error caught gracefully:", err);
        });

        this.peer.on('open', (id) => { onOpen(id); });
        this.peer.on('connection', (c) => {
            if (this.conns.length >= 3) {
                setTimeout(() => {
                    try { c.close(); } catch(e) {}
                }, 500);
                return;
            }
            this.conns.push(c);
            this.setupHostConnection(c);
        });
    },

    join: function(hostId, onConnected) {
        this.mode = 'CLIENT';
        // Connect in reliable mode with queue mitigations
        this.conn = this.peer.connect(hostId, {
            reliable: true,
            serialization: 'json'
        });

        // Connection Error Boundary
        this.conn.on('error', (err) => {
            console.warn("Client data channel error caught gracefully:", err);
        });

        this.conn.on('open', () => {
            if(onConnected) onConnected();
            this.setupClient();
            
            try {
                this.conn.send({ type: 'JOIN_LOBBY', name: myUsername });
            } catch (e) {
                console.warn("Failed to send JOIN_LOBBY packet:", e);
            }
        });
    },

    /* --- HOST MULTI-CONNECTION LOGIC --- */
    setupHostConnection: function(c) {
        // Assign and immediately reserve slot to prevent race conditions on parallel joining
        let assignedId = "";
        if (!window.lobbyPlayers.p2 || window.lobbyPlayers.p2 === "Reserved") { assignedId = "p2"; }
        else if (!window.lobbyPlayers.p3 || window.lobbyPlayers.p3 === "Reserved") { assignedId = "p3"; }
        else if (!window.lobbyPlayers.p4 || window.lobbyPlayers.p4 === "Reserved") { assignedId = "p4"; }
        else {
            try { c.close(); } catch(e) {}
            return;
        }
        
        c.playerId = assignedId;
        window.lobbyPlayers[assignedId] = "Reserved";

        // Error boundary for this client connection
        c.on('error', (err) => {
            console.warn(`Host Connection Error for ${c.playerId} caught gracefully:`, err);
        });

        c.on('data', (data) => {
            if (data.type === 'JOIN_LOBBY') {
                window.lobbyPlayers[c.playerId] = data.name || ("Player " + c.playerId.substring(1));
                if (typeof updateLobbyPlayersList === 'function') updateLobbyPlayersList();
                if (typeof updateLobbyUI === 'function') updateLobbyUI(true);
                
                try {
                    c.send({
                        type: 'LOBBY_WELCOME',
                        name: myUsername,
                        mapIndex: stats.selectedMapIdx,
                        assignedId: c.playerId,
                        lobbyPlayers: window.lobbyPlayers,
                        difficulty: stats.difficulty || 'medium' // Propagate lobby difficulty settings on join handshake
                    });
                } catch(e) {
                    console.warn("Failed to send LOBBY_WELCOME:", e);
                }

                this.broadcastToAll({
                    type: 'LOBBY_UPDATE',
                    lobbyPlayers: window.lobbyPlayers
                });
            }
            else if(data.type === 'P_DATA') {
                const p = players[c.playerId];
                if (p) {
                    p.serverX = data.x;
                    p.serverY = data.y;
                    p.angle = data.angle;
                    
                    if(data.name) p.name = data.name;
                    p.isShooting = data.shoot; 
                    if (data.reload) p.triggerReload = true;
                }
            }
            else if(data.type === 'INTERACT') {
                const p = players[c.playerId];
                if (p) p.triggerInteract = true;
            }
        });
        
        c.on('close', () => {
            console.log(c.playerId + " Disconnected");
            window.lobbyPlayers[c.playerId] = "";
            this.conns = this.conns.filter(conn => conn !== c);

            if (typeof updateLobbyPlayersList === 'function') updateLobbyPlayersList();
            
            this.broadcastToAll({
                type: 'LOBBY_UPDATE',
                lobbyPlayers: window.lobbyPlayers
            });

            if (typeof updateLobbyUI === 'function') {
                const activeGuests = Object.values(window.lobbyPlayers).slice(1).some(name => name !== "" && name !== "Reserved");
                if (!activeGuests) {
                    const startBtn = document.getElementById('start-btn');
                    if (startBtn) {
                        startBtn.disabled = true;
                        startBtn.style.background = '#1a1a1a';
                    }
                    const statusEl = document.getElementById('lobby-status');
                    if (statusEl) {
                        statusEl.innerText = "Waiting for players...";
                        statusEl.style.color = "#fff";
                    }
                }
            }

            if(players[c.playerId]) {
                delete players[c.playerId]; 
                texts.push({x: players['p1'].x, y: players['p1'].y, text: c.playerId.toUpperCase() + " LEFT", color: "#f00", life: 120});
            }
        });
    },

    broadcastToAll: function(data) {
        this.conns.forEach(c => {
            if (c && c.open) {
                try {
                    c.send(data);
                } catch (e) {
                    console.warn(`Failed to broadcast packet to ${c.playerId || "unknown guest"}:`, e);
                }
            }
        });
    },

    broadcastState: function() {
        const now = Date.now();
        if(now - this.lastUpdate < 45) return; 
        this.lastUpdate = now;

        // Build the pruned state payload ONCE to save CPU cycles
        const statePayload = {
            type: 'GAME_STATE',
            p1: getPrunedPlayer(players['p1']), 
            p2: getPrunedPlayer(players['p2']), 
            p3: getPrunedPlayer(players['p3']), 
            p4: getPrunedPlayer(players['p4']), 
            zombies: zombies.map(z => ({ id: z.id, x: z.x, y: z.y, hp: z.hp, maxHp: z.maxHp })), 
            // Sync bullet type across network so guest clients can render explosives
            bullets: bullets.map(b => ({ x: b.x, y: b.y, color: b.color, type: b.type })),
            stats: stats,
            windows: activeMap.windows.map(w => ({ boards: w.boards })),
            doors: activeMap.rooms.map(r => ({ unlocked: r.unlocked }))
        };

        this.conns.forEach(c => {
            if (c && c.open) {
                try {
                    const dc = c._dc || c.dataChannel;
                    if (dc && dc.bufferedAmount > 65536) {
                        return; 
                    }
                    c.send(statePayload);
                } catch(e) {
                    console.warn(`Failed to send state payload to ${c.playerId || "unknown guest"}:`, e);
                }
            }
        });
    },

    broadcastGameOver: function(finalStats) {
        this.broadcastToAll({ type: 'GAME_OVER', stats: finalStats });
    },

    /* --- CLIENT LOGIC --- */
    setupClient: function() {
        this.conn.on('data', (data) => {
            if (data.type === 'LOBBY_WELCOME') {
                window.myPlayerId = data.assignedId;
                window.lobbyPlayers = data.lobbyPlayers;
                stats.selectedMapIdx = data.mapIndex;
                stats.difficulty = data.difficulty || 'medium'; // Sync Host selected difficulty configuration
                
                if (typeof updateLobbyPlayersList === 'function') updateLobbyPlayersList();
                
                const mapDisplay = document.getElementById('lobby-map-display-client');
                if (mapDisplay) {
                    const mapName = (typeof playableMaps !== 'undefined' && playableMaps[data.mapIndex]) ? playableMaps[data.mapIndex].name : "Unknown Map";
                    mapDisplay.innerText = mapName;
                }
                const diffDisplay = document.getElementById('lobby-diff-display-client');
                if (diffDisplay) {
                    diffDisplay.innerText = "Difficulty: " + capitalizeFirstLetter(stats.difficulty);
                }
                
                document.getElementById('lobby-status').innerText = "Connected! Ready to play.";
                document.getElementById('lobby-status').style.color = "#0f0";
            }
            else if (data.type === 'LOBBY_UPDATE') {
                window.lobbyPlayers = data.lobbyPlayers;
                if (typeof updateLobbyPlayersList === 'function') updateLobbyPlayersList();
            }
            else if (data.type === 'LOBBY_MAP_CHANGE') {
                stats.selectedMapIdx = data.mapIndex;
                const mapDisplay = document.getElementById('lobby-map-display-client');
                if (mapDisplay) {
                    const mapName = (typeof playableMaps !== 'undefined' && playableMaps[data.mapIndex]) ? playableMaps[data.mapIndex].name : "Unknown Map";
                    mapDisplay.innerText = mapName;
                }
            }
            else if (data.type === 'LOBBY_DIFF_CHANGE') {
                stats.difficulty = data.difficulty || 'medium';
                const diffDisplay = document.getElementById('lobby-diff-display-client');
                if (diffDisplay) {
                    diffDisplay.innerText = "Difficulty: " + capitalizeFirstLetter(stats.difficulty);
                }
            }
            else if (data.type === 'RETURN_TO_LOBBY') {
                if (typeof goToLobbyScreen === 'function') {
                    goToLobbyScreen();
                }
            }
            else if(data.type === 'START') {
                if (data.mapIndex !== undefined && typeof playableMaps !== 'undefined') {
                    activeMap = playableMaps[data.mapIndex];
                }
                launchGame();
            }
            else if(data.type === 'GAME_STATE') {
                const serverZombies = data.zombies || [];
                const serverMap = new Map();
                
                serverZombies.forEach(sz => {
                    serverMap.set(sz.id, sz);
                    const local = zombies.find(z => z.id === sz.id);
                    if(local) {
                        // Spawn blood particles and stains locally on damage detection [1]
                        if (local.hp > sz.hp && typeof spawnParticles === 'function') {
                            spawnParticles(local.x, local.y, '#800', 3);

                            if (window.bloodStains && Math.random() < 0.45) {
                                window.bloodStains.push({
                                    x: local.x + (Math.random() - 0.5) * 12,
                                    y: local.y + (Math.random() - 0.5) * 12,
                                    r: 4 + Math.random() * 12,
                                    color: 'rgba(139, 0, 0, ' + (0.3 + Math.random() * 0.35) + ')'
                                });
                                if (window.bloodStains.length > 150) window.bloodStains.shift();
                            }
                        }
                        local.serverX = sz.x;
                        local.serverY = sz.y;
                        local.hp = sz.hp; 
                        local.maxHp = sz.maxHp;
                    } else {
                        // Add new zombie
                        zombies.push({
                            id: sz.id,
                            x: sz.x,
                            y: sz.y,
                            hp: sz.hp,
                            maxHp: sz.maxHp,
                            serverX: sz.x,
                            serverY: sz.y,
                            r: 16
                        });
                    }
                });
                
                for(let i = zombies.length - 1; i >= 0; i--) {
                    if(!serverMap.has(zombies[i].id)) zombies.splice(i, 1);
                }

                // COMPARE BULLETS & TRIGGERS LOCAL CLIENT EXPLOSIONS / SPARKS [1]
                const incomingBullets = data.bullets || [];
                const prevBullets = bullets || [];
                const nextKeys = incomingBullets.map(b => b.x + "_" + b.y);
                
                prevBullets.forEach(eb => {
                    const key = eb.x + "_" + eb.y;
                    if (!nextKeys.includes(key)) {
                        if (eb.type === 'explosive') {
                            if (typeof spawnExplosionVisuals === 'function') {
                                spawnExplosionVisuals(eb.x, eb.y);
                            }
                        } else {
                            if (typeof spawnSparks === 'function' && typeof RoomSystem !== 'undefined' && RoomSystem.checkCollision(eb.x, eb.y, false)) {
                                spawnSparks(eb.x, eb.y);
                            }
                        }
                    }
                });

                bullets = incomingBullets;
                
                // Spawn local point indicators (+10 / +50 text) locally when score increases
                if (data.stats && stats) {
                    if (data.stats.score > stats.score) {
                        let diff = data.stats.score - stats.score;
                        if (typeof addText === 'function') {
                            addText(me.x, me.y, "+" + diff, "#ff0");
                        }
                    }
                }
                
                stats = data.stats;

                // Sync positions and properties of all players from Host broadcast
                ['p1', 'p2', 'p3', 'p4'].forEach(pId => {
                    if (pId === window.myPlayerId) {
                        const fallbackPId = data[pId];
                        if (fallbackPId && me) {
                            let myAngle = me.angle;
                            let myX = me.x;
                            let myY = me.y;
                            
                            // Teleport Client on respawn
                            if (me.state === 'DOWNED' && fallbackPId.state === 'ALIVE') {
                                const spawnSource = data.p1;
                                if (spawnSource) {
                                    myX = spawnSource.x;
                                    myY = spawnSource.y;
                                }
                            }
                            
                            // Eject spinning shells locally on ammo depletion [1]
                            if (fallbackPId.clip < (me.clip !== undefined ? me.clip : 8)) {
                                if (typeof spawnShellCasing === 'function') {
                                    spawnShellCasing(me.x, me.y, me.angle);
                                }
                            }

                            // Safe dynamic local inventory synchronization
                            if (fallbackPId.gunName) {
                                syncPlayerInventory(me, fallbackPId.weapIdx, fallbackPId.gunName);
                            }

                            Object.assign(me, fallbackPId);
                            me.angle = myAngle; 
                            me.x = myX;
                            me.y = myY;

                            me.gunName = fallbackPId.gunName !== undefined ? fallbackPId.gunName : "M1911";
                            me.gunColor = fallbackPId.gunColor !== undefined ? fallbackPId.gunColor : "#999";
                            me.clip = fallbackPId.clip !== undefined ? fallbackPId.clip : 8;
                            me.ammo = fallbackPId.ammo !== undefined ? fallbackPId.ammo : 32;
                        }
                    } else {
                        if (data[pId]) {
                            if (!players[pId]) {
                                players[pId] = createPlayer(pId, data[pId].x, data[pId].y, getPlayerColor(pId), data[pId].name);
                            }
                            const p = players[pId];

                            // Eject spinning shells locally for other players on ammo depletion [1]
                            if (p && data[pId].clip < (p.clip !== undefined ? p.clip : 8)) {
                                if (typeof spawnShellCasing === 'function') {
                                    spawnShellCasing(p.x, p.y, p.angle);
                                }
                            }

                            // Safe dynamic other players inventory synchronization
                            if (data[pId].gunName) {
                                syncPlayerInventory(p, data[pId].weapIdx, data[pId].gunName);
                            }

                            p.serverX = data[pId].x !== undefined ? data[pId].x : p.x;
                            p.serverY = data[pId].y !== undefined ? data[pId].y : p.y;
                            p.angle = data[pId].angle !== undefined ? data[pId].angle : p.angle;
                            p.hp = data[pId].hp !== undefined ? data[pId].hp : p.hp;
                            p.score = data[pId].score !== undefined ? data[pId].score : p.score;
                            p.state = data[pId].state !== undefined ? data[pId].state : p.state;
                            p.hasJug = data[pId].hasJug !== undefined ? data[pId].hasJug : p.hasJug;
                            p.reloading = data[pId].reloading !== undefined ? data[pId].reloading : p.reloading;
                            p.weapIdx = data[pId].weapIdx !== undefined ? data[pId].weapIdx : p.weapIdx;
                            p.name = data[pId].name !== undefined ? data[pId].name : p.name;
                            p.gunName = data[pId].gunName !== undefined ? data[pId].gunName : "M1911";
                            p.gunColor = data[pId].gunColor !== undefined ? data[pId].gunColor : "#999";
                            p.clip = data[pId].clip !== undefined ? data[pId].clip : 8;
                            p.ammo = data[pId].ammo !== undefined ? data[pId].ammo : 32;
                        } else {
                            if (players[pId]) delete players[pId];
                        }
                    }
                });

                data.windows.forEach((wData, i) => { if(activeMap.windows[i]) activeMap.windows[i].boards = wData.boards; });
                data.doors.forEach((dData, i) => { if(activeMap.rooms[i]) activeMap.rooms[i].unlocked = dData.unlocked; });
            }
            else if(data.type === 'GAME_OVER') {
                stats = { ...stats, ...data.stats };
                gameOver();
            }
        });

        this.conn.on('close', () => {
            alert("Host Disconnected");
            location.reload(); 
        });
    },

    sendClientData: function(p) {
        // Throttle client send ticks to prevent network buffer overflow
        const now = Date.now();
        if (now - this.lastClientUpdate < 45) return;
        this.lastClientUpdate = now;

        if(this.conn && this.conn.open) {
            try {
                this.conn.send({
                    type: 'P_DATA',
                    x: p.x, y: p.y, angle: p.angle,
                    shoot: mouse.down,
                    reload: p.reloading,
                    name: p.name
                });
            } catch (e) {
                console.warn("Failed to send client data payload:", e);
            }
        }
    },

    sendInteract: function() {
        if(this.conn && this.conn.open) {
            try {
                this.conn.send({ type: 'INTERACT' });
            } catch(e) {
                console.warn("Failed to send INTERACT command:", e);
            }
        }
    }
};

function getPlayerColor(id) {
    if (id === 'p1') return '#3498db'; // Blue
    if (id === 'p2') return '#e67e22'; // Orange
    if (id === 'p3') return '#2ecc71'; // Green
    return '#9b59b6'; // Purple (p4)
}

// Pruning routine to strip bulky database properties from networked updates
function getPrunedPlayer(p) {
    if (!p) return null;
    const activeGun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null;
    return {
        x: p.x,
        y: p.y,
        angle: p.angle,
        hp: p.hp,
        score: p.score,
        state: p.state,
        hasJug: p.hasJug,
        reloading: p.reloading,
        weapIdx: p.weapIdx,
        clip: activeGun ? activeGun.clip : 0,
        ammo: activeGun ? activeGun.ammo : 0,
        gunName: activeGun ? activeGun.name : "M1911",
        gunColor: activeGun ? activeGun.color : "#999",
        name: p.name
    };
}

// Dynamically auto-populates client player models with missing purchased weapons
function syncPlayerInventory(p, serverWeapIdx, serverGunName) {
    if (!p || !p.inventory || !serverGunName) return;
    
    // Check if player has this weapon in their local inventory array
    const hasWeapon = p.inventory.some(w => w.name === serverGunName);
    if (!hasWeapon) {
        const b = weaponDB.find(w => w.name === serverGunName);
        if (b) {
            p.inventory.push({ ...b, clip: b.mag, ammo: b.reserve });
        }
    }
    
    // Set weapons index safely based on its local inventory position
    const targetIdx = p.inventory.findIndex(w => w.name === serverGunName);
    if (targetIdx !== -1) {
        p.weapIdx = targetIdx;
    } else {
        p.weapIdx = 0; // Fallback to starting pistol
    }
}

function capitalizeFirstLetter(string) {
    if (!string) return "Medium";
    return string.charAt(0).toUpperCase() + string.slice(1);
}