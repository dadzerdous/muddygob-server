// =====================
// Simple MUD WebSocket Server
// =====================
const WebSocket = require("ws");
const fs = require("fs");

// Load rooms from /world folder
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

const wss = new WebSocket.Server({ port: 9000 });
console.log("MuddyGob Node.js server running on port 9000");

const players = {}; // name → player data

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
        // remove any player tied to this socket
        for (const name in players) {
            if (players[name].socket === socket) {
                delete players[name];
                break;
            }
        }
    });
});

// ===============
// Command Handler
// ===============
function handleCommand(socket, text) {
    const parts = text.split(" ");
    const cmd = parts[0].toLowerCase();

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

    socket.send(JSON.stringify({
        type: "system",
        msg: "Unknown command."
    }));
}

// Find player by socket
function getPlayer(socket) {
    return Object.values(players).find(p => p.socket === socket);
}

// Send room info to player
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
