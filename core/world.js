// core/world.js
const fs = require("fs");

function loadWorldRecursive(dir, world = {}) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const full = `${dir}/${entry.name}`;

        if (entry.isDirectory()) {
            loadWorldRecursive(full, world);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
            try {
                const data = JSON.parse(fs.readFileSync(full, "utf8"));
                Object.assign(world, data);
            } catch (e) {
                console.error("[WORLD] Failed:", full, e);
            }
        }
    }

    return world;
}

module.exports = { loadWorldRecursive };
