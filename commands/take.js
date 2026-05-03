// ===============================================
// commands/take.js
// ===============================================

module.exports = {
    name: "take",
    aliases: ["get", "grab"],
    help: "take <item>",

    execute(ctx, arg) {
        const { socket, sess, sendSystem, sendRoom, accounts, world } = ctx;

        const acc = accounts[sess.loginId];
        if (!acc) return;

        const itemName = arg?.trim()?.toLowerCase();
        if (!itemName) return sendSystem(socket, "Take what?");

        // Hands full check
        if (acc.heldItem) {
            return sendSystem(socket, "Your hands are already full.");
        }

        // Already carrying this item type check
        const alreadyHeld = acc.heldItem === itemName;
        const inInventory = Array.isArray(acc.inventory) && acc.inventory.includes(itemName);
        if (alreadyHeld || inInventory) {
            return sendSystem(socket,
                acc.race === "goblin"
                    ? "You already have one. That's enough."
                    : `You're already carrying a ${itemName}.`
            );
        }

        const room = world.rooms[sess.room];
        if (!room) return sendSystem(socket, "This place does not exist.");
        if (!Array.isArray(room.items)) return sendSystem(socket, `There is no ${itemName} here.`);

        // Find item in room
        const idx = room.items.findIndex(i =>
            i.defId === itemName ||
            i.defId?.toLowerCase() === itemName
        );
        if (idx === -1) return sendSystem(socket, `There is no ${itemName} here.`);

        // Remove from room
        room.items.splice(idx, 1);

        // Put in hand
        acc.heldItem = itemName;
        require("../core/accounts").save();

        socket.send(JSON.stringify({ type: "held", item: itemName }));
        sendSystem(socket, `You pick up the ${itemName}.`);
        sendRoom(socket, sess.room);
    }
};
