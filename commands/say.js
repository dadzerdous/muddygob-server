module.exports = {
    name: "say",
    aliases: ["s"],
    description: "Speak to everyone in the room.",

    execute({ socket, sess, accounts, world, sendSystem }, message) {

        if (!message) {
            return sendSystem(socket, "Say what?");
        }

        const acc   = accounts[sess.loginId];
        const name  = acc?.name || "Someone";
        const room  = sess.room;

        // YOU see:
        sendSystem(socket, `You say: "${message}"`);

        // OTHERS see:
        for (const [sock, other] of global.sessions.entries()) {
            if (sock !== socket &&
                other.room === room &&
                other.state === "ready") {

                sock.send(JSON.stringify({
                    type: "system",
                    msg: `${name} says: "${message}"`
                }));
            }
        }
    }
};
