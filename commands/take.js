// ===============================================
// commands/take.js
// Hold an item from inventory or the room
// ===============================================

const World = require("../core/world");

module.exports = {
    name: "take",
    aliases: ["get", "grab"],
    help: "take <item>\nHold an item from your inventory or the room.",

    execute(ctx, arg) {
        const {
            socket,
            sess,
            accounts,
            sendSystem,
            sendRoom
        } = ctx;

        if (!arg) {
            return sendSystem(socket, "Take what?");
        }

        const acc = accounts[sess.loginId];
        if (!acc) {
            return sendSystem(socket, "You feel strangely unreal.");
        }

        if (acc.heldItem) {
            return sendSystem(socket, "Your hands are already full.");
        }

        const itemName = arg.toLowerCase();

        // ------------------------------------------
        // 1️⃣ INVENTORY → HANDS
        // ------------------------------------------
        if (Array.isArray(acc.inventory)) {
            const index = acc.inventory.indexOf(itemName);
            if (index !== -1) {
                acc.inventory.splice(index, 1);
                acc.heldItem = itemName;

                sendSystem(socket, `You take the ${itemName} from your inventory.`);
                sendRoom(socket, sess.room);
                return;
            }
        }

        // ------------------------------------------
        // 2️⃣ ROOM → HANDS
        // ------------------------------------------
        const room = World.rooms[sess.room];
        if (!room || !room.objects) {
            return sendSystem(socket, "There is nothing here to take.");
        }

        const obj = room.objects[itemName];
        if (!obj || !obj.itemId) {
            return sendSystem(socket, "You see no such thing.");
        }

        acc.heldItem = obj.itemId;
        delete room.objects[itemName];

        sendSystem(socket, `You pick up the ${itemName}.`);
        sendRoom(socket, sess.room);
    }
};
