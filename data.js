/* --- SAVE DATA & SYNCHRONIZATION --- */
const startData = { 
    kills: 0, 
    highestRound: 1, 
    prevScore: 0, 
    unlockedAch: [], 
    unlockedGuns: ['M1911'],
    xp: 0,
    lobbyCoins: 0,
    ownedCosmetics: ['none'],
    equippedCosmetic: 'none'
};

// Load data initially from local storage (AccountSystem will overwrite this on dynamic cloud sync)
let saveData = JSON.parse(localStorage.getItem('zombieSaveModular')) || startData;

// Safety Checks
if(!saveData.unlockedAch) saveData.unlockedAch = [];
if(!saveData.unlockedGuns) saveData.unlockedGuns = ['M1911'];
if(saveData.xp === undefined) saveData.xp = 0;
if(saveData.lobbyCoins === undefined) saveData.lobbyCoins = 0;
if(!saveData.ownedCosmetics) saveData.ownedCosmetics = ['none'];
if(!saveData.equippedCosmetic) saveData.equippedCosmetic = 'none';

function saveGame(round, kills, score) {
    if(round > saveData.highestRound) saveData.highestRound = round;
    
    let msg = "";
    if(saveData.prevScore === 0) msg = "First run logged! ";
    else {
        let diff = score - saveData.prevScore;
        if(diff > 0) msg = `You did ${((diff/saveData.prevScore)*100).toFixed(0)}% better than last match!`;
        else if(diff < 0) msg = `You did ${((Math.abs(diff)/saveData.prevScore)*100).toFixed(0)}% worse than last match.`;
        else msg = "Same score as last match.";
    }
    
    saveData.prevScore = score;
    localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));

    // Async cloud push if signed in
    if (typeof AccountSystem !== 'undefined' && AccountSystem.currentUser) {
        AccountSystem.pushProfileData();
    }
    return msg;
}

function unlockGun(gunName) {
    if(!saveData.unlockedGuns.includes(gunName)) {
        saveData.unlockedGuns.push(gunName);
        localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));
        
        // Async cloud push if signed in
        if (typeof AccountSystem !== 'undefined' && AccountSystem.currentUser) {
            AccountSystem.pushProfileData();
        }
    }
}

function unlockAch(id) {
    if(!saveData.unlockedAch) saveData.unlockedAch = [];
    if(!saveData.unlockedAch.includes(id)) {
        saveData.unlockedAch.push(id);
        localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));
        
        // Async cloud push if signed in
        if (typeof AccountSystem !== 'undefined' && AccountSystem.currentUser) {
            AccountSystem.pushProfileData();
        }
        return true;
    }
    return false;
}

function resetData() {
    if(confirm("Delete all progress? This will also wipe your cloud saves!")) {
        localStorage.removeItem('zombieSaveModular');
        saveData = { ...startData };

        if (typeof AccountSystem !== 'undefined' && AccountSystem.currentUser) {
            AccountSystem.pushProfileData().then(() => {
                location.reload();
            });
        } else {
            location.reload();
        }
    }
}

/* --- WEAPON DATABASE --- */
const weaponDB = [
    { name: "M1911", dmg: 20, rpm: 20, auto: false, type: 'pistol', mag: 8, reserve: 32, reload: 60, color: '#999' },
    { name: "Python", dmg: 100, rpm: 40, auto: false, type: 'pistol', mag: 6, reserve: 24, reload: 120, color: '#ddd' },
    { name: "CZ75", dmg: 35, rpm: 15, auto: false, type: 'pistol', mag: 15, reserve: 90, reload: 80, color: '#555' },
    { name: "MP40", dmg: 22, rpm: 8, auto: true, type: 'smg', mag: 32, reserve: 192, reload: 100, color: '#333' },
    { name: "MP5k", dmg: 20, rpm: 6, auto: true, type: 'smg', mag: 30, reserve: 150, reload: 90, color: '#222' },
    { name: "Spectre", dmg: 18, rpm: 5, auto: true, type: 'smg', mag: 30, reserve: 180, reload: 80, color: '#444' },
    { name: "Olympia", dmg: 15, rpm: 30, auto: false, type: 'shotgun', pellets: 8, mag: 2, reserve: 38, reload: 120, color: '#5C4033' },
    { name: "Stakeout", dmg: 14, rpm: 50, auto: false, type: 'shotgun', pellets: 8, mag: 6, reserve: 24, reload: 180, color: '#3e2723' },
    { name: "SPAS-12", dmg: 12, rpm: 25, auto: true, type: 'shotgun', pellets: 7, mag: 8, reserve: 32, reload: 140, color: '#2c3e50' },
    { name: "AK-47", dmg: 38, rpm: 7, auto: true, type: 'ar', mag: 30, reserve: 150, reload: 120, color: '#8B4513' },
    { name: "M16", dmg: 35, rpm: 8, auto: false, burst: 3, type: 'ar', mag: 30, reserve: 120, reload: 110, color: '#000' },
    { name: "Commando", dmg: 30, rpm: 6, auto: true, type: 'ar', mag: 30, reserve: 180, reload: 100, color: '#2e4053' },
    { name: "Galil", dmg: 32, rpm: 6, auto: true, type: 'ar', mag: 35, reserve: 210, reload: 130, color: '#5d6d7e' },
    { name: "HK21", dmg: 40, rpm: 7, auto: true, type: 'lmg', mag: 100, reserve: 300, reload: 300, color: '#212f3c' },
    { name: "L96A1", dmg: 1000, rpm: 45, auto: false, type: 'sniper', mag: 5, reserve: 25, reload: 160, color: '#16a085' }, 
    { name: "Bazooka", dmg: 350, rpm: 60, auto: false, type: 'explosive', mag: 1, reserve: 5, reload: 180, color: '#27ae60' }, 
    { name: "Ray Gun", dmg: 400, rpm: 15, auto: true, type: 'special', mag: 20, reserve: 160, reload: 150, color: '#2ecc71' }
];

const achievements = [
    { id: 'k10', name: "First Blood", desc: "Get 10 Kills in one game", icon: "🩸", check: (s) => s.sessionKills >= 10 },
    { id: 'k100', name: "Slayer", desc: "Get 100 Kills Total", icon: "💀", check: (s) => (saveData.kills + s.sessionKills) >= 100 },
    { id: 'k500', name: "Massacre", desc: "Get 500 Kills Total", icon: "☠️", check: (s) => (saveData.kills + s.sessionKills) >= 500 },
    { id: 'k1000', name: "Genocide", desc: "Get 1000 Kills Total", icon: "👹", check: (s) => (saveData.kills + s.sessionKills) >= 1000 },
    { id: 'r5', name: "Survivor", desc: "Reach Round 5", icon: "🏕️", check: (s) => s.round >= 5 },
    { id: 'jug', name: "Iron Belly", desc: "Drink Juggernog", icon: "🍷", check: (s, p) => p.hasJug },
    { id: 'rich', name: "Rich", desc: "Have 3000 Points", icon: "💰", check: (s) => s.score >= 3000 }
];

/* --- COSMETICS DATABASE --- */
const cosmeticDB = [
    { id: 'cone_yellow', name: "Retro Cone Hat (Yellow)", price: 50, color: "#ffd700", type: "cone" },
    { id: 'backpack_survival', name: "Survival Backpack (Brown)", price: 150, color: "#8b5a2b", type: "backpack" },
    { id: 'cape_neon', name: "Neon Cape (Magenta)", price: 300, color: "#ff00ff", type: "cape" },
    { id: 'jetpack_steel', name: "Steel Thruster (Cyan)", price: 500, color: "#00ffff", type: "jetpack" }
];