// ===============================================
// commands/inventory.js — AUTHORITATIVE, FUTURE-PROOF
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

        // Held item
        if (acc.heldItem) {
            const def = world.items[acc.heldItem];
            if (def) {
                items.push(`${def.emoji || ""} ${acc.heldItem}`);
            } else {
                items.push(acc.heldItem);
            }
        }

        // Backpack / inventory array (future-safe)
        if (Array.isArray(acc.inventory)) {
            for (const id of acc.inventory) {
                const def = world.items[id];
                if (def) {
                    items.push(`${def.emoji || ""} ${id}`);
                } else {
                    items.push(id);
                }
            }
        }

        if (items.length === 0) {
            return sendSystem(socket, "You are carrying nothing.");
        }

        sendSystem(socket, "You are carrying:\n• " + items.join("\n• "));
    }
};
