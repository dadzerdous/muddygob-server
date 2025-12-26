// ===============================================
// core/room.js — STABLE ITEM + FUTURE SAFE
// ===============================================
console.log("🟣 core/room.js LOADED — v1.30 (stable items)");

const Sessions = require("./sessions");
const Accounts = require("./accounts");
const World = require("./world");
const { ensureAmbientItems } = require("./itemSpawner");

// -----------------------------------------------
function oppositeDirection(dir) {
    return { north: "south", south: "north", east: "west", west: "east" }[dir] || "somewhere";
}

// -----------------------------------------------
function getRoom(roomId) {
    return World.rooms[roomId];
}

// -----------------------------------------------
function sendRoom(socket, id) {
    const sess = Sessions.get(socket);
    if (!sess) return;

    const acc = Accounts.data[sess.loginId];
    const race = acc?.race;

    const room = World.rooms[id];

    // -------------------------------------------
    // ROOM VALIDATION
    // -------------------------------------------
    if (!room) {
        Sessions.sendSystem(socket, "The world frays… you are pulled back.");
        const fallback = acc?.lastRoom && World.rooms[acc.lastRoom]
            ? acc.lastRoom
            : Object.keys(World.rooms)[0];
        sess.room = fallback;
        return sendRoom(socket, fallback);
    }

    // -------------------------------------------
    // ENSURE AMBIENT SPAWNS
    // -------------------------------------------
    ensureAmbientItems(room);

    // -------------------------------------------
    // BASE DESCRIPTION (FLAVOR ONLY)
    // -------------------------------------------
    let desc = Array.isArray(
        (room.textByRace && race && room.textByRace[race]) || room.text
    )
        ? [...((room.textByRace && race && room.textByRace[race]) || room.text)]
        : ["You see nothing special."];

    // -------------------------------------------
    // OBJECT LIST (AUTHORITATIVE INTERACTION)
    // -------------------------------------------
    const objectList = [];

    // ---------- SCENERY ----------
    if (room.objects) {
        for (const [key, obj] of Object.entries(room.objects)) {
            objectList.push({
                name: key,
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

    // ---------- ITEM INSTANCES (PRESENT ITEMS) ----------
    if (Array.isArray(room.items)) {
        for (const inst of room.items) {
            const def = World.items[inst.defId];
            if (!def) continue;

            // Display name (pretty) vs identity (command-safe)
            const displayName = def.name || inst.defId;

            // 1️⃣ Plain-text presence in room description
            desc.push(`A ${def.emoji || ""} ${displayName} lies here.`);

            // 2️⃣ Interactable object entry
            objectList.push({
                name: inst.defId,           // identity (lowercase id)
                type: "item",
                emoji: def.emoji || "",
                actions: ["look", "take"],
                desc:
                    (def.textByRace && race && def.textByRace[race]) ||
                    def.text ||
                    "You see nothing special."
            });
        }
    }

    // -------------------------------------------
    // PLAYERS IN ROOM
    // -------------------------------------------
    const playersHere = [];
    for (const [sock, s] of Sessions.sessions.entries()) {
        if (s.room === id && s.state === "ready") {
            const a = Accounts.data[s.loginId];
            if (a) playersHere.push(a.name);
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
    if (!dir) return Sessions.sendSystem(socket, "Move where?");

    if (sess.energy <= 0) {
        return Sessions.sendSystem(socket, "You are too exhausted to move.");
    }

    sess.energy = Math.max(0, sess.energy - 3);

    const acc = Accounts.data[sess.loginId];
    acc.energy = sess.energy;
    Accounts.save();

    socket.send(JSON.stringify({
        type: "stats",
        energy: sess.energy
    }));

    const room = getRoom(sess.room);
    if (!room?.exits?.[dir]) {
        return Sessions.sendSystem(socket, "You cannot go that way.");
    }

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

    sendRoom(socket, newRoom);
}

// -----------------------------------------------
function normalizeDirection(cmd, arg) {
    const map = {
        n: "north", north: "north",
        s: "south", south: "south",
        e: "east", east: "east",
        w: "west", west: "west"
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
