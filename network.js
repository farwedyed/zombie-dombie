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
    lastGameStateTime: 0, // Watchdog tracker for host status
    
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
                    // --- STUN SERVERS ---
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

                    // --- TURN SERVER GROUP 2: EXPRESSTURN ---
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
        this.conn = this.peer.connect(hostId, {
            reliable: true,
            serialization: 'json'
        });

        this.conn.on('error', (err) => {
            console.warn("Client data channel error caught gracefully:", err);
        });

        this.conn.on('open', () => {
            this.lastGameStateTime = Date.now(); // Reset watchdog on successful connection
            if(onConnected) onConnected();
            this.setupClient();
            
            try {
                const myLvl = Math.floor((saveData.xp || 0) / 1000) + 1;
                this.conn.send({ type: 'JOIN_LOBBY', name: myUsername, level: myLvl });
            } catch (e) {
                console.warn("Failed to send JOIN_LOBBY packet:", e);
            }
        });
    },

    /* --- HOST MULTI-CONNECTION LOGIC --- */
    setupHostConnection: function(c) {
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

        c.on('error', (err) => {
            console.warn(`Host Connection Error for ${c.playerId} caught gracefully:`, err);
        });

        c.on('data', (data) => {
            if (data.type === 'JOIN_LOBBY') {
                const clientLvl = data.level || 1;
                window.lobbyPlayers[c.playerId] = (data.name || ("Player " + c.playerId.substring(1))) + " [Lv. " + clientLvl + "]";
                if (typeof updateLobbyPlayersList === 'function') updateLobbyPlayersList();
                if (typeof updateLobbyUI === 'function') updateLobbyUI(true);
                
                try {
                    const selectVis = document.getElementById('lobby-visibility-select');
                    const visibility = selectVis ? selectVis.value : 'public';
                    
                    c.send({
                        type: 'LOBBY_WELCOME',
                        name: myUsername,
                        mapIndex: stats.selectedMapIdx,
                        assignedId: c.playerId,
                        lobbyPlayers: window.lobbyPlayers,
                        difficulty: stats.difficulty || 'medium',
                        visibility: visibility
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
                    if (p.state === 'ALIVE') {
                        p.serverX = data.x;
                        p.serverY = data.y;
                    }
                    p.angle = data.angle;
                    
                    if(data.name) p.name = data.name;
                    p.isShooting = data.shoot; 
                    if (data.reload) p.triggerReload = true;
                    p.equippedCosmetic = data.cosmetic || 'none';
                    p.isTouch = data.isTouch || false;
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

        const statePayload = {
            type: 'GAME_STATE',
            p1: getPrunedPlayer(players['p1']), 
            p2: getPrunedPlayer(players['p2']), 
            p3: getPrunedPlayer(players['p3']), 
            p4: getPrunedPlayer(players['p4']), 
            zombies: zombies.map(z => ({ id: z.id, x: z.x, y: z.y, hp: z.hp, maxHp: z.maxHp, hitTimer: z.hitTimer, color: z.color, r: z.r, isBoss: z.isBoss, name: z.name })), 
            bullets: bullets.map(b => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy, color: b.color, type: b.type })),
            zombieArrows: window.zombieArrows.map(a => ({ x: a.x, y: a.y, vx: a.vx, vy: a.vy, life: a.life })), 
            stats: stats,
            windows: activeMap.windows.map(w => ({ boards: w.boards })),
            doors: activeMap.rooms.map(r => ({ unlocked: r.unlocked })),
            drops: window.drops || [],
            doublePointsTimer: window.doublePointsTimer || 0,
            instaKillTimer: window.instaKillTimer || 0
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
                stats.difficulty = data.difficulty || 'medium';
                this.lastGameStateTime = Date.now(); // Feed watchdog

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
                const clientVisDisplay = document.getElementById('lobby-visibility-display-client');
                if (clientVisDisplay && data.visibility) {
                    clientVisDisplay.innerText = data.visibility === 'public' ? "Public" : "Private";
                }
                
                document.getElementById('lobby-status').innerText = "Connected! Ready to play.";
                document.getElementById('lobby-status').style.color = "#0f0";
            }
            else if (data.type === 'LOBBY_UPDATE') {
                window.lobbyPlayers = data.lobbyPlayers;
                this.lastGameStateTime = Date.now(); // Feed watchdog
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
            else if (data.type === 'LOBBY_VISIBILITY_CHANGE') {
                const clientVisDisplay = document.getElementById('lobby-visibility-display-client');
                if (clientVisDisplay) {
                    clientVisDisplay.innerText = data.visibility === 'public' ? "Public" : "Private";
                }
            }
            else if (data.type === 'KICK_BY_HOST') {
                alert("You have been kicked from the lobby by the Host.");
                location.reload(); 
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
                this.lastGameStateTime = Date.now(); // Feed watchdog on every gamestate frame
                
                const serverZombies = data.zombies || [];
                const serverMap = new Map();
                
                serverZombies.forEach(sz => {
                    serverMap.set(sz.id, sz);
                    const local = zombies.find(z => z.id === sz.id);
                    if(local) {
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
                        local.hitTimer = sz.hitTimer;
                        local.color = sz.color;
                        local.r = sz.r;
                        local.isBoss = sz.isBoss;
                        local.name = sz.name;

                        if (local.isBoss) {
                            window.activeBoss = local;
                        }
                    } else {
                        const newZ = {
                            id: sz.id,
                            x: sz.x,
                            y: sz.y,
                            hp: sz.hp,
                            maxHp: sz.maxHp,
                            serverX: sz.x,
                            serverY: sz.y,
                            r: sz.r || 16,
                            hitTimer: sz.hitTimer || 0,
                            color: sz.color || '#3a4a38',
                            isBoss: sz.isBoss || false,
                            name: sz.name || "Zombie"
                        };
                        zombies.push(newZ);
                        if (newZ.isBoss) {
                            window.activeBoss = newZ;
                        }
                    }
                });
                
                for(let i = zombies.length - 1; i >= 0; i--) {
                    const localZ = zombies[i];
                    if(!serverMap.has(localZ.id)) {
                        if (localZ.isBoss && window.activeBoss && window.activeBoss.id === localZ.id) {
                            window.activeBoss = null;
                        }
                        zombies.splice(i, 1);
                    }
                }

                const incomingBullets = data.bullets || [];
                const serverBulletMap = new Map();
                
                incomingBullets.forEach(sb => {
                    serverBulletMap.set(sb.id, sb);
                    const localBullet = bullets.find(b => b.id === sb.id);
                    if (localBullet) {
                        localBullet.vx = sb.vx;
                        localBullet.vy = sb.vy;
                    } else {
                        bullets.push({
                            id: sb.id,
                            x: sb.x,
                            y: sb.y,
                            vx: sb.vx,
                            vy: sb.vy,
                            color: sb.color,
                            type: sb.type,
                            life: 50
                        });
                    }
                });

                for (let i = bullets.length - 1; i >= 0; i--) {
                    const eb = bullets[i];
                    if (!serverBulletMap.has(eb.id)) {
                        if (eb.type === 'explosive') {
                            if (typeof spawnExplosionVisuals === 'function') {
                                spawnExplosionVisuals(eb.x, eb.y);
                            }
                        }
                        bullets.splice(i, 1);
                    }
                }
                
                if (data.zombieArrows) {
                    window.zombieArrows = data.zombieArrows;
                }
                
                window.drops = data.drops || [];
                window.doublePointsTimer = data.doublePointsTimer || 0;
                window.instaKillTimer = data.instaKillTimer || 0;

                if (data.stats && stats) {
                    if (data.stats.score > stats.score) {
                        let diff = data.stats.score - stats.score;
                        if (typeof addText === 'function') {
                            addText(me.x, me.y, "+" + diff, "#ff0");
                        }
                    }
                }
                
                stats = data.stats;

                ['p1', 'p2', 'p3', 'p4'].forEach(pId => {
                    if (pId === window.myPlayerId) {
                        const fallbackPId = data[pId];
                        if (fallbackPId && me) {
                            let myAngle = me.angle;
                            let myX = me.x;
                            let myY = me.y;
                            
                            if (me.state === 'DOWNED' && fallbackPId.state === 'ALIVE') {
                                const spawnSource = data.p1;
                                if (spawnSource) {
                                    myX = spawnSource.x;
                                    myY = spawnSource.y;
                                }
                                if (typeof addText === 'function') {
                                    addText(me.x, me.y, "REVIVED (+INVINCIBLE!)", "#0f0");
                                }
                            }

                            if (fallbackPId.kills > me.kills) {
                                let killDiff = fallbackPId.kills - me.kills;
                                if (typeof addPlayerXP === 'function') {
                                    addPlayerXP(me, killDiff * 25);
                                }
                                saveData.lobbyCoins = (saveData.lobbyCoins || 0) + killDiff;
                            }
                            if (fallbackPId.score > me.score) {
                                let scoreDiff = fallbackPId.score - me.score;
                                let xpToGive = Math.floor(scoreDiff / 10) * 5;
                                if (xpToGive > 0 && typeof addPlayerXP === 'function') {
                                    addPlayerXP(me, xpToGive);
                                }
                            }

                            if (fallbackPId.gunName) {
                                syncPlayerInventory(me, fallbackPId.weapIdx, fallbackPId.gunName);
                            }

                            Object.assign(me, fallbackPId);
                            me.angle = myAngle; 
                            
                            if (fallbackPId.state === 'DOWNED') {
                                me.x = fallbackPId.x;
                                me.y = fallbackPId.y;
                            } else {
                                me.x = myX;
                                me.y = myY;
                            }

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

                            if (p && p.state === 'DOWNED' && data[pId].state === 'ALIVE') {
                                if (typeof addText === 'function') {
                                    addText(p.x, p.y, "REVIVED (+INVINCIBLE!)", "#0f0");
                                }
                            }

                            if (p && !data[pId].reloading && !p.reloading && data[pId].gunName !== "Bazooka") {
                                const lastClip = p.clip !== undefined ? p.clip : 8;
                                if (data[pId].clip < lastClip && (lastClip - data[pId].clip) <= 2) {
                                    if (typeof spawnShellCasing === 'function') {
                                        spawnShellCasing(p.x, p.y, p.angle);
                                    }
                                }
                            }

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
                            p.equippedCosmetic = data[pId].cosmetic !== undefined ? data[pId].cosmetic : 'none';
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

        // 1. Connection Close Event Trigger
        this.conn.on('close', () => {
            this.handleDisconnectFallback();
        });

        // 2. Browser WebRTC ICE Connection State Triggers
        if (this.conn.peerConnection) {
            this.conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
                const state = this.conn.peerConnection.iceConnectionState;
                if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                    this.handleDisconnectFallback("⚠️ ICE Disconnection: Lost network path to the Host.");
                }
            });
            this.conn.peerConnection.addEventListener('connectionstatechange', () => {
                const state = this.conn.peerConnection.connectionState;
                if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                    this.handleDisconnectFallback("⚠️ peer Disconnection: Connection with host closed.");
                }
            });
        }
    },

    // 3. Heartbeat Watchdog verification loop
    checkHostHeartbeat: function() {
        if (this.mode !== 'CLIENT' || !gameActive) return;
        
        if (this.lastGameStateTime === 0) {
            this.lastGameStateTime = Date.now();
            return;
        }

        const elapsed = Date.now() - this.lastGameStateTime;
        if (elapsed > 4000) { // 4-second timeout threshold
            console.warn("Watchdog: Host heartbeat lost. Redirecting.");
            this.handleDisconnectFallback("⚠️ Connection Timed Out: The Host stopped responding.");
        }
    },

    handleDisconnectFallback: function(customMsg) {
        if (this.mode !== 'CLIENT') return;

        gameActive = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        try { if (Network.peer) Network.peer.destroy(); } catch(e){}
        this.peer = null;
        this.conn = null;
        this.conns = [];
        this.mode = 'OFFLINE';

        resetSession();

        document.getElementById('game-ui').style.display = 'none';
        document.getElementById('game-over').style.display = 'none';
        document.getElementById('lobby-screen').style.display = 'none';
        document.getElementById('main-menu').style.display = 'flex';

        const menuMsg = document.getElementById('main-menu-msg');
        if (menuMsg) {
            menuMsg.style.display = 'block';
            menuMsg.innerText = customMsg || "⚠️ Connection Lost: The Host disconnected or closed the session.";
            menuMsg.style.color = "#ff4757";
            menuMsg.style.borderColor = "#ff4757";
        }
    },

    sendClientData: function(p) {
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
                    name: p.name,
                    cosmetic: p.equippedCosmetic || 'none',
                    isTouch: p.isTouch
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
        hasJug: p.hasJug, // Corrected Typo!
        reloading: p.reloading,
        weapIdx: p.weapIdx,
        clip: activeGun ? activeGun.clip : 0,
        ammo: activeGun ? activeGun.ammo : 0,
        gunName: activeGun ? activeGun.name : "M1911",
        gunColor: activeGun ? activeGun.color : "#999",
        name: p.name,
        cosmetic: p.equippedCosmetic || 'none'
    };
}

function syncPlayerInventory(p, serverWeapIdx, serverGunName) {
    if (!p || !p.inventory || !serverGunName) return;
    
    const hasWeapon = p.inventory.some(w => w.name === serverGunName);
    if (!hasWeapon) {
        const b = weaponDB.find(w => w.name === serverGunName);
        if (b) {
            p.inventory.push({ ...b, clip: b.mag, ammo: b.reserve });
        }
    }
    
    const targetIdx = p.inventory.findIndex(w => w.name === serverGunName);
    if (targetIdx !== -1) {
        p.weapIdx = targetIdx;
    } else {
        p.weapIdx = 0; 
    }
}

function capitalizeFirstLetter(string) {
    if (!string) return "Medium";
    return string.charAt(0).toUpperCase() + string.slice(1);
}