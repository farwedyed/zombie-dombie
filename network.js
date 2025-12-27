/* --- NETWORKING MODULE --- */
const Network = {
    peer: null,
    conn: null,
    mode: 'OFFLINE', 
    lastUpdate: 0,
    
    init: function(onOpen) {
        // 1. Keep STUN servers (Critical for finding each other)
        this.peer = new Peer(null, { 
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (id) => { onOpen(id); });
        
        this.peer.on('connection', (c) => {
            this.conn = c;
            this.conn.on('open', () => {
                this.setupHost();
            });
        });

        this.peer.on('error', (err) => { console.error(err); });
    },

    join: function(hostId, onConnected) {
        this.mode = 'CLIENT';
        
        // 2. USE 'none' TO BYPASS PEERJS SERIALIZATION BUGS
        this.conn = this.peer.connect(hostId, {
            serialization: 'none'
        });

        this.conn.on('open', () => {
            if(onConnected) onConnected();
            this.setupClient();
        });

        this.conn.on('error', (err) => { console.error("Connection Error:", err); });
    },

    /* --- HOST LOGIC --- */
    setupHost: function() {
        this.conn.on('data', (rawData) => {
            // 3. FIX: MANUALLY PARSE DATA
            const data = JSON.parse(rawData);

            if(data.type === 'P2_DATA' && players['p2']) {
                players['p2'].x = data.x;
                players['p2'].y = data.y;
                players['p2'].angle = data.angle;
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
            if(players['p2']) {
                delete players['p2']; 
                texts.push({x: players['p1'].x, y: players['p1'].y, text: "P2 LEFT", color: "#f00", life: 120});
            }
        });

        if(typeof updateLobbyUI === 'function') updateLobbyUI(true);
    },

    broadcastState: function() {
        const now = Date.now();
        if(now - this.lastUpdate < 30) return; 
        this.lastUpdate = now;

        if(this.conn && this.conn.open) {
            // 4. FIX: MANUALLY STRINGIFY DATA
            const payload = JSON.stringify({
                type: 'GAME_STATE',
                p1: players['p1'], 
                p2: players['p2'], 
                zombies: zombies, 
                bullets: bullets,
                stats: stats,
                texts: texts, 
                particles: particles, 
                windows: mapData.windows.map(w => ({ boards: w.boards })),
                doors: mapData.rooms.map(r => ({ unlocked: r.unlocked }))
            });
            this.conn.send(payload);
        }
    },

    broadcastGameOver: function(finalStats) {
        if(this.conn && this.conn.open) {
            // 5. FIX: MANUALLY STRINGIFY
            this.conn.send(JSON.stringify({ type: 'GAME_OVER', stats: finalStats }));
        }
    },

    /* --- CLIENT LOGIC --- */
    setupClient: function() {
        this.conn.on('data', (rawData) => {
            // 6. FIX: MANUALLY PARSE DATA
            const data = JSON.parse(rawData);

            if(data.type === 'START') {
                launchGame();
            }
            else if(data.type === 'GAME_STATE') {
                const serverZombies = data.zombies || [];
                const serverMap = new Map();
                serverZombies.forEach(sz => {
                    serverMap.set(sz.id, sz);
                    const local = zombies.find(z => z.id === sz.id);
                    if(local) {
                        local.serverX = sz.x;
                        local.serverY = sz.y;
                        local.hp = sz.hp; 
                    } else {
                        sz.serverX = sz.x;
                        sz.serverY = sz.y;
                        zombies.push(sz);
                    }
                });
                for(let i = zombies.length - 1; i >= 0; i--) {
                    if(!serverMap.has(zombies[i].id)) zombies.splice(i, 1);
                }

                bullets = data.bullets;
                stats = data.stats;
                texts = data.texts || [];
                particles = data.particles || [];

                if(players['p1']) players['p1'] = data.p1;
                
                if(me && players['p2'] && data.p2) {
                    let myAngle = me.angle;
                    Object.assign(me, data.p2);
                    me.angle = myAngle; 
                }

                data.windows.forEach((wData, i) => { if(mapData.windows[i]) mapData.windows[i].boards = wData.boards; });
                data.doors.forEach((dData, i) => { if(mapData.rooms[i]) mapData.rooms[i].unlocked = dData.unlocked; });
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
        if(this.conn && this.conn.open) {
            // 7. FIX: MANUALLY STRINGIFY
            const payload = JSON.stringify({
                type: 'P2_DATA',
                name: p.name, 
                x: p.x, y: p.y, angle: p.angle,
                shoot: mouse.down,
                reload: p.reloading
            });
            this.conn.send(payload);
        }
    },

    sendInteract: function() {
        if(this.conn && this.conn.open) {
            // 8. FIX: MANUALLY STRINGIFY
            this.conn.send(JSON.stringify({ type: 'INTERACT' }));
        }
    }
};
