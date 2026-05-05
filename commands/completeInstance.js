// ===============================================
// commands/completeInstance.js
// Called by event system when tutorial is done
// ===============================================

module.exports = {
    name: "completeinstance",
    help: "completeinstance <name> — internal, marks instance complete",

    execute(ctx, arg) {
        const { socket, sess, accounts, world, sendSystem, sendRoom } = ctx;
        const Accounts = require("../core/accounts");

        const acc          = accounts[sess.loginId];
        const instanceName = arg?.trim()?.toLowerCase();
        if (!acc || !instanceName) return;

        if (!Array.isArray(acc.instancesCompleted)) acc.instancesCompleted = [];

        if (!acc.instancesCompleted.includes(instanceName)) {
            acc.instancesCompleted.push(instanceName);
            Accounts.save();
        }

        // Boot to first non-instance room
        const mainRoom = Object.keys(world.rooms).find(r => !world.rooms[r].instance);
        if (!mainRoom) return sendSystem(socket, "No main world found.");

        sess.room    = mainRoom;
        acc.lastRoom = mainRoom;
        Accounts.save();

        sendSystem(socket, "You leave the tutorial behind.");
        sendRoom(socket, mainRoom);
    }
};
