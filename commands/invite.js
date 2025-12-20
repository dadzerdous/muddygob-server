// commands/invite.js
module.exports = {
  name: "invite",
  aliases: [],
  execute(ctx, arg) {
    const { socket, sess, accounts, sendSystem, broadcastToRoomExcept } = ctx;

    if (!arg) return sendSystem(socket, "Invite who?");

    const targetName = arg.toLowerCase();
    const targetLogin = Object.keys(accounts).find(id => id.startsWith(targetName + "@"));
    if (!targetLogin) return sendSystem(socket, "No such being exists.");

    const targetSocket = [...global.sessions.entries()]
      .find(([sock, s]) => s.loginId === targetLogin)?.[0];

    if (!targetSocket) return sendSystem(socket, `${arg} is not here.`);

    // Store pending invite on both sides
    sess.pendingInvite = targetLogin;
    const targetSess = global.sessions.get(targetSocket);
    targetSess.invitedBy = sess.loginId;

    // Send messages
    sendSystem(socket, `You invite ${arg}.`);
    targetSocket.send(JSON.stringify({
      type: "invite_popup",
      from: accounts[sess.loginId].name
    }));
  }
};
