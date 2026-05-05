// ===============================================
// commands/inventory.js
// ===============================================

module.exports = {
    name: "inventory",
    aliases: ["inv", "i"],
    help: "inventory",

    execute(ctx) {
        const { socket, sess, accounts, world, sendSystem } = ctx;
        const acc = accounts[sess.loginId];
        if (!acc) return;

        const { left, right } = acc.hands || {};
        const bag = Array.isArray(acc.inventory) ? acc.inventory : [];

        console.log("[INV] hands:", { left, right }, "bag:", bag);

        if (!left && !right && bag.length === 0) {
            return sendSystem(socket, "You are carrying nothing.");
        }

        socket.send(JSON.stringify({
            type:  "inventory",
            hands: { left: left || null, right: right || null },
            bag,
            items: world.items,
        }));
    }
};
