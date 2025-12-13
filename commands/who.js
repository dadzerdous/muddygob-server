module.exports = {
    name: "who",
    aliases: [],
    description: "List all beings currently awake in the world.",

    execute({ socket, accounts, sendSystem }) {

        const names = [];

        for (const [sock, sess] of global.sessions.entries()) {
            if (sess.state === "ready") {
                const acc = accounts[sess.loginId];
                if (acc?.name) names.push(acc.name);
            }
        }

        if (names.length <= 1) {
            return sendSystem(socket, "No other presences stir in this world.");
        }

        const list = names.map(n => `• ${n}`).join("\n");
        return sendSystem(socket, "Others breathing in this world:\n" + list);
    }
};
