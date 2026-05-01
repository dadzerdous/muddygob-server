// ===============================================
// commands/discover.js
// Called by client when player taps an object
// for the first time. Persists to account.
// ===============================================

module.exports = {
    name: "discover",
    help: "discover <item> — internal command, sent by client UI",

    execute(ctx, arg) {
        const { socket, sess, accounts, sendSystem } = ctx;

        const acc = accounts[sess.loginId];
        if (!acc || !arg) return;

        if (!Array.isArray(acc.discovered)) acc.discovered = [];

        const id = arg.trim().toLowerCase();

        if (!acc.discovered.includes(id)) {
            acc.discovered.push(id);
            require("../core/accounts").save();
        }

        // No feedback needed — client already handles the UI
    }
};
