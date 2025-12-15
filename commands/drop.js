// ===============================================
// commands/drop.js
// Drop the currently held item
// ===============================================

module.exports = {
    name: "drop",
    aliases: [],
    help: "drop\nDrop the item you are currently holding.",

    execute(ctx) {
        const {
            socket,
            sess,
            accounts,
            world,
            sendSystem,
            sendRoom
        } = ctx;

        const acc = accounts[sess.loginId];
        if (!acc) {
            return sendSystem(socket, "You feel strangely unreal.");
        }

        if (!acc.heldItem) {
            return sendSystem(socket, "You are not holding anything.");
        }

        const room = world[sess.room];
        if (!room) {
            return sendSystem(socket, "The world resists your action.");
        }

        if (!room.objects) room.objects = {};

        const itemName = acc.heldItem;

        // Put item back into room
        room.objects[itemName] = {
            itemId: itemName
        };

        acc.heldItem = null;

        sendSystem(socket, `You drop the ${itemName}.`);
        sendRoom(socket, sess.room);
    }
};
