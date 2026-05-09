// ===============================================
// commands/combat.js
// Single source of truth: sess.combatState
// ===============================================

const World    = require('../core/world');
const Accounts = require('../core/accounts');
const Sessions = require('../core/sessions');

// ── STAGES ───────────────────────────────────────────────
const STAGE = {
    IDLE:     'idle',
    NOTICE:   'notice',
    APPROACH: 'approach',
    MELEE:    'melee',
};

// ── DICE ─────────────────────────────────────────────────
function roll(sides) { return Math.floor(Math.random() * sides) + 1; }

function rollDamage(def) {
    if (!def?.damage?.length) return def?.baseDamage ?? 1;
    return def.damage.reduce((total, d) => total + roll(d.amount ?? 1), 0);
}

function rollNpcDamage(npc) {
    const base = npc?.damage ?? 2;
    return Math.max(1, base + roll(3) - 2);
}

function hitRoll(missChance = 0.15) {
    return Math.random() > missChance;
}

// ── STATE HELPERS ─────────────────────────────────────────
function getCS(sess) {
    return sess.combatState;
}

function initCS(sess, npcId, npc) {
    sess.combatState = {
        stage:    STAGE.NOTICE,
        npcId,
        npcHp:    npc.hp ?? 15,
        playerHp: sess.hp ?? 100,
        roomId:   sess.room,
    };
}

function setStage(sess, stage) {
    if (sess.combatState) sess.combatState.stage = stage;
}

function endCS(sess) {
    sess.combatState = { stage: STAGE.IDLE, npcId: null, npcHp: null, playerHp: null, roomId: null };
}

// ── TIMERS (keyed by loginId) ─────────────────────────────
const _advanceTimers = {};
const _attackTimers  = {};

function clearAdvance(loginId) {
    if (_advanceTimers[loginId]) { clearTimeout(_advanceTimers[loginId]); delete _advanceTimers[loginId]; }
}

function clearAttack(loginId) {
    if (_attackTimers[loginId]) { clearInterval(_attackTimers[loginId]); delete _attackTimers[loginId]; }
}

function clearAllTimers(loginId) {
    clearAdvance(loginId);
    clearAttack(loginId);
}

// ── COMBAT MESSAGE HELPERS ───────────────────────────────
function sendHit(socket, msg) {
    socket.send(JSON.stringify({ type: 'system', msg, msgType: 'hit' }));
}
function sendMiss(socket, msg) {
    socket.send(JSON.stringify({ type: 'system', msg, msgType: 'miss' }));
}
function sendEvent(socket, msg) {
    socket.send(JSON.stringify({ type: 'system', msg, msgType: 'event' }));
}

// ── PUSH STATE TO CLIENT ──────────────────────────────────
function push(socket, sess) {
    const cs = getCS(sess);
    socket.send(JSON.stringify({
        type:     'combat',
        stage:    cs?.stage    ?? STAGE.IDLE,
        npcId:    cs?.npcId   ?? null,
        playerHp: cs?.playerHp ?? sess.hp ?? 100,
    }));
}

// ── GUARD — blocks actions mid-combat ────────────────────
function getNpcDef(room, npcId) {
    const obj = room?.objects?.[npcId];
    if (!obj) return null;
    if (obj.npcRef) {
        const def = World.npcs?.[obj.npcRef];
        return def ? { ...def, ...obj } : obj;
    }
    return obj;
}

function requireIdle(sess, socket, action) {
    const stage = sess.combatState?.stage;
    if (!stage || stage === STAGE.IDLE) return true;
    const blocked = {
        melee:    `You can't ${action} while fighting.`,
        approach: `Not while the ${sess.combatState.npcId} is advancing on you.`,
        notice:   `You're being watched. Not now.`,
    };
    Sessions.sendSystem(socket, blocked[stage] ?? `Can't ${action} right now.`);
    return false;
}

// ── ENGAGE ───────────────────────────────────────────────
function startCombat(socket, sess, npcId) {
    const cs = getCS(sess);
    // Already in combat with this NPC — ignore
    if (cs?.npcId === npcId && cs?.stage !== STAGE.IDLE) return;

    const room = World.rooms[sess.room];
    const npc  = getNpcDef(room, npcId);
    if (!npc || npc.state === 'hidden') return;

    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';

    // Auto-wield whatever's in hands on engage
    if (!sess.wielding) sess.wielding = {};
    if (acc?.hands?.left)  sess.wielding[acc.hands.left]  = true;
    if (acc?.hands?.right) sess.wielding[acc.hands.right] = true;
    socket.send(JSON.stringify({ type: 'wielding', wielding: sess.wielding }));

    initCS(sess, npcId, npc);
    push(socket, sess);

    const msg = npc?.noticeByRace?.[race]
        ?? { goblin: "It locks eyes with you. Neither of you moves. Yet.", human: "It locks eyes with you. You feel its intent.", elf: "Its eyes find yours. The air between you changes." }[race]
        ?? `The ${npcId} turns toward you.`;
    Sessions.sendSystem(socket, msg);

    // NPC auto-advances after 4s
    clearAdvance(sess.loginId);
    _advanceTimers[sess.loginId] = setTimeout(() => { if (socket.readyState === 1) npcAdvance(socket, sess); }, 4000);
}

// ── NPC ADVANCE ──────────────────────────────────────────
function npcAdvance(socket, sess) {
    const cs = getCS(sess);
    if (!cs || cs.stage === STAGE.IDLE) return;

    const acc   = Accounts.data[sess.loginId];
    const race  = acc?.race ?? 'human';
    const npcId = cs.npcId;

    if (cs.stage === STAGE.NOTICE) {
        setStage(sess, STAGE.APPROACH);
        push(socket, sess);

        const msg = npc?.approachByRace?.[race]
            ?? "It moves closer.";
        Sessions.sendSystem(socket, msg);

        clearAdvance(sess.loginId);
        _advanceTimers[sess.loginId] = setTimeout(() => { if (socket.readyState === 1) npcAdvance(socket, sess); }, 4000);

    } else if (cs.stage === STAGE.APPROACH) {
        setStage(sess, STAGE.MELEE);
        push(socket, sess);

        const msg = npc?.meleeByRace?.[race] ?? "It engages you!";
        Sessions.sendSystem(socket, msg);

        startNpcAttackLoop(socket, sess);
    }
}

// ── NPC ATTACK LOOP ───────────────────────────────────────
function startNpcAttackLoop(socket, sess) {
    const cs   = getCS(sess);
    const room = World.rooms[sess.room];
    const npc  = room?.objects?.[cs.npcId];
    const speed = npc?.atbSpeed ?? 3000;

    clearAttack(sess.loginId);
    _attackTimers[sess.loginId] = setInterval(() => {
        const cs = getCS(sess);
        if (!cs || cs.stage !== STAGE.MELEE) {
            clearAttack(sess.loginId);
            return;
        }

        const acc  = Accounts.data[sess.loginId];
        const race = acc?.race ?? 'human';

        if (!hitRoll(0.2)) {
            const miss = npc?.missByRace?.[race]
                ?? { goblin: "It lunges — you sidestep.", human: "It swings wide. Lucky.", elf: "Its strike finds nothing." }[race]
                ?? `The ${cs.npcId} misses.`;
            sendMiss(socket, miss);
            return;
        }

        const dmg = rollNpcDamage(npc);
        cs.playerHp = Math.max(0, cs.playerHp - dmg);
        sess.hp = cs.playerHp;
        socket.send(JSON.stringify({ type: 'stats', hp: cs.playerHp }));

        const hit = (npc?.hitByRace?.[race] ?? `The ${cs.npcId} hits for {dmg}. ({hp} hp)`).replace('{dmg}', dmg).replace('{hp}', cs.playerHp);
        Sessions.sendSystem(socket, hit);

        push(socket, sess);

        if (cs.playerHp <= 0) {
            clearAttack(sess.loginId);
            playerDeath(socket, sess);
        }
    }, speed);
}

// ── PLAYER ATTACK ─────────────────────────────────────────
function playerAttack(socket, sess, weaponId) {
    const cs = getCS(sess);
    if (!cs || cs.stage !== STAGE.MELEE) {
        Sessions.sendSystem(socket, "You're not in melee range.");
        return;
    }

    const acc   = Accounts.data[sess.loginId];
    const race  = acc?.race ?? 'human';
    const def   = World.items[weaponId];
    const room  = World.rooms[sess.room];
    const npc   = getNpcDef(room, cs.npcId);

    if (!hitRoll(0.15)) {
        const miss = {
            goblin: "You swing. It ducks. Nothing lands.",
            human:  "You strike — but miss.",
            elf:    "Your blow finds no mark.",
        }[race] ?? "You miss.";
        sendMiss(socket, miss);
        return;
    }

    const dmg      = rollDamage(def);
    const dmgTypes = def?.damage?.map(d => d.type).join('+') ?? 'physical';
    cs.npcHp = Math.max(0, cs.npcHp - dmg);

    const hit = {
        goblin: `You hit for ${dmg} ${dmgTypes} damage.`,
        human:  `You strike the ${cs.npcId} for ${dmg} ${dmgTypes} damage.`,
        elf:    `${dmg} ${dmgTypes} damage. Clean.`,
    }[race] ?? `${dmg} ${dmgTypes} damage.`;
    Sessions.sendSystem(socket, hit);

    if (cs.npcHp <= 0) {
        npcDeath(socket, sess, npc, race);
        return;
    }

    push(socket, sess);
}

// ── RETREAT ───────────────────────────────────────────────
function retreat(socket, sess) {
    const cs = getCS(sess);
    if (!cs || cs.stage === STAGE.IDLE) {
        Sessions.sendSystem(socket, "You're not in combat.");
        return;
    }

    const acc   = Accounts.data[sess.loginId];
    const race  = acc?.race ?? 'human';
    const npcId = cs.npcId;

    clearAllTimers(sess.loginId);

    if (cs.stage === STAGE.MELEE) {
        setStage(sess, STAGE.APPROACH);
        push(socket, sess);
        const msg = { goblin: "You back off. Still close. Still dangerous.", human: "You disengage. Approach range.", elf: "You create distance. Briefly safer." }[race] ?? "You retreat to approach range.";
        Sessions.sendSystem(socket, msg);
        _advanceTimers[sess.loginId] = setTimeout(() => { if (socket.readyState === 1) npcAdvance(socket, sess); }, 3000);

    } else if (cs.stage === STAGE.APPROACH) {
        setStage(sess, STAGE.NOTICE);
        push(socket, sess);
        const msg = { goblin: "You're out of range. It watches.", human: "You back away. It watches. Not done.", elf: "You disengage. The tension holds." }[race] ?? "You retreat to notice range.";
        Sessions.sendSystem(socket, msg);
        _advanceTimers[sess.loginId] = setTimeout(() => { if (socket.readyState === 1) npcAdvance(socket, sess); }, 4000);

    } else if (cs.stage === STAGE.NOTICE) {
        if (Math.random() > 0.3) {
            endCS(sess);
            push(socket, sess);
            const msg = { goblin: "You bolt. It doesn't follow. This time.", human: "You run. It lets you go. For now.", elf: "You withdraw. It watches you leave." }[race] ?? "You flee.";
            Sessions.sendSystem(socket, msg);
            // Goblin re-engages after a longer delay if player stays
            _advanceTimers[sess.loginId] = setTimeout(() => {
                const stillHere = require('../core/sessions').get(socket)?.room === sess.room;
                const stillIdle = !sess.combatState?.stage || sess.combatState.stage === 'idle';
                if (stillHere && stillIdle) startCombat(socket, sess, cs.npcId);
            }, 8000);
        } else {
            const msg = { goblin: "You try to run. It's faster.", human: "You bolt — but it cuts you off.", elf: "You move to leave. It moves faster." }[race] ?? "You fail to flee.";
            Sessions.sendSystem(socket, msg);
            setTimeout(() => { if (socket.readyState === 1) npcAdvance(socket, sess); }, 1500);
        }
    }
}

// ── DEATH ─────────────────────────────────────────────────
function playerDeath(socket, sess) {
    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';

    clearAllTimers(sess.loginId);
    endCS(sess);
    push(socket, sess);

    const msg = {
        goblin: "Everything goes dark. Then lighter. You're back at the start.",
        human:  "You fall. When you wake, you're at the beginning.",
        elf:    "The world fades. You return to where it started. Again.",
    }[race] ?? "You have been defeated.";
    Sessions.sendSystem(socket, npc?.deathByRace?.[race] ?? "Your enemy is defeated.");

    const room = World.rooms[sess.room];
    if (npc?.dropTable && room) {
        if (!room.items) room.items = [];
        npc.dropTable.forEach(itemId => {
            room.items.push({ id: `${itemId}_${Date.now()}`, defId: itemId, originRoom: sess.room });
        });
    }

    if (npc?.xpReward) {
        const acc = Accounts.data[sess.loginId];
        if (acc) {
            acc.xp = (acc.xp ?? 0) + npc.xpReward;
            Accounts.save();
            Sessions.sendSystem(socket, `+${npc.xpReward} XP`);
        }
    }

    if (npc) npc.state = 'hidden';

    const Room = require('../core/room');
    Room.sendRoom(socket, sess.room);
}

// ── EXPORTED GUARD ────────────────────────────────────────
module.exports = {
    name: 'engage',
    aliases: ['attack', 'retreat', 'flee'],

    execute(ctx, arg) {
        const { socket, sess, cmdName } = ctx;
        const acc = ctx.accounts[sess.loginId];
        if (!acc) return;
        const lower = cmdName || 'engage';
        if (lower === 'engage') startCombat(socket, sess, arg?.trim().toLowerCase() || 'goblin');
        else if (lower === 'attack') playerAttack(socket, sess, arg?.trim().toLowerCase() || acc.hands.left || acc.hands.right);
        else if (lower === 'retreat' || lower === 'flee') retreat(socket, sess);
    },

    // Exported for server.js direct calls and look.js
    startCombat,
    playerAttack,
    retreat,
    requireIdle,
    getCS,
    STAGE,
};
