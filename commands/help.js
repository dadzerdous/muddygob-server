// ===============================================
// commands/help.js – MUD-style help system
// ===============================================

module.exports = {
    name: "help",
    aliases: ["h"],

    execute({ sendSystem, commands }, arg) {

        // ------------------------------------------
        // HELP <command> → detailed help
        // ------------------------------------------
        if (arg) {
            const key = arg.toLowerCase();
            const cmd = commands[key];

            if (!cmd || !cmd.help) {
                return sendSystem(`No help available for '${arg}'.`);
            }

            return sendSystem(
                `📘 HELP: ${cmd.name}\n\n${cmd.help}`
            );
        }

        // ------------------------------------------
        // HELP → list commands only
        // ------------------------------------------
        const primary = Object.values(commands)
            .filter(c => c.name)               // skip broken ones
            .filter((v, i, a) => a.indexOf(v) === i) // unique
            .map(c => `• ${c.name}`)
            .join("\n");

        return sendSystem(
            `📘 AVAILABLE COMMANDS:\n` +
            primary +
            `\n\nType: help <command> for details.`
        );
    }
};
