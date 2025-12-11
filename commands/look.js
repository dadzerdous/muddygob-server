module.exports = {
    name: "look",
    aliases: ["l"],

    execute(socket, sess, accounts, world, arg) {
        const room = world[sess.room];
        if (!room) {
            return socket.send(JSON.stringify({ type: "system", msg: "The world frays here." }));
        }

        // No argument → look at room
        if (!arg) {
            return socket.send(JSON.stringify({
                type: "system",
                msg: room.text.join("\n\n")
            }));
        }

        // Look at object
        const objName = arg.toLowerCase();
        const object = room.objects?.[objName];

        if (!object) {
            return socket.send(JSON.stringify({
                type: "system",
                msg: `You see no such thing.`
            }));
        }

        const acc = accounts[sess.loginId];
        const race = acc?.race;

        // Race-specific text
        let desc =
            (object.textByRace && race && object.textByRace[race]) ||
            object.text ||
            "You see nothing special.";

        socket.send(JSON.stringify({
            type: "system",
            msg: desc
        }));
    }
};
