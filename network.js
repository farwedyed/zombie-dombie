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

        this.peer.on('open', (id) => { onOpen(id); });
        this.peer.on('connection', (c) => {
            if (this.conns.length >= 3) {
                // Lobby full
                setTimeout(() => c.close(), 500);
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
        this.conn.on('open', () => {
            if(onConnected) onConnected();
            this.setupClient();
            // Send client's username to the host immediately
            this.conn.send({ type: 'JOIN_LOBBY', name: myUsername });
        });
    },

    /* --- HOST MULTI-CONNECTION LOGIC --- */
    setupHostConnection: function(c) {
        // Assign a free player slot (p2, p3, or p4)
        let assignedId = "";
        if (!window.lobbyPlayers.p2) { assignedId = "p2"; }
        else if (!window.lobbyPlayers.p3) { assignedId = "p3"; }
        else if (!window.lobbyPlayers.p4) { assignedId = "p4"; }
        else {
            c.close();
            return;
        }
        c.playerId = assignedId;

        c.on('data', (data) => {
            if (data.type === 'JOIN_LOBBY') {
                window.lobbyPlayers[c.playerId] = data.name || ("Player " + c.playerId.substring(1));
                if (typeof updateLobbyPlayersList === 'function') updateLobbyPlayersList();
                if (typeof updateLobbyUI === 'function') updateLobbyUI(true);
                
                // Welcome client with their assigned slot ID and current lobby states
                c.send({
                    type: 'LOBBY_WELCOME',
                    name: myUsername,
                    mapIndex: stats.selectedMapIdx,
                    assignedId: c.playerId,
                    lobbyPlayers: window.lobbyPlayers
                });

                // Propagate the updated player list to all other connected clients
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
                    if(data.shoot) p.triggerShoot = true;
                    if(data.reload) p.triggerReload = true;
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
            
            // Notify other clients of disconnect
            this.broadcastToAll({
                type: 'LOBBY_UPDATE',
                lobbyPlayers: window.lobbyPlayers
            });

            if (typeof updateLobbyUI === 'function') {
                // If everyone leaves, update lobby status
                const activeGuests = Object.values(window.lobbyPlayers).slice(1).some(name => name !== "");
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
                c.send(data);
            }
        });
    },

    broadcastState: function() {
        const now = Date.now();
        if(now - this.lastUpdate < 45) return; // Throttled to 22 updates/sec

        // Congestion control check: if any WebRTC data buffer is clogged, drop frame
        let congested = false;
        this.conns.forEach(c => {
            const dc = c._dc || c.dataChannel;
            if (dc && dc.bufferedAmount > 65536) congested = true;
        });
        if (congested) return;
        this.lastUpdate = now;

        if(this.conns.length > 0) {
            this.broadcastToAll({
                type: 'GAME_STATE',
                p1: players['p1'], 
                p2: players['p2'], 
                p3: players['p3'], 
                p4: players['p4'], 
                zombies: zombies.map(z => ({ id: z.id, x: z.x, y: z.y, hp: z.hp, maxHp: z.maxHp })), 
                bullets: bullets.map(b => ({ x: b.x, y: b.y, color: b.color })),
                stats: stats,
                windows: activeMap.windows.map(w => ({ boards: w.boards })),
                doors: activeMap.rooms.map(r => ({ unlocked: r.unlocked }))
            });
        }
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
                if (typeof updateLobbyPlayersList === 'function') updateLobbyPlayersList();
                
                const mapDisplay = document.getElementById('lobby-map-display-client');
                if (mapDisplay) {
                    const mapName = (typeof playableMaps !== 'undefined' && playableMaps[data.mapIndex]) ? playableMaps[data.mapIndex].name : "Unknown Map";
                    mapDisplay.innerText = mapName;
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
                        // Spawn blood particles locally on damage detection
                        if (local.hp > sz.hp && typeof spawnParticles === 'function') {
                            spawnParticles(local.x, local.y, '#800', 3);
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

                bullets = data.bullets || [];
                
                // Spawn local point indicators (+10 / +60 text) locally when score increases
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
                        // Keep prediction local coordinates for yourself, avoiding snaps
                        if (data[pId] && me) {
                            let myAngle = me.angle;
                            let myX = me.x;
                            let myY = me.y;
                            
                            // Teleport Client on respawn
                            if (me.state === 'DOWNED' && data[pId].state === 'ALIVE') {
                                const spawnSource = data.p1;
                                if (spawnSource) {
                                    myX = spawnSource.x;
                                    myY = spawnSource.y;
                                }
                            }
                            
                            Object.assign(me, data[pId]);
                            me.angle = myAngle; 
                            me.x = myX;
                            me.y = myY;
                        }
                    } else {
                        // Update target coordinates for LERPing of other survivors
                        if (data[pId]) {
                            if (!players[pId]) {
                                players[pId] = createPlayer(pId, data[pId].x, data[pId].y, getPlayerColor(pId), data[pId].name);
                            }
                            const p = players[pId];
                            p.serverX = data[pId].x;
                            p.serverY = data[pId].y;
                            p.angle = data[pId].angle;
                            p.hp = data[pId].hp;
                            p.score = data[pId].score;
                            p.state = data[pId].state;
                            p.hasJug = data[pId].hasJug;
                            p.reloading = data[pId].reloading;
                            p.weapIdx = data[pId].weapIdx;
                            p.inventory = data[pId].inventory;
                            p.name = data[pId].name;
                        } else {
                            if (players[pId]) delete players[pId];
                        }
                    }
                });

                data.windows.forEach((wData, i) => { if(activeMap.windows[i]) activeMap.windows[i].boards = wData.boards; });
                data.doors.forEach((dData, i) => { if(activeMap.rooms[i]) activeMap.rooms[i].unlocked = dData.unlocked; });
            }
            else if(data.type === 'GAME_OVER') {
                stats = data.stats;
                gameOver();
            }
        });

        this.conn.on('close', () => {
            alert("Host Disconnected");
            location.reload(); 
        });
    },

    sendClientData: function(p) {
        const now = Date.now();
        if (now - this.lastClientUpdate < 45) return;
        this.lastClientUpdate = now;

        if(this.conn && this.conn.open) {
            this.conn.send({
                type: 'P_DATA',
                x: p.x, y: p.y, angle: p.angle,
                shoot: mouse.down,
                reload: p.reloading,
                name: p.name
            });
        }
    },

    sendInteract: function() {
        if(this.conn && this.conn.open) {
            this.conn.send({ type: 'INTERACT' });
        }
    }
};

function getPlayerColor(id) {
    if (id === 'p1') return '#3498db'; // Blue
    if (id === 'p2') return '#e67e22'; // Orange
    if (id === 'p3') return '#2ecc71'; // Green
    return '#9b59b6'; // Purple (p4)
}