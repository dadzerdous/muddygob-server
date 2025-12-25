// ===============================================
// commands/take.js — ROOM ITEMS (FINAL, ALIGNED)
// ===============================================

module.exports = {
    name: "take",
    aliases: ["get", "grab"],
    help: "take <item>",

    execute(ctx, arg) {
        const { socket, sess, sendSystem, sendRoom, accounts, world } = ctx;

        const acc = accounts[sess.loginId];
        if (!acc) return;

        // ---------------------------------------
        // PARSE INPUT
        // ---------------------------------------
        const itemName = arg?.trim()?.toLowerCase();
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
        // ROOM CHECK
        // ---------------------------------------
        const room = world.rooms[sess.room];
        if (!room) {
            return sendSystem(socket, "This place does not exist.");
        }

        if (!Array.isArray(room.items)) {
            return sendSystem(socket, `There is no ${itemName} here.`);
        }

        // ---------------------------------------
        // FIND ITEM INSTANCE
        // ---------------------------------------
        const idx = room.items.findIndex(i => i.defId === itemName);
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
        require("../core/accounts").save();


        // ---------------------------------------
        // FEEDBACK + RERENDER
        // ---------------------------------------
        sendSystem(socket, `You pick up the ${itemName}.`);
        return sendRoom(socket, sess.room);
    }
};
