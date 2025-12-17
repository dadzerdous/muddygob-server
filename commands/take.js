// ===============================================
// take.js — Take item from room into hands
// ===============================================

module.exports = {
    name: "take",
    aliases: ["get", "grab"],

    execute(socket, sess, args) {
        const Sessions = require("../core/sessions");
        const Accounts = require("../core/accounts");
        const World = require("../core/world");
        const { sendRoom } = require("../core/room");

        const acc = Accounts.data[sess.loginId];
        if (!acc) return;

        const itemName = args[0];
        if (!itemName) {
            return Sessions.sendSystem(socket, "Take what?");
        }

        if (sess.hands) {
            return Sessions.sendSystem(socket, "Your hands are already full.");
        }

        const room = World.rooms[sess.room];
        if (!room || !room.objects) {
            return Sessions.sendSystem(socket, `There is no ${itemName} here.`);
        }

        // 🔑 find ANY instance of that itemId
        const entry = Object.entries(room.objects)
            .find(([_, obj]) => obj.itemId === itemName);

        if (!entry) {
            return Sessions.sendSystem(socket, `There is no ${itemName} here.`);
        }

        const [instanceId] = entry;

        // remove instance from room
        delete room.objects[instanceId];

        // hands hold ITEM TYPE, not instance
        sess.hands = itemName;

        Accounts.save();

        Sessions.sendSystem(socket, `You pick up the ${itemName}.`);

        sendRoom(socket, sess.room);
    }
};
