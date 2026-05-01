// ===============================================
// commands/drop.js
// ===============================================

module.exports = {
    name: "drop",
    help: "drop — drop your held item in the current room",

    execute(ctx) {
        const { socket, sess, accounts, world, sendSystem, sendRoom, broadcastToRoomExcept } = ctx;

        const acc = accounts[sess.loginId];
        if (!acc || !acc.heldItem) {
            return sendSystem(socket, "You are not holding anything.");
        }

        const room = world.rooms[sess.room];
        if (!room) return;

        const itemId = acc.heldItem;

        // Use room.items (same array that take.js reads from)
        if (!Array.isArray(room.items)) room.items = [];

        // Drop the item back as a new instance
        room.items.push({
            id: `${itemId}_${Date.now()}`,
            defId: itemId,
        });

        // Clear hands
        acc.heldItem = null;
        require("../core/accounts").save();

        socket.send(JSON.stringify({ type: "held", item: null }));

        sendSystem(socket, `You drop the ${itemId}.`);

        const actor = acc?.name || "Someone";
        broadcastToRoomExcept(sess.room, `${actor} drops a ${itemId}.`, socket);

        sendRoom(socket, sess.room);
    }
};
