module.exports = {
    name: "take",
    aliases: [],

    execute(ctx, arg) {
        const { socket, sess, accounts, world, sendRoom, sendSystem, saveAccounts } = ctx;
        const acc = accounts[sess.loginId];
        const room = world[sess.room];

        if (!arg) return sendSystem(socket, "Take what?");

        const obj = room.objects?.[arg];
        if (!obj) return sendSystem(socket, "You see no such thing.");

        if (obj.type !== "item")
            return sendSystem(socket, "You cannot take that.");

        // Look up actual item definition
        const itemDef = itemsDB[obj.itemId];
        if (!itemDef)
            return sendSystem(socket, "This item cannot be taken.");

        // Add to inventory
        if (!acc.inventory) acc.inventory = [];
        acc.inventory.push(obj.itemId);

        // Remove item from room
        delete room.objects[arg];

        saveAccounts();

        sendSystem(socket, `You pick up the ${arg}.`);
        sendRoom(socket, sess.room);
    }
};
