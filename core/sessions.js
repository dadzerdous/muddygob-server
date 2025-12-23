// ===============================================
// core/sessions.js
// ===============================================

const sessions = new Map();
const Accounts = require("./accounts");

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
            // ✅ SAFE: delegate persistence
            Accounts.updateVitals(
                sess.loginId,
                sess.energy,
                sess.stamina
            );

            sock.send(JSON.stringify({
                type: "stats",
                energy: sess.energy,
                stamina: sess.stamina
            }));
        }
    }
}

setInterval(regenTick, 3000);

// -----------------------------------------------
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

// -----------------------------------------------
function remove(socket) {
    sessions.delete(socket);
}

function get(socket) {
    return sessions.get(socket);
}

function sendSystem(socket, msg) {
    socket.send(JSON.stringify({ type: "system", msg }));
}

// -----------------------------------------------
module.exports = {
    sessions,
    create,
    remove,
    get,
    sendSystem
};
