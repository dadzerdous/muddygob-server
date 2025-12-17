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
    return Sessions.sendSystem(socket, "The world frays here.");
}


    // -------------------------------------------
    // AMBIENT ITEM MATERIALIZATION (GENERIC)
    // 🔥 MUST HAPPEN BEFORE objectList BUILD
    // -------------------------------------------
    if (room.ambient) {
        if (!room.objects) room.objects = {};

        for (const [itemId, rule] of Object.entries(room.ambient)) {
            const max = rule.max ?? 1;

            const existing = Object.values(room.objects)
                .filter(o => o.itemId === itemId).length;

            for (let i = existing; i < max; i++) {
                const key = `${itemId}_${i + 1}`;
                room.objects[key] = { itemId };
            }
        }
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
    const desc =
        (room.textByRace && race && room.textByRace[race]) ||
        room.text ||
        ["You see nothing special."];

    // -------------------------------------------
    // Objects (NOW sees ambient items)
    // -------------------------------------------
  const objectList = [];

if (room.objects) {
    for (const [instanceId, obj] of Object.entries(room.objects)) {

        if (obj.itemId && World.items[obj.itemId]) {
            const def = World.items[obj.itemId];

            objectList.push({
                name: obj.itemId,          // 👈 PLAYER SEES THIS
                instanceId,                // 👈 SERVER USES THIS
                type: "item",
                emoji: def.emoji,
                actions: def.actions || ["look"],
                desc:
                    (def.textByRace && race && def.textByRace[race]) ||
                    def.text ||
                    null
            });

        } else {
            objectList.push({
                name: instanceId,          // scenery keeps its key
                type: obj.type || "scenery",
                emoji: obj.emoji || "",
                actions: obj.actions || ["look"],
                desc:
                    (obj.textByRace && race && obj.textByRace[race]) ||
                    obj.text ||
                    null
            });
        }
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
