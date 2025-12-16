module.exports = {
    name: "hands",
    aliases: ["hand", "hold"],
    help: "hands\nSee what you are currently holding.",

    execute({ socket, sess, accounts, sendSystem }) {
        const acc = accounts[sess.loginId];
        if (!acc) return;

        if (!acc.heldItem) {
            return sendSystem(socket, "Your hands are empty.");
        }

        sendSystem(socket, `You are holding: ${acc.heldItem}.`);
    }
};
