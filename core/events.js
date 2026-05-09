// ===============================================
// core/events.js — Event engine
// ===============================================

const World    = require("./world");
const Accounts = require("./accounts");
const Sessions = require("./sessions");

// ── CHECK & FIRE ─────────────────────────────────────────
// Called by commands (throw, use, combine) after basic validation
// Returns true if an event fired, false if not
function checkEvent(socket, sess, action, item, target) {
    const room = World.rooms[sess.room];
    if (!room?.events) return false;

    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';

    // Find matching event
    const event = Object.values(room.events).find(e => {
        const t = e.trigger;
        return t.action === action
            && (!t.item   || t.item   === item)
            && (!t.target || t.target === target);
    });

    if (!event) return false;

    console.log("[EVENT] firing:", action, item, target);

    // Fire each outcome in order
    for (const outcome of event.outcome) {
        fireOutcome(socket, sess, acc, race, outcome);
    }

    return true;
}

// ── OUTCOME HANDLERS ─────────────────────────────────────
function fireOutcome(socket, sess, acc, race, outcome) {
    switch (outcome.do) {

        case 'system': {
            const msg = outcome.msgByRace?.[race] || outcome.msg || '';
            Sessions.sendSystem(socket, msg);

            // Broadcast to others in room if specified
            if (outcome.broadcast) {
                const broadcastMsg = outcome.broadcastByRace?.[race] || outcome.broadcast;
                Sessions.broadcastToRoomExcept(sess.room, broadcastMsg, socket);
            }
            break;
        }

        case 'spawnItem': {
            const { item, owner, onGround } = outcome;
            if (!item) break;

            const room = World.rooms[sess.room];
            if (!room.items) room.items = [];

            // If room has a matching hidden object, reveal it too
            if (room.objects?.[item]?.state === 'hidden') {
                room.objects[item].state = 'visible';
            }

            if (owner === 'actor' && !onGround) {
                // Put directly in player's hands
                const slot = Accounts.emptyHand(acc);
                if (slot) {
                    acc.hands[slot] = item;
                    Accounts.save();
                    socket.send(JSON.stringify({ type: 'hands', hands: acc.hands }));
                    break;
                }
                // Hands full — fall through to ground spawn
            }

            // Spawn on ground — with owner if specified
            room.items.push({
                id:         `${item}_${Date.now()}`,
                defId:      item,
                originRoom: sess.room,
                owner:      owner === 'actor' ? acc.name : null,
            });
            break;
        }

        case 'removeFromHands': {
            const { item } = outcome;
            if (!item) break;
            if (acc.hands.left  === item) acc.hands.left  = null;
            if (acc.hands.right === item) acc.hands.right = null;
            Accounts.save();
            socket.send(JSON.stringify({ type: 'hands', hands: acc.hands }));
            break;
        }

        case 'removeFromRoom': {
            const room = World.rooms[sess.room];
            if (!room?.items) break;
            const idx = room.items.findIndex(i => i.defId === outcome.item);
            if (idx !== -1) room.items.splice(idx, 1);
            break;
        }

        case 'sendRoom': {
            const Room = require("./room");
            Room.sendRoom(socket, sess.room);
            break;
        }

        case 'revealNpc': {
            const { npc } = outcome;
            if (!npc) break;
            const room = World.rooms[sess.room];
            if (!room?.objects?.[npc]) break;
            room.objects[npc].state = 'visible';
            console.log('[EVENT] revealed NPC:', npc);
            break;
        }

        case 'completeInstance': {
            if (!Array.isArray(acc.instancesCompleted)) acc.instancesCompleted = [];
            if (!acc.instancesCompleted.includes(outcome.instance)) {
                acc.instancesCompleted.push(outcome.instance);
                Accounts.save();
            }
            break;
        }

        default:
            console.warn("[EVENT] unknown outcome:", outcome.do);
    }
}

module.exports = { checkEvent };
