// ===============================================
// commands/drop.js — AMBIENT ITEM MODEL (LOCKED)
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

        // One rock per room rule
        if (room.objects.rock) {
            return sendSystem(socket,
                "This room doesn’t need another one of those."
            );
        }

        const item = acc.heldItem;

        // Place into room FIRST
        room.objects.rock = { itemId: item };

        // THEN clear hands
        acc.heldItem = null;

        sendSystem(socket, `You drop the ${item}.`);

        const actor = acc?.name || "Someone";
        broadcastToRoomExcept(
            sess.room,
            `${actor} drops a ${item}.`,
            socket
        );

        sendRoom(socket, sess.room);
    }
};
