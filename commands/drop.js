// ===============================================
// commands/drop.js — FIXED (itemId-safe)
// ===============================================

module.exports = {
    name: "drop",
    help: "drop",

    execute(ctx) {
        const {
            socket,
            sess,
            accounts,
            world,
            sendSystem,
            sendRoom,
            broadcastToRoomExcept
        } = ctx;

        const acc = accounts[sess.loginId];
        if (!acc || !acc.heldItem) {
            return sendSystem(socket, "You are not holding anything.");
        }

        const room = world.rooms[sess.room];
        if (!room) return;

        if (!room.objects) room.objects = {};

        const itemId = acc.heldItem;

        // 🔍 Check if THIS ITEM TYPE already exists in room
        const alreadyHere = Object.values(room.objects)
            .some(obj => obj.itemId === itemId);

        if (alreadyHere) {
            return sendSystem(socket,
                "This room doesn’t need another one of those."
            );
        }

        // 🪨 Generate a safe object key
        const key = itemId; // for now, one-per-room
        room.objects[key] = { itemId };

        // ✅ Only now clear hands
        acc.heldItem = null;
        console.log(
  "[DROP DEBUG] room objects after drop:",
  JSON.stringify(room.objects)
);


        sendSystem(socket, `You drop the ${itemId}.`);

        const actor = acc?.name || "Someone";
        broadcastToRoomExcept(
            sess.room,
            `${actor} drops a ${itemId}.`,
            socket
        );

        sendRoom(socket, sess.room);
    }
};
