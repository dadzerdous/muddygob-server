// ===============================================
// commands/take.js — AMBIENT ITEM MODEL (LOCKED)
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

        // Already holding something
        if (acc.heldItem) {
            return sendSystem(socket,
                acc.race === "goblin"
                    ? "Don't get greedy."
                    : "Your hands are already full."
            );
        }

        const room = world.rooms[sess.room];
        if (!room || !room.objects) {
            return sendSystem(socket, "There is nothing here to take.");
        }

        const key = arg.toLowerCase();
        const obj = room.objects[key];

        if (!obj || !obj.itemId) {
            return sendSystem(socket, "You see no such thing.");
        }

        // Remove from room FIRST
        delete room.objects[key];

        // Attach to player hands
        acc.heldItem = obj.itemId;

        sendSystem(socket, `You pick up the ${key}.`);

        const actor = acc?.name || "Someone";
        broadcastToRoomExcept(
            sess.room,
            `${actor} picks up a ${key}.`,
            socket
        );

        sendRoom(socket, sess.room);
    }
};
