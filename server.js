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

// ------------------------------------
// Load world files
// ------------------------------------
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

// ------------------------------------
// WebSocket Server
// ------------------------------------
const wss = new WebSocket.Server({ port: 9000 });
console.log("MuddyGob server running on port 9000");

const sessions = new Map(); // socket -> { state, loginId, room }

// Pronoun helpers
const RACE_OPTIONS = ["goblin", "human", "elf"];
const RACE_PRONOUNS = {
    goblin: ["they", "it"],
    elf: ["he", "she"],
    human: ["he", "she", "they", "it"]
};

function buildPronounObject(key) {
    switch (key) {
        case "he":   return { subj: "he",   obj: "him",  poss: "his"   };
        case "she":  return { subj: "she",  obj: "her",  poss: "her"   };
        case "they": return { subj: "they", obj: "them", poss: "their" };
        case "it":   return { subj: "it",   obj: "it",   poss: "its"   };
        default:     return { subj: key,    obj: key,    poss: key + "'s" };
    }
}

wss.on("connection", (socket) => {
    console.log("New connection");

    sessions.set(socket, {
        state: "connected",   // "connected" -> "ready"
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

// ==================================
// INPUT ROUTER (JSON first, fallback text)
// ==================================
function handleIncoming(socket, raw) {
    // Try JSON
    try {
        const obj = JSON.parse(raw);
        if (obj && obj.type) {
            handleJson(socket, obj);
            return;
        }
    } catch (_) {
        // Not JSON, fall through to text
    }

    handleText(socket, raw);
}

// ==================================
// JSON COMMANDS (UI buttons)
// ==================================
function handleJson(socket, data) {
    const sess = sessions.get(socket);
    if (!sess) return;

    switch (data.type) {
        // -------------------------
        // CREATE ACCOUNT (single shot)
        // -------------------------
        case "create_account": {
            const baseNameRaw = (data.name || "").trim();
            const password = (data.password || "").trim();
            const race = (data.race || "").trim().toLowerCase();
            const pronounKey = (data.pronoun || "").trim().toLowerCase();

            // Basic presence
            if (!baseNameRaw || !password || !race || !pronounKey) {
                return sendSystem(socket,
                    "That being cannot be created (missing name, password, race, or pronouns)."
                );
            }

            // Name rules: 4–16 letters, apostrophe allowed, no spaces/numbers
            const NAME_RE = /^[A-Za-z']{4,16}$/;
            if (!NAME_RE.test(baseNameRaw)) {
                return sendSystem(socket,
                    "That being cannot be created (name must be 4–16 letters; apostrophes allowed)."
                );
            }

            // Race + pronoun validation
            if (!RACE_OPTIONS.includes(race)) {
                return sendSystem(socket,
                    "That being cannot be created (its ancestry feels… wrong)."
                );
            }

            const allowedPronouns = RACE_PRONOUNS[race] || [];
            if (!allowedPronouns.includes(pronounKey)) {
                return sendSystem(socket,
                    "That being cannot be created (those pronouns do not fit this ancestry)."
                );
            }

            // Build loginId: name@race.pronoun (case-insensitive key)
            const baseLower = baseNameRaw.toLowerCase();
            const loginId = `${baseLower}@${race}.${pronounKey}`;

            if (accounts[loginId]) {
                return sendSystem(socket,
                    "That being cannot be created (a " +
                    race +
                    " with those pronouns already carries that name)."
                );
            }

            const pronouns = buildPronounObject(pronounKey);

            accounts[loginId] = {
                name: baseNameRaw,
                password,
                race,
                pronounKey,
                pronouns,
                createdAt: Date.now(),
                lastRoom: START_ROOM
            };
            saveAccounts();

            sess.state = "ready";
            sess.loginId = loginId;
            sess.room = START_ROOM;

            sendSystem(
                socket,
                `A new ${race} stirs in the dark as ${baseNameRaw}.` +
                ` Your login ID is: ${loginId}`
            );
            sendRoom(socket, sess.room);
            return;
        }

        // -------------------------
        // LOGIN
        // -------------------------
        case "try_login": {
            // Player can enter either:
            //   - full ID (name@race.pronoun)
            //   - or just type that into the same "username" field
            let loginId = (data.login || data.name || "").trim().toLowerCase();
            const password = (data.password || "").trim();

            if (!loginId || !password) {
                return sendSystem(socket,
                    "You reach for a being, but give no name or no key phrase."
                );
            }

            const acc = accounts[loginId];
            if (!acc) {
                return sendSystem(socket,
                    "No such being found. (Check the name@race.pronoun.)"
                );
            }

            if (acc.password !== password) {
                return sendSystem(socket,
                    "The pattern of this being does not match. (Wrong password.)"
                );
            }

            sess.state = "ready";
            sess.loginId = loginId;
            sess.room = acc.lastRoom || START_ROOM;

            sendSystem(socket, `Welcome back, ${acc.name}.`);
            sendRoom(socket, sess.room);
            return;
        }

        default:
            sendSystem(socket, "The world doesn’t understand that request.");
    }
}

// ==================================
// TEXT COMMANDS (in-game)
// ==================================
function handleText(socket, input) {
    const sess = sessions.get(socket);
    if (!sess || sess.state !== "ready") {
        return sendSystem(socket, "You must create or login before acting in the world.");
    }

    const parts = input.split(" ");
    const cmd = (parts[0] || "").toLowerCase();
    const arg = parts.slice(1).join(" ");

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

        const acc = accounts[sess.loginId];
        if (acc) {
            acc.lastRoom = sess.room;
            saveAccounts();
        }

        sendRoom(socket, sess.room);
        return;
    }

    if (cmd === "say") {
        const acc = accounts[sess.loginId];
        const name = acc ? acc.name : "Someone";
        const text = arg.trim() || "...";
        // Later we’ll broadcast to other players; for now just echo
        return sendSystem(socket, `${name} says: "${text}"`);
    }

    sendSystem(socket, "Nothing in the dark responds to that.");
}

// ==================================
// SEND HELPERS
// ==================================
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
        return sendSystem(socket, "The world frays here. (Unknown room.)");
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
        players: [], // TODO: populate when we track all sockets per room
        background: room.background || null
    }));
}
