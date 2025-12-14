const Items = require("../core/items");

module.exports = {
    name: "inventory",
    aliases: ["inv", "i"],

    execute({ socket, sess, sendSystem }) {
        const acc = require("../core/accounts").data[sess.loginId];
        const inv = acc.inventory || [];

        if (inv.length === 0) {
            return sendSystem(socket, "You are carrying nothing.");
        }

        const lines = inv.map(id => {
            const item = Items.get(id);
            return item
                ? `${item.emoji} ${item.name}`
                : id;
        });

        sendSystem(socket, "You are carrying:\n" + lines.join("\n"));
    }
};
