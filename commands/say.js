
module.exports = {
    name: "say",
    aliases: ["s"],
    execute(player, args, players) {
        const msg = args.join(" ");
        for (let p of Object.values(players)) {
            if (p.room === player.room) {
                p.ws.send(`${player.name} says: ${msg}`);
            }
        }
    }
};
