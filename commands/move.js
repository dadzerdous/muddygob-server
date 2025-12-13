module.exports = {
    name: "move",
    aliases: ["go", "walk", "m"],
    description: "Move in a direction.",

    execute({ socket, sess, accounts, world, sendRoom, sendSystem }, arg) {

        if (!arg) {
            return sendSystem(socket, "Move where?");
        }

        const dirMap = {
            n: "north",
            north: "north",
            s: "south",
            south: "south",
            e: "east",
            east: "east",
            w: "west",
            west: "west"
        };

        const dir = dirMap[arg.toLowerCase()];
        if (!dir) {
            return sendSystem(socket, "Unknown direction.");
        }

        const room = world[sess.room];
        if (!room || !room.exits || !room.exits[dir]) {
            return sendSystem(socket, "You cannot go that way.");
        }

        // Change rooms
        sess.room = room.exits[dir];

        // Send new room to player
        return sendRoom(socket, sess.room);
    }
};
