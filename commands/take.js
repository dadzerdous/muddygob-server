// ===============================================
// commands/take.js (FIXED: no formatActor)
// ===============================================

module.exports = {
    name: "take",
    aliases: ["get", "grab"],
    help: "take <item>",

    execute(ctx, arg) {
        const {
            socket,
            sess,
            accounts,
            world,
            sendSystem,
            sendRoom,
            broadcastToRoomExcept
        } = ctx;

        if (!arg) return sendSystem(socket, "Take what?");

        const acc = accounts[sess.loginId];
        if (!acc) return;

        const room = world.rooms[sess.room];
        if (!room || !room.objects) {
            return sendSystem(socket, "There is nothing here to take.");
        }

        const key = arg.toLowerCase();
        const obj = room.objects[key];

        if (!obj || !obj.itemId) {
            return sendSystem(socket, "You see no such thing.");
        }

        // Remove from room
        delete room.objects[key];

        // Put into hands
        acc.heldItem = obj.itemId;

        // Personal message
        sendSystem(socket, `You pick up the ${key}.`);

        // Broadcast to others (safe)
        const actor = acc?.name || "Someone";
        broadcastToRoomExcept(
            sess.room,
            `${actor} picks up a ${key}.`,
            socket
        );

        // Update room for the player who acted
        sendRoom(socket, sess.room);

        // NOTE: Do NOT broadcast null messages.
        // Other players can "look" to refresh, or we can add a room-refresh packet later.
    }
};
