module.exports = {
    name: "look",
    aliases: ["l"],
    description: "Look at your surroundings or an object.",

    execute(socket, sess, accounts, world, arg) {
        // If no object specified → refresh full room view
        if (!arg) {
            return sendRoom(socket, sess.room);
        }

        const room = world[sess.room];
        const acc = accounts[sess.loginId];
        const race = acc ? acc.race : "human";

        // Does the room contain this object?
        if (!room.objects || !room.objects[arg]) {
            return sendSystem(socket, "You see no such thing.");
        }

        const obj = room.objects[arg];
        const desc =
            (obj.descByRace && obj.descByRace[race]) ||
            obj.desc ||
            "You see nothing special.";

        return sendSystem(socket, desc);
    }
};

// REQUIRED HELPERS
const { sessions } = require("../server");

