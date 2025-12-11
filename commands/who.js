module.exports = {
    name: "who",
    aliases: [],
    description: "List all beings currently awake in the world.",

    execute(socket, sess, accounts, world, arg) {
        const names = [];

        for (const [sock, s] of sess.map.entries?.() || []) {}

        // sessions isn't passed — so pull from module scope
        const { sessions } = require("../server_state");

        for (const [sock, s] of sessions.entries()) {
            if (s.state === "ready") {
                const acc = accounts[s.loginId];
                if (acc && acc.name) {
                    names.push(acc.name);
                }
            }
        }

        if (names.length <= 1) {
            return socket.send(JSON.stringify({
                type: "system",
                msg: "No other presences stir in this world."
            }));
        }

        const list = names.map(n => `• ${n}`).join("\n");
        socket.send(JSON.stringify({
            type: "system",
            msg: "Others breathing in this world:\n" + list
        }));
    }
};
