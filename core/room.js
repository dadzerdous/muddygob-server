// ===============================================
// core/room.js — FINAL CLEAN VERSION
// ===============================================

const Sessions = require("./sessions");
const Accounts = require("./accounts");
const World = require("./world");   // World.rooms, World.items

// -----------------------------------------------
// Opposite direction helper
// -----------------------------------------------
function oppositeDirection(dir) {
    return {
        north: "south",
        south: "north",
        east: "west",
        west: "east"
    }[dir] || "somewhere";
}

// -----------------------------------------------
// SEND ROOM DATA TO CLIENT
// -----------------------------------------------
function sendRoom(socket, id) {
    const sess = Sessions.get(socket);
    if (!sess) return;

    const acc = Accounts.data[sess.loginId];
    const race = acc?.race;

    const room = World.rooms[id];
    if (!room) {
        return Sessions.sendSystem(socket, "The world frays here (missing room).");
    }

    // -------------------------------------------
    // Players in this room
    // -------------------------------------------
    const playersHere = [];
    for (const [sock, s] of Sessions.sessions.entries()) {
        if (s.room === id && s.state === "ready") {
            const a = Accounts.data[s.loginId];
            if (a) playersHere.push(a.name);
        }
    }

    // -------------------------------------------
    // Room description (optional race-specific)
    // -------------------------------------------
    const desc =
        (room.textByRace && race && room.textByRace[race]) ||
        room.text ||
        ["You see nothing special."];

    // -------------------------------------------
    // Objects (items + scenery)
    // -------------------------------------------
    const objectList = [];

    if (room.objects) {
        for (const [name, obj] of Object.entries(room.objects)) {

            // ITEM: references item database under /world/items
            if (obj.itemId && World.items[obj.itemId]) {
                const def = World.items[obj.itemId];

                objectList.push({
                    name,
                    type: "item",
                    emoji: def.emoji,
                    actions: def.actions || ["look"],
                    desc:
                        (def.textByRace && race && def.textByRace[race]) ||
                        def.text ||
                        null
                });
            }

            // SCENERY
            else {
                objectList.push({
                    name,
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
    // Send final structured room packet
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
// MOVEMENT HANDLER
// -----------------------------------------------
function handleMove(socket, sess, cmd, arg) {
    const dir = normalizeDirection(cmd, arg);
    if (!dir) return Sessions.sendSystem(socket, "Move where?");

    const room = World.rooms[sess.room];
    if (!room || !room.exits || !room.exits[dir]) {
        return Sessions.sendSystem(socket, "You cannot go that way.");
    }

    const acc = Accounts.data[sess.loginId];
    const name = acc?.name || "Someone";

    const oldRoom = sess.room;
    const newRoom = room.exits[dir];

    // Notify people in the old room
    Sessions.broadcastToRoomExcept(oldRoom, `${name} leaves ${dir}.`, socket);

    // Save new room location
    sess.room = newRoom;
    acc.lastRoom = newRoom;
    Accounts.save();  // persists last room for auto-resume

    // Notify people in new room
    Sessions.broadcastToRoomExcept(newRoom, `${name} enters from ${oppositeDirection(dir)}.`, socket);

    // Send updated room to mover
    sendRoom(socket, newRoom);
}

// -----------------------------------------------
// NORMALIZE MOVEMENT INPUT
// -----------------------------------------------
function normalizeDirection(cmd, arg) {
    const map = {
        n: "north", north: "north",
        s: "south", south: "south",
        e: "east",  east:  "east",
        w: "west",  west:  "west"
    };

    if (map[cmd]) return map[cmd];
    if (arg && map[arg]) return map[arg];
    return null;
}

module.exports = {
    sendRoom,
    handleMove,
    oppositeDirection
};
