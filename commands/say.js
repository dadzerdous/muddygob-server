// commands/say.js
module.exports = {
    name: "say",
    aliases: ["s"],
    help: "Speak to everyone in the room.",

    execute({ socket, sess, accounts, sendSystem }, message) {
        if (!message) {
            return sendSystem(socket, "Say what?");
        }

        const acc   = accounts[sess.loginId];
        const name  = acc?.name || "Someone";
        const roomId = sess.room;

        // You see:
        sendSystem(socket, `You say: "${message}"`);

        // Others see:
        for (const [sock, other] of global.sessions.entries()) {
            if (
                sock !== socket &&
                other.room === roomId &&
                other.state === "ready"
            ) {
                sock.send(JSON.stringify({
                    type: "system",
                    msg: `${name} says: "${message}"`
                }));
            }
        }
    }
};
