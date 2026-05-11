// ===============================================
// commands/combat.js
// Single source of truth: sess.combatState
//
// STAGE DESIGN:
//   idle   — no combat, free movement
//   notice — NPC spotted player, narrative only, NOT a combat state
//            player can move freely, NPC advances on timer
//   ranged — combat begins here: bag locked, retreat visible
//            NPC closing, player can throw/retreat(90%)
//   melee  — ATB per hand (weapon or unarmed), NPC attacks on own timer
//            retreat(90%) → ranged
//
// EXIT COMBAT: leave the room (movement unblocked at notice/idle)
// NPC DEATH:   drop table + XP + re-hide, idle
// PLAYER DEATH: respawn at start room, idle
// ===============================================

const World    = require('../core/world');
const Accounts = require('../core/accounts');
const Sessions = require('../core/sessions');

// ── STAGES ───────────────────────────────────────────────
const STAGE = {
    IDLE:   'idle',
    NOTICE: 'notice',   // narrative only — not a combat lock
    RANGED: 'ranged',   // combat start
    MELEE:  'melee',
};

const START_ROOM = 'forest-g3';

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

// ── NPC LOOKUP — always use this, merges npcRef ──────────
function getNpcDef(room, npcId) {
    const obj = room?.objects?.[npcId];
    if (!obj) return null;
    if (obj.npcRef) {
        const def = World.npcs?.[obj.npcRef];
        return def ? { ...def, ...obj } : obj;
    }
    return obj;
}

// ── STATE HELPERS ─────────────────────────────────────────
function getCS(sess) { return sess.combatState; }

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
    sess.combatState = {
        stage: STAGE.IDLE, npcId: null, npcHp: null, playerHp: null, roomId: null
    };
}

// ── TIMERS (keyed by loginId) ─────────────────────────────
const _advanceTimers = {};
const _attackTimers  = {};

function clearAdvance(loginId) {
    if (_advanceTimers[loginId]) {
        clearTimeout(_advanceTimers[loginId]);
        delete _advanceTimers[loginId];
    }
}

function clearAttack(loginId) {
    if (_attackTimers[loginId]) {
        clearInterval(_attackTimers[loginId]);
        delete _attackTimers[loginId];
    }
}

function clearAllTimers(loginId) {
    clearAdvance(loginId);
    clearAttack(loginId);
}

// ── MESSAGE HELPERS ───────────────────────────────────────
function sendHit(socket, msg, side, dmg, dmgType) {
    const msgType = side === 'enemy' ? 'hit-enemy'
                  : side === 'right' ? 'hit-right'
                  : 'hit-left';
    socket.send(JSON.stringify({ type: 'system', msg, msgType, dmg: dmg ?? 0, dmgType: dmgType ?? 'physical' }));
}
function sendMiss(socket, msg, side) {
    socket.send(JSON.stringify({ type: 'system', msg, msgType: 'miss', side: side ?? 'enemy' }));
}
function sendEvent(socket, msg) {
    socket.send(JSON.stringify({ type: 'system', msg, msgType: 'event' }));
}

// ── PUSH COMBAT STATE TO CLIENT ───────────────────────────
function push(socket, sess) {
    const cs   = getCS(sess);
    const room = World.rooms[sess.room];
    const npc  = cs?.npcId ? getNpcDef(room, cs.npcId) : null;
    socket.send(JSON.stringify({
        type:     'combat',
        stage:    cs?.stage    ?? STAGE.IDLE,
        npcId:    cs?.npcId   ?? null,
        npcEmoji: npc?.emoji  ?? '👾',
        npcHp:    cs?.npcHp   ?? null,
        playerHp: cs?.playerHp ?? sess.hp ?? 100,
    }));
}

// ── GUARD — blocks item actions during ranged/melee ──────
// Notice is NOT blocked — player can move and act freely
function requireIdle(sess, socket, action) {
    const stage = sess.combatState?.stage;
    if (!stage || stage === STAGE.IDLE || stage === STAGE.NOTICE) return true;
    const blocked = {
        melee:  `You can't ${action} while fighting.`,
        ranged: `Not while the ${sess.combatState.npcId} is closing on you.`,
    };
    Sessions.sendSystem(socket, blocked[stage] ?? `Can't ${action} right now.`);
    return false;
}

// ── NPC NOTICE — sends flavour text, queues advance ──────
// This fires when an aggressive NPC spots the player.
// It is NOT a combat state — player is still free to move.
function npcNotice(socket, sess, npcId) {
    const room = World.rooms[sess.room];
    const npc  = getNpcDef(room, npcId);
    if (!npc || npc.state === 'hidden') return;

    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';

    // Set notice stage for narrative purposes only
    if (!sess.combatState) sess.combatState = { stage: STAGE.IDLE };
    sess.combatState.stage   = STAGE.NOTICE;
    sess.combatState.npcId   = npcId;
    sess.combatState.npcHp   = npc.hp ?? 15;
    sess.combatState.playerHp = sess.hp ?? 100;
    sess.combatState.roomId  = sess.room;

    // Send notice — client shows nothing special in botbar at this stage
    push(socket, sess);

    const msg = npc?.noticeByRace?.[race]
        ?? { goblin: "It locks eyes with you. Neither of you moves. Yet.", human: "It notices you.", elf: "Its gaze finds yours." }[race]
        ?? `The ${npcId} notices you.`;
    sendEvent(socket, msg);

    // NPC advances to ranged after delay
    clearAdvance(sess.loginId);
    const advanceDelay = npc.advanceDelay ?? 4000;
    _advanceTimers[sess.loginId] = setTimeout(() => {
        if (socket.readyState !== 1) return;
        // Only advance if player is still in the same room
        if (sess.room !== sess.combatState?.roomId) {
            endCS(sess);
            return;
        }
        npcAdvanceToRanged(socket, sess);
    }, advanceDelay);
}

// ── ENGAGE — player taps NPC chip ─────────────────────────
// Immediately starts combat at ranged stage (player chose to engage)
function startCombat(socket, sess, npcId) {
    const cs = getCS(sess);

    // Already in ranged/melee with this NPC — if ranged, skip to melee
    if (cs?.npcId === npcId) {
        if (cs?.stage === STAGE.MELEE) return; // already there
        if (cs?.stage === STAGE.RANGED) {
            // Player chose to engage — skip straight to melee
            clearAdvance(sess.loginId);
            npcAdvanceToMelee(socket, sess);
            return;
        }
        if (cs?.stage === STAGE.NOTICE) {
            // Player engaging during notice — jump to ranged then melee
            clearAdvance(sess.loginId);
            npcAdvanceToRanged(socket, sess);
            return;
        }
    }

    const room = World.rooms[sess.room];
    const npc  = getNpcDef(room, npcId);
    if (!npc || npc.state === 'hidden') return;

    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';

    clearAllTimers(sess.loginId);

    // Auto-wield whatever's in hands on engage
    if (!sess.wielding) sess.wielding = {};
    if (acc?.hands?.left)  sess.wielding[acc.hands.left]  = true;
    if (acc?.hands?.right) sess.wielding[acc.hands.right] = true;
    socket.send(JSON.stringify({ type: 'wielding', wielding: sess.wielding }));

    // Jump straight to ranged — player chose to engage
    sess.combatState = {
        stage:    STAGE.RANGED,
        npcId,
        npcHp:    npc.hp ?? 15,
        playerHp: sess.hp ?? 100,
        roomId:   sess.room,
    };
    push(socket, sess);

    // Player-initiated engage — different from NPC advancing on player
    const msg = npc?.engageByRace?.[race]
        ?? { goblin: "You step toward it. It tenses. No going back.", human: "You advance on it. It readies itself.", elf: "You move in. Every muscle in it tightens." }[race]
        ?? `You engage the ${npcId}.`;
    sendEvent(socket, msg);

    // NPC closes to melee after short delay
    clearAdvance(sess.loginId);
    _advanceTimers[sess.loginId] = setTimeout(() => {
        if (socket.readyState === 1) npcAdvanceToMelee(socket, sess);
    }, 3000);
}

// ── NPC ADVANCE: notice → ranged ─────────────────────────
function npcAdvanceToRanged(socket, sess) {
    const cs = getCS(sess);
    if (!cs || cs.stage !== STAGE.NOTICE) return;

    const room = World.rooms[sess.room];
    const npc  = getNpcDef(room, cs.npcId);
    if (!npc) return;

    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';

    // Auto-wield on NPC advance — clean stale entries first
    if (!sess.wielding) sess.wielding = {};
    // Remove wielding entries for items no longer in hands
    Object.keys(sess.wielding).forEach(id => {
        if (acc.hands.left !== id && acc.hands.right !== id) delete sess.wielding[id];
    });
    if (acc?.hands?.left)  sess.wielding[acc.hands.left]  = true;
    if (acc?.hands?.right) sess.wielding[acc.hands.right] = true;
    socket.send(JSON.stringify({ type: 'wielding', wielding: sess.wielding }));

    setStage(sess, STAGE.RANGED);
    push(socket, sess);

    const msg = npc?.approachByRace?.[race]
        ?? { goblin: "It moves. Fast. Toward you.", human: "It advances. Combat is coming.", elf: "It closes the distance. Deliberately." }[race]
        ?? `The ${cs.npcId} advances.`;
    sendEvent(socket, msg);

    // NPC closes to melee
    clearAdvance(sess.loginId);
    _advanceTimers[sess.loginId] = setTimeout(() => {
        if (socket.readyState === 1) npcAdvanceToMelee(socket, sess);
    }, 3000);
}

// ── NPC ADVANCE: ranged → melee ───────────────────────────
function npcAdvanceToMelee(socket, sess) {
    const cs = getCS(sess);
    if (!cs || cs.stage !== STAGE.RANGED) return;

    const room = World.rooms[sess.room];
    const npc  = getNpcDef(room, cs.npcId);
    if (!npc) return;

    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';

    setStage(sess, STAGE.MELEE);
    push(socket, sess);

    const msg = npc?.meleeByRace?.[race]
        ?? { goblin: "It's on you. No more distance.", human: "It closes in. This is it.", elf: "It is upon you. The gap is gone." }[race]
        ?? `The ${cs.npcId} is in your face.`;
    sendEvent(socket, msg);

    startNpcAttackLoop(socket, sess);
}

// ── NPC ATTACK LOOP ───────────────────────────────────────
function startNpcAttackLoop(socket, sess) {
    const cs   = getCS(sess);
    const room = World.rooms[sess.room];
    // Always use getNpcDef so npcRef merging works
    const npc  = getNpcDef(room, cs.npcId);
    const speed = npc?.atbSpeed ?? 3000;

    clearAttack(sess.loginId);
    _attackTimers[sess.loginId] = setInterval(() => {
        const cs = getCS(sess);
        if (!cs || cs.stage !== STAGE.MELEE) {
            clearAttack(sess.loginId);
            return;
        }

        // Re-fetch in case room state changed
        const room = World.rooms[sess.room];
        const npc  = getNpcDef(room, cs.npcId);
        const acc  = Accounts.data[sess.loginId];
        const race = acc?.race ?? 'human';

        // Dazzle blind — NPC misses this attack, flag cleared
        if (cs.npcBlinded) {
            cs.npcBlinded = false;
            const npcEmoji = npc?.emoji ?? '👾';
            sendMiss(socket, `${npcEmoji} It swings blind. Misses completely.`);
            return;
        }

        if (!hitRoll(0.2)) {
            const npcEmoji = npc?.emoji ?? '👾';
            const missText = npc?.missByRace?.[race]
                ?? { goblin: "It lunges — you sidestep.", human: "It swings wide. Lucky.", elf: "Its strike finds nothing." }[race]
                ?? `The ${cs.npcId} misses.`;
            sendMiss(socket, `${npcEmoji} ${missText}`);
            return;
        }

        const dmg = rollNpcDamage(npc);
        cs.playerHp = Math.max(0, cs.playerHp - dmg);
        sess.hp = cs.playerHp;
        socket.send(JSON.stringify({ type: 'stats', hp: cs.playerHp }));

        const npcEmoji = npc?.emoji ?? '👾';
        const hitTemplate = npc?.hitByRace?.[race]
            ?? `${npcEmoji} The ${cs.npcId} hits for {dmg}. ({hp} hp)`;
        const hit = hitTemplate.replace('{dmg}', dmg).replace('{hp}', cs.playerHp);
        sendHit(socket, hit, 'enemy', dmg, npc?.damageType ?? 'blunt');

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

    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';
    const room = World.rooms[sess.room];
    const npc  = getNpcDef(room, cs.npcId);

    // weaponId may be 'unarmed-left', 'unarmed-right', 'unarmed', or a real item id
    const isUnarmed = !weaponId || weaponId.startsWith('unarmed');
    const def       = isUnarmed ? null : World.items[weaponId];
    const isArmed   = !!def;

    // Determine which hand fired
    const hand = weaponId === 'unarmed-right' ? 'right'
               : weaponId === 'unarmed-left'  ? 'left'
               : acc.hands.left  === weaponId ? 'left'
               : acc.hands.right === weaponId ? 'right'
               : 'left';

    const weaponEmoji = def?.emoji ?? (hand === 'right' ? '🤚' : '✋');

    if (!hitRoll(0.15)) {
        const missText = isArmed
            ? ({ goblin: "You swing. It ducks. Nothing lands.", human: "You strike — but miss.", elf: "Your blow finds no mark." }[race] ?? "You miss.")
            : ({ goblin: "Your fist finds air.", human: "You swing wide. Empty.", elf: "Your strike is too slow." }[race] ?? "You miss.");
        sendMiss(socket, `${weaponEmoji} ${missText}`);
        return;
    }

    const dmg = isArmed ? rollDamage(def) : 1;
    const dmgType = def?.damage?.[0]?.type ?? (isArmed ? 'physical' : 'blunt');
    cs.npcHp = Math.max(0, cs.npcHp - dmg);

    const hit = isArmed
        ? ({ goblin: `${weaponEmoji} You hit for ${dmg} ${dmgType}.`, human: `${weaponEmoji} You strike for ${dmg} ${dmgType}.`, elf: `${weaponEmoji} ${dmg} ${dmgType}. Clean.` }[race] ?? `${weaponEmoji} ${dmg} damage.`)
        : ({ goblin: `${weaponEmoji} Your fist connects. ${dmg} damage.`, human: `${weaponEmoji} You punch for ${dmg} damage.`, elf: `${weaponEmoji} Solid. ${dmg} damage.` }[race] ?? `${weaponEmoji} ${dmg} damage.`);
    sendHit(socket, hit, hand, dmg, dmgType);

    if (cs.npcHp <= 0) {
        npcDeath(socket, sess, npc, acc, race);
        return;
    }

    // Award weapon XP on hit
    awardWeaponXP(socket, sess, acc, weaponId);
    push(socket, sess);
}

// ── NPC DEATH ─────────────────────────────────────────────
function npcDeath(socket, sess, npc, acc, race) {
    clearAllTimers(sess.loginId);

    const cs   = getCS(sess);
    const room = World.rooms[sess.room];

    // Death message
    const msg = npc?.deathByRace?.[race]
        ?? { goblin: "It drops. You stand over it.", human: "It falls. The fight is over.", elf: "It goes still. The air changes." }[race]
        ?? "Your enemy is defeated.";
    sendEvent(socket, msg);

    // Drop table — respects dropChance per item
    if (npc?.dropTable?.length && room) {
        if (!room.items) room.items = [];
        const chance = npc.dropChance ?? 1.0;
        npc.dropTable.forEach(itemId => {
            if (Math.random() < chance) {
                room.items.push({
                    id:         `${itemId}_${Date.now()}`,
                    defId:      itemId,
                    originRoom: 'dropped',  // not native — won't count toward discoveries
                });
                Sessions.sendSystem(socket, "Something small falls to the ground.");
            }
        });
    }

    // XP reward
    if (npc?.xpReward) {
        acc.xp = (acc.xp ?? 0) + npc.xpReward;
        Accounts.save();
        Sessions.sendSystem(socket, `+${npc.xpReward} XP`);
    }

    // Kill bonus weapon XP — only items actually in hands right now
    const inHands = [acc.hands?.left, acc.hands?.right].filter(Boolean);
    const wielded = inHands.filter(id => sess.wielding?.[id]);
    // If nothing wielded, award to unarmed
    if (wielded.length === 0 && inHands.length === 0) {
        awardWeaponXP(socket, sess, acc, null, 5); // unarmed kill bonus
    } else {
        wielded.forEach(wId => awardWeaponXP(socket, sess, acc, wId, 5));
    }

    // Show weaponXP summary in log
    if (acc.weaponXP && Object.keys(acc.weaponXP).length) {
        const summary = Object.entries(acc.weaponXP).map(([id, xp]) => {
            const def   = World.items[id];
            const name  = def?.name ?? id;
            const emoji = def?.emoji ?? '';
            const level = weaponLevel(xp);
            return `${emoji} ${name} Lv${level} (${xp}xp)`;
        }).join(' · ');
        Sessions.sendSystem(socket, `Weapon XP: ${summary}`);
    }

    // Re-hide NPC in room
    if (room?.objects?.[cs.npcId]) {
        room.objects[cs.npcId].state = 'hidden';
    }

    // Quest flag for NPC kills
    const killFlag = `killed_${cs.npcId}`;
    if (!acc.flags) acc.flags = {};
    if (!acc.flags[killFlag]) {
        acc.flags[killFlag] = true;
        Accounts.save();
        try {
            const { sendQuestState } = require('../core/events');
            sendQuestState(socket, acc);
        } catch(e) {}
    }

    endCS(sess);
    push(socket, sess);

    const Room = require('../core/room');
    Room.sendRoom(socket, sess.room);
}

// ── PLAYER DEATH ──────────────────────────────────────────
function playerDeath(socket, sess) {
    const cs   = getCS(sess);
    const room = World.rooms[sess.room];
    const npc  = getNpcDef(room, cs?.npcId);   // ← FIXED: was undefined
    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';

    clearAllTimers(sess.loginId);
    endCS(sess);
    push(socket, sess);

    const msg = {
        goblin: "Everything goes dark. Then lighter. You're back where you woke.",
        human:  "You fall. When you wake, you're at the beginning.",
        elf:    "The world fades. You return to where it started. Again.",
    }[race] ?? "You have been defeated.";
    Sessions.sendSystem(socket, msg);

    // Respawn: clear hands, reset hp, send to start room
    acc.hands = { left: null, right: null };
    sess.hp   = 100;
    acc.hp    = 100;
    sess.room = START_ROOM;
    acc.lastRoom = START_ROOM;
    sess.wielding = {};
    Accounts.save();

    socket.send(JSON.stringify({ type: 'hands', hands: acc.hands }));
    socket.send(JSON.stringify({ type: 'stats', hp: 100 }));
    socket.send(JSON.stringify({ type: 'wielding', wielding: {} }));

    const Room = require('../core/room');
    Room.sendRoom(socket, START_ROOM);
}

// ── RETREAT ───────────────────────────────────────────────
// melee → ranged (90%)
// ranged → notice (90%, ends combat lock — player free to move/flee)
// notice — no retreat action, player just moves rooms to escape
function retreat(socket, sess) {
    const cs = getCS(sess);
    if (!cs || cs.stage === STAGE.IDLE || cs.stage === STAGE.NOTICE) {
        Sessions.sendSystem(socket, "You're not in combat.");
        return;
    }

    const acc  = Accounts.data[sess.loginId];
    const race = acc?.race ?? 'human';

    clearAllTimers(sess.loginId);

    const success = Math.random() < 0.9; // 90% chance

    if (cs.stage === STAGE.MELEE) {
        if (success) {
            setStage(sess, STAGE.RANGED);
            push(socket, sess);
            const msg = {
                goblin: "You wrench yourself back. Still in range. Still trouble.",
                human:  "You disengage. You have a moment.",
                elf:    "You create space. Use it well.",
            }[race] ?? "You retreat to ranged distance.";
            Sessions.sendSystem(socket, msg);
            // NPC re-closes
            _advanceTimers[sess.loginId] = setTimeout(() => {
                if (socket.readyState === 1) npcAdvanceToMelee(socket, sess);
            }, 3000);
        } else {
            const msg = {
                goblin: "You try to pull back. It won't let you.",
                human:  "You move to disengage — it presses harder.",
                elf:    "You reach for distance. It denies you.",
            }[race] ?? "You fail to retreat.";
            Sessions.sendSystem(socket, msg);
            // Still in melee — NPC gets a free hit
            _advanceTimers[sess.loginId] = setTimeout(() => {
                if (socket.readyState === 1) startNpcAttackLoop(socket, sess);
            }, 500);
        }

    } else if (cs.stage === STAGE.RANGED) {
        if (success) {
            // Back to notice — combat lock ends, player free to move
            setStage(sess, STAGE.NOTICE);
            push(socket, sess);
            const msg = {
                goblin: "You back off. It watches. Not done with you.",
                human:  "You create distance. It holds position. For now.",
                elf:    "You disengage. The tension remains.",
            }[race] ?? "You retreat. It watches.";
            Sessions.sendSystem(socket, msg);
            // NPC re-advances after pause
            _advanceTimers[sess.loginId] = setTimeout(() => {
                if (socket.readyState === 1) {
                    if (sess.room === cs.roomId) npcAdvanceToRanged(socket, sess);
                }
            }, 4000);
        } else {
            const msg = {
                goblin: "You scramble back — it cuts you off.",
                human:  "You try to create distance. It matches you.",
                elf:    "You reach for space. It refuses you.",
            }[race] ?? "You fail to retreat.";
            Sessions.sendSystem(socket, msg);
            // Stays at ranged, NPC re-closes sooner
            _advanceTimers[sess.loginId] = setTimeout(() => {
                if (socket.readyState === 1) npcAdvanceToMelee(socket, sess);
            }, 1500);
        }
    }
}

// ── HANDLE ROOM CHANGE (called from room.js on move) ─────
// If player moves during notice: end combat (NPC stays)
// If player moves during ranged/melee: shouldn't happen (movement blocked)
function onPlayerMove(sess) {
    const cs = getCS(sess);
    if (!cs || cs.stage === STAGE.IDLE) return;
    if (cs.stage === STAGE.NOTICE) {
        clearAllTimers(sess.loginId);
        endCS(sess);
    }
    // ranged/melee movement is blocked by requireIdle — belt and suspenders
}

// ── WEAPON XP ─────────────────────────────────────────────
function weaponLevel(xp) {
    if (xp >= 200) return 5;
    if (xp >= 120) return 4;
    if (xp >=  60) return 3;
    if (xp >=  20) return 2;
    return 1;
}

function awardWeaponXP(socket, sess, acc, weaponId, bonus = 0) {
    const key = (!weaponId || weaponId.startsWith('unarmed')) ? 'unarmed' : weaponId;
    if (!acc.weaponXP) acc.weaponXP = {};
    const prev = acc.weaponXP[key] ?? 0;
    const next = prev + 1 + bonus;
    acc.weaponXP[key] = next;
    Accounts.save();

    const prevLevel = weaponLevel(prev);
    const nextLevel = weaponLevel(next);

    socket.send(JSON.stringify({ type: 'weapon_xp', weaponXP: acc.weaponXP }));

    if (nextLevel > prevLevel) {
        const def  = World.items[key];
        const name = def?.name ?? key;
        Sessions.sendSystem(socket, `✦ ${name} level ${nextLevel}! New skills may be available.`);
        const newSkill = (def?.skills ?? []).find(s => s.minLevel === nextLevel);
        if (newSkill) {
            Sessions.sendSystem(socket, `✦ Skill unlocked: ${newSkill.emoji} ${newSkill.label} — ${newSkill.description}`);
        }
    }
}

// ── EXPORTS ───────────────────────────────────────────────
module.exports = {
    name: 'engage',
    aliases: ['attack', 'retreat', 'flee'],

    execute(ctx, arg) {
        const { socket, sess, cmdName } = ctx;
        const acc = ctx.accounts[sess.loginId];
        if (!acc) return;
        const lower = cmdName || 'engage';
        if (lower === 'engage')
            startCombat(socket, sess, arg?.trim().toLowerCase() || 'goblin');
        else if (lower === 'attack')
            playerAttack(socket, sess, arg?.trim().toLowerCase() || acc.hands.left || acc.hands.right);
        else if (lower === 'retreat' || lower === 'flee')
            retreat(socket, sess);
    },

    startCombat,
    playerAttack,
    npcNotice,
    retreat,
    requireIdle,
    onPlayerMove,
    getCS,
    STAGE,
};
