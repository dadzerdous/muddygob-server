// ===============================================
// core/itemSpawner.js
// Handles ambient / passive item spawning
// ===============================================

function ensureAmbientItems(room) {
    if (!room || !room.ambient) return;

    if (!room.objects) room.objects = {};

    for (const [itemId, rule] of Object.entries(room.ambient)) {
        const max = rule.max ?? 1;

        const existing = Object.values(room.objects)
            .filter(o => o.itemId === itemId).length;

        for (let i = existing; i < max; i++) {
            const instanceId = `${itemId}_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 6)}`;

            room.objects[instanceId] = { itemId };
        }
    }
}

module.exports = {
    ensureAmbientItems
};
