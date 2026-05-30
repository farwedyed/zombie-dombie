/* --- FIREBASE AUTHENTICATION & SAVE SYSTEM --- */

// Pre-filled with your actual Firebase config from the console
const firebaseConfig = {
    apiKey: "AIzaSyDZFSpHRI_koQynEANZ-t9T9S0Jsn34zR0",
    authDomain: "zombie-2d.firebaseapp.com",
    projectId: "zombie-2d",
    storageBucket: "zombie-2d.firebasestorage.app",
    messagingSenderId: "225934281983",
    appId: "1:225934281983:web:1e82fbdb4ce30ab68990ca"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const AccountSystem = {
    currentUser: null,

    init: function() {
        // Listen for authentication changes
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                console.log("User logged in:", user.displayName);
                
                // Automatically populate the local codename input field if it is empty
                const nameInput = document.getElementById('username-input');
                if (nameInput && !nameInput.value.trim()) {
                    nameInput.value = user.displayName ? user.displayName.substring(0, 12) : "Survivor";
                    if (typeof saveLocalUsername === 'function') {
                        saveLocalUsername();
                    }
                }

                // Sync data down from Firestore
                await this.pullProfileData();
            } else {
                this.currentUser = null;
                console.log("User logged out");
                // Fall back to local storage profile data
                if (typeof startData !== 'undefined') {
                    saveData = JSON.parse(localStorage.getItem('zombieSaveModular')) || startData;
                }
                this.updateAuthUI();
                if (typeof refreshMainMenuStats === 'function') {
                    refreshMainMenuStats();
                }
            }
        });
    },

    // Trigger Google Sign-In pop-up
    loginWithGoogle: function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then((result) => {
                if (typeof addText === 'function') {
                    addText(window.innerWidth / 2, window.innerHeight / 2, "LOGGED IN!", "#0f0");
                }
            })
            .catch((error) => {
                console.error("Sign-in failed:", error);
                alert(`Sign-in failed: [${error.code}] ${error.message}`);
            });
    },

    // Handle Log Out
    logout: function() {
        auth.signOut().then(() => {
            if (typeof addText === 'function') {
                addText(window.innerWidth / 2, window.innerHeight / 2, "LOGGED OUT!", "#fff");
            }
        });
    },

    // Fetch progress values from firestore and load them into local memory
    pullProfileData: async function() {
        if (!this.currentUser) return;

        const docRef = db.collection("users").doc(this.currentUser.uid);
        try {
            const doc = await docRef.get();
            if (doc.exists) {
                const cloudData = doc.data();
                
                // Merge cloud data over default structure to prevent missing fields
                if (typeof startData !== 'undefined') {
                    saveData = {
                        kills: cloudData.kills !== undefined ? cloudData.kills : startData.kills,
                        highestRound: cloudData.highestRound !== undefined ? cloudData.highestRound : startData.highestRound,
                        prevScore: cloudData.prevScore !== undefined ? cloudData.prevScore : startData.prevScore,
                        unlockedAch: cloudData.unlockedAch !== undefined ? cloudData.unlockedAch : [...startData.unlockedAch],
                        unlockedGuns: cloudData.unlockedGuns !== undefined ? cloudData.unlockedGuns : [...startData.unlockedGuns],
                        xp: cloudData.xp !== undefined ? cloudData.xp : startData.xp,
                        lobbyCoins: cloudData.lobbyCoins !== undefined ? cloudData.lobbyCoins : startData.lobbyCoins,
                        ownedCosmetics: cloudData.ownedCosmetics !== undefined ? cloudData.ownedCosmetics : [...startData.ownedCosmetics],
                        equippedCosmetic: cloudData.equippedCosmetic !== undefined ? cloudData.equippedCosmetic : startData.equippedCosmetic,
                        unlockedBosses: cloudData.unlockedBosses !== undefined ? cloudData.unlockedBosses : [...startData.unlockedBosses],
                        defeatedBosses: cloudData.defeatedBosses !== undefined ? cloudData.defeatedBosses : [...startData.defeatedBosses]
                    };
                }

                // Keep local storage mirrored for offline convenience
                localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));
            } else {
                // First-time user: upload their current local save data structure to the cloud
                await this.pushProfileData();
            }
            this.updateAuthUI();
            if (typeof refreshMainMenuStats === 'function') {
                refreshMainMenuStats();
            }

        } catch (error) {
            console.warn("Failed to retrieve profile data from cloud:", error);
            // Fall back to local storage on read failure
            if (typeof startData !== 'undefined') {
                saveData = JSON.parse(localStorage.getItem('zombieSaveModular')) || startData;
            }
            this.updateAuthUI();
            if (typeof refreshMainMenuStats === 'function') {
                refreshMainMenuStats();
            }
        }
    },

    // Push local memory variables up to Firestore database
    pushProfileData: async function() {
        if (!this.currentUser) return;

        const docRef = db.collection("users").doc(this.currentUser.uid);
        try {
            if (typeof saveData !== 'undefined') {
                await docRef.set({
                    displayName: this.currentUser.displayName || "Survivor",
                    kills: saveData.kills,
                    highestRound: saveData.highestRound,
                    prevScore: saveData.prevScore,
                    unlockedAch: saveData.unlockedAch,
                    unlockedGuns: saveData.unlockedGuns,
                    xp: saveData.xp || 0,
                    lobbyCoins: saveData.lobbyCoins || 0,
                    ownedCosmetics: saveData.ownedCosmetics || ['none'],
                    equippedCosmetic: saveData.equippedCosmetic || 'none',
                    unlockedBosses: saveData.unlockedBosses || [],
                    defeatedBosses: saveData.defeatedBosses || [],
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log("Cloud profile updated successfully.");
            }
        } catch (error) {
            console.warn("Failed to push profile updates to cloud:", error);
        }
    },

    // Fetch and dynamically render the top 10 global records inside the Leaderboard Modal
    fetchLeaderboard: async function() {
        const boardBody = document.getElementById('leaderboard-body');
        if (!boardBody) return;

        boardBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:#888;">Synchronizing Global Combat Logs...</td></tr>`;

        try {
            // Fetch top 10 users sorted by highestRound descending
            const snap = await db.collection("users").orderBy("highestRound", "desc").limit(10).get();
            boardBody.innerHTML = "";
            let rank = 1;
            
            if (snap.empty) {
                boardBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#666;">No combat logs logged yet.</td></tr>`;
                return;
            }

            snap.forEach(doc => {
                const u = doc.data();
                const name = u.displayName || "Survivor";
                const lvl = Math.floor((u.xp || 0) / 1000) + 1;
                const kills = u.kills !== undefined ? u.kills : 0;
                const round = u.highestRound !== undefined ? u.highestRound : 1;

                boardBody.innerHTML += `
                    <tr style="border-bottom: 1px solid #222; transition: background 0.15s ease;">
                        <td style="padding:12px; font-weight:bold; color:#ffd700; text-align:center;">#${rank}</td>
                        <td style="padding:12px; color:#fff; font-weight:bold;">${name} <span style="font-size:10px; color:#555;">[Lv.${lvl}]</span></td>
                        <td style="padding:12px; color:#ffd700; font-weight:bold; text-align:center;">Round ${round}</td>
                        <td style="padding:12px; color:#ff4757; text-align:center; font-weight:bold;">${kills}</td>
                    </tr>
                `;
                rank++;
            });
        } catch (e) {
            console.warn("Leaderboard fetch failed gracefully:", e);
            boardBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#e74c3c; font-size:12px;">Failed to synchronize leaderboard. Firestore indexing may be building.</td></tr>`;
        }
    },

    // Adjust UI elements depending on auth state
    updateAuthUI: function() {
        const authContainer = document.getElementById('auth-status-container');
        if (!authContainer) return;

        if (this.currentUser) {
            const currentLevel = Math.floor((saveData.xp || 0) / 1000) + 1;
            const coins = saveData.lobbyCoins || 0;

            authContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(255,255,255,0.05); padding: 8px 12px; border: 1px solid #333; border-radius: 4px; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px; text-align: left;">
                        <img src="${this.currentUser.photoURL || 'https://via.placeholder.com/32'}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid #a83232;">
                        <div>
                            <div style="color: #ffd700; font-size: 13px; font-weight: bold; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.currentUser.displayName}</div>
                            <div style="color: #bbb; font-size: 10px; font-weight: bold;">Lv. ${currentLevel} | 🪙 ${coins} Coins</div>
                        </div>
                    </div>
                    <button onclick="AccountSystem.logout()" style="width: auto; padding: 6px 10px; font-size: 11px; margin: 0; background: #222; border-color: #444; height: auto;">Sign Out</button>
                </div>
            `;
        } else {
            authContainer.innerHTML = `
                <button onclick="AccountSystem.loginWithGoogle()" style="border-color: #a83232; background: rgba(168, 50, 50, 0.15); font-size: 14px; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 15px;">
                    <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
                        <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.415 0-6.195-2.78-6.195-6.195s2.78-6.195 6.195-6.195c1.55 0 2.96.57 4.05 1.51l3.05-3.05C19.11 1.84 15.84 1c-6.207 0-11.24 5.033-11.24 11.24s5.033 11.24 11.24 11.24c5.897 0 10.866-4.23 11.24-10.285H12.24z"/>
                    </svg>
                    Sign In with Google
                </button>
            `;
        }
    }
};

// Initialize the account system on load
window.addEventListener('DOMContentLoaded', () => {
    AccountSystem.init();
});