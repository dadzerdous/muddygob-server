// commands/emote.js
module.exports = {
    name: "emote",
    aliases: ["hug", "kiss", "highfive", "slap", "boop"],

    help: [
        "Perform an emote on another player.",
        "",
        "Usage:",
        "  hug <player>",
        "  kiss <player>",
        "  highfive <player>",
        "",
        "Players must be in the same room."
    ].join("\n"),

    execute(ctx, arg) {
        const { socket, sess, accounts, sendSystem, broadcastToRoomExcept, world } = ctx;

        // Figure out which emote they typed
        const verb = ctx.cmdName || "emote"; // cmdName should be wired in server
        const targetName = arg?.trim();

        if (!targetName) {
            return sendSystem(socket, `Who do you want to ${verb}?`);
        }

        // Normalize case
        const targetLower = targetName.toLowerCase();

        // Find player in same room
        let targetSocket = null;
        let targetAccount = null;
        for (const [sock, s] of global.sessions.entries()) {
            if (s.room === sess.room && s.loginId) {
                const acc = accounts[s.loginId];
                if (acc && acc.name.toLowerCase() === targetLower) {
                    targetSocket = sock;
                    targetAccount = acc;
                    break;
                }
            }
        }

        if (!targetSocket || !targetAccount) {
            return sendSystem(socket, `${targetName} is not here.`);
        }

        // Actor details
        const actorAcc = accounts[sess.loginId];
        const actorName = actorAcc?.name || "Someone";
        const targetReal = targetAccount.name;

        // Messaging
        if (socket === targetSocket) {
            return sendSystem(socket, `You can't ${verb} yourself.`);
        }

        // To actor
        sendSystem(socket, `You ${verb} ${targetReal}.`);

        // To target
        sendSystem(targetSocket, `${actorName} ${verb}s you.`);

        // To others
        broadcastToRoomExcept(sess.room, `${actorName} ${verb}s ${targetReal}.`, socket);
        broadcastToRoomExcept(sess.room, `${actorName} ${verb}s ${targetReal}.`, targetSocket);
    }
};
