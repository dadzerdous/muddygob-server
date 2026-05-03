// commands/hands.js
module.exports = {
    name: "hands",
    execute(ctx) {
        const { socket, sess, accounts, world, sendSystem } = ctx;
        const acc = accounts[sess.loginId];
        if (!acc) return;

        const { left, right } = acc.hands || {};

        const fmt = (item) => {
            if (!item) return "empty";
            const def = world.items[item];
            return `${def?.emoji ?? ''} ${item}`.trim();
        };

        sendSystem(socket, `Left: ${fmt(left)} | Right: ${fmt(right)}`);
    }
};
