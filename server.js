// ============================
// MuddyGob MUD Server
// Accounts + Races + Pronouns
// Room loading + Chat Broadcast
// ============================

const WebSocket = require("ws");
const fs = require("fs");


// ===================================
// Load commands from ./commands
// ===================================
const commands = {};
const commandFiles = fs.readdirSync("./commands").filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
    try {
        const cmd = require(`./commands/${file}`);
        commands[cmd.name] = cmd;

        if (cmd.aliases) {
            for (const a of cmd.aliases) {
                commands[a] = cmd;
            }
        }
    } catch (e) {
        console.error("[COMMANDS] Failed to load:", file, e);
    }
}

console.log("[COMMANDS] Loaded:", Object.keys(commands));

const ACCOUNT_PATH = "accounts.json";
const START_ROOM = "forest-g3";

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
// Recursively load world/*.json
// ===================================
function loadWorldRecursive(dir, world = {}) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;

        if (entry.isDirectory()) {
            loadWorldRecursive(fullPath, world);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
            try {
                const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
                Object.assign(world, data);
            } catch (e) {
                console.error("FAILED TO LOAD ROOM FILE:", fullPath, e);
            }
        }
    }

    return world;
}

const world = loadWorldRecursive("./world");
console.log("Loaded rooms:", Object.keys(world));


// ===================================
// WebSocket Server
// ===================================
const wss = new WebSocket.Server({ port: 9000 });
console.log("MuddyGob server running on port 9000");

const sessions = new Map(); // socket -> { state, loginId, room }
global.sessions = sessions;


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

// Compatibility: broadcast to everyone in room
function broadcastToRoom(roomId, msg) {
    for (const [sock, sess] of sessions.entries()) {
        if (sess.room === roomId && sess.state === "ready") {
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

    // Call *after* setting the session
    broadcastPlayerCount();

    sendSystem(socket, "Connected to MuddyGob. Press New or Login.");

    socket.on("message", (data) => {
        const text = data.toString().trim();
        handleIncoming(socket, text);
    });

    socket.on("close", () => {
        sessions.delete(socket);
        broadcastPlayerCount();
        console.log("Connection closed");
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
    // Handle heartbeat
if (data.type === "ping") {
    socket.send("pong");
    return;
}

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

function normalizeDir(dir) {
    const map = {
        n: "north",
        s: "south",
        e: "east",
        w: "west",
        north: "north",
        south: "south",
        east: "east",
        west: "west"
    };
    return map[dir.toLowerCase()] || dir.toLowerCase();
}


function handleText(socket, input) {
    const sess = sessions.get(socket);
    if (!sess || sess.state !== "ready") {
        return sendSystem(socket, "You must create or login first.");
    }

    const [cmd, ...rest] = input.split(" ");
    const arg   = rest.join(" ").trim();
    const lower = cmd.toLowerCase();

    // --- BUILT-IN COMMAND: WHO ---
    if (lower === "who") {
        const names = [];

        for (const [sock, s] of sessions.entries()) {
            if (s.state === "ready") {
                const acc = accounts[s.loginId];
                if (acc && acc.name) {
                    names.push(acc.name);
                }
            }
        }

        if (names.length <= 1) {
            return sendSystem(socket, "No other presences stir in this world.");
        }

        const list = names.map(n => `• ${n}`).join("\n");
        return sendSystem(socket,
            "Others breathing in this world:\n" + list
        );
    }

    // --- FALL THROUGH TO COMMANDS FOLDER ---
if (commands[lower]) {
    return commands[lower].execute({
        socket,
        sess,
        accounts,
        world,
        sendRoom,
        sendSystem,
        commands,
        broadcastToRoomExcept,
        oppositeDirection,
        saveAccounts
    }, arg);
}



    sendSystem(socket, "Nothing responds.");
}


// ===================================
// MOVEMENT HANDLER
// ===================================
function handleMove(socket, arg) {
    const sess = sessions.get(socket);
    const acc = accounts[sess.loginId];
    const name = acc ? acc.name : "Someone";

    const dir = normalizeDir(arg);
    const room = world[sess.room];

    if (!room || !room.exits || !room.exits[dir]) {
        return sendSystem(socket, "You cannot go that way.");
    }

    const oldRoom = sess.room;
    const newRoom = room.exits[dir];

    // notify others in old room
    broadcastToRoomExcept(oldRoom, `[MOVE] ${name} leaves ${dir}.`, socket);

    // move player
    sess.room = newRoom;
    acc.lastRoom = newRoom;
    saveAccounts();

    // notify others in new room
    broadcastToRoomExcept(newRoom, `[MOVE] ${name} enters from ${oppositeDirection(dir)}.`, socket);

    sendRoom(socket, newRoom);
}


// ===================================
// Send helpers
// ===================================

function broadcastPlayerCount() {
    const count = [...sessions.values()].filter(s => s.state === "ready").length;

    for (const [sock, sess] of sessions.entries()) {
        sock.send(JSON.stringify({
            type: "players_online",
            count
        }));
    }
}


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

    const acc  = accounts[sess.loginId];
    const race = acc ? acc.race : null;

    const room = world[id];
    if (!room) {
        return sendSystem(socket, "The world frays here (missing room).");
    }

    // --- Collect players in this room ---
    const playersHere = [];
    for (const [sock, s] of sessions.entries()) {
        if (s.room === id && s.state === "ready") {
            const a = accounts[s.loginId];
            if (a && a.name) {
                playersHere.push(a.name);
            }
        }
    }

    // --- Choose correct description (race-based or general) ---
    const desc =
        (room.textByRace && race && room.textByRace[race]) ||
        room.text ||
        ["You see nothing special."];

    // --- NEW: Collect room objects (e.g., rock, pond) ---
    const objectList = [];
    if (room.objects) {
        for (const [name, obj] of Object.entries(room.objects)) {
            objectList.push({
                name,
                emoji: obj.emoji || null,
                actions: obj.actions || [],
                desc:
                    (obj.textByRace && race && obj.textByRace[race]) ||
                    obj.text ||
                    null
            });
        }
    }

    // --- Send room to client ---
    socket.send(JSON.stringify({
        type: "room",
        id,
        title: room.title || "Somewhere",
        desc,
        exits: Object.keys(room.exits || {}),
        background: room.background || null,
        players: playersHere,
        objects: objectList     // 👈 NEW — now client sees rock, pond, etc.
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


