module.exports = {
    name: "move",
    aliases: ["go", "walk", "mv", "m", "g"],
    description: "Move to another room.",

    execute(socket, sess, accounts, world, arg) {
        const sendSystem = msg =>
            socket.send(JSON.stringify({ type: "system", msg }));

        if (!arg) return sendSystem("Move where?");

        const dirMap = {
            n: "north",
            north: "north",
            up: "north",

            s: "south",
            south: "south",
            down: "south",

            e: "east",
            east: "east",

            w: "west",
            west: "west",
            left: "west",
            right: "east"
        };

        const dir = dirMap[arg.toLowerCase()];
        if (!dir) return sendSystem("That direction makes no sense.");

        const room = world[sess.room];
        if (!room || !room.exits[dir]) {
            return sendSystem("You cannot go that way.");
        }

        sess.room = room.exits[dir];
        accounts[sess.loginId].lastRoom = sess.room;

        // load new room
        const newRoom = world[sess.room];
        socket.send(JSON.stringify({
            type: "room",
            id: sess.room,
            title: newRoom.title,
            desc: newRoom.text,
            exits: Object.keys(newRoom.exits),
            background: newRoom.background || null
        }));
    }
};
