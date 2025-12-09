// =====================
// MuddyGob Node.js MUD Server
// With name + password account system
// =====================
const WebSocket = require("ws");
const fs = require("fs");

const ACCOUNT_PATH = "./accounts.json";

// ---------------------------
// Load or create account file
// ---------------------------
let accounts = {};
if (fs.existsSync(ACCOUNT_PATH)) {
    accounts = JSON.parse(fs.readFileSync(ACCOUNT_PATH, "utf8"));
} else {
    fs.writeFileSync(ACCOUNT_PATH, "{}");
}

// Save accounts to disk
function saveAccounts() {
    fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(accounts, null, 2));
}


// ---------------------------
// Load world rooms
// ---------------------------
function loadWorld() {
    const world = {};
    const files = fs.readdirSync("./world");

    for (const file of files) {
        if (file.endsWith(".json")) {
            const data = JSON.parse(fs.readFileSync("./world/" + file, "utf8"));
            Object.assign(world, data);
        }
    }
    return world;
}

const world = loadWorld();

// ---------------------------
// WebSocket Server
// ---------------------------
const wss = new WebSocket.Server({ port: 9000 });
console.log("MuddyGob Node.js server running on port 9000");

// Player sessions (socket → session data)
const sessions = new Map();

wss.on("connection", (socket) => {

    // new temp session
    sessions.set(socket, {
        state: "awaiting_name",   // awaiting_name → awaiting_pass_create → awaiting_pass_login → ready
        name: null,
        room: "start"
    });

    socket.send(JSON.stringify({
        type: "system",
        msg: "Greetings! Please enter your name using: name <yourname>"
    }));

    socket.on("message", (data) => {
        const text = data.toString().trim();
        handleCommand(socket, text);
    });

    socket.on("close", () => {
        sessions.delete(socket);
    });
});


// ===========================
// COMMAND HANDLER
// ===========================
function handleCommand(socket, input) {
    const parts = input.split(" ");
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(" ");

    const sess = sessions.get(socket);
    if (!sess) return;

    // ------------------------------------
    // 1. NAME
    // ------------------------------------
    if (cmd === "name") {
        if (!arg) {
            return send(socket, "system", "Usage: name <yourname>");
        }

        sess.name = arg;

        if (accounts[arg]) {
            // Returning player
            sess.state = "awaiting_pass_login";
            return send(socket, "system",
                `Welcome back, ${arg}. Please enter your password:\npass <password>`
            );
        } else {
            // New player
            sess.state = "awaiting_pass_create";
            return send(socket, "system",
                `New character. Please create a password:\npass create <password>`
            );
        }
    }

    // ------------------------------------
    // 2. PASSWORD CREATE
    // ------------------------------------
    if (cmd === "pass" && sess.state === "awaiting_pass_create") {

        const parts = arg.split(" ");
        if (parts[0] !== "create" || !parts[1]) {
            return send(socket, "system", "Usage: pass create <password>");
        }

        const password = parts[1];

        // Save new account
        accounts[sess.name] = {
            password,
            createdAt: Date.now(),
            lastRoom: "start"
        };
        saveAccounts();

        sess.state = "ready";
        sess.room = "start";

        sendRoom(socket, "start");
        return;
    }

    // ------------------------------------
    // 3. PASSWORD LOGIN
    // ------------------------------------
    if (cmd === "pass" && sess.state === "awaiting_pass_login") {

        const password = arg.trim();
        if (!password) {
            return send(socket, "system", "Usage: pass <password>");
        }

        if (accounts[sess.name].password !== password) {
            return send(socket, "system", "Incorrect password.");
        }

        // Good login
        sess.state = "ready";
        sess.room = accounts[sess.name].lastRoom || "start";

        sendRoom(socket, sess.room);
        return;
    }

    // ------------------------------------
    // Block all commands before login
    // ------------------------------------
    if (sess.state !== "ready") {
        return send(socket, "system", "Please enter your name and password first.");
    }

    // ------------------------------------
    // MOVE
    // ------------------------------------
    if (cmd === "move") {
        const dir = arg;

        const room = world[sess.room];
        if (!room || !room.exits[dir]) {
            return send(socket, "system", "You cannot go that way.");
        }

        sess.room = room.exits[dir];
        accounts[sess.name].lastRoom = sess.room;
        saveAccounts();

        sendRoom(socket, sess.room);
        return;
    }

    // ------------------------------------
    // Unknown command
    // ------------------------------------
    send(socket, "system", "Unknown command.");
}


// ===========================
// SEND HELPERS
// ===========================
function send(socket, type, msg) {
    socket.send(JSON.stringify({ type, msg }));
}

function sendRoom(socket, id) {
    const room = world[id];
    socket.send(JSON.stringify({
        type: "room",
        title: room.title,
        desc: room.text,
        exits: Object.keys(room.exits),
        players: [],
        background: room.background || null
    }));
}
