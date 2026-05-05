// ===============================================
// commands/throw.js
// ===============================================

const World = require("../core/world");

module.exports = {
    name: "throw",
    help: "throw <item> <target>",

    execute(ctx, arg) {
        console.log("[THROW] arg:", arg, "parts:", (arg||'').trim().toLowerCase().split(' '));
        const { socket, sess, accounts, sendSystem, sendRoom } = ctx;
        const Accounts       = require("../core/accounts");
        const { checkEvent } = require("../core/events");

        const acc = accounts[sess.loginId];
        if (!acc) return;

        if (!acc.hands) acc.hands = { left: null, right: null };

        const parts  = (arg || '').trim().toLowerCase().split(' ');
        const item   = parts[0];
        const target = parts[1];

        if (!item) return sendSystem(socket, "Throw what?");

        const inHands = acc.hands.left === item || acc.hands.right === item;
        if (!inHands) return sendSystem(socket, `You aren't holding a ${item}.`);

        if (!target) {
            socket.send(JSON.stringify({
                type:   "target_prompt",
                action: "throw",
                item,
                msg:    `Throw the ${item} at what?`,
            }));
            return;
        }

        console.log("[THROW]", item, "->", target, "| room events:", !!World.rooms[sess.room]?.events);

        const fired = checkEvent(socket, sess, 'throw', item, target);
        console.log("[THROW] event fired:", fired);

        if (fired) {
            sendRoom(socket, sess.room);
            return;
        }

        if (acc.hands.left  === item) acc.hands.left  = null;
        if (acc.hands.right === item) acc.hands.right = null;
        Accounts.save();

        socket.send(JSON.stringify({ type: 'hands', hands: acc.hands }));
        sendSystem(socket, `You throw the ${item}. It disappears.`);
        sendRoom(socket, sess.room);
    }
};
