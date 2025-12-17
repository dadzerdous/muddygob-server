// ===============================================
// commands/drop.js (FIXED: no formatActor)
// ===============================================

module.exports = {
    name: "drop",
    help: "drop",

    execute(ctx) {
        const {
            socket,
            sess,
            accounts,
            world,
            sendSystem,
            sendRoom,
            broadcastToRoomExcept
        } = ctx;

        const acc = accounts[sess.loginId];
        if (!acc || !acc.heldItem) {
            return sendSystem(socket, "You are not holding anything.");
        }

        const room = world.rooms[sess.room];
        if (!room) return;

        if (!room.objects) room.objects = {};

        const item = acc.heldItem;

        // Drop into the room under the item key (e.g., "rock")
        room.objects[item] = { itemId: item };
        acc.heldItem = null;

        sendSystem(socket, `You drop the ${item}.`);

        // Broadcast to others (safe)
        const actor = acc?.name || "Someone";
        broadcastToRoomExcept(
            sess.room,
            `${actor} drops a ${item}.`,
            socket
        );

        // Update room for the player who acted
        sendRoom(socket, sess.room);
    }
};
