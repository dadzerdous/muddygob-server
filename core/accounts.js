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
    } catch {
        accounts = {};
    }
} else {
    fs.writeFileSync(ACCOUNT_PATH, "{}");
}

function save() {
    fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(accounts, null, 2));
    console.log("[ACCOUNTS] Saved accounts.json");
}

function get(loginId) { return accounts[loginId]; }
function set(loginId, data) { accounts[loginId] = data; save(); }

// -----------------------------------------------
// Shared session activation helper
// NO require('./room') here — breaks circular dep
// sendRoom is passed in from server.js instead
// -----------------------------------------------
function activateSession(socket, sess, acc, loginId, startRoom, sendRoom) {
    const room = acc.lastRoom || acc.room || startRoom;

    sess.loginId = loginId;
    sess.room    = room;
    sess.energy  = acc.energy  ?? 100;
    sess.stamina = acc.stamina ?? 100;
    sess.state   = "ready";

    socket.send(JSON.stringify({ type: "session_token", token: loginId }));
    socket.send(JSON.stringify({ type: "player_state",  player: acc }));
    socket.send(JSON.stringify({
        type: "stats",
        level:   acc.level   ?? 1,
        energy:  sess.energy,
        stamina: sess.stamina,
    }));

    if (acc.heldItem) {
        socket.send(JSON.stringify({ type: "held", item: acc.heldItem }));
    }

    // Send per-room discoveries so client can restore chips
    if (acc.discovered && !Array.isArray(acc.discovered)) {
        socket.send(JSON.stringify({ type: "discovered", perRoom: acc.discovered }));
    }

    console.log("[ACCOUNTS] activateSession — calling sendRoom for:", room);
    sendRoom(socket, room);
}

// -----------------------------------------------
// CREATE
// -----------------------------------------------
function create(socket, sess, data, startRoom, sendRoom) {
    const { name, password, race, pronoun } = data;

    if (!name || !password || !race || !pronoun) {
        return socket.send(JSON.stringify({ type: "system", msg: "Missing required fields." }));
    }

    const loginId = `${name.toLowerCase()}@${race}.${pronoun}`;

    if (accounts[loginId]) {
        return socket.send(JSON.stringify({ type: "system", msg: "That being already exists." }));
    }

    accounts[loginId] = {
        name, password, race, pronoun,
        room:       startRoom,
        lastRoom:   startRoom,
        energy:     100,
        stamina:    100,
        level:      1,
        heldItem:   null,
        inventory:  [],
        discovered: [],
    };

    save();
    activateSession(socket, sess, accounts[loginId], loginId, startRoom, sendRoom);
}

// -----------------------------------------------
// LOGIN
// -----------------------------------------------
function login(socket, sess, data, startRoom, sendRoom) {
    const { login: loginId, password } = data;

    if (!loginId || !password) {
        return socket.send(JSON.stringify({ type: "system", msg: "Missing login or password." }));
    }

    const acc = accounts[loginId];

    if (!acc) {
        return socket.send(JSON.stringify({ type: "system", msg: "No such being exists." }));
    }

    if (acc.password !== password) {
        return socket.send(JSON.stringify({ type: "system", msg: "Wrong password." }));
    }

    activateSession(socket, sess, acc, loginId, startRoom, sendRoom);
}

// -----------------------------------------------
// RESUME
// -----------------------------------------------
function resume(socket, sess, data, startRoom, sendRoom) {
    const { token } = data;
    const acc = accounts[token];

    if (!acc) {
        return socket.send(JSON.stringify({ type: "system", msg: "Session expired. Please log in again." }));
    }

    activateSession(socket, sess, acc, token, startRoom, sendRoom);
}

// -----------------------------------------------
function updateVitals(loginId, energy, stamina) {
    const acc = accounts[loginId];
    if (!acc) return;
    acc.energy  = energy;
    acc.stamina = stamina;
    save();
}

module.exports = { data: accounts, get, set, save, create, login, resume, updateVitals };
