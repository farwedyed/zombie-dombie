/* --- NETWORKING MODULE --- */
const Network = {
    peer: null,
    conn: null,
    mode: 'OFFLINE', 
    lastUpdate: 0,
    
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
        this.conn = this.peer.connect(hostId);
        this.conn.on('open', () => {
            if(onConnected) onConnected();
            this.setupClient();
        });
    },

    /* --- HOST LOGIC --- */
    setupHost: function() {
        this.conn.on('data', (data) => {
            if(data.type === 'P2_DATA' && players['p2']) {
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
            this.conn.send({
                type: 'GAME_STATE',
                p1: players['p1'], 
                p2: players['p2'], 
                zombies: zombies, 
                bullets: bullets,
                stats: stats,
                texts: texts, 
                particles: particles, 
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
            if(data.type === 'START') {
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