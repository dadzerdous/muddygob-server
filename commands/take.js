// ===============================================
// commands/take.js
// ===============================================

module.exports = {
    name: "take",
    aliases: ["get", "grab"],
    help: "take <item>",

    execute(ctx, arg) {
        const World = require('../core/world');
        const { socket, sess, sendSystem, sendRoom, accounts, world } = ctx;
        const Accounts = require("../core/accounts");

        const acc = accounts[sess.loginId];
        if (!acc) return;

        // Normalize: "fake coin" → "fake_coin"
        const normalize = s => s?.toLowerCase().replace(/\s+/g, '_');
        const itemName = normalize(arg);
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

        const idx = room.items.findIndex(i => normalize(i.defId) === itemName || normalize(World.items[i.defId]?.name ?? '') === itemName);
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

        const displayName = World.items[defId]?.name || defId;
        socket.send(JSON.stringify({ type: "hands", hands: acc.hands }));
        sendSystem(socket, `You pick up the ${displayName}.`);

        // Quest flag: took_rock
        if (defId === 'rock' && !acc.flags?.took_rock) {
            if (!acc.flags) acc.flags = {};
            acc.flags.took_rock = true;
            Accounts.save();
            try {
                const { sendQuestState } = require('../core/events');
                sendQuestState(socket, acc);
            } catch(e) {}
        }

        sendRoom(socket, sess.room);
    }
};
