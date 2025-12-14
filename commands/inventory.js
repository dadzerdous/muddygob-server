// ===============================================
// commands/inventory.js
// Show carried items
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

    help: "inventory\nShow what you are currently carrying.",

    execute({ socket, sess, accounts, sendSystem }) {
        const acc = accounts[sess.loginId];

        if (!acc.inventory || acc.inventory.length === 0) {
            return sendSystem(socket, "You are carrying nothing.");
        }

        const lines = acc.inventory.map(id => {
            const item = itemsDB[id];
            return item
                ? `${item.emoji} ${id}`
                : id;
        });

        sendSystem(
            socket,
            "You are carrying:\n" + lines.join("\n")
        );
    }
};
