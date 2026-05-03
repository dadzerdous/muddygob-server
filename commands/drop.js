// ===============================================
// commands/drop.js
// ===============================================

module.exports = {
    name: "drop",
    help: "drop <item>",

    execute(ctx, arg) {
        const { socket, sess, accounts, world, sendSystem, sendRoom, broadcastToRoomExcept } = ctx;
        const Accounts = require("../core/accounts");

        const acc = accounts[sess.loginId];
        if (!acc) return;

        // Determine which item to drop
        const itemName = arg?.trim()?.toLowerCase()
            || acc.hands.left
            || acc.hands.right;

        if (!itemName) return sendSystem(socket, "You are not holding anything.");

        // Find which hand holds it
        let slot = null;
        if (acc.hands.left  === itemName) slot = 'left';
        if (acc.hands.right === itemName) slot = 'right';

        if (!slot) {
            return sendSystem(socket, `You aren't holding a ${itemName}.`);
        }

        const room = world.rooms[sess.room];
        if (!room) return;

        if (!Array.isArray(room.items)) room.items = [];

        // Prevent dropping if already in room
        const alreadyHere = room.items.some(i => i.defId === itemName);
        if (alreadyHere) {
            return sendSystem(socket, `There's already a ${itemName} here.`);
        }

        // Drop into room
        room.items.push({
            id:    `${itemName}_${Date.now()}`,
            defId: itemName,
        });

        // Free hand
        acc.hands[slot] = null;
        Accounts.save();

        socket.send(JSON.stringify({ type: "hands", hands: acc.hands }));
        sendSystem(socket, `You drop the ${itemName}.`);
        broadcastToRoomExcept(sess.room, `${acc.name} drops a ${itemName}.`, socket);
        sendRoom(socket, sess.room);
    }
};
