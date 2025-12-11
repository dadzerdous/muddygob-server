
module.exports = {
    name: "move",
    aliases: ["go"],
    execute(player, args, players, rooms) {
        const dir = args[0];
        const room = rooms[player.room];

        if (!room.exits[dir]) {
            return player.ws.send("You cannot go that way.");
        }

        player.room = room.exits[dir];
        commands.look.execute(player, [], players, rooms);
    }
};
