// core/sessions.js
const sessions = new Map();  // socket → session object

function createSession(socket, startRoom) {
    const sess = {
        state: "connected",
        loginId: null,
        room: startRoom,
        spamTimes: [],
        muteLevel: 0
    };
    sessions.set(socket, sess);
    return sess;
}

function destroySession(socket) {
    sessions.delete(socket);
}

function getSession(socket) {
    return sessions.get(socket);
}

function countReady() {
    let c = 0;
    for (const s of sessions.values()) {
        if (s.state === "ready") c++;
    }
    return c;
}

module.exports = {
    sessions,
    createSession,
    destroySession,
    getSession,
    countReady
};
