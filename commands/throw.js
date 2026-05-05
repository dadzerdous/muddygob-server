// ===============================================
// commands/throw.js
// ===============================================

module.exports = {
    name: "throw",
    help: "throw <item> <target>",

    execute(ctx, arg) {
        const { socket, sess, accounts, world, sendSystem, sendRoom } = ctx;
        const Accounts = require("../core/accounts");
        const { checkEvent } = require("../core/events");

        const acc = accounts[sess.loginId];
        if (!acc) return;

        const parts  = (arg || '').trim().toLowerCase().split(' ');
        const item   = parts[0];
        const target = parts[1];

        if (!item) return sendSystem(socket, "Throw what?");

        // Check player is holding the item
        const inHands = acc.hands.left === item || acc.hands.right === item;
        if (!inHands) return sendSystem(socket, `You aren't holding a ${item}.`);

        // No target yet — ask client to prompt for one
        if (!target) {
            socket.send(JSON.stringify({
                type:   "target_prompt",
                action: "throw",
                item,
                msg:    `Throw the ${item} at what?`,
            }));
            return;
        }

        // Check for event first
        const fired = checkEvent(socket, sess, 'throw', item, target);
        console.log("[THROW] event fired:", fired, "room events:", !!World.rooms[sess.room]?.events);
        if (fired) {
            // Event handled everything — re-render room
            sendRoom(socket, sess.room);
            return;
        }

        // No event — generic throw
        if (acc.hands.left  === item) acc.hands.left  = null;
        if (acc.hands.right === item) acc.hands.right = null;
        Accounts.save();

        socket.send(JSON.stringify({ type: 'hands', hands: acc.hands }));
        sendSystem(socket, `You throw the ${item}. It disappears.`);
        sendRoom(socket, sess.room);
    }
};
