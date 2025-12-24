// ===============================================
// core/itemSpawner.js
// Handles ambient / passive item spawning (FIXED)
// ===============================================

function ensureAmbientItems(room) {
    if (!room || !room.ambient) return;

    // Live item instances live here ONLY
    if (!room.items) room.items = [];

    for (const [itemId, rule] of Object.entries(room.ambient)) {
        const max = rule.max ?? 1;

        const existing = room.items.filter(i => i.defId === itemId).length;

        for (let i = existing; i < max; i++) {
            room.items.push({
                id: `${itemId}_${Date.now()}_${Math.random()
                    .toString(36)
                    .slice(2, 6)}`,
                defId: itemId
            });
        }
    }
}

module.exports = {
    ensureAmbientItems
};
