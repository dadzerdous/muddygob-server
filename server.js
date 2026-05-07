// ===============================================
// MuddyGob — CLEAN MODULAR SERVER.JS
// ===============================================

const WebSocket = require("ws");
const fs = require("fs");

process.on("uncaughtException", err => {
    console.error("🔥 UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", err => {
    console.error("🔥 UNHANDLED PROMISE REJECTION:", err);
});

// ------------------------------han
// Load core modules
// ------------------------------
const Accounts = require("./core/accounts");
const Sessions = require("./core/sessions");
const World    = require("./core/world");
const Room     = require("./core/room");
const Spam     = require("./core/spam");

// ------------------------------
// Load commands folder
// ------------------------------
const commands = {};
const cmdFiles = fs.readdirSync("./commands").filter(f => f.endsWith(".js"));

for (const f of cmdFiles) {
    try {
        const cmd = require(`./commands/${f}`);
        commands[cmd.name] = cmd;

        if (cmd.aliases) {
            for (const a of cmd.aliases) commands[a] = cmd;
        }
    } catch (err) {
        console.error("[COMMAND] Failed:", f, err);
    }
}

console.log("[COMMANDS] Loaded:", Object.keys(commands));

// ------------------------------
// Constants
// ------------------------------
const PORT = process.env.PORT || 9000;
const START_ROOM = "forest-g3";

// ------------------------------
// Start WebSocket server
// ------------------------------
const wss = new WebSocket.Server({ port: PORT });
console.log("MuddyGob server running on port", PORT);

// Allow global access for commands like /who
global.sessions = Sessions.sessions;

// ------------------------------
// Handle new connections
// ------------------------------
wss.on("connection", socket => {
    console.log("New connection");

    Sessions.create(socket, START_ROOM);
    Sessions.broadcastPlayerCount();

    Sessions.sendSystem(socket, "Connected to MuddyGob. Press New or Login.");

    // Log every message the client sends
    socket.on("message", msg => {
        console.log("[WS RAW]", msg.toString());
        handleIncoming(socket, msg.toString().trim());
    });

    socket.on("close", () => {
        Sessions.remove(socket);
        Sessions.broadcastPlayerCount();
        console.log("Connection closed");
    });
});


// ------------------------------
// Handle JSON or text commands
// ------------------------------
function handleIncoming(socket, raw) {

    // Try JSON first
    try {
        const data = JSON.parse(raw);
        if (data?.type) return handleJSON(socket, data);
    } catch {}

    // Otherwise handle text commands
    handleText(socket, raw);
}

// ------------------------------
// JSON commands (UI-driven)
// ------------------------------
function handleJSON(socket, data) {
    const sess = Sessions.get(socket);
    if (!sess) return;

        console.log("[JSON]", data.type, data.name || data.login || data.token || "");

    // Heartbeat ping/pong
    if (data.type === "ping") return socket.send("pong");

    switch (data.type) {

        case "create_account":
            console.log("[JSON] create_account", data.name);
            return Accounts.create(socket, sess, data, START_ROOM, Room.sendRoom);

        case "try_login":
            console.log("[JSON] try_login", data.login);
            return Accounts.login(socket, sess, data, START_ROOM, Room.sendRoom);

        case "resume":
            console.log("[JSON] resume", data.token);
            return Accounts.resume(socket, sess, data, START_ROOM, Room.sendRoom);

        default:
            return Sessions.sendSystem(socket, "The world does not understand that.");
    }
}

// ------------------------------
// Text commands (movement, say, look…)
// ONLY CALLED AFTER LOGIN
// ------------------------------
function handleText(socket, input) {
    const sess = Sessions.get(socket);

    // Safety: text commands require an active session
    if (!sess || sess.state !== "ready") {
        Sessions.sendSystem(socket, "You must create or login first.");
        return;
    }

    // --------------------------------
    // Basic command parsing
    // --------------------------------
    const [cmd, ...rest] = input.split(" ");
    const arg = rest.join(" ").trim();
    const lower = cmd.toLowerCase();

    // --------------------------------
    // Built-in WHO command
    // --------------------------------
    if (lower === "who") {
        return Sessions.doWho(socket);
    }

    // --------------------------------
    // Movement shortcuts
    // --------------------------------
    if (["n", "s", "e", "w", "north", "south", "east", "west", "move"].includes(lower)) {
        return Room.handleMove(socket, sess, lower, arg);
    }

    // --------------------------------
    // Reset vote / cancel
    // --------------------------------
    if (lower === "resetvote")   return Room.handleResetVote(socket, sess);
    if (lower === "resetcancel") return Room.handleResetCancel(socket, sess);

    // --------------------------------
    // Wield / unwield
    // --------------------------------
    if (lower === "wield") {
        const acc = Accounts.data[sess.loginId];
        if (!acc) return;
        const itemId = arg?.trim().toLowerCase();
        if (!itemId) return Sessions.sendSystem(socket, "Wield what?");
        const inHands = acc.hands.left === itemId || acc.hands.right === itemId;
        if (!inHands) return Sessions.sendSystem(socket, `You aren't holding a ${itemId}.`);
        if (!sess.wielding) sess.wielding = {};
        sess.wielding[itemId] = true;
        socket.send(JSON.stringify({ type: 'wielding', wielding: sess.wielding }));
        Sessions.sendSystem(socket, `You wield the ${itemId}.`);
        return;
    }
    if (lower === "unwield") {
        const itemId = arg?.trim().toLowerCase();
        if (sess.wielding) delete sess.wielding[itemId];
        socket.send(JSON.stringify({ type: 'wielding', wielding: sess.wielding || {} }));
        Sessions.sendSystem(socket, `You lower the ${itemId}.`);
        return;
    }

    // --------------------------------
    // Combat
    // --------------------------------
    const Combat = require('./commands/combat');
    if (lower === "engage") {
        return Combat.startCombat(socket, sess, arg || 'goblin');
    }
    if (lower === "attack") {
        const acc = Accounts.data[sess.loginId];
        const weaponId = arg?.trim().toLowerCase() || acc?.hands?.left || acc?.hands?.right;
        return Combat.playerAttack(socket, sess, weaponId);
    }
    if (lower === "retreat" || lower === "flee") {
        return Combat.retreat(socket, sess);
    }

    // --------------------------------
    // Commands folder
    // --------------------------------
    if (commands[lower]) {
        return commands[lower].execute({
            socket,
            sess,
            accounts: Accounts.data,
            world: World,
            cmdName: lower,

            sendRoom: Room.sendRoom,
            sendSystem: Sessions.sendSystem,
            commands,
            broadcastToRoomExcept: Sessions.broadcastToRoomExcept,
            oppositeDirection: Room.oppositeDirection,
            saveAccounts: Accounts.save
        }, arg);
    }

    // --------------------------------
    // Fallback
    // --------------------------------
    Sessions.sendSystem(socket, "Nothing responds.");
}

console.log("[SERVER] Ready.");
