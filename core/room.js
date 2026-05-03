// ===============================================
// core/room.js
// ===============================================
console.log("🟣 core/room.js LOADED — v1.25 (roomDesc) 🟣");

const Sessions = require("./sessions");
const Accounts  = require("./accounts");
const World     = require("./world");

function oppositeDirection(dir) {
    return { north:"south", south:"north", east:"west", west:"east" }[dir] || "somewhere";
}

function getRoom(roomId) {
    return World.rooms[roomId];
}

function sendRoom(socket, id) {
    const sess = Sessions.get(socket);
    if (!sess) { console.log("❌ sendRoom: no session"); return; }

    console.log("[SEND ROOM]", id, "state:", sess.state);

    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race;
    const room = World.rooms[id];

    if (!room) {
        console.error("[ROOM ERROR] Missing room:", id);
        Sessions.sendSystem(socket, "The world frays… you are pulled back.");
        const fallback = acc?.lastRoom && World.rooms[acc.lastRoom]
            ? acc.lastRoom : Object.keys(World.rooms)[0];
        sess.room = fallback;
        return sendRoom(socket, fallback);
    }

    // Spawn ambient items
    const { ensureAmbientItems } = require("./itemSpawner");
    ensureAmbientItems(room);

    // Players in room
    const playersHere = [];
    for (const [sock, s] of Sessions.sessions.entries()) {
        if (s.room === id && s.state === "ready") {
            const a = Accounts.data[s.loginId];
            if (a) playersHere.push(a.name);
        }
    }

    // Base description (atmospheric text only)
    let desc = Array.isArray(room.text)
        ? [...room.text]
        : ["You see nothing special."];

    // Per-player discovery set for this room
    const playerDisc = (acc?.discovered && !Array.isArray(acc.discovered))
        ? (acc.discovered[id] || [])
        : [];
    const discSet = new Set(playerDisc);

    // Build object list + append each object's roomDesc to description
    const objectList = [];
    const seenIds    = new Set();

    // ---------- SCENERY ----------
    if (room.objects) {
        for (const [key, obj] of Object.entries(room.objects)) {
            if (seenIds.has(key)) continue;
            seenIds.add(key);

            // Append this object's roomDesc to description
            const roomDesc = (obj.roomDescByRace && race && obj.roomDescByRace[race])
                || obj.roomDesc
                || null;
            if (roomDesc) desc.push(roomDesc);

            objectList.push({
                id:         key,
                name:       key,
                type:       "scenery",
                emoji:      obj.emoji || "",
                actions:    obj.actions || ["look"],
                discovered: discSet.has(key),
                lookText:
                    (obj.textByRace && race && obj.textByRace[race]) ||
                    obj.text || obj.lookText || null,
            });
        }
    }

    // ---------- AMBIENT ITEMS ----------
    if (room.items) {
        for (const inst of room.items) {
            const def = World.items[inst.defId];
            if (!def) continue;
            if (seenIds.has(inst.defId)) continue;
            seenIds.add(inst.defId);

            // roomDesc from ambient rule or item def
            const roomDesc = room.ambient?.[inst.defId]?.roomText
                || (def.roomDescByRace && race && def.roomDescByRace[race])
                || def.roomDesc
                || null;
            if (roomDesc) desc.push(roomDesc);

            objectList.push({
                id:         inst.defId,
                name:       def.name || inst.defId,
                type:       "item",
                emoji:      def.emoji || "",
                actions:    def.baseActions || ["look","take"],
                discovered: discSet.has(inst.defId),
                lookText:
                    (def.textByRace && race && def.textByRace[race]) ||
                    def.text || null,
            });
        }
    }

    const totalDiscoverable = objectList.length;

    try {
        const payload = {
            type:             "room",
            id,
            title:            room.title || "Somewhere",
            desc,
            exits:            Object.keys(room.exits || {}),
            background:       room.background || null,
            players:          playersHere,
            objects:          objectList,
            totalDiscoverable,
        };

        console.log("📦 ROOM PAYLOAD:", {
            id, title: payload.title,
            desc: payload.desc.length,
            objects: payload.objects.length,
            exits: payload.exits,
        });

        socket.send(JSON.stringify(payload));
        console.log("✅ ROOM SENT:", id);
    } catch (err) {
        console.error("🔥 sendRoom() failed:", err);
    }
}

function handleMove(socket, sess, cmd, arg) {
    const dir = normalizeDirection(cmd, arg);
    if (!dir) return Sessions.sendSystem(socket, "Move where?");
    if (sess.energy <= 0) return Sessions.sendSystem(socket, "You are too exhausted to move.");

    sess.energy = Math.max(0, sess.energy - 3);
    const acc = Accounts.data[sess.loginId];
    acc.energy = sess.energy;
    Accounts.save();

    socket.send(JSON.stringify({ type:"stats", energy:sess.energy }));

    const room = getRoom(sess.room);
    if (!room?.exits?.[dir]) return Sessions.sendSystem(socket, "You cannot go that way.");

    const actor  = acc?.name || "Someone";
    const oldRoom = sess.room;
    const newRoom = room.exits[dir];

    Sessions.broadcastToRoomExcept(oldRoom, `${actor} leaves ${dir}.`, socket);
    sess.room    = newRoom;
    acc.lastRoom = newRoom;
    Accounts.save();
    Sessions.broadcastToRoomExcept(newRoom, `${actor} enters from ${oppositeDirection(dir)}.`, socket);

    sendRoom(socket, newRoom);
}

function normalizeDirection(cmd, arg) {
    const map = { n:"north",north:"north",s:"south",south:"south",e:"east",east:"east",w:"west",west:"west" };
    return map[cmd] || map[arg] || null;
}

module.exports = { sendRoom, handleMove, oppositeDirection, getRoom };
