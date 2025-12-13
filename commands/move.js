// commands/move.js
module.exports = {
    name: "move",
    aliases: ["go", "walk", "m"],
    description: "Move in a direction (north, south, east, west).",

    execute({
        socket,
        sess,
        accounts,
        world,
        sendRoom,
        sendSystem,
        broadcastToRoomExcept,
        oppositeDirection,
        saveAccounts
    }, arg) {

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

        const acc    = accounts[sess.loginId];
        const name   = acc ? acc.name : "Someone";
        const oldRoom = sess.room;
        const newRoom = room.exits[dir];

        // Notify others in old room
        broadcastToRoomExcept(oldRoom, `[MOVE] ${name} leaves ${dir}.`, socket);

        // Move player + persist lastRoom
        sess.room = newRoom;
        if (acc) {
            acc.lastRoom = newRoom;
            saveAccounts();
        }

        // Notify others in new room
        broadcastToRoomExcept(newRoom, `[MOVE] ${name} enters from ${oppositeDirection(dir)}.`, socket);

        // Show new room to this player
        return sendRoom(socket, newRoom);
    }
};
