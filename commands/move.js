module.exports = {
    name: "move",
    aliases: ["go"],
    execute(socket, sess, accounts, world, arg) {
        if (!arg) {
            return socket.send(JSON.stringify({ type: "system", msg: "Move where?" }));
        }

        const dir = arg.toLowerCase();
        const room = world[sess.room];

        if (!room || !room.exits || !room.exits[dir]) {
            return socket.send(JSON.stringify({ type: "system", msg: "You cannot go that way." }));
        }

        const newRoom = room.exits[dir];
        sess.room = newRoom;

        if (accounts[sess.loginId]) {
            accounts[sess.loginId].lastRoom = newRoom;
        }

        const newRoomObj = world[newRoom];

        socket.send(JSON.stringify({
            type: "room",
            id: newRoom,
            title: newRoomObj.title,
            desc: newRoomObj.text,
            exits: Object.keys(newRoomObj.exits || {}),
            background: newRoomObj.background || null
        }));
    }
};
