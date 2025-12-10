// ===============================================
// MuddyGob MUD Server - Clean, Fixed Version
// ===============================================

const WebSocket = require("ws");
const fs = require("fs");

const ACCOUNT_PATH = "./accounts.json";
const START_ROOM = "g3";

// ---------------------------------------
// Load or initialize accounts file
// ---------------------------------------
let accounts = {};
if (fs.existsSync(ACCOUNT_PATH)) {
    try { accounts = JSON.parse(fs.readFileSync(ACCOUNT_PATH, "utf8")); }
    catch { accounts = {}; }
} else {
    fs.writeFileSync(ACCOUNT_PATH, "{}");
}

function saveAccounts() {
    fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(accounts, null, 2));
}

// ---------------------------------------
// Load world from /world/*.json
// ---------------------------------------
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
console.log("Loaded rooms:", Object.keys(world));

// ---------------------------------------
// WebSocket Server
// ---------------------------------------
const wss = new WebSocket.Server({ port: 9000 });
console.log("MuddyGob server running on port 9000");

const sessions = new Map(); // socket → session

wss.on("connection", (socket) => {
    sessions.set(socket, {
        state: "connected",   // connected → creating_name → creating_pass → creating_race → creating_pronouns → ready
        temp: {},
        name: null,
        room: START_ROOM
    });

    socket.send(JSON.stringify({
        type: "system",
        msg: "Connected. Press NEW or LOGIN."
    }));

    socket.on("message", (data) => {
        const text = data.toString().trim();
        handleIncoming(socket, text);
    });

    socket.on("close", () => sessions.delete(socket));
});

// ===============================================
// ROUTER (Try JSON, else text)
// ===============================================
function handleIncoming(socket, raw) {
    try {
        const obj = JSON.parse(raw);
        if (obj?.type) return handleJson(socket, obj);
    } catch {}

    handleText(socket, raw);
}

// ===============================================
// JSON COMMANDS
// ===============================================
function handleJson(socket, data) {
    const sess = sessions.get(socket);
    console.log("JSON:", data);

    switch (data.type) {

        // -------------------------------------------
        // Start create flow
        // -------------------------------------------
        case "start_create":
            sess.state = "creating_name";
            sendSystem(socket, "Enter a username.");
            return;

        case "try_create":
            if (sess.state !== "creating_name")
                return sendSystem(socket, "Unexpected.");

            const uname = (data.name || "").trim();
            if (!uname) return sendSystem(socket, "Name cannot be empty.");
            if (accounts[uname]) return sendSystem(socket, "Name already taken.");

            sess.temp.name = uname;
            sess.state = "creating_pass";
            sendSystem(socket, "Enter a password.");
            return;

        case "try_create_pass":
            if (sess.state !== "creating_pass")
                return sendSystem(socket, "Unexpected.");

            const pw = (data.password || "").trim();
            if (!pw) return sendSystem(socket, "Password cannot be empty.");

            sess.temp.password = pw;
            sess.state = "creating_race";

            // Ask client to show race UI
            socket.send(JSON.stringify({
                type: "choose_race",
                races: ["goblin", "human", "elf"]
            }));
            return;

        // -------------------------------------------
        // Race selection (this must ONLY appear once)
        // -------------------------------------------
        case "choose_race":
            if (sess.state !== "creating_race")
                return sendSystem(socket, "Unexpected.");

            sess.temp.race = data.race;

            let allowed = [];
            switch (data.race) {
                case "goblin": allowed = ["they", "it"]; break;
                case "elf":    allowed = ["he", "she"]; break;
                case "human":  allowed = ["he", "she", "they", "it"]; break;
            }

            sess.state = "creating_pronouns";

            socket.send(JSON.stringify({
                type: "choose_pronouns",
                allowed
            }));
            return;

        // -------------------------------------------
        // Pronouns
        // -------------------------------------------
        case "choose_pronoun":
            if (sess.state !== "creating_pronouns")
                return sendSystem(socket, "Unexpected.");

            sess.temp.pronouns = buildPronounObject(data.pronoun);
            finalizeAccount(socket);
            return;

        // -------------------------------------------
        // LOGIN
        // -------------------------------------------
        case "try_login":
            const loginName = (data.name || "").trim();
            const loginPw = (data.password || "").trim();

            if (!accounts[loginName])
                return sendSystem(socket, "No such account.");

            if (accounts[loginName].password !== loginPw)
                return sendSystem(socket, "Incorrect password.");

            sess.state = "ready";
            sess.name = loginName;
            sess.room = accounts[loginName].lastRoom || START_ROOM;

            sendRoom(socket, sess.room);
            return;
    }
}

// ===============================================
// Build pronoun object
// ===============================================
function buildPronounObject(key) {
    switch (key) {
        case "he": return { subj: "he", obj: "him", poss: "his" };
        case "she": return { subj: "she", obj: "her", poss: "her" };
        case "they": return { subj: "they", obj: "them", poss: "their" };
        case "it": return { subj: "it", obj: "it", poss: "its" };
    }
}

// ===============================================
// Finalize account creation
// ===============================================
function finalizeAccount(socket) {
    const sess = sessions.get(socket);
    const t = sess.temp;

    accounts[t.name] = {
        password: t.password,
        race: t.race,
        pronouns: t.pronouns,
        createdAt: Date.now(),
        lastRoom: START_ROOM
    };

    saveAccounts();

    sess.name = t.name;
    sess.room = START_ROOM;
    sess.state = "ready";

    sendSystem(socket, `Welcome, ${sess.name}.`);
    sendRoom(socket, sess.room);
}

// ===============================================
// TEXT COMMANDS
// ===============================================
function handleText(socket, input) {
    const sess = sessions.get(socket);

    if (!sess || sess.state !== "ready")
        return sendSystem(socket, "You must login first.");

    const room = world[sess.room];
    const parts = input.split(" ");
    const cmd = parts[0].toLowerCase();

    if (cmd === "move") {
        const dir = parts[1];
        if (!room.exits[dir])
            return sendSystem(socket, "You cannot go that way.");

        sess.room = room.exits[dir];
        accounts[sess.name].lastRoom = sess.room;
        saveAccounts();

        return sendRoom(socket, sess.room);
    }

    if (cmd === "say") {
        return sendSystem(socket, `(You say): ${parts.slice(1).join(" ")}`);
    }

    sendSystem(socket, "Unknown command.");
}

// ===============================================
// SEND SYSTEM MESSAGE
// ===============================================
function sendSystem(socket, msg) {
    socket.send(JSON.stringify({ type: "system", msg }));
}

// ===============================================
// SEND ROOM PACKET
// ===============================================
function sendRoom(socket, id) {
    const sess = sessions.get(socket);
    const acc = accounts[sess.name];
    const race = acc.race;

    const room = world[id];
    if (!room) {
        return sendSystem(socket, "The world fractures here.");
    }

    const desc =
        room.textByRace?.[race] ??
        room.text ??
        ["You see nothing special."];

    socket.send(JSON.stringify({
        type: "room",
        id,
        title: room.title,
        desc,
        exits: Object.keys(room.exits || {}),
        players: [],
        background: room.background || null
    }));
}
