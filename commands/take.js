// ===============================================
// commands/take.js — AUTHORITATIVE HANDS FIXED
// ===============================================

module.exports = {
    name: "take",
    aliases: ["get", "grab"],
    help: "take <item>",
    
    execute(ctx, args) {
        const { socket, sess, accounts, world, sendSystem, sendRoom } = ctx;
        
        const acc = accounts[sess.loginId];
        if (!acc) return;

        const itemName = (Array.isArray(args) ? args[0] : args)?.toLowerCase();
        if (!itemName) {
            return sendSystem(socket, "Take what?");
        }

        if (acc.heldItem) {
            return sendSystem(socket, "Your hands are already full.");
        }

        const room = world.rooms[sess.room];
        if (!room || !room.objects) {
            return sendSystem(socket, `There is no ${itemName} here.`);
        }

        // Find object by itemId
        const entry = Object.entries(room.objects)
            .find(([_, obj]) => obj.itemId === itemName);

        if (!entry) {
            return sendSystem(socket, `There is no ${itemName} here.`);
        }

        const [instanceId] = entry;

        // Remove from room
        delete room.objects[instanceId];

        // Set held item
        acc.heldItem = itemName;

        // 🔔 Notify client (authoritative)
        socket.send(JSON.stringify({
            type: "held",
            item: acc.heldItem
        }));

        // Feedback + room update
        sendSystem(socket, `You pick up the ${itemName}.`);
        sendRoom(socket, sess.room);
    }
};
