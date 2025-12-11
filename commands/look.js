module.exports = {
    name: "look",
    aliases: ["l"],
    execute(socket, sess, accounts, world, arg) {
        const acc = accounts[sess.loginId];
        const race = acc ? acc.race : null;
        const room = world[sess.room];

        if (!room) {
            return socket.send(JSON.stringify({ type: "system", msg: "The world frays here (missing room)." }));
        }

        const desc =
            (room.textByRace && race && room.textByRace[race]) ||
            room.text ||
            ["You see nothing special."];

        socket.send(JSON.stringify({
            type: "room",
            id: sess.room,
            title: room.title,
            desc,
            exits: Object.keys(room.exits || {}),
            background: room.background || null
        }));
    }
};
