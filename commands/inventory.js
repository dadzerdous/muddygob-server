// ===============================================
// commands/inventory.js — CLICKABLE ITEMS
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

        // ---- HELD ITEM ----
        if (acc.heldItem) {
            const itemId = acc.heldItem;
            const def = world.items[itemId] || {};
            const emoji = def.emoji || "";

            // Held items get DROP + STORE + LOOK
            const actions = JSON.stringify(["drop", "store", "look"]);

            items.push(`${emoji} <span class="obj" data-name="${itemId}" data-actions='${actions}'>${itemId}</span>`);
        }

        // ---- BACKPACK ITEMS ----
        if (Array.isArray(acc.inventory)) {
            for (const itemId of acc.inventory) {
                const def = world.items[itemId] || {};
                const emoji = def.emoji || "";

                // Stored items get PULL + LOOK
                const actions = JSON.stringify(["pull", "look"]);

                items.push(`${emoji} <span class="obj" data-name="${itemId}" data-actions='${actions}'>${itemId}</span>`);
            }
        }

        if (items.length === 0) {
            return sendSystem(socket, "You are carrying nothing.");
        }

        // ---- SEND AS SYSTEM MESSAGE ----
        // Uses <br> so spans stay clickable
        sendSystem(socket, "You are carrying:<br>• " + items.join("<br>• "));
    }
};
