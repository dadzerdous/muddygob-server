// ===============================================
// commands/drop.js
// ===============================================

const { formatActor } = require("../core/room");

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
        room.objects[item] = { itemId: item };
        acc.heldItem = null;

        sendSystem(socket, `You drop the ${item}.`);

        broadcastToRoomExcept(
            sess.room,
            `${formatActor(acc)} drops a ${item}.`,
            socket
        );

        sendRoom(socket, sess.room);
    }
};
