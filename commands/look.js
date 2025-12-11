
module.exports = {
    name: "look",
    aliases: ["l"],
    execute(player, args, players, rooms) {
        const room = rooms[player.room];
        player.ws.send(room.title);
        player.ws.send(room.description);
        player.ws.send("Exits: " + Object.keys(room.exits).join(", "));
    }
};
