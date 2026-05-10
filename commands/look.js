// ===============================================
// commands/look.js — ROOM + HANDS + INVENTORY + PLAYER INSPECT
// ===============================================

const Accounts = require("../core/accounts");
const Sessions = require("../core/sessions");
const World = require("../core/world");

module.exports = {
    name: "look",
    aliases: ["l"],
    help: "Look at the room, an object, or a player.",

    execute(ctx, arg) {
        const { socket, sess, sendRoom, sendSystem, commands } = ctx;

        // If no argument → show room
        if (!arg || arg.trim() === "") {
            return sendRoom(socket, sess.room);
        }

        const objName = arg.trim().toLowerCase();

        const acc = Accounts.data[sess.loginId];
        if (!acc) return;
        const race = acc.race || "human";

        // ---------------------------------------
        // 0) PLAYER INSPECT: look <player>
        // ---------------------------------------
        for (const [sock, s] of Sessions.sessions.entries()) {
            if (s.room !== sess.room || s.state !== "ready") continue;

            const other = Accounts.data[s.loginId];
            if (!other) continue;

            if (objName === other.name.toLowerCase()) {
                if (commands["inspect"]) {
                    return commands["inspect"].execute(ctx, objName);
                } else {
                    return sendSystem(socket, "Inspect is not available yet.");
                }
            }
        }

        // ---------------------------------------
        // 1) LOOK AT HELD ITEM — send detailed stat card
        // ---------------------------------------
        const inHands = acc.hands.left === objName || acc.hands.right === objName;
        const inBag   = Array.isArray(acc.inventory) && acc.inventory.includes(objName);

        if (inHands || inBag) {
            const def = World.items[objName];
            if (def) {
                const flavour = (def.textByRace && def.textByRace[race]) || def.text || null;
                const weaponXP = acc.weaponXP?.[objName] ?? 0;
                socket.send(JSON.stringify({
                    type:     'item_detail',
                    itemId:   objName,
                    def,
                    flavour,
                    weaponXP,
                    race,
                }));
                return;
            }
        }

        // ---------------------------------------
        // 3) LOOK IN THE ROOM
        // ---------------------------------------
const room = World.rooms[sess.room];
if (!room) {
    return sendSystem(socket, "This place does not exist.");
}

// ---------------------------------------
// 3A) LOOK AT ITEM INSTANCES IN ROOM
// ---------------------------------------
if (Array.isArray(room.items)) {
    const inst = room.items.find(i => i.defId === objName || World.items[i.defId]?.name?.toLowerCase() === objName);
    if (inst) {
        const def = World.items[objName];
        if (def) {
            const desc =
                (def.textByRace && race && def.textByRace[race]) ||
                def.text ||
                `You see nothing special about the ${objName}.`;
            return sendSystem(socket, desc);
        }
    }
}


 
        // find by obj key or by itemId
        let target = null;

        if (room.objects) {
            for (const [instanceId, obj] of Object.entries(room.objects)) {
                if (instanceId === objName || obj.itemId === objName || (obj.name && obj.name.toLowerCase() === objName)) {
                    target = obj;
                    break;
                }
            }
        }

        if (!target) {
            return sendSystem(socket, `You see no ${objName} here.`);
        }

        // If item points to item database
        if (target.itemId && World.items[target.itemId]) {
            const def = World.items[target.itemId];
            const desc =
                (def.textByRace && def.textByRace[race]) ||
                def.text ||
                `You see nothing special about the ${objName}.`;
            return sendSystem(socket, desc);
        }

        // Scenery object
        const desc =
            (target.textByRace && target.textByRace[race]) ||
            target.lookText ||
            target.text ||
            `You see nothing special about the ${objName}.`;

        return sendSystem(socket, desc);
    }
};
