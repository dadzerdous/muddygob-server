// ===============================================
// core/room.js — AUTHORITATIVE VERSION (SAFE)
// ===============================================
console.log("🟣 core/room.js LOADED — v1.23 (Dec 24) 🟣");

const Sessions = require("./sessions");
const Accounts = require("./accounts");
const World = require("./world");

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
if (!sess) {
    console.log("❌ sendRoom: no session for socket");
    return;
}

console.log("[SEND ROOM] requested:", id, "state:", sess.state, "loginId:", sess.loginId);


    const acc = Accounts.data[sess.loginId];
    const race = acc?.race;

    const room = World.rooms[id];

    // -------------------------------------------
    // ROOM EXISTENCE CHECK (FIRST, ALWAYS)
    // -------------------------------------------
    if (!room) {
        console.error(
            "[ROOM ERROR] Missing room:",
            id,
            "Known rooms:",
            Object.keys(World.rooms)
        );

        Sessions.sendSystem(socket, "The world frays… you are pulled back.");

        const fallback =
            acc?.lastRoom && World.rooms[acc.lastRoom]
                ? acc.lastRoom
                : Object.keys(World.rooms)[0];

        sess.room = fallback;
        return sendRoom(socket, fallback);
    }

    // -------------------------------------------
    // ENSURE AMBIENT ITEMS
    // -------------------------------------------
    const { ensureAmbientItems } = require("./itemSpawner");
    ensureAmbientItems(room);

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
    // ROOM DESCRIPTION (BASE)
    // -------------------------------------------
    let desc = Array.isArray(
        (room.textByRace && race && room.textByRace[race]) || room.text
    )
        ? [...((room.textByRace && race && room.textByRace[race]) || room.text)]
        : ["You see nothing special."];

    // -------------------------------------------
    // OBJECT LIST (SCENERY + ITEMS)
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

// ---------- AMBIENT ITEMS ----------
// ---------- AMBIENT ITEMS (LIVE INSTANCES) ----------
if (room.items) {
    for (const itemInstance of room.items) {
        const def = World.items[itemInstance.defId];
        if (!def) continue;

        const displayName = (def.name || itemInstance.defId).toLowerCase();

        // Plain-text description only
        desc.push(
    `A ${def.emoji} <span class="obj"
        data-name="${itemInstance.defId}"
        data-actions='["look","take"]'>
        ${displayName}
    </span> lies here.`
);



        // Clickable object entry
        objectList.push({
            name: itemInstance.defId,
            type: "item",
            emoji: def.emoji || "",
            actions: ["look", "take"],
            desc:
                (def.textByRace && race && def.textByRace[race]) ||
                def.text ||
                "A simple item."
        });
    }
}

    // -------------------------------------------
    // SEND ROOM PACKET (SINGLE, GUARDED)
    // -------------------------------------------
    try {
        const payload = {
            type: "room",
            id,
            title: room.title || "Somewhere",
            desc,
            exits: Object.keys(room.exits || {}),
            background: room.background || null,
            players: playersHere,
            objects: objectList
        };

        console.log("📦 ROOM PAYLOAD READY:", {
            id: payload.id,
            title: payload.title,
            descLines: Array.isArray(payload.desc) ? payload.desc.length : "not-array",
            exits: payload.exits,
            players: payload.players?.length ?? 0,
            objects: payload.objects?.length ?? 0
        });

        socket.send(JSON.stringify(payload));
        console.log("✅ ROOM PACKET SENT:", id);

    } catch (err) {
        console.error("🔥 sendRoom() failed:", err);
    }
}

// -----------------------------------------------
function handleMove(socket, sess, cmd, arg) {
    const dir = normalizeDirection(cmd, arg);

    if (!dir) return Sessions.sendSystem(socket, "Move where?");

    if (sess.energy <= 0) {
        return Sessions.sendSystem(socket, "You are too exhausted to move.");
    }

    // Drain energy
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
