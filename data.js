/* --- SAVE DATA --- */
const startData = { 
    kills: 0, 
    highestRound: 1, 
    prevScore: 0, 
    unlockedAch: [], 
    unlockedGuns: ['M1911'] 
};

// Load data or use startData
let saveData = JSON.parse(localStorage.getItem('zombieSaveModular')) || startData;

// --- FIX: SAFETY CHECK FOR OLD SAVES ---
// This ensures that if you played an older version, your save gets updated
if(!saveData.unlockedAch) saveData.unlockedAch = [];
if(!saveData.unlockedGuns) saveData.unlockedGuns = ['M1911'];
// ---------------------------------------

function saveGame(round, kills, score) {
    saveData.kills += kills; // Add session kills to total
    if(round > saveData.highestRound) saveData.highestRound = round;
    
    let msg = "";
    if(saveData.prevScore === 0) msg = "First run logged! Set a high score next time.";
    else {
        let diff = score - saveData.prevScore;
        if(diff > 0) {
            let pct = ((diff / saveData.prevScore) * 100).toFixed(0);
            msg = `Nice! You did ${pct}% better than your last game!`;
        } else if(diff < 0) {
            let pct = ((Math.abs(diff) / saveData.prevScore) * 100).toFixed(0);
            msg = `You did ${pct}% worse than before. You played like a loser!`;
        } else {
            msg = "Exactly the same score as last time. Boring.";
        }
    }
    
    saveData.prevScore = score;
    localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));
    return msg;
}

function unlockGun(gunName) {
    if(!saveData.unlockedGuns.includes(gunName)) {
        saveData.unlockedGuns.push(gunName);
        localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));
    }
}

function unlockAch(id) {
    // Safety check again
    if(!saveData.unlockedAch) saveData.unlockedAch = [];
    
    if(!saveData.unlockedAch.includes(id)) {
        saveData.unlockedAch.push(id);
        localStorage.setItem('zombieSaveModular', JSON.stringify(saveData));
        return true; // Returns true indicating a NEW unlock
    }
    return false;
}

function resetData() {
    if(confirm("Delete all progress? This cannot be undone.")) {
        localStorage.removeItem('zombieSaveModular');
        location.reload();
    }
}

/* --- GAME DATABASE --- */
const mapData = {
    rooms: [
        { id: 0, name: "Start Room", unlocked: true, color: "#1a1a1a", x:0, y:0, w:800, h:600 },
        { id: 1, name: "Hallway", unlocked: false, price: 750, color: "#222", x:800, y:0, w:400, h:600, door: {x:760, y:250, w:40, h:100} },
        { id: 2, name: "Outside", unlocked: false, price: 1000, color: "#152215", x:1200, y:-200, w:800, h:1000, door: {x:1180, y:200, w:40, h:200} },
        { id: 3, name: "Attic", unlocked: false, price: 1250, color: "#2c3e50", x:0, y:-500, w:800, h:450, door: {x:350, y:0, w:100, h:40} }
    ],
    walls: [
        {x:0, y:0, w:350, h:40}, {x:450, y:0, w:350, h:40}, 
        {x:0, y:560, w:350, h:40}, {x:450, y:560, w:350, h:40}, 
        {x:0, y:0, w:40, h:200}, {x:0, y:300, w:40, h:300},
        {x:760, y:0, w:40, h:250}, {x:760, y:350, w:40, h:250},
        {x:800, y:0, w:400, h:40}, 
        {x:800, y:560, w:150, h:40}, {x:1050, y:560, w:150, h:40},
        {x:1180, y:0, w:40, h:200}, {x:1180, y:400, w:40, h:200}, 
        {x:1200, y:-200, w:800, h:40}, {x:1200, y:760, w:800, h:40}, {x:1960, y:-200, w:40, h:1000},
        {x:1180, y:600, w:40, h:200},
        {x:0, y:-500, w:800, h:40}, {x:0, y:-500, w:40, h:500}, {x:760, y:-500, w:40, h:500}
    ],
    windows: [
        { x: 0, y: 200, w: 40, h: 100, boards: 6, max: 6, orientation: 'V' },
        { x: 350, y: 560, w: 100, h: 40, boards: 6, max: 6, orientation: 'H' },
        { x: 950, y: 560, w: 100, h: 40, boards: 6, max: 6, orientation: 'H' },
    ],
    furniture: [
        {x: 200, y: 200, w: 100, h: 50, color: '#3e2723'},
        {x: 600, y: 400, w: 50, h: 100, color: '#3e2723'},
        {x: 900, y: 200, w: 200, h: 200, color: '#111'},
        {x: 1500,y: 100, w: 15, h: 15, color: '#555'}
    ],
    interactables: [
        { x: 300, y: 30, w: 40, h: 40, type: 'WALLBUY', price: 500, label: "Olympia" },
        { x: 900, y: 30, w: 40, h: 40, type: 'WALLBUY', price: 1000, label: "MP40" },
        { x: 50, y: -200, w: 40, h: 40, type: 'WALLBUY', price: 1800, label: "AK-47" },
        { x: 1800, y: 300, w: 60, h: 60, type: 'BOX', price: 950, color: '#8e44ad', label: "?" },
        { x: 150, y: -400, w: 50, h: 50, type: 'PERK', perk: 'jug', price: 2500, color: '#c0392b', label: "JUG" }
    ],
    spawnPoints: [
        { x: -50, y: 250, roomId: 0 }, { x: 400, y: 650, roomId: 0 },
        { x: 1000, y: 650, roomId: 1 },
        { x: 1500, y: -250, roomId: 2 }, { x: 2050, y: 300, roomId: 2 },
        { x: 400, y: -550, roomId: 3 }
    ]
};

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
    { name: "Ray Gun", dmg: 400, rpm: 15, auto: true, type: 'special', mag: 20, reserve: 160, reload: 150, color: '#2ecc71' }
];

// ACHIEVEMENTS with ICONS
const achievements = [
    // 10 Kills is SESSION based (in one game)
    { id: 'k10', name: "First Blood", desc: "Get 10 Kills in one game", icon: "🩸", check: (s) => s.sessionKills >= 10 },
    
    // Higher Tiers are TOTAL based (Lifetime)
    { id: 'k100', name: "Slayer", desc: "Get 100 Kills Total", icon: "💀", check: (s) => (saveData.kills + s.sessionKills) >= 100 },
    { id: 'k500', name: "Massacre", desc: "Get 500 Kills Total", icon: "☠️", check: (s) => (saveData.kills + s.sessionKills) >= 500 },
    { id: 'k1000', name: "Genocide", desc: "Get 1000 Kills Total", icon: "👹", check: (s) => (saveData.kills + s.sessionKills) >= 1000 },
    
    { id: 'r5', name: "Survivor", desc: "Reach Round 5", icon: "🏕️", check: (s) => s.round >= 5 },
    { id: 'jug', name: "Iron Belly", desc: "Drink Juggernog", icon: "🍷", check: (s, p) => p.hasJug },
    { id: 'rich', name: "Rich", desc: "Have 3000 Points", icon: "💰", check: (s) => s.score >= 3000 }
];