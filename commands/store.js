// ===============================================
// commands/store.js — HANDS → INVENTORY
// ===============================================

module.exports = {
    name: "store",
    help: "store — put the item you are holding into your inventory",

    execute(ctx) {
        const {
            socket,
            sess,
            accounts,
            sendSystem
        } = ctx;

        const acc = accounts[sess.loginId];
        if (!acc) return;

        // Nothing in hands
        if (!acc.heldItem) {
            return sendSystem(socket, "You are not holding anything.");
        }

        // Ensure inventory exists
        if (!Array.isArray(acc.inventory)) {
            acc.inventory = [];
        }

        const itemId = acc.heldItem;

        // Prevent duplicates
        if (acc.inventory.includes(itemId)) {
            return sendSystem(socket,
                acc.race === "goblin"
                    ? "You already squirreled one away."
                    : "You already have one of those stored."
            );
        }

acc.inventory.push(itemId);
acc.heldItem = null;

socket.send(JSON.stringify({
    type: "held",
    item: null
}));



        sendSystem(socket,
            acc.race === "goblin"
                ? "You tuck it away, just in case."
                : `You store the ${itemId}.`
        );
    }
};
