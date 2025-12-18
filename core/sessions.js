// ===============================================
// core/sessions.js
// ===============================================

const sessions = new Map(); // socket → {state, loginId, room}

function create(socket, startRoom) {
    sessions.set(socket, {
        state: "connected",
        loginId: null,
        room: startRoom,
        hp: 100,
        energy: 100,
        stamina: 100
    });
}

function broadcastRoomRefresh(roomId) {
    const Room = require("./room");

    for (const [sock, sess] of sessions.entries()) {
        if (sess.room === roomId && sess.state === "ready") {
            Room.sendRoom(sock, roomId);
        }
    }
}


function remove(socket) {
    sessions.delete(socket);
}

function get(socket) {
    return sessions.get(socket);
}

function sendSystem(socket, msg) {
    socket.send(JSON.stringify({ type: "system", msg }));
}

function broadcastPlayerCount() {
    const count = [...sessions.values()].filter(s => s.state === "ready").length;

    for (const [sock] of sessions.entries()) {
        sock.send(JSON.stringify({
            type: "players_online",
            count
        }));
    }
}

function broadcastToRoomExcept(roomId, msg, exceptSocket) {
    for (const [sock, sess] of sessions.entries()) {
        if (sock !== exceptSocket &&
            sess.room === roomId &&
            sess.state === "ready") {
            sock.send(JSON.stringify({ type: "system", msg }));
        }
    }
}

function doWho(socket) {
    const names = [];

    for (const [sock, sess] of sessions.entries()) {
        if (sess.state === "ready") {
            const Accounts = require("./accounts");
            const acc = Accounts.data[sess.loginId];
            if (acc) names.push(acc.name);
        }
    }

    if (names.length <= 1)
        return sendSystem(socket, "No other presences stir in this world.");

    sendSystem(socket, "Others breathing in this world:\n" +
        names.map(n => `• ${n}`).join("\n"));
}

module.exports = {
    sessions,
    create,
    remove,
    get,
    sendSystem,
    broadcastPlayerCount,
    broadcastToRoomExcept,
    doWho
};
