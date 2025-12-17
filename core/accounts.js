// ===============================================
// core/accounts.js
// Handles: account create, login, resume, saving
// ===============================================

const fs = require("fs");
const World = require("./world");
const { ensureAmbientItems } = require("./itemSpawner");


const ACCOUNT_PATH = "accounts.json";

// In-memory store
let accounts = {};

// -----------------------------------------------
// Load accounts at startup
// -----------------------------------------------
if (fs.existsSync(ACCOUNT_PATH)) {
    try {
        accounts = JSON.parse(fs.readFileSync(ACCOUNT_PATH, "utf8"));
        console.log("[ACCOUNTS] Loaded", Object.keys(accounts).length, "accounts.");
    } catch (err) {
        console.error("[ACCOUNTS] Failed to parse accounts.json:", err);
        accounts = {};
    }
} else {
    fs.writeFileSync(ACCOUNT_PATH, "{}");
    console.log("[ACCOUNTS] Created empty accounts.json");
}

// -----------------------------------------------
// Save function
// -----------------------------------------------
function save() {
    try {
        fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(accounts, null, 2));
        console.log("[ACCOUNTS] Saved accounts.json");
    } catch (err) {
        console.error("[ACCOUNTS] Failed saving accounts.json:", err);
    }
}

// -----------------------------------------------
// Generate token
// -----------------------------------------------
function makeToken() {
    return Math.random().toString(36).slice(2);
}

// -----------------------------------------------
// 🔑 SEND PLAYER STATE
// -----------------------------------------------
function sendPlayerState(socket, acc) {
    socket.send(JSON.stringify({
        type: "player_state",
        player: {
            name: acc.name,
            race: acc.race,
            pronoun: acc.pronounKey
        }
    }));
}

// -----------------------------------------------
// 🔒 SAFE ROOM RESOLUTION
// -----------------------------------------------
function resolveRoom(acc, startRoom) {
    if (!acc.lastRoom || !World.rooms[acc.lastRoom]) {
        console.warn(
            "[SPAWN FIX] Invalid lastRoom, resetting:",
            acc.lastRoom,
            "→",
            startRoom
        );
        acc.lastRoom = startRoom;
        save();
    }
    return acc.lastRoom;
}

// -----------------------------------------------
// Create account
// -----------------------------------------------
function create(socket, sess, data, startRoom) {
    const { sendSystem } = require("./sessions");
    const { sendRoom } = require("./room");


    const baseName = (data.name || "").trim();
    const password = (data.password || "").trim();
    const race = (data.race || "").trim().toLowerCase();
    const pronounKey = (data.pronoun || "").trim().toLowerCase();

    if (!baseName || !password || !race || !pronounKey) {
        return sendSystem(socket, "Missing name, password, race, or pronoun.");
    }

    const NAME_RE = /^[A-Za-z']{4,16}$/;
    if (!NAME_RE.test(baseName)) {
        return sendSystem(socket,
            "Name must be 4–16 letters; apostrophes allowed."
        );
    }

    const RACE_OPTIONS = ["goblin", "human", "elf"];
    const RACE_PRONOUNS = {
        goblin: ["they", "it"],
        elf: ["he", "she"],
        human: ["he", "she", "they", "it"]
    };

    if (!RACE_OPTIONS.includes(race)) {
        return sendSystem(socket, "Invalid race.");
    }

    if (!RACE_PRONOUNS[race].includes(pronounKey)) {
        return sendSystem(socket, "Invalid pronoun for this race.");
    }

    const loginId = `${baseName.toLowerCase()}@${race}.${pronounKey}`;

    if (accounts[loginId]) {
        return sendSystem(socket, "A being with this identity already exists.");
    }

    const token = makeToken();

    accounts[loginId] = {
        name: baseName,
        password,
        race,
        pronounKey,
        pronouns: buildPronoun(pronounKey),
        inventory: [],
        lastRoom: startRoom,
        sessionToken: token,
        createdAt: Date.now()
    };

    save();

    sess.state = "ready";
    sess.loginId = loginId;
    sess.room = startRoom;

    socket.send(JSON.stringify({ type: "session_token", token }));

    sendSystem(socket, `A new ${race} awakens as ${baseName}.`);

    sendPlayerState(socket, accounts[loginId]);
    sendRoom(socket, startRoom);
}

// -----------------------------------------------
// Login
// -----------------------------------------------
function login(socket, sess, data, startRoom) {
    const { sendSystem } = require("./sessions");
    const { sendRoom } = require("./room");


    const loginId = (data.login || "").trim().toLowerCase();
    const password = (data.password || "").trim();

    if (!loginId || !password) {
        return sendSystem(socket, "A name and password are required.");
    }

    const acc = accounts[loginId];
    if (!acc) return sendSystem(socket, "No such being exists.");
    if (acc.password !== password) return sendSystem(socket, "Wrong password.");

    const token = makeToken();
    acc.sessionToken = token;
    save();

    socket.send(JSON.stringify({ type: "session_token", token }));

    sess.state = "ready";
    sess.loginId = loginId;
    sess.room = resolveRoom(acc, startRoom);

    sendSystem(socket, `Welcome back, ${acc.name}.`);

    sendPlayerState(socket, acc);
    sendRoom(socket, sess.room);
}

// -----------------------------------------------
// Resume existing session
// -----------------------------------------------
function resume(socket, sess, data, startRoom) {
    const { sendSystem } = require("./sessions");
    const { sendRoom } = require("./room");

    const token = data.token;
    if (!token) return sendSystem(socket, "No session token.");

    const loginId = Object.keys(accounts).find(
        id => accounts[id].sessionToken === token
    );

    if (!loginId) return sendSystem(socket, "Session expired.");

    const acc = accounts[loginId];

    sess.state = "ready";
    sess.loginId = loginId;
    sess.room = resolveRoom(acc, startRoom);

    sendSystem(socket, `Resuming your journey, ${acc.name}.`);

    sendPlayerState(socket, acc);
    sendRoom(socket, sess.room);
}

// -----------------------------------------------
function buildPronoun(key) {
    switch (key) {
        case "he": return { subj: "he", obj: "him", poss: "his" };
        case "she": return { subj: "she", obj: "her", poss: "her" };
        case "they": return { subj: "they", obj: "them", poss: "their" };
        case "it": return { subj: "it", obj: "it", poss: "its" };
    }
}

// -----------------------------------------------
module.exports = {
    data: accounts,
    save,
    create,
    login,
    resume
};
