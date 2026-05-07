// ===============================================
// commands/combat.js — engage, attack, retreat, flee
// ===============================================

const World    = require('../core/world');
const Accounts = require('../core/accounts');
const Sessions = require('../core/sessions');

// ── DICE ─────────────────────────────────────────────────
function roll(sides) { return Math.floor(Math.random() * sides) + 1; }

function rollDamage(def) {
    if (!def?.damage?.length) return def?.baseDamage ?? 1;
    // Roll each damage component and sum
    return def.damage.reduce((total, d) => {
        const sides = d.amount ?? 1;
        return total + roll(sides);
    }, 0);
}

function rollNpcDamage(npc) {
    const base = npc?.damage ?? 2;
    // Npc does base ± 1 variance
    return Math.max(1, base + roll(3) - 2); // -1, 0, or +1
}

function hitRoll(missChance = 0.15) {
    return Math.random() > missChance;
}

// ── COMBAT STATE ─────────────────────────────────────────
// combatSessions[loginId] = { stage, roomId, npcId, npcHp, playerHp }
const combatSessions = {};

// NPC auto-engage timers
const npcEngageTimers = {};

// ── STAGES ───────────────────────────────────────────────
const STAGE = { NOTICE: 'notice', APPROACH: 'approach', MELEE: 'melee' };

// ── ENGAGE ───────────────────────────────────────────────
function startCombat(socket, sess, npcId) {
    // Don't restart if already in combat with this NPC
    const existing = combatSessions[sess.loginId];
    if (existing && existing.npcId === npcId) return;

    const acc    = Accounts.data[sess.loginId];
    const room   = World.rooms[sess.room];
    const npc    = room?.objects?.[npcId];
    if (!npc || npc.state === 'hidden') return;

    const race = acc?.race ?? 'human';

    combatSessions[sess.loginId] = {
        stage:    STAGE.NOTICE,
        roomId:   sess.room,
        npcId,
        npcHp:    npc.hp ?? 15,
        playerHp: sess.hp ?? 100,
    };

    const noticeMsg = {
        goblin: { goblin: "It locks eyes with you. Neither of you moves. Yet.", human: "It locks eyes with you. You feel its intent.", elf: "Its eyes find yours. The air between you changes." },
    }[npcId]?.[race] ?? `The ${npcId} turns toward you.`;

    Sessions.sendSystem(socket, noticeMsg);
    sendCombatState(socket, sess.loginId);

    // NPC auto-advances after 4 seconds if player doesn't act
    clearNpcTimer(sess.loginId);
    npcEngageTimers[sess.loginId] = setTimeout(() => {
        npcAdvance(socket, sess, npcId);
    }, 4000);
}

function npcAdvance(socket, sess, npcId) {
    const cs = combatSessions[sess.loginId];
    if (!cs) return;
    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';

    if (cs.stage === STAGE.NOTICE) {
        cs.stage = STAGE.APPROACH;
        const msg = {
            goblin: { goblin: "It takes a step toward you. Deliberate.", human: "It moves closer. You can smell it now.", elf: "It advances. Unhurried. Certain." }
        }[npcId]?.[race] ?? `The ${npcId} moves closer.`;
        Sessions.sendSystem(socket, msg);
        sendCombatState(socket, sess.loginId);

        // Auto advance to melee after 4 more seconds
        clearNpcTimer(sess.loginId);
        npcEngageTimers[sess.loginId] = setTimeout(() => {
            npcAdvance(socket, sess, npcId);
        }, 4000);

    } else if (cs.stage === STAGE.APPROACH) {
        cs.stage = STAGE.MELEE;
        const msg = {
            goblin: { goblin: "It's on you. No more thinking.", human: "It lunges. You're in melee range.", elf: "It closes the gap. Combat has begun." }
        }[npcId]?.[race] ?? `The ${npcId} engages you!`;
        Sessions.sendSystem(socket, msg);
        sendCombatState(socket, sess.loginId);
        startNpcAttackLoop(socket, sess, npcId);
    }
}

// ── NPC ATTACK LOOP ───────────────────────────────────────
const npcAttackTimers = {};

function startNpcAttackLoop(socket, sess, npcId) {
    const room = World.rooms[sess.room];
    const npc  = room?.objects?.[npcId];
    const npcSpeed = npc?.atbSpeed ?? 3000;

    clearInterval(npcAttackTimers[sess.loginId]);
    npcAttackTimers[sess.loginId] = setInterval(() => {
        const cs = combatSessions[sess.loginId];
        if (!cs || cs.stage !== STAGE.MELEE) {
            clearInterval(npcAttackTimers[sess.loginId]);
            return;
        }

        const acc  = Accounts.data[sess.loginId];
        const race = acc?.race ?? 'human';

        // NPC miss chance
        if (!hitRoll(0.2)) {
            const missMsg = {
                goblin: { goblin: "It lunges — you sidestep.", human: "It swings wide. Lucky.", elf: "Its strike finds nothing." }
            }[npcId]?.[race] ?? `The ${npcId} misses.`;
            Sessions.sendSystem(socket, missMsg);
            sendCombatState(socket, sess.loginId);
            return;
        }

        const dmg = rollNpcDamage(npc);
        cs.playerHp = Math.max(0, cs.playerHp - dmg);
        sess.hp = cs.playerHp;
        socket.send(JSON.stringify({ type: 'stats', hp: cs.playerHp }));

        const hitMsg = {
            goblin: { goblin: `It hits you for ${dmg}. (${cs.playerHp} hp)`, human: `It strikes for ${dmg} damage. (${cs.playerHp} hp)`, elf: `It finds a gap. ${dmg} damage. (${cs.playerHp} hp)` }
        }[npcId]?.[race] ?? `The ${npcId} hits you for ${dmg}. (${cs.playerHp} hp)`;

        Sessions.sendSystem(socket, hitMsg);
        sendCombatState(socket, sess.loginId);

        if (cs.playerHp <= 0) {
            clearInterval(npcAttackTimers[sess.loginId]);
            playerDeath(socket, sess, npcId);
        }
    }, npcSpeed);
}

// ── PLAYER ATTACK ─────────────────────────────────────────
function playerAttack(socket, sess, weaponId) {
    const cs = combatSessions[sess.loginId];
    if (!cs || cs.stage !== STAGE.MELEE) {
        Sessions.sendSystem(socket, "You're not in melee range.");
        return;
    }

    const acc    = Accounts.data[sess.loginId];
    const race   = acc?.race ?? 'human';
    const def    = World.items[weaponId];
    const room   = World.rooms[sess.room];
    const npc    = room?.objects?.[cs.npcId];

    // Roll to hit
    if (!hitRoll(0.15)) {
        const missMsg = {
            goblin: "You swing. It ducks. Nothing lands.",
            human:  "You strike — but miss.",
            elf:    "Your blow finds no mark."
        }[race] ?? "You miss.";
        Sessions.sendSystem(socket, missMsg);
        sendCombatState(socket, sess.loginId);
        return;
    }

    // Roll damage from item definition
    const dmg = rollDamage(def);
    cs.npcHp  = Math.max(0, cs.npcHp - dmg);

    // Build hit message with damage types
    const dmgTypes = def?.damage?.map(d => d.type).join('+') ?? 'physical';
    const hitMsg = {
        goblin: `You hit for ${dmg} ${dmgTypes} damage.`,
        human:  `You strike the ${cs.npcId} for ${dmg} ${dmgTypes} damage.`,
        elf:    `${dmg} ${dmgTypes} damage. Clean.`
    }[race] ?? `${dmg} ${dmgTypes} damage.`;

    Sessions.sendSystem(socket, hitMsg);

    if (cs.npcHp <= 0) {
        npcDeath(socket, sess, npc, race);
        return;
    }

    sendCombatState(socket, sess.loginId);
}

// ── DEATH ─────────────────────────────────────────────────
function playerDeath(socket, sess, npcId) {
    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';

    endCombat(sess.loginId);

    const msg = {
        goblin: "Everything goes dark. Then lighter. You're back at the start, somehow.",
        human:  "You fall. When you wake, you're at the beginning.",
        elf:    "The world fades. You return to where it started. Again."
    }[race] ?? "You have been defeated.";

    Sessions.sendSystem(socket, msg);

    // Respawn at start room
    const Room = require('./room');
    sess.room = 'forest-g3';
    sess.hp   = 100;
    acc.lastRoom = 'forest-g3';
    acc.hands = { left: null, right: null }; // drop everything on death
    Accounts.save();

    socket.send(JSON.stringify({ type: 'hands', hands: acc.hands }));
    Room.sendRoom(socket, 'forest-g3');
}

function npcDeath(socket, sess, npc, race) {
    const cs = combatSessions[sess.loginId];
    endCombat(sess.loginId);

    const msg = {
        goblin: "It drops. You feel something — not quite pride, not quite guilt.",
        human:  "The goblin falls. The silence returns.",
        elf:    "It collapses. You stand over it, uncertain what you feel."
    }[race] ?? "Your enemy is defeated.";

    Sessions.sendSystem(socket, msg);

    // Spawn drops in room
    const room = World.rooms[sess.room];
    if (npc?.dropTable && room) {
        if (!room.items) room.items = [];
        npc.dropTable.forEach(itemId => {
            room.items.push({
                id:         `${itemId}_${Date.now()}`,
                defId:      itemId,
                originRoom: sess.room,
            });
        });
    }

    // XP reward
    if (npc?.xpReward) {
        const acc = Accounts.data[sess.loginId];
        if (acc) {
            acc.xp = (acc.xp ?? 0) + npc.xpReward;
            Accounts.save();
            Sessions.sendSystem(socket, `+${npc.xpReward} XP`);
        }
    }

    // Reset NPC state
    if (npc) npc.state = 'hidden';

    const Room = require('./room');
    Room.sendRoom(socket, sess.room);
}

// ── RETREAT ───────────────────────────────────────────────
function retreat(socket, sess) {
    const cs = combatSessions[sess.loginId];
    if (!cs) return Sessions.sendSystem(socket, "You're not in combat.");

    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';

    clearNpcTimer(sess.loginId);
    clearInterval(npcAttackTimers[sess.loginId]);

    if (cs.stage === STAGE.MELEE) {
        cs.stage = STAGE.APPROACH;
        const msg = { goblin: "You back off. Still close. Still dangerous.", human: "You disengage. Approach range.", elf: "You create distance. Briefly safer." }[race] ?? "You retreat to approach range.";
        Sessions.sendSystem(socket, msg);
        sendCombatState(socket, sess.loginId);

        // NPC re-advances
        npcEngageTimers[sess.loginId] = setTimeout(() => {
            npcAdvance(socket, sess, cs.npcId);
        }, 3000);

    } else if (cs.stage === STAGE.APPROACH) {
        cs.stage = STAGE.NOTICE;
        const msg = { goblin: "You're out of range. It watches you.", human: "You back away. It watches. Not done.", elf: "You disengage. The tension holds." }[race] ?? "You retreat to notice range.";
        Sessions.sendSystem(socket, msg);
        sendCombatState(socket, sess.loginId);

        npcEngageTimers[sess.loginId] = setTimeout(() => {
            npcAdvance(socket, sess, cs.npcId);
        }, 4000);

    } else if (cs.stage === STAGE.NOTICE) {
        // Flee — chance based, 70% success
        const fleeChance = Math.random();
        if (fleeChance > 0.3) {
            endCombat(sess.loginId);
            const msg = { goblin: "You bolt. It doesn't follow. This time.", human: "You run. It lets you go. For now.", elf: "You withdraw. It watches you leave." }[race] ?? "You flee.";
            Sessions.sendSystem(socket, msg);
            sendCombatState(socket, sess.loginId);
        } else {
            const msg = { goblin: "You try to run. It's faster. You're still here.", human: "You bolt — but it cuts you off.", elf: "You move to leave. It moves faster." }[race] ?? "You fail to flee.";
            Sessions.sendSystem(socket, msg);
            npcAdvance(socket, sess, cs.npcId);
        }
    }
}

// ── HELPERS ───────────────────────────────────────────────
function endCombat(loginId) {
    clearNpcTimer(loginId);
    clearInterval(npcAttackTimers[loginId]);
    delete npcAttackTimers[loginId];
    delete combatSessions[loginId];
}

function clearNpcTimer(loginId) {
    if (npcEngageTimers[loginId]) {
        clearTimeout(npcEngageTimers[loginId]);
        delete npcEngageTimers[loginId];
    }
}

function sendCombatState(socket, loginId) {
    const cs = combatSessions[loginId];
    socket.send(JSON.stringify({
        type:     'combat',
        stage:    cs?.stage ?? null,
        playerHp: cs?.playerHp ?? null,
        npcHp:    cs?.npcHp ?? null,
        npcId:    cs?.npcId ?? null,
    }));
}

function getCombatSession(loginId) {
    return combatSessions[loginId] ?? null;
}

// ── EXPORTS ───────────────────────────────────────────────
module.exports = {
    name: 'engage',
    aliases: ['attack', 'retreat', 'flee'],

    execute(ctx, arg) {
        const { socket, sess, sendSystem } = ctx;
        const acc = ctx.accounts[sess.loginId];
        if (!acc) return;

        const lower = ctx.cmdName || 'engage';

        if (lower === 'engage') {
            const npcId = arg?.trim().toLowerCase() || 'goblin';
            startCombat(socket, sess, npcId);
        } else if (lower === 'attack') {
            const weaponId = arg?.trim().toLowerCase()
                || acc.hands.left
                || acc.hands.right;
            playerAttack(socket, sess, weaponId);
        } else if (lower === 'retreat' || lower === 'flee') {
            retreat(socket, sess);
        }
    },

    startCombat,
    playerAttack,
    retreat,
    getCombatSession,
    endCombat,
    STAGE,
};
