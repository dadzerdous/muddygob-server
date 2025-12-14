// ===============================================
// commands/inventory.js
// Show carried items (SAFE VERSION)
// ===============================================

const fs = require("fs");
const path = require("path");

const itemsDB = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "../world/items/rock.json"),
        "utf8"
    )
);

module.exports = {
    name: "inventory",
    aliases: ["inv", "i"],
    help: "inventory\nShow what you are carrying.",

    execute({ socket, sess, accounts, sendSystem }) {
        const acc = accounts[sess.loginId];

        if (!acc) {
            return sendSystem(socket, "You seem to have no body.");
        }

        if (!Array.isArray(acc.inventory) || acc.inventory.length === 0) {
            return sendSystem(socket, "You are carrying nothing.");
        }

        const lines = [];

        for (const id of acc.inventory) {
            const item = itemsDB[id];
            if (item) {
                lines.push(`${item.emoji} ${id}`);
            } else {
                lines.push(id);
            }
        }

        return sendSystem(
            socket,
            "You are carrying:\n" + lines.join("\n")
        );
    }
};
