// ===============================================
// commands/take.js
// ===============================================

module.exports = {
    name: "take",
    aliases: ["get", "grab"],
    help: "take <item>",

    execute(ctx, args) {
        const { socket, sess, accounts, world, sendSystem, sendRoom } = ctx;

        // 1. Account Check
        const acc = accounts[sess.loginId];

        if (!acc) return;

        // 2. Parse Item Name
        const itemName = (Array.isArray(args) ? args[0] : args)?.toLowerCase();
        if (!itemName) {
            return sendSystem(socket, "Take what?");
        }

        // 3. Hands Check (Prevent carrying multiple items)
        if (acc.heldItem) {
            return sendSystem(socket, "Your hands are already full.");
        }

        // 4. Room Lookup
        const room = world.rooms[sess.room];
        if (!room) {
            return sendSystem(socket, "The world frays… nothing is here.");
        }

        // 5. Find Item Instance in the room
        // We check room.items because itemSpawner.js puts them there
        room.items = room.items || [];
        const idx = room.items.findIndex(inst => inst.defId === itemName);

        if (idx === -1) {
            return sendSystem(socket, `There is no ${itemName} here.`);
        }

        // 6. Remove from Room
        room.items.splice(idx, 1);

        // 7. Put in Hands & Save
        acc.heldItem = itemName;
        accounts.save();

        // 8. Client Update
        socket.send(JSON.stringify({
            type: "held",
            item: itemName
        }));

        sendSystem(socket, `You pick up the ${itemName}.`);
        
        // Refresh the room for the player so the item disappears from view
        return sendRoom(socket, sess.room);
    }
};
