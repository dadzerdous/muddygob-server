// ============================
// MuddyGob MUD Server
// Accounts + Races + Pronouns
// Room loading + Chat Broadcast
// ============================

const WebSocket = require("ws");
const fs = require("fs");

const ACCOUNT_PATH = "/tmp/accounts.json";
const START_ROOM = "g3";

// ===================================
// Load or create accounts.json (+ logs)
// ===================================
let accounts = {};
if (fs.existsSync(ACCOUNT_PATH)) {
    try {
        console.log("[ACCOUNTS] Found accounts.json, loading...");
        accounts = JSON.parse(fs.readFileSync(ACCOUNT_PATH, "utf8"));
        console.log("[ACCOUNTS] Loaded", Object.keys(accounts).length, "accounts.");
    } catch (e) {
        console.error("[ACCOUNTS] ERROR parsing accounts.json:", e);
        accounts = {};
    }
} else {
    console.log("[ACCOUNTS] accounts.json not found, creating new file...");
    fs.writeFileSync(ACCOUNT_PATH, "{}");
    console.log("[ACCOUNTS] Created empty accounts.json");
}

function saveAccounts() {
    try {
        fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(accounts, null, 2));
        console.log("[ACCOUNTS] Saved accounts.json");
    } catch (e) {
        console.error("[ACCOUNTS] FAILED TO SAVE accounts.json:", e);
    }
}


// ===================================
// Load world/*.json
// ===================================
function loadWorld() {
    const world = {};

    if (!fs.existsSync("./world")) {
        console.error("NO ./world DIRECTORY FOUND!");
        return world;
    }

    const files = fs.readdirSync("./world");
    for (const file of files) {
        if (file.endsWith(".json")) {
            try {
                const data = JSON.parse(fs.readFileSync("./world/" + file, "utf8"));
                Object.assign(world, data);
            } catch (e) {
                console.error("FAILED TO LOAD ROOM FILE:", file, e);
            }
        }
    }
    return world;
}

const world = loadWorld();
console.log("Loaded rooms:", Object.keys(world));

// ===================================
// WebSocket Server
// ===================================
const wss = new WebSocket.Server({ port: 9000 });
console.log("MuddyGob server running on port 9000");

const sessions = new Map(); // socket -> { state, loginId, room }

// Races + allowed pronouns
const RACE_OPTIONS = ["goblin", "human", "elf"];
const RACE_PRONOUNS = {
    goblin: ["they", "it"],
    elf: ["he", "she"],
    human: ["he", "she", "they", "it"]
};

// Build actual pronoun object
function buildPronounObject(key) {
    switch (key) {
        case "he": return { subj: "he", obj: "him", poss: "his" };
        case "she": return { subj: "she", obj: "her", poss: "her" };
        case "they": return { subj: "they", obj: "them", poss: "their" };
        case "it": return { subj: "it", obj: "it", poss: "its" };
        default: return { subj: key, obj: key, poss: key + "'s" };
    }
}

// ===================================
// BROADCAST CHAT TO ROOM
// ===================================
function broadcastToRoomExcept(roomId, msg, exceptSocket) {
    for (const [sock, sess] of sessions.entries()) {
        if (sock !== exceptSocket &&
            sess.room === roomId &&
            sess.state === "ready") {
            sock.send(JSON.stringify({ type: "system", msg }));
        }
    }
}


// ===================================
// Handle each incoming connection
// ===================================
wss.on("connection", (socket) => {
    console.log("New connection");

    sessions.set(socket, {
        state: "connected",
        loginId: null,
        room: START_ROOM
    });

    sendSystem(socket, "Connected to MuddyGob. Press New or Login.");

    socket.on("message", (data) => {
        const text = data.toString().trim();
        handleIncoming(socket, text);
    });

    socket.on("close", () => {
        console.log("Connection closed");
        sessions.delete(socket);
    });
});

// ===================================
// JSON before text
// ===================================
function handleIncoming(socket, raw) {
    try {
        const obj = JSON.parse(raw);
        if (obj && obj.type) {
            handleJson(socket, obj);
            return;
        }
    } catch {}

    handleText(socket, raw);
}

// ===================================
// JSON COMMANDS (UI flow)
// ===================================
function handleJson(socket, data) {
    const sess = sessions.get(socket);
    if (!sess) return;

    switch (data.type) {

        // --- CREATE ACCOUNT ---
        case "create_account": {
            const baseName = (data.name || "").trim();
            const password = (data.password || "").trim();
            const race = (data.race || "").trim().toLowerCase();
            const pronounKey = (data.pronoun || "").trim().toLowerCase();

            if (!baseName || !password || !race || !pronounKey) {
                return sendSystem(socket,
                    "That being cannot be created (missing name, password, race, or pronoun)."
                );
            }

            // Must be 4–16 letters + apostrophe
            const NAME_RE = /^[A-Za-z']{4,16}$/;
            if (!NAME_RE.test(baseName)) {
                return sendSystem(socket,
                    "That being cannot be created (name must be 4–16 letters; apostrophes allowed)."
                );
            }

            if (!RACE_OPTIONS.includes(race)) {
                return sendSystem(socket,
                    "That being cannot be created (its ancestry feels wrong)."
                );
            }

            if (!RACE_PRONOUNS[race].includes(pronounKey)) {
                return sendSystem(socket,
                    "That being cannot be created (those pronouns do not match this ancestry)."
                );
            }

            const keyName = baseName.toLowerCase();
            const loginId = `${keyName}@${race}.${pronounKey}`;

            if (accounts[loginId]) {
                return sendSystem(socket,
                    "That being cannot be created (another exists with this form)."
                );
            }

            accounts[loginId] = {
                name: baseName,
                password,
                race,
                pronounKey,
                pronouns: buildPronounObject(pronounKey),
                lastRoom: START_ROOM,
                createdAt: Date.now()
            };

            saveAccounts();

            sess.state = "ready";
            sess.loginId = loginId;
            sess.room = START_ROOM;

            sendSystem(socket, `A new ${race} awakens as ${baseName}. Your login ID is ${loginId}.`);
            sendRoom(socket, START_ROOM);
            return;
        }

        // --- LOGIN ---
        case "try_login": {
            let login = (data.login || "").trim().toLowerCase();
            const password = (data.password || "").trim();

            if (!login || !password) {
                return sendSystem(socket,
                    "A name and a key phrase are required."
                );
            }

            const acc = accounts[login];
            if (!acc) {
                return sendSystem(socket,
                    "No such being exists."
                );
            }

            if (acc.password !== password) {
                return sendSystem(socket,
                    "The key phrase does not match."
                );
            }

            sess.state = "ready";
            sess.loginId = login;
            sess.room = acc.lastRoom || START_ROOM;

            sendSystem(socket, `Welcome back, ${acc.name}.`);
            sendRoom(socket, sess.room);
            return;
        }

        default:
            sendSystem(socket, "The world does not understand that.");
    }
}

// ===================================
// TEXT COMMANDS
// ===================================
function handleText(socket, input) {
    const sess = sessions.get(socket);
    if (!sess || sess.state !== "ready") {
        return sendSystem(socket, "You must create or login first.");
    }

    const [cmd, ...rest] = input.split(" ");
    const arg = rest.join(" ").trim();

    switch (cmd.toLowerCase()) {

case "move": {
    if (!arg) return sendSystem(socket, "Move where?");
    const acc = accounts[sess.loginId];
    const name = acc ? acc.name : "Someone";

    const room = world[sess.room];
    if (!room || !room.exits || !room.exits[arg]) {
        return sendSystem(socket, "You cannot go that way.");
    }

    const oldRoom = sess.room;
    const newRoom = room.exits[arg];

    // Announce departure to others
    broadcastToRoomExcept(oldRoom, `[MOVE] ${name} leaves ${arg}.`, socket);

    // move player
    sess.room = newRoom;

    // save last location
    acc.lastRoom = newRoom;
    saveAccounts();

    // Announce arrival to others
    broadcastToRoomExcept(newRoom, `[MOVE] ${name} enters from ${oppositeDirection(arg)}.`, socket);

    // send room info to mover
    sendRoom(socket, newRoom);
    return;
}


            const acc = accounts[sess.loginId];
            if (acc) {
                acc.lastRoom = sess.room;
                saveAccounts();
            }

            sendRoom(socket, sess.room);
            return;
        }

case "say": {
    const acc = accounts[sess.loginId];
    const name = acc ? acc.name : "Someone";
    const msg = arg || "...";

    if (isMuted(sess)) {
        return sendSystem(socket, `[SYSTEM] Your throat is too raw to speak yet.`);
    }

    recordSpeech(sess);

    broadcastToRoom(sess.room, `[PLAYER] ${name} says:`);
    broadcastToRoom(sess.room, `[SAY] "${msg}"`);
    return;
}


    case "look":
case "l": {
    sendRoom(socket, sess.room);
    sendPlayersInRoom(socket, sess.room);
    return;
}


        default:
            sendSystem(socket, "Nothing responds.");
    }
}

// ===================================
// Send helpers
// ===================================

function oppositeDirection(dir) {
    const opposites = {
        north: "south",
        south: "north",
        east: "west",
        west: "east"
    };
    return opposites[dir] || "somewhere";
}

function sendSystem(socket, msg) {
    socket.send(JSON.stringify({ type: "system", msg }));
}

function sendRoom(socket, id) {
    const sess = sessions.get(socket);
    if (!sess) return;

    const acc = accounts[sess.loginId];
    const race = acc ? acc.race : null;

    const room = world[id];
    if (!room) {
        return sendSystem(socket, "The world frays here (missing room).");
    }

    const desc =
        (room.textByRace && race && room.textByRace[race]) ||
        room.text ||
        ["You see nothing special."];

    socket.send(JSON.stringify({
        type: "room",
        id,
        title: room.title || "Somewhere",
        desc,
        exits: Object.keys(room.exits || {}),
        background: room.background || null
    }));
}
function sendPlayersInRoom(socket, roomId) {
    const names = [];

    for (const [sock, sess] of sessions.entries()) {
        if (sess.room === roomId && sess.state === "ready") {
            const acc = accounts[sess.loginId];
            if (acc) names.push(acc.name);
        }
    }

    socket.send(JSON.stringify({
        type: "room_players",
        players: names
    }));
}

function recordSpeech(sess) {
    const now = Date.now();
    if (!sess.spamTimes) sess.spamTimes = [];

    // Keep last 10 seconds
    sess.spamTimes = sess.spamTimes.filter(t => now - t < 10000);
    sess.spamTimes.push(now);

    if (sess.spamTimes.length >= 6) {
        // escalate punishment
        if (!sess.muteLevel) sess.muteLevel = 1;

        const durations = {
            1: 5000,   // 5s
            2: 15000,  // 15s
            3: 30000,  // 30s
        };

        const mute = durations[sess.muteLevel] || 60000; // fallback 1 min
        sess.mutedUntil = now + mute;

        sess.muteLevel++; // next time is worse
    }
}

function isMuted(sess) {
    return sess.mutedUntil && Date.now() < sess.mutedUntil;
}


