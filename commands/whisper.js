module.exports = {
    name: "whisper",
    aliases: ["tell"],

    help: [
        "Whisper to a player in the same room.",
        "",
        "Usage:",
        "  whisper <player> <message>",
        "  tell <player> <message>"
    ].join("\n"),

    execute(ctx, arg) {
        const { socket, sess, accounts, sendSystem } = ctx;

        // Parse "player message"
        if (!arg) {
            return sendSystem(socket, "Whisper to who?");
        }

        const parts = arg.split(" ");
        const targetName = parts.shift()?.trim();
        const message = parts.join(" ").trim();

        if (!targetName) {
            return sendSystem(socket, "Whisper to who?");
        }
        if (!message) {
            return sendSystem(socket, "Say what?");
        }

        const targetLower = targetName.toLowerCase();
        const room = sess.room;

        // Search room for player
        let targetSocket = null;
        let targetAcc = null;

        for (const [sock, s] of global.sessions.entries()) {
            if (s.room === room && s.state === "ready") {
                const acc = accounts[s.loginId];
                if (acc && acc.name.toLowerCase() === targetLower) {
                    targetSocket = sock;
                    targetAcc = acc;
                    break;
                }
            }
        }

        if (!targetSocket) {
            return sendSystem(socket, `${targetName} is not here.`);
        }

        if (targetSocket === socket) {
            return sendSystem(socket, `Whispering to yourself feels... odd.`);
        }

        const actorAcc = accounts[sess.loginId];
        const actor = actorAcc?.name || "Someone";
        const targetReal = targetAcc.name;

        // Actor sees
        sendSystem(socket, `You whisper to ${targetReal}, "${message}"`);

        // Target sees
        sendSystem(targetSocket, `${actor} whispers, "${message}"`);
    }
};
