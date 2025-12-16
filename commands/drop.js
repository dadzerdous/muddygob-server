// ===============================================
// commands/drop.js
// Drop the currently held item
// ===============================================

const World = require("../core/world");

module.exports = {
    name: "drop",
    help: "drop\nDrop the item you are currently holding.",

    execute({ socket, sess, accounts, sendSystem, sendRoom }) {
        const acc = accounts[sess.loginId];
        if (!acc) {
            return sendSystem(socket, "You feel strangely unreal.");
        }

        if (!acc.heldItem) {
            return sendSystem(socket, "You are not holding anything.");
        }

        const room = World.rooms[sess.room];
        if (!room) {
            return sendSystem(socket, "The world resists your action.");
        }

        if (!room.objects) room.objects = {};

        const item = acc.heldItem;

        room.objects[item] = { itemId: item };
        acc.heldItem = null;

        sendSystem(socket, `You drop the ${item}.`);
        sendRoom(socket, sess.room);
    }
};
