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

// Ensure ambient items exist
sendRoom(socket, sess.room);


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

        // 🔑 RESOLVE BY itemId (NOT instanceId)
        const entry = Object.entries(room.objects)
            .find(([_, obj]) => obj.itemId === itemName);

        if (!entry) {
            return Sessions.sendSystem(socket, `There is no ${itemName} here.`);
        }

        const [instanceId, obj] = entry;

        // Remove from room
        delete room.objects[instanceId];

        // Put into hands (store instanceId)
        sess.hands = instanceId;

        Accounts.save();

        Sessions.sendSystem(socket, `You pick up the ${itemName}.`);

        // Refresh room so item disappears visually
// Ensure ambient items exist before attempting take
const { sendRoom } = require("../core/room");
sendRoom(socket, sess.room);

    }
};
