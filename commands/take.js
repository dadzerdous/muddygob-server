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

        // Normalize: "fake coin" → "fake_coin"
        const normalize = s => s?.toLowerCase().replace(/\s+/g, '_');
        const itemName = normalize(arg);
        try {
            const Combat = require('../commands/combat');
            if (Combat.requireIdle && !Combat.requireIdle(sess, socket, 'take')) return;
        } catch(e) {}

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

        const idx = room.items.findIndex(i => normalize(i.defId) === itemName);
        if (idx === -1) return sendSystem(socket, `There is no ${itemName} here.`);

        // Check ownership
        const inst = room.items[idx];
        if (inst.owner && inst.owner !== acc.name) {
            return sendSystem(socket,
                acc.race === 'goblin'
                    ? "That one's not yours. You can tell."
                    : `That belongs to someone else.`
            );
        }

        // Remove from room
        room.items.splice(idx, 1);

        // Store using defId (normalized underscore form)
        const defId = inst.defId;
        acc.hands[slot] = defId;
        Accounts.save();

        socket.send(JSON.stringify({ type: "hands", hands: acc.hands }));
        sendSystem(socket, `You pick up the ${itemName}.`);
        sendRoom(socket, sess.room);
    }
};
