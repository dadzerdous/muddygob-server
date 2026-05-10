// ===============================================
// commands/skill.js
// Handles: skill <itemId> <skillId>
// e.g. "skill shiny_shield dazzle"
// ===============================================

const World    = require('../core/world');
const Accounts = require('../core/accounts');
const Sessions = require('../core/sessions');

// XP threshold → weapon level
function weaponLevel(xp) {
    if (xp >= 200) return 5;
    if (xp >= 120) return 4;
    if (xp >=  60) return 3;
    if (xp >=  20) return 2;
    return 1;
}

module.exports = {
    name: 'skill',
    help: 'skill <itemId> <skillId> — use a weapon skill',

    execute(ctx, arg) {
        const { socket, sess, accounts, sendSystem } = ctx;
        const acc = accounts[sess.loginId];
        if (!acc) return;

        const parts   = (arg || '').trim().toLowerCase().split(' ');
        const itemId  = parts[0];
        const skillId = parts[1];

        if (!itemId || !skillId) return sendSystem(socket, "Use which skill?");

        // Must be holding the item
        const inHands = acc.hands.left === itemId || acc.hands.right === itemId;
        if (!inHands) return sendSystem(socket, `You aren't holding a ${itemId}.`);

        // Get item def
        const def = World.items[itemId];
        if (!def?.skills?.length) return sendSystem(socket, "That item has no skills.");

        // Find the skill
        const skill = def.skills.find(s => s.id === skillId);
        if (!skill) return sendSystem(socket, `Unknown skill: ${skillId}.`);

        // Check weapon level
        const xp    = acc.weaponXP?.[itemId] ?? 0;
        const level = weaponLevel(xp);
        if (level < (skill.minLevel ?? 1)) {
            return sendSystem(socket, `You haven't mastered the ${def.name} enough to use ${skill.label} yet.`);
        }

        // Check cooldown
        if (!sess.skillCooldowns) sess.skillCooldowns = {};
        const now     = Date.now();
        const expires = sess.skillCooldowns[itemId] ?? 0;
        if (now < expires) {
            const remaining = Math.ceil((expires - now) / 1000);
            return sendSystem(socket, `${skill.label} is on cooldown. (${remaining}s)`);
        }

        // Check mana
        const manaCost = skill.manaCost ?? 0;
        if (sess.mana < manaCost) {
            return sendSystem(socket, `Not enough mana. (need ${manaCost}, have ${Math.floor(sess.mana)})`);
        }

        // Must be in combat to use active skills
        const cs = sess.combatState;
        if (!cs || cs.stage === 'idle' || cs.stage === 'notice') {
            return sendSystem(socket, "You aren't in combat.");
        }

        // Deduct mana, set cooldown
        sess.mana = Math.max(0, sess.mana - manaCost);
        acc.mana  = sess.mana;
        sess.skillCooldowns[itemId] = now + (skill.cooldownMs ?? 8000);
        Accounts.save();

        // Send mana update to client
        socket.send(JSON.stringify({ type: 'stats', mana: sess.mana }));

        // Send cooldown packet to client
        socket.send(JSON.stringify({
            type:       'skill_cooldown',
            itemId,
            durationMs: skill.cooldownMs ?? 8000,
        }));

        // Execute skill effect
        switch (skillId) {
            case 'dazzle':
                executeDazzle(socket, sess, acc, cs, def, skill);
                break;
            default:
                sendSystem(socket, `${skill.label} fizzles.`);
        }
    }
};

// ── DAZZLE ────────────────────────────────────────────────
// 25% chance to blind: NPC misses its next attack
function executeDazzle(socket, sess, acc, cs, def, skill) {
    const race = acc.race ?? 'human';

    const useMsg = {
        goblin: "You catch the light on the coin. It's blinding, even to you.",
        human:  "You angle the shield. A flash of reflected light.",
        elf:    "The false coin catches everything. For a moment, everything is white.",
    }[race] ?? "You flash the shiny shield.";

    Sessions.sendSystem(socket, useMsg);
    Sessions.broadcastToRoomExcept(sess.room, `${acc.name} flashes something blinding.`, socket);

// 40% chance to blind for testing (tune to 25% for balance later)
    if (Math.random() < 0.40) {
        // Success — set blind flag on combat state
        cs.npcBlinded = true;
        const hitMsg = {
            goblin: "It recoils, eyes shut. It'll miss its next swing.",
            human:  "It staggers, blinded. You have a window.",
            elf:    "It stops. Sightless for a moment. Use it.",
        }[race] ?? "The enemy is blinded!";
        Sessions.sendSystem(socket, hitMsg);
        socket.send(JSON.stringify({ type: 'system', msg: hitMsg, msgType: 'event' }));
    } else {
        const missMsg = {
            goblin: "It squints but doesn't stop. Not enough shine.",
            human:  "The angle was wrong. It barely notices.",
            elf:    "The light scatters. No effect.",
        }[race] ?? "The dazzle has no effect.";
        Sessions.sendSystem(socket, missMsg);
    }
}
