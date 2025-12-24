// ===============================================
// commands/take.js — AUTHORITATIVE HANDS (FIXED)
// ===============================================

module.exports = {
    name: "take",
    aliases: ["get", "grab"],
    help: "take <item>",

    execute(ctx, args) {
        const { socket, sess, accounts, world, sendSystem, sendRoom } = ctx;

        // ---------------------------------------
        // ACCOUNT CHECK
        // ---------------------------------------
        const acc = accounts[sess.loginId];
        if (!acc) return;

        // ---------------------------------------
        // PARSE ITEM NAME
        // ---------------------------------------
        const itemName = (Array.isArray(args) ? args[0] : args)?.toLowerCase();
        if (!itemName) {
            return sendSystem(socket, "Take what?");
        }

        // ---------------------------------------
        // HANDS CHECK
        // ---------------------------------------
        if (acc.heldItem) {
            return sendSystem(socket, "Your hands are already full.");
        }

        // ---------------------------------------
        // ROOM LOOKUP
        // ---------------------------------------
        const room = world.rooms[sess.room];
        if (!room) {
            return sendSystem(socket, "The world frays… nothing is here.");
        }

        // ---------------------------------------
        // ENSURE ITEM INSTANCES ARRAY
        // ---------------------------------------
        room.items = room.items || [];

        // ---------------------------------------
        // FIND ITEM INSTANCE
        // ---------------------------------------
        const idx = room.items.findIndex(inst => inst.defId === itemName);

        if (idx === -1) {
            return sendSystem(socket, `There is no ${itemName} here.`);
        }

        // ---------------------------------------
        // REMOVE FROM ROOM
        // ---------------------------------------
        room.items.splice(idx, 1);

        // ---------------------------------------
        // PUT IN HANDS
        // ---------------------------------------
        acc.heldItem = itemName;
        accounts.save();

        // ---------------------------------------
        // CLIENT UPDATE
        // ---------------------------------------
        socket.send(JSON.stringify({
            type: "held",
            item: itemName
        }));

        sendSystem(socket, `You pick up the ${itemName}.`);
        return sendRoom(socket, sess.room);
    }
};
