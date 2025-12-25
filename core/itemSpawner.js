// ===============================================
// core/itemSpawner.js
// ===============================================
console.log("[SPAWNER] room.id =", room.id, "ambient =", room.ambient);

function ensureAmbientItems(room) {
    if (!room || !room.ambient) return;

    // Initialize items array if missing
    if (!room.items) room.items = [];

    // Simple throttle: Don't check for respawns more than once every 30 seconds
    const now = Date.now();
    if (room.lastSpawnCheck && now - room.lastSpawnCheck < 30000) {
        return; 
    }
    room.lastSpawnCheck = now;

    for (const [itemId, rule] of Object.entries(room.ambient)) {
        const max = rule.max ?? 1;
        const existing = room.items.filter(i => i.defId === itemId).length;

        for (let i = existing; i < max; i++) {
            room.items.push({
                id: `${itemId}_${now}_${Math.random().toString(36).slice(2, 6)}`,
                defId: itemId
            });
        }
    }
}

module.exports = {
    ensureAmbientItems
};
