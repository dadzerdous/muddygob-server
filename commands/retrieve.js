// ===============================================
// retrieve.js — Pull item from inventory to hands
// Aliases: pull
// ===============================================

module.exports = {
    name: "retrieve",
    aliases: ["pull"],

    execute(socket, sess, args) {
        const Sessions = require("../core/sessions");
        const Accounts = require("../core/accounts");

        const acc = Accounts.data[sess.loginId];
        if (!acc) return;

        const itemName = args[0];
        if (!itemName) {
            return Sessions.sendSystem(socket, "Pull what?");
        }

        if (sess.hands) {
            return Sessions.sendSystem(socket, "Your hands are already full.");
        }

        // Find first matching item in inventory by itemId
        const idx = acc.inventory.findIndex(
            it => it.itemId === itemName
        );

        if (idx === -1) {
            return Sessions.sendSystem(socket, `You are not carrying a ${itemName}.`);
        }

        // Remove from inventory
        const item = acc.inventory.splice(idx, 1)[0];
        sess.hands = item;

        Accounts.save();

        Sessions.sendSystem(socket, `You pull the ${itemName} from your pack.`);
    }
};
