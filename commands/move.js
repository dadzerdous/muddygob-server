module.exports = {
    name: "move",
    aliases: ["go", "walk", "m"],

    execute(socket, sess, accounts, world, arg) {
        if (!arg) return socket.send(JSON.stringify({
            type: "system",
            msg: "Move where?"
        }));

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
            return socket.send(JSON.stringify({
                type: "system",
                msg: "Unknown direction."
            }));
        }

        const room = world[sess.room];
        if (!room || !room.exits || !room.exits[dir]) {
            return socket.send(JSON.stringify({
                type: "system",
                msg: "You cannot go that way."
            }));
        }

        const newRoom = room.exits[dir];
        sess.room = newRoom;

        socket.send(JSON.stringify({
            type: "room",
            id: newRoom,
            title: world[newRoom].title,
            desc: world[newRoom].text,
            exits: Object.keys(world[newRoom].exits),
            background: world[newRoom].background || null
        }));
    }
};
