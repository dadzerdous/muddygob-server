// ===============================================
// commands/use.js
// ===============================================

const World = require("../core/world");

module.exports = {
    name: "use",
    help: "use <item> — use or combine an item",

    execute(ctx, arg) {
        const { socket, sess, accounts, sendSystem, sendRoom } = ctx;
        const Sessions = require('../core/sessions');
        const Accounts = require("../core/accounts");

        const acc = accounts[sess.loginId];
        if (!acc) return;
        if (!acc.hands) acc.hands = { left: null, right: null };

        const normalize = s => s?.toLowerCase().replace(/\s+/g, '_');
        const parts  = (arg || '').trim().toLowerCase().split(' ');
        const item   = normalize(parts[0]);
        const target = parts.length > 1 ? parts[parts.length - 1] : null;

        if (!item) return sendSystem(socket, "Use what?");

        // Must be holding it
        const inHands = acc.hands.left === item || acc.hands.right === item;
        if (!inHands) return sendSystem(socket, `You aren't holding a ${item}.`);

        // Find the other hand item
        const otherItem = acc.hands.left === item
            ? acc.hands.right
            : acc.hands.left;

        // Try combining if both hands have items
        if (otherItem) {
            const key1 = `${item}+${otherItem}`;
            const key2 = `${otherItem}+${item}`;
            const recipe = World.recipes?.[key1] || World.recipes?.[key2];

            if (recipe) {
                const race = acc?.race ?? 'human';

                // Remove both items from hands
                acc.hands.left  = null;
                acc.hands.right = null;

                // Spawn result in left hand
                acc.hands.left = recipe.result;
                Accounts.save();

                socket.send(JSON.stringify({ type: 'hands', hands: acc.hands }));

                // Race-specific craft message
                const msg = recipe.msgByRace?.[race] || recipe.msg || `You combine the ${item} and ${otherItem} into a ${recipe.result}.`;
                sendSystem(socket, msg);

                // Re-render room so item descriptions update
                sendRoom(socket, sess.room);
                return;
            }

            // No recipe found
            sendSystem(socket,
                acc.race === 'goblin'
                    ? "You bash them together. Nothing happens."
                    : `You can't combine those.`
            );
            return;
        }

        // Only one item in hands — check for room events with target
        const { checkEvent } = require("../core/events");

        if (target) {
            const fired = checkEvent(socket, sess, 'use', item, target);
            if (fired) {
                sendRoom(socket, sess.room);
                return;
            }
            sendSystem(socket, `Nothing happens.`);
            return;
        }

        // No target — ask for one
        socket.send(JSON.stringify({
            type:   "target_prompt",
            action: "use",
            item,
            msg:    `Use the ${item} with what?`,
        }));
    }
};
