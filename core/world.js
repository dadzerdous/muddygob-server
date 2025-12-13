// ===============================================
// core/world.js
// ===============================================

const fs = require("fs");

function loadRecursive(dir, world = {}) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const full = `${dir}/${entry.name}`;

        if (entry.isDirectory()) {
            loadRecursive(full, world);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
            try {
                const data = JSON.parse(fs.readFileSync(full, "utf8"));
                Object.assign(world, data);
            } catch (err) {
                console.error("FAILED TO LOAD ROOM FILE:", full, err);
            }
        }
    }

    return world;
}

const data = loadRecursive("./world");
console.log("[WORLD] Loaded rooms:", Object.keys(data));

module.exports = { data };
