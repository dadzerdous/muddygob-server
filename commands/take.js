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

const room = World.rooms[sess.room];
if (!room) {
    return sendSystem(socket, "The world frays… nothing is here.");
}

// Ensure instances exist (safe guard)
room.items = room.items || [];

// Find a live item instance in this room
const idx = room.items.findIndex(inst => inst.defId === objName);

if (idx === -1) {
    return sendSystem(socket, `There is no ${objName} here.`);
}

// Remove it from the room
room.items.splice(idx, 1);

// Put it in player hands (held item)
acc.heldItem = objName;
Accounts.save();

// Tell client hands changed
socket.send(JSON.stringify({
    type: "held",
    item: objName
}));

sendSystem(socket, `You pick up the ${objName}.`);
return sendRoom(socket, sess.room);

    }
};
