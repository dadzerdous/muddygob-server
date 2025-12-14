// ===============================================
// commands/help.js – Safe MUD-style help system
// ===============================================

module.exports = {
    name: "help",
    aliases: ["h"],

    execute({ socket, sendSystem, commands }, arg) {

        // ------------------------------------------
        // HELP <command>
        // ------------------------------------------
        if (arg) {
            const key = arg.toLowerCase();
            const cmd = commands[key];

            if (!cmd || !cmd.help) {
                return sendSystem(
                    socket,
                    `No help available for '${arg}'.`
                );
            }

            return sendSystem(
                socket,
                `📘 HELP: ${cmd.name}\n\n${cmd.help}`
            );
        }

        // ------------------------------------------
        // HELP (list commands)
        // ------------------------------------------
        const unique = [];
        const seen = new Set();

        for (const cmd of Object.values(commands)) {
            if (!cmd.name) continue;
            if (seen.has(cmd.name)) continue;
            seen.add(cmd.name);
            unique.push(`• ${cmd.name}`);
        }

        return sendSystem(
            socket,
            `📘 AVAILABLE COMMANDS:\n` +
            unique.join("\n") +
            `\n\nType: help <command> for details.`
        );
    }
};
