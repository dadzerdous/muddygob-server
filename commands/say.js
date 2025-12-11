module.exports = {
    name: "say",
    aliases: ["s", "speak", "talk"],
    description: "Speak to everyone in the room.",

    execute(socket, sess, accounts, world, arg) {
        const sendSystem = msg =>
            socket.send(JSON.stringify({ type: "system", msg }));

        if (!arg) return sendSystem("Say what?");

        const acc = accounts[sess.loginId];
        const name = acc.name;
        const roomId = sess.room;

        // broadcast to room
        for (const [sock, s2] of sessions.entries()) {
            if (s2.room === roomId && s2.state === "ready") {
                sock.send(JSON.stringify({
                    type: "system",
                    msg: `💬 ${name} says: "${arg}"`
                }));
            }
        }
    }
};
