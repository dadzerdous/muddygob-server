module.exports = {
    name: "say",
    aliases: ["s"],

    execute(socket, sess, accounts, world, message) {
        if (!message) {
            return socket.send(JSON.stringify({
                type: "system",
                msg: "Say what?"
            }));
        }

        const acc = accounts[sess.loginId];
        const name = acc?.name || "Someone";
        const roomId = sess.room;

        // YOU see:
        socket.send(JSON.stringify({
            type: "system",
            msg: `You say: "${message}"`
        }));

        // OTHERS see:
        for (const [sock, other] of sessions.entries()) {
            if (sock !== socket && other.room === roomId && other.state === "ready") {
                sock.send(JSON.stringify({
                    type: "system",
                    msg: `${name} says: "${message}"`
                }));
            }
        }
    }
};
