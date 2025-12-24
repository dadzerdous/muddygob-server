// ===============================================
// core/room.js — AUTHORITATIVE VERSION (FIXED)
// ===============================================

const Sessions = require("./sessions");
const Accounts = require("./accounts");
const World = require("./world");
const Theme = require("./theme");

// -----------------------------------------------
function oppositeDirection(dir) {
    return { north:"south", south:"north", east:"west", west:"east" }[dir] || "somewhere";
}

// -----------------------------------------------
function getRoom(roomId) {
    return World.rooms[roomId];
}

// -----------------------------------------------
function sendRoom(socket, id) {
    console.log("[SEND ROOM] requested:", id);

    const sess = Sessions.get(socket);
    if (!sess) return;

    const acc = Accounts.data[sess.loginId];
    const race = acc?.race;

    const room = World.rooms[id];
if (!room) {
    console.error(
        "[ROOM ERROR] Missing room:",
        id,
        "Known rooms:",
        Object.keys(World.rooms)
    );

    Sessions.sendSystem(socket, "The world frays… you are pulled back.");

    // Fallback to last known room or safe start
    const fallback = acc?.lastRoom && World.rooms[acc.lastRoom]
        ? acc.lastRoom
        : Object.keys(World.rooms)[0];

    sess.room = fallback;

    // Re-render safely
    return sendRoom(socket, fallback);
}





    // -------------------------------------------
    // Players in room
    // -------------------------------------------
    const playersHere = [];
    for (const [sock, s] of Sessions.sessions.entries()) {
        if (s.room === id && s.state === "ready") {
            const a = Accounts.data[s.loginId];
            if (a) playersHere.push(a.name);
        }
    }

    // -------------------------------------------
    // Description (race-aware)
    // -------------------------------------------
let desc = Array.isArray(
    (room.textByRace && race && room.textByRace[race]) || room.text
)
    ? [...((room.textByRace && race && room.textByRace[race]) || room.text)]
    : ["You see nothing special."];

// Inject ambient item flavor lines
if (room.items) {
    for (const instance of room.items) {
        const def = World.items[instance.defId];
        if (!def) continue;

        desc.push(
            `A ${def.emoji} <span class="obj"
                data-name="${def.id}"
                data-actions='["look","take"]'>
                ${def.name.toLowerCase()}
            </span> lies here.`
        );
    }
}



// -------------------------------------------
// Objects (scenery + ambient items, CLEAN)
// -------------------------------------------
const objectList = [];

// 1️⃣ Scenery objects (tree, altar, etc)
if (room.objects) {
    for (const [key, obj] of Object.entries(room.objects)) {
        objectList.push({
            name: key,                         // scenery key is safe
            type: "scenery",
            emoji: obj.emoji || "",
            actions: obj.actions || ["look"],
            desc:
                (obj.textByRace && race && obj.textByRace[race]) ||
                obj.text ||
                null
        });
    }
}

// 2️⃣ Ambient item instances (twig, rock, etc)
if (room.items) {
    for (const instance of room.items) {
        const def = World.items[instance.defId];
        if (!def) continue;

        objectList.push({
            name: def.id,                      // ✅ PLAYER NAME
            type: "item",
            emoji: def.emoji,
            actions: ["look", "take"],
            desc:
                (def.textByRace && race && def.textByRace[race]) ||
                def.text ||
                null
        });
    }
}

    // -------------------------------------------
    // SEND ROOM PACKET
    // -------------------------------------------
    socket.send(JSON.stringify({
        type: "room",
        id,
        title: room.title || "Somewhere",
        desc,
        exits: Object.keys(room.exits || {}),
        background: room.background || null,
        players: playersHere,
        objects: objectList
    }));
}


// -----------------------------------------------
function handleMove(socket, sess, cmd, arg) {
    const dir = normalizeDirection(cmd, arg);

    // ENERGY CHECK
    if (sess.energy <= 0) {
        return Sessions.sendSystem(socket, "You are too exhausted to move.");
    }

    // drain 3 energy
    sess.energy = Math.max(0, sess.energy - 3);

    // sync to accounts
    const account = Accounts.data[sess.loginId];
    account.energy = sess.energy;
    Accounts.save();

    // tell client
    socket.send(JSON.stringify({
        type: "stats",
        energy: sess.energy
    }));

    if (!dir) return Sessions.sendSystem(socket, "Move where?");

    const room = getRoom(sess.room);
    if (!room?.exits?.[dir]) {
        return Sessions.sendSystem(socket, "You cannot go that way.");
    }

    const acc = Accounts.data[sess.loginId];
    const actor = acc?.name || "Someone";

    const oldRoom = sess.room;
    const newRoom = room.exits[dir];

    Sessions.broadcastToRoomExcept(oldRoom, `${actor} leaves ${dir}.`, socket);

    sess.room = newRoom;
    acc.lastRoom = newRoom;
    Accounts.save();

    Sessions.broadcastToRoomExcept(
        newRoom,
        `${actor} enters from ${oppositeDirection(dir)}.`,
        socket
    );

    const { ensureAmbientItems } = require("./itemSpawner");
    ensureAmbientItems(World.rooms[newRoom]);

    sendRoom(socket, newRoom);
}


// -----------------------------------------------
function normalizeDirection(cmd, arg) {
    const map = {
        n:"north", north:"north",
        s:"south", south:"south",
        e:"east",  east:"east",
        w:"west",  west:"west"
    };
    return map[cmd] || map[arg] || null;
}

// -----------------------------------------------
module.exports = {
    sendRoom,
    handleMove,
    oppositeDirection,
    getRoom
};
