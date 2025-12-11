module.exports = {
    name: "help",
    aliases: ["h"],
    description: "Show available commands.",

    execute(socket, sess, accounts, world, arg, commands) {
        const list = Object.values(commands)
            .filter((c, i, self) => self.indexOf(c) === i)
            .map(c => `• ${c.name} — ${c.description || "no description"}`)
            .join("\n");

        socket.send(JSON.stringify({
            type: "system",
            msg:
`📘 AVAILABLE COMMANDS:
${list}

Type: help <command> for details.`
        }));
    }
};
