// ===============================================
// core/sessions.js
// ===============================================

const sessions = new Map(); // socket → session
const Accounts = require("./accounts");

// -----------------------------------------------
// Regen tick (energy + stamina)
// -----------------------------------------------
function regenTick() {
    for (const [sock, sess] of sessions.entries()) {
        if (sess.state !== "ready") continue;

        let changed = false;

        if (sess.energy < 100) {
            sess.energy = Math.min(100, sess.energy + 2);
            changed = true;
        }

        if (sess.stamina < 100) {
            sess.stamina = Math.min(100, sess.stamina + 1);
            changed = true;
        }

        if (changed) {
            Accounts.updateVitals(sess.loginId, sess.energy, sess.stamina);
            sock.send(JSON.stringify({
                type:    "stats",
                energy:  sess.energy,
                stamina: sess.stamina,
                hp:      sess.hp ?? 100,
            }));
        }
    }
}

setInterval(regenTick, 3000);

// -----------------------------------------------
// Session lifecycle
// -----------------------------------------------
function create(socket, startRoom) {
    sessions.set(socket, {
        state:       "connected",
        loginId:     null,
        room:        startRoom,
        hp:          100,
        energy:      100,
        stamina:     100,
        wielding:    {},
        combatState: { stage: 'idle', npcId: null, npcHp: null, playerHp: null, roomId: null },
    });
}

function remove(socket) {
    sessions.delete(socket);
}

function get(socket) {
    return sessions.get(socket);
}

// -----------------------------------------------
// Messaging helpers
// -----------------------------------------------
function sendSystem(socket, msg) {
    socket.send(JSON.stringify({ type: "system", msg }));
}

// -----------------------------------------------
// Player count broadcast
// -----------------------------------------------
function broadcastPlayerCount() {
    const count = [...sessions.values()].filter(s => s.state === "ready").length;
    for (const [sock] of sessions.entries()) {
        sock.send(JSON.stringify({ type: "players_online", count }));
    }
}

function broadcastToRoomExcept(roomId, msg, exceptSocket) {
    for (const [sock, sess] of sessions.entries()) {
        if (sock !== exceptSocket && sess.state === "ready" && sess.room === roomId) {
            sock.send(JSON.stringify({ type: "system", msg }));
        }
    }
}

// Send a fresh room packet to all players in a room except one socket
function broadcastRoomToOthers(roomId, exceptSocket, sendRoomFn) {
    let count = 0;
    for (const [sock, sess] of sessions.entries()) {
        if (sock !== exceptSocket && sess.room === roomId && sess.state === 'ready') {
            sendRoomFn(sock, roomId);
            count++;
        }
    }
    console.log('[BROADCAST ROOM]', roomId, '→', count, 'other players');
}

// -----------------------------------------------
// Who command — FIXED: was missing from sessions.js,
// only existed in the dead theme.js file
// -----------------------------------------------
function doWho(socket) {
    const names = [];
    for (const [, sess] of sessions.entries()) {
        if (sess.state === "ready") {
            const acc = Accounts.data[sess.loginId];
            if (acc) names.push(acc.name);
        }
    }
    if (names.length <= 1) {
        return sendSystem(socket, "No other presences stir in this world.");
    }
    sendSystem(socket, "Others breathing in this world:\n" + names.map(n => `• ${n}`).join("\n"));
}

module.exports = {
    sessions,
    create,
    remove,
    get,
    sendSystem,
    broadcastPlayerCount,
    broadcastToRoomExcept,
    broadcastRoomToOthers,
    doWho,
};
