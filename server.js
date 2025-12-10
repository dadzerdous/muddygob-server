// ============================
// MuddyGob MUD Server
// Accounts + Races + Pronouns
// Race-based room descriptions
// ============================
const WebSocket = require("ws");
const fs = require("fs");

const ACCOUNT_PATH = "./accounts.json";
const START_ROOM = "g3"; // Southwest bonfire

// ------------------------------------
// Load or create accounts.json
// ------------------------------------
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

// ------------------------------------
// Load world files
// ------------------------------------
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

// ------------------------------------
// WebSocket Server
// ------------------------------------
const wss = new WebSocket.Server({ port: 9000 });
console.log("MuddyGob server running on port 9000");

const sessions = new Map(); // socket → session

wss.on("connection", (socket) => {

    sessions.set(socket, {
        state: "connected",   // connected → creating → ready
        name: null,
        temp: {},             // store username, race, pronouns before finalize
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

// ==================================
// INPUT ROUTER (JSON first, fallback text)
// ==================================
function handleIncoming(socket, raw) {
    try {
        const obj = JSON.parse(raw);
        if (obj && obj.type) return handleJson(socket, obj);
    } catch {}

    handleText(socket, raw);
}

// ==================================
// JSON COMMANDS (UI buttons)
// ==================================
function handleJson(socket, data) {
    const sess = sessions.get(socket);
    console.log("JSON received:", data);


    switch (data.type) {

        // -------------------------
        // CREATE ACCOUNT STEP 1
        // -------------------------
        case "start_create":
            sess.state = "creating_name";
            return sendSystem(socket, "Enter a name.");

        case "try_create":
            if (sess.state !== "creating_name")
                return sendSystem(socket, "Unexpected.");

            const uname = (data.name || "").trim();

            if (!uname)
                return sendSystem(socket, "Name cannot be empty.");

            if (accounts[uname])
                return sendSystem(socket, "That name is already taken.");

            sess.temp.name = uname;
            sess.state = "creating_pass";
            return sendSystem(socket, "Enter a password.");

        case "choose_race":
    if (sess.state !== "creating_race")
        return sendSystem(socket, "Unexpected.");

    sess.temp.race = data.race;

    let allowed = [];
    switch (data.race) {
        case "goblin":
            allowed = ["they", "it"];
            break;
        case "elf":
            allowed = ["he", "she"];
            break;
        case "human":
            allowed = ["he", "she", "they", "it"];
            break;
    }

    sess.state = "creating_pronouns";

    socket.send(JSON.stringify({
        type: "choose_pronouns",
        allowed
    }));

    return;


        // -------------------------
        // CREATE PASSWORD
        // -------------------------
        case "try_create_pass":
            if (sess.state !== "creating_pass")
                return sendSystem(socket, "Unexpected.");

            const pass = (data.password || "").trim();
            if (!pass)
                return sendSystem(socket, "Password cannot be empty.");

            sess.temp.password = pass;
            sess.state = "creating_race";

            return socket.send(JSON.stringify({
                type: "choose_race",
                races: ["goblin", "human", "elf"]
            }));

        // -------------------------
        // RACE SELECTION
        // -------------------------
        case "choose_race":
            if (sess.state !== "creating_race")
                return sendSystem(socket, "Unexpected.");

            sess.temp.race = data.race;
            sess.state = "creating_pronouns";

            return socket.send(JSON.stringify({
                type: "choose_pronouns",
                options: ["he", "she", "they", "it"]
            }));

        // -------------------------
        // PRONOUN SELECTION
        // -------------------------
        case "choose_pronoun":
            if (sess.state !== "creating_pronouns")
                return sendSystem(socket, "Unexpected.");

            sess.temp.pronouns = buildPronounObject(data.pronoun);
            finalizeAccount(socket);
            return;

        // -------------------------
        // LOGIN
        // -------------------------
        case "try_login":
            const name = (data.name || "").trim();
            const pw = (data.password || "").trim();

            if (!accounts[name])
                return sendSystem(socket, "No such account.");
            if (accounts[name].password !== pw)
                return sendSystem(socket, "Incorrect password.");

            sess.state = "ready";
            sess.name = name;
            sess.room = accounts[name].lastRoom || START_ROOM;

            return sendRoom(socket, sess.room);
    }
}

// Build pronoun object B
function buildPronounObject(key) {
    switch (key) {
        case "he": return { subj: "he", obj: "him", poss: "his" };
        case "she": return { subj: "she", obj: "her", poss: "her" };
        case "they": return { subj: "they", obj: "them", poss: "their" };
        case "it": return { subj: "it", obj: "it", poss: "its" };
    }
}

// Finish account creation
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

// ==================================
// TEXT COMMANDS
// ==================================
function handleText(socket, input) {
    const sess = sessions.get(socket);
    if (!sess || sess.state !== "ready")
        return sendSystem(socket, "You must create/login first.");

    const parts = input.split(" ");
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(" ");

    if (cmd === "move") {
        const dir = arg.trim();
        const room = world[sess.room];

        if (!room.exits[dir])
            return sendSystem(socket, "You cannot go that way.");

        sess.room = room.exits[dir];
        accounts[sess.name].lastRoom = sess.room;
        saveAccounts();
        return sendRoom(socket, sess.room);
    }

    if (cmd === "say") {
        return sendSystem(socket, `(You say): ${arg}`);
    }

    sendSystem(socket, "Unknown command.");
}

// ==================================
// SEND HELPERS
// ==================================
function sendSystem(socket, msg) {
    socket.send(JSON.stringify({ type: "system", msg }));
}

function sendRoom(socket, id) {
    const sess = sessions.get(socket);
    const acc = accounts[sess.name];
    const race = acc.race;

    const room = world[id];
    if (!room) return sendSystem(socket, "The world fractures here.");

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
