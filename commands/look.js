module.exports = {
    name: "look",
    aliases: ["l"],
    description: "Look at your surroundings or an object.",

    execute({ socket, sess, accounts, world, sendRoom, sendSystem }, arg) {
        // No argument → show whole room
        if (!arg) {
            return sendRoom(socket, sess.room);
        }

        const room = world[sess.room];
        const acc  = accounts[sess.loginId];
        const race = acc ? acc.race : "human";

        // Check if object exists
        if (!room.objects || !room.objects[arg]) {
            return sendSystem(socket, "You see no such thing.");
        }

        const obj = room.objects[arg];

        // Race-specific or default description
        const desc =
            (obj.descByRace && obj.descByRace[race]) ||
            obj.desc ||
            "You see nothing special.";

        return sendSystem(socket, desc);
    }
};
