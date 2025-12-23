// ===============================================
// commands/retrieve.js — INVENTORY → HANDS (CLEAN)
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

        // Hands already full
        if (acc.heldItem) {
            return sendSystem(socket, "Your hands are already full.");
        }

        // No inventory
        if (!Array.isArray(acc.inventory) || acc.inventory.length === 0) {
            return sendSystem(socket, "You are carrying nothing.");
        }

        // Item not in inventory
        const idx = acc.inventory.indexOf(itemName);
        if (idx === -1) {
            return sendSystem(socket, `You are not carrying a ${itemName}.`);
        }

        // Move item: inventory → hands
        acc.inventory.splice(idx, 1);
        acc.heldItem = itemName;

        // 🔔 Notify client (authoritative)
        socket.send(JSON.stringify({
            type: "held",
            item: acc.heldItem
        }));

        sendSystem(socket, `You pull the ${itemName} from your pack.`);
    }
};
