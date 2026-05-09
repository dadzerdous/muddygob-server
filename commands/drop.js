// ===============================================
// commands/drop.js
// ===============================================

module.exports = {
    name: "drop",
    help: "drop <item>",

    execute(ctx, arg) {
        const { socket, sess, accounts, world, sendSystem, sendRoom, broadcastToRoomExcept } = ctx;
        const Accounts = require("../core/accounts");
        const Sessions = require("../core/sessions");

        const acc = accounts[sess.loginId];
        if (!acc) return;

        // Determine which item to drop
        const normalize = s => s?.toLowerCase().replace(/\s+/g, '_');
        const itemName = normalize(arg) || acc.hands.left || acc.hands.right;

        if (!itemName) return sendSystem(socket, "You are not holding anything.");

        // Find which hand holds it
        let slot = null;
        if (acc.hands.left  === itemName) slot = 'left';
        if (acc.hands.right === itemName) slot = 'right';

        // Check inventory if not in hands
        if (!slot) {
            if (Array.isArray(acc.inventory) && acc.inventory.includes(itemName)) {
                // Drop directly from inventory
                const room = world.rooms[sess.room];
                if (!room) return;
                if (!Array.isArray(room.items)) room.items = [];
                const alreadyHere = room.items.some(i => i.defId === itemName);
                if (alreadyHere) return sendSystem(socket, `There's already a ${itemName} here.`);
                room.items.push({ id: `${itemName}_${Date.now()}`, defId: itemName, originRoom: 'dropped' });
                acc.inventory = acc.inventory.filter(i => i !== itemName);
                Accounts.save();
                const displayName1 = world.items?.[itemName]?.name || itemName;
                socket.send(JSON.stringify({type:'system',msg:`You drop the ${displayName1}.`,msgType:'action'}));
                broadcastToRoomExcept(sess.room, `${acc.name} drops a ${displayName1}.`, socket);
                Sessions.broadcastRoomToOthers(sess.room, socket, sendRoom);
                sendRoom(socket, sess.room);
                return;
            }
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

        // Drop into room — mark as dropped so it's not treated as native
        room.items.push({
            id:         `${itemName}_${Date.now()}`,
            defId:      itemName,
            originRoom: 'dropped',
        });

        // Free hand
        acc.hands[slot] = null;
        Accounts.save();

        const displayName2 = world.items?.[itemName]?.name || itemName;
        socket.send(JSON.stringify({ type: "hands", hands: acc.hands }));
        socket.send(JSON.stringify({type:'system',msg:`You drop the ${displayName2}.`,msgType:'action'}));
        broadcastToRoomExcept(sess.room, `${acc.name} drops a ${displayName2}.`, socket);
        Sessions.broadcastRoomToOthers(sess.room, socket, sendRoom);
        sendRoom(socket, sess.room);
    }
};
