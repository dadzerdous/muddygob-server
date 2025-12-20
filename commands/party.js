const { v4: uuid } = require("uuid");

module.exports = {
    name: "party",
    aliases: ["p"],

    help: [
        "Party commands:",
        "  party create",
        "  party invite <name>",
        "  party accept",
        "  party leave",
        "  party",
        "  p <message>   (party chat)",
    ].join("\n"),

    execute(ctx, arg) {
        const { socket, sess, accounts, sendSystem } = ctx;
        const parts = arg.split(" ");
        const cmd = parts.shift()?.toLowerCase();
        const msg = parts.join(" ").trim();

        // No subcommand means chat
        if (!cmd) {
            return sendPartyChat(ctx, arg);
        }

        switch (cmd) {
            case "create": return partyCreate(ctx);
            case "invite": return partyInvite(ctx, msg);
            case "accept": return partyAccept(ctx);
            case "leave": return partyLeave(ctx);
            default: return sendSystem(socket, "Unknown party command.");
        }
    }
};

function partyCreate({ socket, sess, sendSystem }) {
    if (sess.partyId) return sendSystem(socket, "You are already in a party.");

    const id = uuid();
    global.parties[id] = { leader: socket, members: new Set([socket]) };
    sess.partyId = id;

    sendSystem(socket, "🎉 Party created! You are the leader.");
}

function partyInvite(ctx, targetName) {
    const { socket, sess, accounts, sendSystem } = ctx;

    if (!targetName) return sendSystem(socket, "Invite who?");
    const room = sess.room;

    // Auto-create party if player is not in one
    if (!sess.partyId) {
        const id = uuid();
        global.parties[id] = { leader: socket, members: new Set([socket]) };
        sess.partyId = id;
        sendSystem(socket, "🎉 A new party forms around you...");
    }

    const party = global.parties[sess.partyId];
    if (!party) return sendSystem(socket, "Party error.");

    // Only leader can invite
    if (party.leader !== socket) {
        return sendSystem(socket, "Only the party leader can invite.");
    }

    // Find target in same room
    for (const [sock, s] of global.sessions.entries()) {
        if (s.room === room && s.state === "ready") {
            const acc = accounts[s.loginId];
            if (acc && acc.name.toLowerCase() === targetName.toLowerCase()) {
                s.inviteFrom = socket;
                sendSystem(socket, `Invite sent to ${acc.name}.`);
                sendSystem(sock, `${acc.name}, you are invited to join a party. Type 'party accept'.`);
                return;
            }
        }
    }

    sendSystem(socket, `${targetName} is not here.`);
}


function partyAccept(ctx) {
    const { socket, sess, accounts, sendSystem } = ctx;
    const inviter = sess.inviteFrom;
    delete sess.inviteFrom;

    if (!inviter) return sendSystem(socket, "You have no pending invite.");

    const inviterSess = global.sessions.get(inviter);
    if (!inviterSess?.partyId) return sendSystem(socket, "That party no longer exists.");

    const party = global.parties[inviterSess.partyId];
    party.members.add(socket);
    sess.partyId = inviterSess.partyId;

    const acc = accounts[sess.loginId];
    sendSystem(socket, `You joined the party!`);

    for (const member of party.members) {
        if (member !== socket) {
            const mSess = global.sessions.get(member);
            const name = accounts[mSess.loginId].name;
            sendSystem(member, `${acc.name} has joined the party.`);
        }
    }
}

function partyLeave({ socket, sess, accounts, sendSystem }) {
    const id = sess.partyId;
    if (!id) return sendSystem(socket, "You are not in a party.");

    const party = global.parties[id];
    const name = accounts[sess.loginId].name;

    party.members.delete(socket);
    sess.partyId = null;

    sendSystem(socket, "You leave the party.");

    if (party.members.size === 0) {
        delete global.parties[id];
    } else if (party.leader === socket) {
        // promote someone else
        const first = [...party.members][0];
        party.leader = first;
        sendSystem(first, "You are now the party leader!");
    }

    for (const m of party.members) {
        sendSystem(m, `${name} left the party.`);
    }
}

function sendPartyChat({ socket, sess, accounts, sendSystem }, message) {
    if (!sess.partyId) return sendSystem(socket, "You are not in a party.");

    const party = global.parties[sess.partyId];
    const actor = accounts[sess.loginId].name;

    for (const m of party.members) {
        sendSystem(m, `🎤 [Party] ${actor}: ${message}`);
    }
}
