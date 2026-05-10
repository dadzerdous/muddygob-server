// ===============================================
// core/accounts.js
// ===============================================

const fs = require("fs");
const ACCOUNT_PATH = "accounts.json";
let accounts = {};

if (fs.existsSync(ACCOUNT_PATH)) {
    try {
        accounts = JSON.parse(fs.readFileSync(ACCOUNT_PATH, "utf8"));
        console.log("[ACCOUNTS] Loaded", Object.keys(accounts).length, "accounts.");
        // Migrate old accounts
        for (const acc of Object.values(accounts)) {
            if (!acc.instancesCompleted) acc.instancesCompleted = [];
            if (!acc.hands) {
                acc.hands = { left: acc.heldItem || null, right: null };
                delete acc.heldItem;
            }
            if (!acc.inventory)  acc.inventory  = [];
            if (!acc.discovered || Array.isArray(acc.discovered)) acc.discovered = {};
            // Migrate stamina → mana
            if (acc.stamina !== undefined && acc.mana === undefined) {
                acc.mana = acc.stamina;
                delete acc.stamina;
            }
            if (acc.mana    === undefined) acc.mana    = 100;
            if (acc.weaponXP === undefined) acc.weaponXP = {};
            if (acc.xp       === undefined) acc.xp       = 0;
        }
    } catch { accounts = {}; }
} else {
    fs.writeFileSync(ACCOUNT_PATH, "{}");
}

function save() {
    fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(accounts, null, 2));
}

function get(loginId)          { return accounts[loginId]; }
function set(loginId, data)    { accounts[loginId] = data; save(); }

// ── HELPERS ──────────────────────────────────────────────
// Returns all items the player is currently carrying (both hands + inventory)
function allCarrying(acc) {
    const items = [];
    if (acc.hands.left)  items.push(acc.hands.left);
    if (acc.hands.right) items.push(acc.hands.right);
    if (Array.isArray(acc.inventory)) items.push(...acc.inventory);
    return items;
}

// Returns the first empty hand slot name, or null if both full
function emptyHand(acc) {
    if (!acc.hands.left)  return 'left';
    if (!acc.hands.right) return 'right';
    return null;
}

// ── SESSION ACTIVATION ───────────────────────────────────
function activateSession(socket, sess, acc, loginId, startRoom, sendRoom) {
    // Route to tutorial if not completed, otherwise last room or start
    const inTutorial = !acc.instancesCompleted?.includes('tutorial');
    const room = inTutorial
        ? (acc.lastRoom || startRoom)
        : (acc.lastRoom || startRoom);

    sess.loginId = loginId;
    sess.room    = room;
    sess.energy  = acc.energy  ?? 100;
    sess.mana    = acc.mana    ?? 100;
    sess.state   = "ready";

    socket.send(JSON.stringify({ type: "session_token", token: loginId }));
    socket.send(JSON.stringify({ type: "player_state",  player: acc }));
    socket.send(JSON.stringify({
        type:   "stats",
        level:  acc.level  ?? 1,
        energy: sess.energy,
        mana:   sess.mana,
    }));

    // Send both hands
    socket.send(JSON.stringify({ type: "hands", hands: acc.hands }));

    // Send per-room discoveries
    if (acc.discovered && !Array.isArray(acc.discovered)) {
        socket.send(JSON.stringify({ type: "discovered", perRoom: acc.discovered }));
    }

    console.log("[ACCOUNTS] activateSession → sendRoom:", room);
    sendRoom(socket, room);
}

// ── CREATE ───────────────────────────────────────────────
function create(socket, sess, data, startRoom, sendRoom) {
    const { name, password, race, pronoun } = data;
    if (!name || !password || !race || !pronoun) {
        return socket.send(JSON.stringify({ type:"system", msg:"Missing required fields." }));
    }

    const loginId = `${name.toLowerCase()}@${race}.${pronoun}`;
    if (accounts[loginId]) {
        return socket.send(JSON.stringify({ type:"system", msg:"That being already exists." }));
    }

    accounts[loginId] = {
        name, password, race, pronoun,
        room:       startRoom,
        lastRoom:   startRoom,
        energy:     100,
        mana:       100,
        level:      1,
        xp:         0,
        weaponXP:   {},
        hands:              { left: null, right: null },
        inventory:          [],
        discovered:         {},
        instancesCompleted: [],
    };

    save();
    activateSession(socket, sess, accounts[loginId], loginId, startRoom, sendRoom);
}

// ── LOGIN ────────────────────────────────────────────────
function login(socket, sess, data, startRoom, sendRoom) {
    const { login: loginId, password } = data;
    if (!loginId || !password) {
        return socket.send(JSON.stringify({ type:"system", msg:"Missing login or password." }));
    }

    const acc = accounts[loginId];
    if (!acc)                    return socket.send(JSON.stringify({ type:"system", msg:"No such being exists." }));
    if (acc.password !== password) return socket.send(JSON.stringify({ type:"system", msg:"Wrong password." }));

    activateSession(socket, sess, acc, loginId, startRoom, sendRoom);
}

// ── RESUME ───────────────────────────────────────────────
function resume(socket, sess, data, startRoom, sendRoom) {
    const { token } = data;
    const acc = accounts[token];
    if (!acc) {
        return socket.send(JSON.stringify({ type:"system", msg:"Session expired. Please log in again." }));
    }
    activateSession(socket, sess, acc, token, startRoom, sendRoom);
}

// ── VITALS ───────────────────────────────────────────────
function updateVitals(loginId, energy, mana) {
    const acc = accounts[loginId];
    if (!acc) return;
    acc.energy = energy;
    acc.mana   = mana;
    save();
}

module.exports = {
    data: accounts,
    get, set, save,
    create, login, resume,
    updateVitals,
    allCarrying, emptyHand,
};
