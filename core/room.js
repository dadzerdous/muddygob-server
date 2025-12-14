// ===============================================
// commands/look.js — FIXED FOR NEW WORLD LOADER
// ===============================================

const Accounts = require("../core/accounts");
const Sessions = require("../core/sessions");
const World = require("../core/world");

module.exports = {
    name: "look",
    aliases: ["l"],
    description: "Look at the room or an object.",

    execute({ socket, sess, sendRoom, sendSystem }, arg) {

        // If player typed just "look" → show room again
        if (!arg || arg.trim() === "") {
            return sendRoom(socket, sess.room);
        }

        const room = World.rooms[sess.room];   // ✅ Correct reference
        if (!room) {
            return sendSystem(socket, "This place does not exist.");
        }

        const acc = Accounts.data[sess.loginId];
        const race = acc?.race || "human";

        const objName = arg.trim().toLowerCase();

        // Check if object exists in room
        const obj = room.objects?.[objName];
        if (!obj) {
            return sendSystem(socket, `You see no ${objName} here.`);
        }

        // If it's an item pointing to item database
        if (obj.itemId && World.items[obj.itemId]) {
            const def = World.items[obj.itemId];

            const desc =
                (def.textByRace && def.textByRace[race]) ||
                def.text ||
                `You see nothing special about the ${objName}.`;

            return sendSystem(socket, desc);
        }

        // Scenery object
        const desc =
            (obj.textByRace && obj.textByRace[race]) ||
            obj.text ||
            `You see nothing special about the ${objName}.`;

        return sendSystem(socket, desc);
    }
};
