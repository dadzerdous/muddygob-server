// =====================
// MuddyGob Node.js MUD Server
// Login + Create + Movement + Say + Look
// =====================
const WebSocket = require("ws");
const fs = require("fs");

const ACCOUNT_PATH = "./accounts.json";
const START_ROOM = "g3"; // bonfire southwest corner

// ---------------------------
// Load or create account file
// ---------------------------
let accounts = {};
if (fs.existsSync(ACCOUNT_PATH)) {
    try {
        accounts = JSON.parse(fs.readFileSync(ACCOUNT_PATH, "utf8"));
    } catch (e) {
        console.error("Failed to parse accounts.json - starting fresh.", e);
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
        console.error("No ./world folder found!");
        return world;
    }

    const files = fs.readdirSync("./world");
    for (const file of files) {
        if (file.endsWith(".json")) {
            try {
                const data = JSON.parse(fs.readFileSync("./world/" + file, "utf8"));
                Object.assign(world, data);
            } catch (e) {
                console.error("Error loading file:", file, e);
            }
        }
    }

    return world;
}

const world = loadWorld();
console.log("Loaded rooms:", Object.keys(world));


// --------------------------------------
// WebSocket Server
// --------------------------------------
const wss = new WebSocket.Server({ port: 9000 });
console.log("MuddyGob Node.js server running on port 9000");

// socket -> session
const sessions = new Map();

wss.on("connection", (socket) => {
    console.log("New connection");

    sessions.set(socket, {
        state: "connected",
        name: null,
        room: START_ROOM
    });

    socket.send(JSON.stringify({
        type: "system",
        msg: "Connected to MuddyGob server."
    }));

    socket.on("message", (data) => {
        const text = data.toString().trim();
        handleIncoming(socket, text);
    });

    socket.on("close", () => {
        console.log("Disconnected");
        sessions.delete(socket);
    });
});


// --------------------------------------
// ROUTER (JSON first, then text)
// --------------------------------------
function handleIncoming(socket, raw) {

    // JSON UI commands (new / login)
    try {
        const obj = JSON.parse(raw);
        if (obj && obj.type) {
            handleJson(socket, obj);
            return;
        }
    } catch (_) { }

    // Otherwise classic MUD commands
    handleText(socket, raw);
}



// --------------------------------------
// JSON Commands (Create/Login)
// --------------------------------------
function handleJson(socket, data) {
    const sess = sessions.get(socket);
    if (!sess) return;

    switch (data.type) {

        case "create_account": {
            const name = (data.name || "").trim();
            const password = (data.password || "").trim();

            if (!name || !password)
                return sendSystem(socket, "Enter username and password.");

            if (accounts[name])
                return sendSystem(socket, "That name is already taken.");

            accounts[name] = {
                password,
                createdAt: Date.now(),
                lastRoom: START_ROOM
            };
            saveAccounts();

            sess.state = "ready";
            sess.name = name;
            sess.room = START_ROOM;

            sendSystem(socket, `Welcome, ${name}. Your journey begins.`);
            sendRoom(socket, sess.room);
            return;
        }

        case "login": {
            const name = (data.name || "").trim();
            const password = (data.password || "").trim();

            if (!name || !password)
                return sendSystem(socket, "Enter username and password.");

            if (!accounts[name])
                return sendSystem(socket, "No such account.");

            if (accounts[name].password !== password)
                return sendSystem(socket, "Incorrect password.");

            sess.state = "ready";
            sess.name = name;
            sess.room = accounts[name].lastRoom || START_ROOM;

            sendSystem(socket, `Welcome back, ${name}.`);
            sendRoom(socket, sess.room);
            return;
        }

        default:
            sendSystem(socket, "Unknown command.");
    }
}



// --------------------------------------
// TEXT COMMANDS (Gameplay)
// --------------------------------------
function handleText(socket, input) {
    const sess = sessions.get(socket);
    if (!sess) return;

    const parts = input.split(" ");
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(" ");

    // Must be logged in
    if (sess.state !== "ready")
        return sendSystem(socket, "Create or login first.");

    // ------------------------
    // LOOK
    // ------------------------
    if (cmd === "look") {
        sendRoom(socket, sess.room);
        return;
    }

    // ------------------------
    // SAY (broadcast)
    // ------------------------
    if (cmd === "say") {
        if (!arg)
            return sendSystem(socket, "Say what?");

        broadcast(`${sess.name} says: ${arg}`);
        return;
    }

    // ------------------------
    // MOVE
    // ------------------------
    if (cmd === "move") {
        const rawDir = arg.trim();

        const dir = normalizeDirection(rawDir);

        if (!dir)
            return sendSystem(socket, "Move where?");

        const room = world[sess.room];
        if (!room || !room.exits || !room.exits[dir]) {
            return sendSystem(socket, "You cannot go that way.");
        }

        sess.room = room.exits[dir];

        if (accounts[sess.name]) {
            accounts[sess.name].lastRoom = sess.room;
            saveAccounts();
        }

        sendRoom(socket, sess.room);
        return;
    }

    sendSystem(socket, "Unknown command.");
}



// --------------------------------------
// Direction Mapper
// --------------------------------------
function normalizeDirection(dir) {
    if (!dir) return null;

    dir = dir.toLowerCase();

    // UI arrows
    if (dir === "up") return "north";
    if (dir === "down") return "south";
    if (dir === "left") return "west";
    if (dir === "right") return "east";

    // direct synonyms
    if (dir === "n") return "north";
    if (dir === "s") return "south";
    if (dir === "e") return "east";
    if (dir === "w") return "west";

    return dir;
}



// --------------------------------------
// Send helpers
// --------------------------------------
function sendSystem(socket, msg) {
    socket.send(JSON.stringify({ type: "system", msg }));
}

function broadcast(msg) {
    for (const [sock] of sessions) {
        sock.send(JSON.stringify({ type: "system", msg }));
    }
}

function sendRoom(socket, id) {
    const room = world[id];
    if (!room) {
        return sendSystem(socket, `The world frays here. (Unknown room: ${id})`);
    }

    socket.send(JSON.stringify({
        type: "room",
        id,
        title: room.title || "Somewhere",
        desc: room.text || [],
        exits: room.exits ? Object.keys(room.exits) : [],
        players: [], // future multiplayer
        background: room.background || null
    }));
}
