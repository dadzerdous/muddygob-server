// =====================
// MuddyGob Render-Compatible Server
// =====================
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");

// ------------------------------------------------------
// LOAD WORLD JSON FILES
// ------------------------------------------------------
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

// ------------------------------------------------------
// CREATE REQUIRED HTTP SERVER (Render needs this)
// ------------------------------------------------------
const PORT = process.env.PORT || 9000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("MuddyGob WS server is running.\n");
});

// ------------------------------------------------------
// WEBSOCKET UPGRADE SERVER
// ------------------------------------------------------
const wss = new WebSocket.Server({ server });

console.log("MuddyGob WebSocket server initialized.");

const players = {}; // name → player data


// ------------------------------------------------------
// HANDLE WS CONNECTIONS
// ------------------------------------------------------
wss.on("connection", (socket) => {

    socket.send(JSON.stringify({
        type: "system",
        msg: "Welcome! Please choose a name using: name <yourname>"
    }));

    socket.on("message", (data) => {
        const text = data.toString().trim();
        handleCommand(socket, text);
    });

    socket.on("close", () => {
        for (const name in players) {
            if (players[name].socket === socket) {
                delete players[name];
                break;
            }
        }
    });
});


// ------------------------------------------------------
// COMMANDS
// ------------------------------------------------------
function handleCommand(socket, text) {
    const parts = text.split(" ");
    const cmd = parts[0].toLowerCase();

    // ---------------- NAME ----------------
    if (cmd === "name") {
        const name = parts[1];
        if (!name) {
            socket.send(JSON.stringify({
                type: "system",
                msg: "Please enter a name: name <yourname>"
            }));
            return;
        }

        players[name] = {
            socket,
            room: "start"
        };

        sendRoom(socket, "start");
        return;
    }

    // ---------------- MOVE ----------------
    if (cmd === "move") {
        const dir = parts[1];
        const player = getPlayer(socket);
        if (!player) return;

        const room = world[player.room];
        if (!room.exits[dir]) {
            socket.send(JSON.stringify({
                type: "system",
                msg: "You cannot go that way."
            }));
            return;
        }

        player.room = room.exits[dir];
        sendRoom(socket, player.room);
        return;
    }

    // ---------------- UNKNOWN ----------------
    socket.send(JSON.stringify({
        type: "system",
        msg: "Unknown command."
    }));
}


// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------
function getPlayer(socket) {
    return Object.values(players).find(p => p.socket === socket);
}

function sendRoom(socket, roomId) {
    const room = world[roomId];

    socket.send(JSON.stringify({
        type: "room",
        title: room.title,
        desc: room.text,
        exits: Object.keys(room.exits),
        players: [],
        background: room.background || null
    }));
}


// ------------------------------------------------------
// START SERVER (IMPORTANT FOR RENDER!)
// ------------------------------------------------------
server.listen(PORT, () => {
    console.log(`MuddyGob server running on port ${PORT}`);
});
