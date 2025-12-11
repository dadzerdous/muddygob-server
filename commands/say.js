module.exports = {
    name: "say",
    aliases: ["s"],
    execute(socket, sess, accounts, world, arg) {
        if (!arg) {
            return socket.send(JSON.stringify({ type: "system", msg: "Say what?" }));
        }

        const acc = accounts[sess.loginId];
        const name = acc ? acc.name : "Someone";

        const msg = `${name} says: "${arg}"`;

        // Send to everyone in the room
        for (const [sock, otherSess] of sessions.entries()) {
            if (otherSess.room === sess.room && otherSess.state === "ready") {
                sock.send(JSON.stringify({ type: "chat", msg }));
            }
        }
    }
};
