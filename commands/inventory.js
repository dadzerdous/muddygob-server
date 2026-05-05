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

        // Hands
        const { left, right } = acc.hands || {};
        for (const [side, itemId] of [['left', left], ['right', right]]) {
            if (!itemId) continue;
            const def   = world.items[itemId] || {};
            const emoji = def.emoji || "";
            items.push(`${emoji} <span class="obj" data-name="${itemId}" data-actions="look|drop|store">${itemId}</span> <em>(${side} hand)</em>`);
        }

        // Inventory/bag
        if (Array.isArray(acc.inventory)) {
            for (const itemId of acc.inventory) {
                const def   = world.items[itemId] || {};
                const emoji = def.emoji || "";
                items.push(`${emoji} <span class="obj" data-name="${itemId}" data-actions="look|retrieve|drop">${itemId}</span> <em>(bag)</em>`);
            }
        }

        if (items.length === 0) return sendSystem(socket, "You are carrying nothing.");

        sendSystem(socket, "You are carrying:<br>• " + items.join("<br>• "));
    }
};
