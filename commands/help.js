// commands/help.js
module.exports = {
    name: "help",
    aliases: ["h"],
    description: "Show available commands.",

    execute({ socket, commands, sendSystem }, arg) {
        // If they asked about a specific command: help look
        if (arg) {
            const key = arg.toLowerCase();
            const cmd = commands[key];

            if (!cmd) {
                return sendSystem(socket, `No such command: ${arg}`);
            }

            const aliasList = (cmd.aliases && cmd.aliases.length)
                ? cmd.aliases.join(", ")
                : "none";

            return sendSystem(
                socket,
                `📘 ${cmd.name}\nDescription: ${cmd.description || "no description"}\nAliases: ${aliasList}`
            );
        }

        // Otherwise: show list of all unique commands
        const unique = [];
        const seen   = new Set();

        for (const c of Object.values(commands)) {
            if (!c || !c.name) continue;
            if (seen.has(c)) continue;
            seen.add(c);
            unique.push(c);
        }

        const list = unique
            .map(c => `• ${c.name} — ${c.description || "no description"}`)
            .join("\n");

        return sendSystem(
            socket,
            `📘 AVAILABLE COMMANDS:\n${list}\n\nType: help <command> for details.`
        );
    }
};
