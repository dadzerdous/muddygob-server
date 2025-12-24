// ===============================================
// core/accounts.js
// ===============================================

const fs = require("fs");

const ACCOUNT_PATH = "accounts.json";

// In-memory store
let accounts = {};

// -----------------------------------------------
// Load accounts
// -----------------------------------------------
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

// -----------------------------------------------
function save() {
    fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(accounts, null, 2));
    console.log("[ACCOUNTS] Saved accounts.json");
}

// -----------------------------------------------
// Account helpers
// -----------------------------------------------
function get(loginId) {
    return accounts[loginId];
}

function set(loginId, data) {
    accounts[loginId] = data;
    save();
}
function create(socket, sess, data, startRoom) {
    const { name, password, race, pronoun } = data;

    if (!name || !password || !race) {
        return socket.send(JSON.stringify({
            type: "system",
            msg: "Missing required fields."
        }));
    }

    const loginId = `${name}@${race}.${pronoun}`;

    if (accounts[loginId]) {
        return socket.send(JSON.stringify({
            type: "system",
            msg: "That being already exists."
        }));
    }

    // Create account
    accounts[loginId] = {
        name,
        password,
        race,
        pronoun,
        room: startRoom,
        energy: 100,
        stamina: 100
    };

    save();

    // Activate session
    sess.loginId = loginId;
    sess.room = startRoom;
    sess.energy = 100;
    sess.stamina = 100;
    sess.state = "ready";

    // Send initial packets
    socket.send(JSON.stringify({
        type: "session_token",
        token: loginId
    }));

socket.send(JSON.stringify({
    type: "player_state",
    player: accounts[loginId]
}));

const Room = require("./room");
Room.sendRoom(socket, startRoom);


    const Room = require("./room");
    Room.sendRoom(socket, startRoom);
}

// -----------------------------------------------
// ✅ Safe vitals update (used by sessions)
// -----------------------------------------------
function updateVitals(loginId, energy, stamina) {
    const acc = accounts[loginId];
    if (!acc) return;

    acc.energy = energy;
    acc.stamina = stamina;
    save();
}

// -----------------------------------------------
module.exports = {
    data: accounts,
    get,
    set,
    save,
    updateVitals,
    create
};

