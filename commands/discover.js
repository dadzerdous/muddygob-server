// ===============================================
// commands/discover.js
// Saves discoveries per room to account
// ===============================================

module.exports = {
    name: "discover",
    help: "discover <item> — internal, sent by client UI",

    execute(ctx, arg) {
        const { socket, sess, accounts } = ctx;

        const acc = accounts[sess.loginId];
        if (!acc || !arg) return;

        const itemId = arg.trim().toLowerCase();
        const roomId = sess.room;

        // Per-room discoveries: acc.discovered = { roomId: [itemIds] }
        if (!acc.discovered || Array.isArray(acc.discovered)) {
            // Migrate old flat array to per-room object
            acc.discovered = {};
        }

        if (!acc.discovered[roomId]) acc.discovered[roomId] = [];

        if (!acc.discovered[roomId].includes(itemId)) {
            acc.discovered[roomId].push(itemId);
            require("../core/accounts").save();
        }
    }
};
