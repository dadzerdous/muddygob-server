// ===============================================
// commands/take.js
// ===============================================

module.exports = {
    name: "take",
    aliases: ["get", "grab"],
    help: "take <item>",

    execute(ctx, arg) {
        const { socket, sess, sendSystem, sendRoom, accounts, world } = ctx;
        const Accounts = require("../core/accounts");

        const acc = accounts[sess.loginId];
        if (!acc) return;

        const itemName = arg?.trim()?.toLowerCase();
        if (!itemName) return sendSystem(socket, "Take what?");

        // Check both hands and inventory for duplicates
        if (Accounts.allCarrying(acc).includes(itemName)) {
            return sendSystem(socket,
                acc.race === "goblin"
                    ? "You already have one. That's enough."
                    : `You're already carrying a ${itemName}.`
            );
        }

        // Find empty hand
        const slot = Accounts.emptyHand(acc);
        if (!slot) {
            return sendSystem(socket, "Your hands are both full.");
        }

        const room = world.rooms[sess.room];
        if (!room) return sendSystem(socket, "This place does not exist.");
        if (!Array.isArray(room.items)) return sendSystem(socket, `There is no ${itemName} here.`);

        const idx = room.items.findIndex(i =>
            i.defId === itemName || i.defId?.toLowerCase() === itemName
        );
        if (idx === -1) return sendSystem(socket, `There is no ${itemName} here.`);

        // Remove from room
        room.items.splice(idx, 1);

        // Put in hand
        acc.hands[slot] = itemName;
        Accounts.save();

        socket.send(JSON.stringify({ type: "hands", hands: acc.hands }));
        sendSystem(socket, `You pick up the ${itemName}.`);
        sendRoom(socket, sess.room);
    }
};
