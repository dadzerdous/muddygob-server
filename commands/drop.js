// ===============================================
// commands/drop.js
// ===============================================

module.exports = {
    name: "drop",
    help: "drop — drop your held item in the current room",

    execute(ctx) {
        const { socket, sess, accounts, world, sendSystem, sendRoom, broadcastToRoomExcept } = ctx;

        const acc = accounts[sess.loginId];
        if (!acc || !acc.heldItem) {
            return sendSystem(socket, "You are not holding anything.");
        }

        const room = world.rooms[sess.room];
        if (!room) return;

        const itemId = acc.heldItem;

        if (!Array.isArray(room.items)) room.items = [];

        // Prevent dropping if this item type already exists in the room
        const alreadyHere = room.items.some(i => i.defId === itemId);
        if (alreadyHere) {
            return sendSystem(socket,
                acc.race === "goblin"
                    ? "There's already one here. Even goblins know when enough is enough."
                    : `There's already a ${itemId} here.`
            );
        }

        // Drop into room
        console.log("[DROP] dropping", itemId, "into", sess.room);
        room.items.push({
            id: `${itemId}_${Date.now()}`,
            defId: itemId,
        });
        console.log("[DROP] room.items now:", room.items.length);

        // Clear hands
        acc.heldItem = null;
        require("../core/accounts").save();

        socket.send(JSON.stringify({ type: "held", item: null }));
        sendSystem(socket, `You drop the ${itemId}.`);

        const actor = acc?.name || "Someone";
        broadcastToRoomExcept(sess.room, `${actor} drops a ${itemId}.`, socket);

        console.log("[DROP] calling sendRoom for", sess.room);
        sendRoom(socket, sess.room);
    }
};
