// ===============================================
// core/room.js — AUTHORITATIVE VERSION
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
    const sess = Sessions.get(socket);
    if (!sess) return;

    const acc = Accounts.data[sess.loginId];
    const race = acc?.race;

    const room = getRoom(id);
    if (!room) {
        return Sessions.sendSystem(socket, "The world frays here.");
    }

    // Players
    const playersHere = [];
    for (const [_, s] of Sessions.sessions.entries()) {
        if (s.room === id && s.state === "ready") {
            const a = Accounts.data[s.loginId];
            if (a) playersHere.push(Theme.formatActor(a));
        }
    }

    // Description
    const desc =
        (room.textByRace && race && room.textByRace[race]) ||
        room.text ||
        ["You see nothing special."];

    // Objects
    const objects = [];
    for (const [name, obj] of Object.entries(room.objects || {})) {
        if (obj.itemId && World.items[obj.itemId]) {
            const def = World.items[obj.itemId];
            objects.push({
                name,
                type: "item",
                emoji: def.emoji,
                actions: def.actions || ["look"],
                desc: def.textByRace?.[race] || def.text || null
            });
        } else {
            objects.push({
                name,
                type: "scenery",
                emoji: obj.emoji || "",
                actions: obj.actions || ["look"],
                desc: obj.textByRace?.[race] || obj.text || null
            });
        }
    }

    socket.send(JSON.stringify({
        type: "room",
        id,
        title: room.title,
        desc,
        exits: Object.keys(room.exits || {}),
        background: room.background || null,
        ambience: Theme.ambientForRoom(room, race),
        players: playersHere,
        objects
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
    const actor = Theme.formatActor(acc);

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

function normalizeDirection(cmd, arg) {
    const map = { n:"north", north:"north", s:"south", south:"south", e:"east", east:"east", w:"west", west:"west" };
    return map[cmd] || map[arg] || null;
}

module.exports = {
    sendRoom,
    handleMove,
    oppositeDirection,
    getRoom
};
