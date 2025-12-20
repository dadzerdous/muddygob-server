module.exports = {
    name: "inspect",
    aliases: ["inspect", "examine", "ex"],
    execute(ctx, arg) {
        const { socket, sess, accounts, sendSystem } = ctx;
        if (!arg) return sendSystem(socket, "Inspect who?");

        const room = sess.room;

        // Find target in same room
        for (const [sock, s] of global.sessions.entries()) {
            if (s.state !== "ready") continue;
            if (s.room !== room) continue;

            const acc = accounts[s.loginId];
            if (!acc) continue;

            if (acc.name.toLowerCase() === arg.toLowerCase()) {

                // Build basic identity
                const line1 = `${acc.name} is a ${acc.race} (${acc.pronounKey}).`;

                // find hand item if exists
                const held = s.heldItem 
                    ? `Holding: ${s.heldItem}` 
                    : "Empty-handed.";

                sendSystem(socket, `You study ${acc.name}.`);
                sendSystem(socket, line1);
                sendSystem(socket, held);

                // tell them
                sendSystem(sock, `${acc.name} feels your eyes on them…`);
                return;
            }
        }

        sendSystem(socket, `${arg} is not here.`);
    }
};
