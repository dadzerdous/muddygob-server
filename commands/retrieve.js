// ===============================================
// retrieve.js — Pull item from inventory to hands
// ===============================================

module.exports = {
    name: "retrieve",
    aliases: ["pull"],

    execute(ctx, args) {
        const { socket, sess, accounts, sendSystem } = ctx;
        const acc = accounts[sess.loginId];
        if (!acc) return;

        const itemName = (Array.isArray(args) ? args[0] : args)?.toLowerCase();
        if (!itemName) {
            return sendSystem(socket, "Pull what?");
        }

        if (acc.heldItem) {
            return sendSystem(socket, "Your hands are already full.");
        }

        if (!Array.isArray(acc.inventory) || acc.inventory.length === 0) {
            return sendSystem(socket, "You are carrying nothing.");
        }

        const idx = acc.inventory.indexOf(itemName);
        if (idx === -1) {
            return sendSystem(socket, `You are not carrying a ${itemName}.`);
        }

sendRoom(socket, sess.room);
sendSystem(socket, `You pick up the ${itemName}.`);

    }
};
