
// ===============================================
// core/spam.js
// Handles speech spam + mute timers
// ===============================================

function recordSpeech(sess) {
    const now = Date.now();
    if (!sess.spamTimes) sess.spamTimes = [];

    sess.spamTimes = sess.spamTimes.filter(t => now - t < 10000);
    sess.spamTimes.push(now);

    if (sess.spamTimes.length >= 6) {
        if (!sess.muteLevel) sess.muteLevel = 1;

        const durations = {
            1: 5000,
            2: 15000,
            3: 30000
        };

        const mute = durations[sess.muteLevel] || 60000;
        sess.mutedUntil = now + mute;

        sess.muteLevel++;
    }
}

function isMuted(sess) {
    return sess.mutedUntil && Date.now() < sess.mutedUntil;
}

module.exports = {
    recordSpeech,
    isMuted
};
