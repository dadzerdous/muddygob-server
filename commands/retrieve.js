// ===============================================
// commands/retrieve.js — inventory → hand
// ===============================================

module.exports = {
    name: "retrieve",
    aliases: ["pull"],
    help: "retrieve <item> — take item from inventory into hand",

    execute(ctx, arg) {
        const { socket, sess, accounts, sendSystem } = ctx;
        const Accounts = require("../core/accounts");

        const acc = accounts[sess.loginId];
        if (!acc) return;

        const normalize = s => s?.toLowerCase().replace(/\s+/g, '_');
        const itemName = normalize(arg);
        if (!itemName) return sendSystem(socket, "Retrieve what?");

        if (!Array.isArray(acc.inventory) || !acc.inventory.includes(itemName)) {
            return sendSystem(socket, `You don't have a ${itemName} stored.`);
        }

        const slot = Accounts.emptyHand(acc);
        if (!slot) return sendSystem(socket, "Your hands are both full.");

        acc.inventory = acc.inventory.filter(i => i !== itemName);
        acc.hands[slot] = itemName;
        Accounts.save();

        socket.send(JSON.stringify({ type: "hands", hands: acc.hands }));
        socket.send(JSON.stringify({ type:"system", msg:`You pull out the ${itemName}.`, msgType:"action" }));
    }
};
