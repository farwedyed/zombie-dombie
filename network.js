/* --- NETWORKING MODULE --- */
if (!window.lobbyPlayers) {
    window.lobbyPlayers = { p1: "Survivor", p2: "", p3: "", p4: "", p5: "", p6: "", p7: "", p8: "" };
}
if (!window.myPlayerId) {
    window.myPlayerId = "p1"; // Default for host/offline
}

const Network = {
    peer: null,
    conns: [], // Host: Stores up to 7 guest connections (P2 through P8)
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
            // Allow up to 7 guest connections (Host + 7 guests = 8 players)
            if (this.conns.length >= 7) {
                console.warn("Lobby connection refused: lobby is full (max 8 players).");
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
        
        // Explicit 8-player slot routing configuration
        if (!window.lobbyPlayers.p2 || window.lobbyPlayers.p2 === "Reserved") { assignedId = "p2"; }
        else if (!window.lobbyPlayers.p3 || window.lobbyPlayers.p3 === "Reserved") { assignedId = "p3"; }
        else if (!window.lobbyPlayers.p4 || window.lobbyPlayers.p4 === "Reserved") { assignedId = "p4"; }
        else if (!window.lobbyPlayers.p5 || window.lobbyPlayers.p5 === "Reserved") { assignedId = "p5"; }
        else if (!window.lobbyPlayers.p6 || window.lobbyPlayers.p6 === "Reserved") { assignedId = "p6"; }
        else if (!window.lobbyPlayers.p7 || window.lobbyPlayers.p7 === "Reserved") { assignedId = "p7"; }
        else if (!window.lobbyPlayers.p8 || window.lobbyPlayers.p8 === "Reserved") { assignedId = "p8"; }
        else {
            console.warn("Incoming connection rejected: All lobby player slots from P1 to P8 are full.");
            try { c.close(); } catch(e) {}
            return;
        }
        
        console.log(`Lobby slot matched! Assigning peer connection to slot: ${assignedId}`);
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
                        gameMode: stats.gameMode || 'SURVIVAL',
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
                    lobbyPlayers: window.lobbyPlayers,
                    gameMode: stats.gameMode || 'SURVIVAL'
                });

                // MID-GAME JOIN HANDSHAKE: Spawn as spectator
                if (gameActive) {
                    const spawnX = activeMap.rooms[0].x + activeMap.rooms[0].w / 2;
                    const spawnY = activeMap.rooms[0].y + activeMap.rooms[0].h / 2;
                    players[c.playerId] = createPlayer(c.playerId, spawnX, spawnY, getPlayerColor(c.playerId), window.lobbyPlayers[c.playerId]);
                    
                    if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
                        // In Infection mode, mid-game joiners automatically start infected
                        InfectionMode.infectPlayer(c.playerId, false);
                    } else {
                        players[c.playerId].state = 'SPECTATING';
                    }
                    
                    try {
                        c.send({
                            type: 'START',
                            mapIndex: stats.selectedMapIdx,
                            gameMode: stats.gameMode || 'SURVIVAL',
                            midGame: true
                        });
                    } catch (e) {
                        console.warn("Failed to send mid-game START:", e);
                    }
                }
            }
            else if(data.type === 'P_DATA') {
                const p = players[c.playerId];
                if (p) {
                    if (p.state === 'ALIVE' && data.x !== undefined && data.y !== undefined) {
                        p.serverX = data.x;
                        p.serverY = data.y;
                    }
                    if (data.angle !== undefined) p.angle = data.angle;
                    
                    if(data.name) p.name = data.name;
                    p.isShooting = data.shoot; 

                    if (data.reload) {
                        const gun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null;
                        if (gun && !p.reloading) {
                            p.reloading = true;
                            p.reloadTimer = gun.reload;
                            p.triggerReload = false; 
                            if (typeof addText === 'function') {
                                addText(p.x, p.y - 40, "RELOADING...", "#fff");
                            }
                        }
                    }

                    p.equippedCosmetic = data.cosmetic || 'none';
                    p.isTouch = data.isTouch || false;
                    if (data.state) p.state = data.state;

                    if (data.gunName) {
                        if (p.justPurchasedWeapon) {
                            if (data.gunName === p.justPurchasedWeapon) {
                                p.justPurchasedWeapon = null; // Clear lock once client equips it
                                syncPlayerInventory(p, data.weapIdx, data.gunName);
                            }
                            // Otherwise ignore out-of-date in-flight weapon packets
                        } else {
                            syncPlayerInventory(p, data.weapIdx, data.gunName);
                        }
                    }
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
                lobbyPlayers: window.lobbyPlayers,
                gameMode: stats.gameMode || 'SURVIVAL'
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

            if (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) {
                InfectionMode.infectedIds.delete(c.playerId);
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
            p5: getPrunedPlayer(players['p5']), 
            p6: getPrunedPlayer(players['p6']), 
            p7: getPrunedPlayer(players['p7']), 
            p8: getPrunedPlayer(players['p8']), 
            zombies: zombies.map(z => ({ 
                id: z.id, x: z.x, y: z.y, hp: z.hp, maxHp: z.maxHp, 
                hitTimer: z.hitTimer, color: z.color, r: z.r, 
                isBoss: z.isBoss, name: z.name, type: z.type,
                chargeState: z.chargeState, chargeAngle: z.chargeAngle
            })), 
            bullets: bullets.map(b => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy, color: b.color, type: b.type })),
            zombieArrows: window.zombieArrows.map(a => ({ x: a.x, y: a.y, vx: a.vx, vy: a.vy, life: a.life })), 
            stats: stats,
            windows: activeMap.windows.map(w => ({ boards: w.boards })),
            doors: activeMap.rooms.map(r => ({ unlocked: r.unlocked })),
            drops: window.drops || [],
            doublePointsTimer: window.doublePointsTimer || 0,
            instaKillTimer: window.instaKillTimer || 0,
            acidPools: window.acidPools || [],
            toxicClouds: window.toxicClouds || [],
            fireZones: window.fireZones || [],
            mortarTargets: window.mortarTargets || [],
            groundSmashes: window.groundSmashes || [],

            // --- REPLICATE ACTIVE INFECTION MODE STATES ---
            infectionActive: (typeof InfectionMode !== 'undefined' && InfectionMode.isActive),
            infectionState: (typeof InfectionMode !== 'undefined') ? InfectionMode.state : 'WAITING',
            infectionTimer: (typeof InfectionMode !== 'undefined') ? InfectionMode.timer : 0,
            infectionCountdown: (typeof InfectionMode !== 'undefined') ? InfectionMode.countdown : 0,
            alphaId: (typeof InfectionMode !== 'undefined') ? InfectionMode.alphaId : null,
            infectedIds: (typeof InfectionMode !== 'undefined') ? Array.from(InfectionMode.infectedIds) : []
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
                stats.gameMode = data.gameMode || 'SURVIVAL';
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
                const modeDisplay = document.getElementById('lobby-mode-display-client');
                if (modeDisplay) {
                    modeDisplay.innerText = "Mode: " + (stats.gameMode === 'INFECTION' ? "Infection Mode" : "Classic Survival");
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
                if (data.gameMode) stats.gameMode = data.gameMode;
                this.lastGameStateTime = Date.now(); 
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
            else if (data.type === 'LOBBY_MODE_CHANGE') {
                stats.gameMode = data.gameMode || 'SURVIVAL';
                const modeDisplay = document.getElementById('lobby-mode-display-client');
                if (modeDisplay) {
                    modeDisplay.innerText = "Mode: " + (stats.gameMode === 'INFECTION' ? "Infection Mode" : "Classic Survival");
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
                stats.gameMode = data.gameMode || 'SURVIVAL';
                this.lastGameStateTime = Date.now(); 
                launchGame();
                if (data.midGame && (!typeof InfectionMode !== 'undefined' || !InfectionMode.isActive)) {
                    me.state = 'SPECTATING';
                }
            }

            // --- MELEE FLASH CHANNELS ---
            else if (data.type === 'INF_SELECT_ALPHA') {
                if (typeof InfectionMode !== 'undefined') {
                    InfectionMode.isActive = true;
                    InfectionMode.state = 'ACTIVE';
                    InfectionMode.alphaId = data.alphaId;
                    InfectionMode.infectedIds.add(data.alphaId);
                    InfectionMode.infectPlayer(data.alphaId, true);
                }
            }
            else if (data.type === 'INF_TURN') {
                if (typeof InfectionMode !== 'undefined') {
                    InfectionMode.infectPlayer(data.victimId, false);
                }
            }
            else if (data.type === 'INF_RESPAWN') {
                if (typeof InfectionMode !== 'undefined') {
                    InfectionMode.respawnPlayer(data.playerId);
                    const p = players[data.playerId];
                    if (p) {
                        p.x = data.x;
                        p.y = data.y;
                    }
                }
            }
            else if (data.type === 'INF_GAME_OVER') {
                if (typeof InfectionMode !== 'undefined') {
                    InfectionMode.endMatch(data.result);
                }
            }

            else if(data.type === 'GAME_STATE') {
                this.lastGameStateTime = Date.now(); // Feed watchdog on every gamestate frame
                
                // --- CONTINUOUS SYNC OF INFECTION STATES ---
                if (data.infectionActive) {
                    if (typeof InfectionMode !== 'undefined') {
                        InfectionMode.isActive = true;
                        InfectionMode.state = data.infectionState;
                        InfectionMode.timer = data.infectionTimer;
                        InfectionMode.countdown = data.infectionCountdown;
                        InfectionMode.alphaId = data.alphaId;
                        InfectionMode.infectedIds = new Set(data.infectedIds);
                    }
                } else if (typeof InfectionMode !== 'undefined') {
                    InfectionMode.isActive = false;
                }

                const serverZombies = data.zombies || [];
                const serverMap = new Map();
                
                serverZombies.forEach(sz => {
                    serverMap.set(sz.id, sz);
                    const local = zombies.find(z => z.id === sz.id);
                    if(local) {
                        if (local.hp > sz.hp) {
                            if (typeof spawnParticles === 'function') {
                                spawnParticles(local.x, local.y, '#800', 3);
                            }

                            if (typeof addText === 'function') {
                                let pts = 10;
                                if (window.doublePointsTimer > 0) pts *= 2;
                                addText(local.x, local.y, "+" + pts, "#fff");
                            }

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
                        local.type = sz.type;
                        local.chargeState = sz.chargeState;
                        local.chargeAngle = sz.chargeAngle;

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
                            name: sz.name || "Zombie",
                            type: sz.type,
                            chargeState: sz.chargeState,
                            chargeAngle: sz.chargeAngle
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
                let shotSoundPlayedThisTick = false; 
                
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
                        
                        if (!shotSoundPlayedThisTick) {
                            if (typeof SoundSystem !== 'undefined') {
                                SoundSystem.play('shoot');
                            }
                            shotSoundPlayedThisTick = true;
                        }
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
                
                window.acidPools = data.acidPools || [];
                window.toxicClouds = data.toxicClouds || [];
                window.fireZones = data.fireZones || [];
                window.mortarTargets = data.mortarTargets || [];
                window.groundSmashes = data.groundSmashes || [];
                
                ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].forEach(pId => {
                    if (pId === window.myPlayerId) {
                        const fallbackPId = data[pId];
                        if (fallbackPId && me) {
                            let myAngle = me.angle;
                            let myX = me.x;
                            let myY = me.y;
                            let myWeapIdx = me.weapIdx; 
                            let localReloading = me.reloading; 

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

                                if (scoreDiff !== 10 && scoreDiff !== 20) {
                                    if (typeof addText === 'function') {
                                        addText(me.x, me.y - 40, "+" + scoreDiff, "#ff0");
                                    }
                                }
                            }

                            const oldInvSize = me.inventory ? me.inventory.length : 0;
                            if (fallbackPId.gunName) {
                                syncPlayerInventory(me, fallbackPId.weapIdx, fallbackPId.gunName);
                            }
                            const newInvSize = me.inventory ? me.inventory.length : 0;

                            Object.assign(me, fallbackPId);
                            me.angle = myAngle; 
                            
                            if (newInvSize > oldInvSize) {
                                const targetIdx = me.inventory.findIndex(w => w.name === fallbackPId.gunName);
                                if (targetIdx !== -1) {
                                    me.weapIdx = targetIdx;
                                }
                            } else {
                                me.weapIdx = myWeapIdx; 
                            }

                            if (!localReloading) {
                                me.reloading = false;
                            }
                            
                            if (fallbackPId.state === 'DOWNED') {
                                me.x = fallbackPId.x;
                                me.y = fallbackPId.y;
                            } else {
                                me.x = myX;
                                me.y = myY;
                            }

                            me.gunName = fallbackPId.gunName !== undefined ? fallbackPId.gunName : "Model 1911";
                            me.gunColor = fallbackPId.gunColor !== undefined ? fallbackPId.gunColor : "#999";
                            me.clip = fallbackPId.clip !== undefined ? fallbackPId.clip : 8;
                            me.ammo = fallbackPId.ammo !== undefined ? fallbackPId.ammo : 32;

                            const activeGunInInv = me.inventory ? me.inventory.find(w => w.name === fallbackPId.gunName) : null;
                            if (activeGunInInv) {
                                if (fallbackPId.clip !== undefined) activeGunInInv.clip = fallbackPId.clip;
                                if (fallbackPId.ammo !== undefined) activeGunInInv.ammo = fallbackPId.ammo;
                            }
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

                            if (p && data[pId].reloading && !p.reloading) {
                                if (typeof addText === 'function') {
                                    addText(p.x, p.y - 40, "RELOADING...", "#fff");
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
                            p.hasVigor = data[pId].hasVigor !== undefined ? data[pId].hasVigor : p.hasVigor;
                            p.reloading = data[pId].reloading !== undefined ? data[pId].reloading : p.reloading;
                            p.weapIdx = data[pId].weapIdx !== undefined ? data[pId].weapIdx : p.weapIdx;
                            p.name = data[pId].name !== undefined ? data[pId].name : p.name;
                            p.gunName = data[pId].gunName !== undefined ? data[pId].gunName : "Model 1911";
                            p.gunColor = data[pId].gunColor !== undefined ? data[pId].gunColor : "#999";
                            p.clip = data[pId].clip !== undefined ? data[pId].clip : 8;
                            p.ammo = data[pId].ammo !== undefined ? data[pId].ammo : 32;
                            p.equippedCosmetic = data[pId].cosmetic !== undefined ? data[pId].cosmetic : 'none';

                            // Replicate Melee Slashes of other players
                            p.isSlashing = data[pId].isSlashing !== undefined ? data[pId].isSlashing : p.isSlashing;
                        } else {
                            if (players[pId]) delete players[pId];
                        }
                    }
                });

                // --- DETECT BOARD REPAIRS ON CLIENT ---
                data.windows.forEach((wData, i) => { 
                    if (activeMap.windows[i]) {
                        // Detect if a board was added
                        if (wData.boards > activeMap.windows[i].boards) {
                            let diff = wData.boards - activeMap.windows[i].boards;
                            let pointsToGive = GameBalanceConfig.SCORE_WINDOW_REPAIR * diff;
                            if (window.doublePointsTimer > 0) pointsToGive *= 2;
                            
                            // Spawn "+10" (or "+20") at the window's position on client's screen
                            if (typeof addText === 'function') {
                                addText(activeMap.windows[i].x + 20, activeMap.windows[i].y, "+" + pointsToGive, "#fff");
                            }
                            
                            // Play the board repair/purchase sound effect locally for clients
                            if (typeof SoundSystem !== 'undefined') {
                                SoundSystem.play('purchase');
                            }
                        }
                        activeMap.windows[i].boards = wData.boards; 
                    }
                });

                data.doors.forEach((dData, i) => { 
                    if(activeMap.rooms[i] && activeMap.rooms[i].unlocked !== dData.unlocked) {
                        activeMap.rooms[i].unlocked = dData.unlocked;
                        if (dData.unlocked && typeof SoundSystem !== 'undefined') {
                            SoundSystem.play('purchase');
                        }
                    }
                });

                // Detect round increase to award local round survival coins
                if (data.stats.round > stats.round) {
                    const roundsSurvived = data.stats.round - stats.round;
                    const coinBonus = roundsSurvived * 10;
                    saveData.lobbyCoins = (saveData.lobbyCoins || 0) + coinBonus;
                    if (me) {
                        addText(me.x, me.y - 70, `+${coinBonus} ROUND BONUS 🪙`, "#ffd700");
                    }
                }

                stats = data.stats;
            }
            else if(data.type === 'GAME_OVER') {
                stats = { ...stats, ...data.stats };
                gameOver();
            }
        });

        this.conn.on('close', () => {
            this.handleDisconnectFallback();
        });

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

    checkHostHeartbeat: function() {
        if (this.mode !== 'CLIENT' || !gameActive) return;
        
        if (this.lastGameStateTime === 0) {
            this.lastGameStateTime = Date.now();
            return;
        }

        const elapsed = Date.now() - this.lastGameStateTime;
        if (elapsed > 4000) { 
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
        document.getElementById('main-menu').style.display = 'none'; 
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
                const activeGun = p.inventory && p.inventory[p.weapIdx] ? p.inventory[p.weapIdx] : null;

                if (mouse.down && activeGun && activeGun.clip === 0 && activeGun.ammo === 0) {
                    const nowMs = Date.now();
                    if (nowMs - (activeGun.lastDryFireTime || 0) >= 600) { 
                        activeGun.lastDryFireTime = nowMs;
                        if (typeof SoundSystem !== 'undefined') {
                            SoundSystem.play('dry_fire');
                        }
                    }
                }

                this.conn.send({
                    type: 'P_DATA',
                    x: p.x, y: p.y, angle: p.angle,
                    shoot: mouse.down,
                    reload: p.reloading,
                    name: p.name,
                    cosmetic: p.equippedCosmetic || 'none',
                    isTouch: p.isTouch,
                    weapIdx: p.weapIdx,
                    gunName: activeGun ? activeGun.name : "",
                    clip: activeGun ? activeGun.clip : 0,    
                    ammo: activeGun ? activeGun.ammo : 0,    
                    state: p.state 
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
    if (id === 'p1') return '#3498db'; 
    if (id === 'p2') return '#e67e22'; 
    if (id === 'p3') return '#2ecc71'; 
    if (id === 'p4') return '#9b59b6'; 
    if (id === 'p5') return '#f1c40f'; // Yellow
    if (id === 'p6') return '#e74c3c'; // Red
    if (id === 'p7') return '#1abc9c'; // Turquoise
    return '#10ac84'; // Green-blue (p8)
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
        hasVigor: p.hasVigor,
        reloading: p.reloading,
        weapIdx: p.weapIdx,
        clip: activeGun ? activeGun.clip : 0,
        ammo: activeGun ? activeGun.ammo : 0,
        gunName: activeGun ? activeGun.name : "Model 1911",
        gunColor: activeGun ? activeGun.color : "#999",
        name: p.name,
        cosmetic: p.equippedCosmetic || 'none',

        // --- REPLICATE ACTIVE INFECTION PROPERTIES ---
        isSlashing: p.isSlashing,
        isInfected: (typeof InfectionMode !== 'undefined' && InfectionMode.isActive) ? InfectionMode.infectedIds.has(p.id) : false
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