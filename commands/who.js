// ===============================================
// commands/who.js
// ===============================================

const { sessions } = require("../server_state");

module.exports = {
    name: "who",
    aliases: [],
    description: "List all beings currently awake in the world.",

    execute(socket, sess, accounts, world, arg) {
        const names = [];

        for (const [sock, s] of sessions.entries()) {
            if (s.state === "ready") {
                const acc = accounts[s.loginId];
                if (acc && acc.name) {
                    names.push(acc.name);
                }
            }
        }

        if (names.length <= 1) {
            // nobody but you
            return socket.send(JSON.stringify({
                type: "system",
                msg: "No other presences stir in this world."
            }));
        }

        // Build formatted list with <br>
        const list = names.map(n => `• ${n}`).join("<br>");

        return socket.send(JSON.stringify({
            type: "system",
            msg: `Others breathing in this world:<br>${list}`
        }));
    }
};
