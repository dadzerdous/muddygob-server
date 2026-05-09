// ===============================================
// commands/store.js — hand → inventory
// ===============================================

module.exports = {
    name: "store",
    help: "store <item> — put held item into inventory",

    execute(ctx, arg) {
        const { socket, sess, accounts, sendSystem } = ctx;
        const Accounts = require("../core/accounts");

        const acc = accounts[sess.loginId];
        if (!acc) return;

        const normalize = s => s?.toLowerCase().replace(/\s+/g, '_');
        const itemName = normalize(arg) || acc.hands.left || acc.hands.right;

        if (!itemName) return sendSystem(socket, "You aren't holding anything.");

        let slot = null;
        if (acc.hands.left  === itemName) slot = 'left';
        if (acc.hands.right === itemName) slot = 'right';

        if (!slot) return sendSystem(socket, `You aren't holding a ${itemName}.`);

        if (!Array.isArray(acc.inventory)) acc.inventory = [];
        if (acc.inventory.includes(itemName)) {
            return sendSystem(socket, `You already have a ${itemName} stored.`);
        }

        acc.hands[slot] = null;
        acc.inventory.push(itemName);
        Accounts.save();

        const World = require('../core/world');
        const displayName = World.items?.[itemName]?.name || itemName;
        socket.send(JSON.stringify({ type: "hands", hands: acc.hands }));
        socket.send(JSON.stringify({type:'system',msg:`You tuck away the ${displayName}.`,msgType:'action'}));
    }
};
