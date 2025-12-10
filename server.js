// =====================
// MuddyGob Node.js MUD Server
// Modern JSON login + create + text commands in-game
// =====================
const WebSocket = require("ws");
const fs = require("fs");

const ACCOUNT_PATH = "./accounts.json";
const START_ROOM = "g3"; // SW corner bonfire spawn

// ---------------------------
// Load or create account file
// ---------------------------
let accounts = {};
if (fs.existsSync(ACCOUNT_PATH)) {
    try {
        accounts = JSON.parse(fs.readFileSync(ACCOUNT_PATH, "utf8"));
    } catch (e) {
        console.error("Failed to parse accounts.json, starting fresh.", e);
        accounts = {};
    }
} else {
    fs.writeFileSync(ACCOUNT_PATH, "{}");
}

function saveAccounts() {
    fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(accounts, null, 2));
}

// ---------------------------
// Load world rooms from ./world/*.json
// ---------------------------
function loadWorld() {
    const world = {};
    if (!fs.existsSync("./world")) {
        console.error("No ./world directory found!");
        return world;
    }

    const files = fs.readdirSync("./world");
    for (const file of files) {
        if (file.endsWith(".json")) {
            try {
                const data = JSON.parse(fs.readFileSync("./world/" + file, "utf8"));
                Object.assign(world, data);
            } catch (e) {
                console.error("Failed to load world file:", file, e);
            }
        }
    }
    return world;
}

const world = loadWorld();
console.log("Loaded rooms:", Object.keys(world));


// ---------------------------
// WebSocket Server
// ---------------------------
const wss = new WebSocket.Server({ port: 9000 });
console.log("MuddyGob Node.js server running on port 9000");

// socket -> { state, name, room }
const sessions = new Map();

wss.on("connection", (socket) => {
    console.log("New connection");

    sessions.set(socket, {
        state: "connected", // connected -> ready
        name: null,
        room: START_ROOM
    });

    // Just let the client know we're alive.
    socket.send(JSON.stringify({
        type: "system",
        msg: "Connected to MuddyGob server."
    }));

    socket.on("message", (data) => {
        const text = data.toString().trim();
        handleIncoming(socket, text);
    });

    socket.on("close", () => {
        console.log("Connection closed");
        sessions.delete(socket);
    });
});

// ---------------------------
// Incoming message router
// ---------------------------
function handleIncoming(socket, raw) {
    // Try JSON first (for login/create/etc)
    try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object" && obj.type) {
            handleJsonCommand(socket, obj);
            return;
        }
    } catch (_e) {
        // Not JSON, fall through to text command
    }

    // Otherwise, treat as classic text command (e.g. "move up")
    handleTextCommand(socket, raw);
}

// ---------------------------
// JSON commands (UI buttons)
// ---------------------------
function handleJsonCommand(socket, data) {
    const sess = sessions.get(socket);
    if (!sess) return;

    switch (data.type) {
        case "create_account": {
            const name = (data.name || "").trim();
            const password = (data.password || "").trim();

            if (!name || !password) {
                return sendSystem(socket, "Please enter both a username and a password.");
            }

            if (accounts[name]) {
                return sendSystem(socket, "That name is already taken.");
            }

            accounts[name] = {
                password,
                createdAt: Date.now(),
                lastRoom: START_ROOM
            };
            saveAccounts();

            sess.state = "ready";
            sess.name = name;
            sess.room = START_ROOM;

            sendSystem(socket, `Welcome, ${name}. Your journey begins at the bonfire.`);
            sendRoom(socket, sess.room);
            return;
        }

        case "login": {
            const name = (data.name || "").trim();
            const password = (data.password || "").trim();

            if (!name || !password) {
                return sendSystem(socket, "Please enter both username and password.");
            }

            if (!accounts[name]) {
                return sendSystem(socket, "No such account. Try creating a new one.");
            }

            if (accounts[name].password !== password) {
                return sendSystem(socket, "Incorrect password.");
            }

            sess.state = "ready";
            sess.name = name;
            sess.room = accounts[name].lastRoom || START_ROOM;

            sendSystem(socket, `Welcome back, ${name}.`);
            sendRoom(socket, sess.room);
            return;
        }

        default:
            console.log("Unknown JSON command:", data);
            sendSystem(socket, "Unknown command.");
    }
}

// ---------------------------
// Text commands (in-game)
// ---------------------------
function handleTextCommand(socket, input) {
    const sess = sessions.get(socket);
    if (!sess) return;

    const parts = input.split(" ");
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(" ");

    // Block in-game commands until logged in
    if (sess.state !== "ready") {
        return sendSystem(socket, "You must create or login before moving.");
    }

    if (cmd === "move") {
        const dir = arg.trim();
        if (!dir) {
            return sendSystem(socket, "Move where?");
        }

        const room = world[sess.room];
        if (!room || !room.exits || !room.exits[dir]) {
            return sendSystem(socket, "You cannot go that way.");
        }

        sess.room = room.exits[dir];
        // update last room
        if (sess.name && accounts[sess.name]) {
            accounts[sess.name].lastRoom = sess.room;
            saveAccounts();
        }

        sendRoom(socket, sess.room);
        return;
    }

    // You can add say/look/etc here later
    sendSystem(socket, "Unknown command.");
}

// ---------------------------
// Send helpers
// ---------------------------
function sendSystem(socket, msg) {
    socket.send(JSON.stringify({ type: "system", msg }));
}

function sendRoom(socket, id) {
    const room = world[id];
    if (!room) {
        return sendSystem(socket, "The world frays here. (Unknown room.)");
    }

    socket.send(JSON.stringify({
        type: "room",
        id,
        title: room.title || "Somewhere",
        desc: room.text || [],
        exits: room.exits ? Object.keys(room.exits) : [],
        players: [], // multiplayer later
        background: room.background || null
    }));
}
