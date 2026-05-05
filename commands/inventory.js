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

        const items = [];

        // Check if carrying anything
        const { left, right } = acc.hands || {};
        if (!left && !right && (!acc.inventory || acc.inventory.length === 0)) {
            return sendSystem(socket, "You are carrying nothing.");
        }

        if (items.length === 0) return sendSystem(socket, "You are carrying nothing.");

        // Send as structured packet so client can build interactive elements
        socket.send(JSON.stringify({
            type: "inventory",
            hands: {
                left:  acc.hands?.left  || null,
                right: acc.hands?.right || null,
            },
            bag: Array.isArray(acc.inventory) ? acc.inventory : [],
            items: world.items,
        }));
    }
};
