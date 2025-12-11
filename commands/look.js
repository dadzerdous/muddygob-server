module.exports = {
    name: "look",
    aliases: ["l", "examine", "inspect"],
    description: "Look at your surroundings.",

    execute(socket, sess, accounts, world, arg) {
        const sendSystem = msg =>
            socket.send(JSON.stringify({ type: "system", msg }));

        const room = world[sess.room];
        if (!room) return sendSystem("The world fades here…");

        // If looking at an object
        if (arg) {
            const key = arg.toLowerCase();

            if (room.objects && room.objects[key]) {
                const obj = room.objects[key];
                const race = accounts[sess.loginId].race;

                const desc =
                    (obj.textByRace && obj.textByRace[race]) ||
                    obj.text ||
                    "You see nothing special.";

                return sendSystem(desc);
            }

            return sendSystem("You see no such thing.");
        }

        // Looking at the room
        const lines = room.text.join("\n");

        sendSystem(room.title + "\n\n" + lines + "\n\nExits: " +
            Object.keys(room.exits).join(", "));
    }
};
