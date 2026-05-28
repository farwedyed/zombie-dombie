/* --- NETWORKING MODULE --- */
if (!window.lobbyPlayers) {
    window.lobbyPlayers = { host: "", guest: "" };
}

const Network = {
    peer: null,
    conn: null,
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
            this.conn = c;
            this.setupHost();
        });
    },

    join: function(hostId, onConnected) {
        this.mode = 'CLIENT';
        // Connect in unreliable mode (UDP semantics) for gaming-grade latency
        this.conn = this.peer.connect(hostId, {
            reliable: false,
            serialization: 'json'
        });
        this.conn.on('open', () => {
            if(onConnected) onConnected();
            this.setupClient();
            // Send client's username to the host immediately
            this.conn.send({ type: 'JOIN_LOBBY', name: myUsername });
        });
    },

    /* --- HOST LOGIC --- */
    setupHost: function() {
        this.conn.on('data', (data) => {
            if (data.type === 'JOIN_LOBBY') {
                window.lobbyPlayers.guest = data.name || "Player 2";
                if (typeof updateLobbyPlayersList === 'function') updateLobbyPlayersList();
                if (typeof updateLobbyUI === 'function') updateLobbyUI(true);
                
                // Welcome the client and synchronize lobby parameters
                this.conn.send({
                    type: 'LOBBY_WELCOME',
                    name: myUsername,
                    mapIndex: stats.selectedMapIdx
                });
            }
            else if(data.type === 'P2_DATA' && players['p2']) {
                players['p2'].x = data.x;
                players['p2'].y = data.y;
                players['p2'].angle = data.angle;
                
                // --- SYNC NAME ---
                if(data.name) players['p2'].name = data.name;

                if(data.shoot) players['p2'].triggerShoot = true;
                if(data.reload) players['p2'].triggerReload = true;
            }
            else if(data.type === 'INTERACT' && players['p2']) {
                players['p2'].triggerInteract = true;
            }
        });
        
        this.conn.on('close', () => {
            console.log("Player 2 Disconnected");
            window.lobbyPlayers.guest = "Disconnected";
            if (typeof updateLobbyPlayersList === 'function') updateLobbyPlayersList();
            
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

            if(players['p2']) {
                delete players['p2']; 
                texts.push({x: players['p1'].x, y: players['p1'].y, text: "P2 LEFT", color: "#f00", life: 120});
            }
        });
    },

    broadcastState: function() {
        const now = Date.now();
        if(now - this.lastUpdate < 30) return; 
        this.lastUpdate = now;

        if(this.conn && this.conn.open) {
            this.conn.send({
                type: 'GAME_STATE',
                p1: players['p1'], 
                p2: players['p2'], 
                // Only serialize the necessary keys to compress network packet size
                zombies: zombies.map(z => ({ id: z.id, x: z.x, y: z.y, hp: z.hp, maxHp: z.maxHp })), 
                bullets: bullets.map(b => ({ x: b.x, y: b.y, color: b.color })),
                stats: stats,
                // Removed redundant texts and particles serialization arrays (handled locally now)
                windows: activeMap.windows.map(w => ({ boards: w.boards })),
                doors: activeMap.rooms.map(r => ({ unlocked: r.unlocked }))
            });
        }
    },

    broadcastGameOver: function(finalStats) {
        if(this.conn && this.conn.open) {
            this.conn.send({ type: 'GAME_OVER', stats: finalStats });
        }
    },

    /* --- CLIENT LOGIC --- */
    setupClient: function() {
        this.conn.on('data', (data) => {
            if (data.type === 'LOBBY_WELCOME') {
                window.lobbyPlayers.host = data.name || "Host";
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
                        // Spawn blood particles locally if zombie takes damage (avoids network overhead)
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

                if(players['p1']) players['p1'] = data.p1;
                
                if(me && players['p2'] && data.p2) {
                    let myAngle = me.angle;
                    Object.assign(me, data.p2);
                    me.angle = myAngle; 
                }

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
        // Throttle client send ticks to prevent network buffer overflow
        const now = Date.now();
        if (now - this.lastClientUpdate < 30) return;
        this.lastClientUpdate = now;

        if(this.conn && this.conn.open) {
            this.conn.send({
                type: 'P2_DATA',
                name: p.name, 
                x: p.x, y: p.y, angle: p.angle,
                shoot: mouse.down,
                reload: p.reloading
            });
        }
    },

    sendInteract: function() {
        if(this.conn && this.conn.open) {
            this.conn.send({ type: 'INTERACT' });
        }
    }
};