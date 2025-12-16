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
