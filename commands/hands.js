// commands/hands.js
module.exports = {
    name: "hands",
    execute(ctx) {
        const { accounts, sess, sendSystem, world } = ctx;
        const acc = accounts[sess.loginId];

        if (!acc?.heldItem) {
            return sendSystem(ctx.socket, "Your hands are empty.");
        }

        const def = world.items[acc.heldItem];
        const emoji = def?.emoji || "";
        sendSystem(ctx.socket, `You are holding ${emoji} ${acc.heldItem}.`);
    }
};
