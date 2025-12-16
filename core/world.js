// ===============================================
// core/world.js — Smart world loader (FIXED PATHS)
// ===============================================

const fs = require("fs");
const path = require("path");

// ✅ IMPORTANT: absolute paths based on this file’s location
const ROOMS_ROOT = path.join(__dirname, "../world");
const ITEMS_ROOT = path.join(__dirname, "../world/items");

// Final exported data
const World = {
    rooms: {},
    items: {}
};

// --------------------------------------------------
// Load all rooms recursively (except items folder)
// --------------------------------------------------
function loadRooms(dir) {
    if (!fs.existsSync(dir)) {
        console.error("[WORLD] Rooms directory not found:", dir);
        return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const full = path.join(dir, entry.name);

        // Skip items folder
        if (entry.isDirectory() && entry.name === "items") continue;

        if (entry.isDirectory()) {
            loadRooms(full);
        }
        else if (entry.isFile() && entry.name.endsWith(".json")) {
            try {
                const json = JSON.parse(fs.readFileSync(full, "utf8"));

                // Each file may define one or more rooms
                for (const key of Object.keys(json)) {
                    World.rooms[key] = json[key];
                }

            } catch (err) {
                console.error("[WORLD] Failed to load room file:", full, err);
            }
        }
    }
}

// --------------------------------------------------
// Load all items from /world/items only
// --------------------------------------------------
function loadItems() {
    if (!fs.existsSync(ITEMS_ROOT)) {
        console.warn("[ITEMS] Items directory not found:", ITEMS_ROOT);
        return;
    }

    const itemFiles = fs.readdirSync(ITEMS_ROOT).filter(f => f.endsWith(".json"));

    for (const file of itemFiles) {
        const full = path.join(ITEMS_ROOT, file);

        try {
            const json = JSON.parse(fs.readFileSync(full, "utf8"));

            for (const key of Object.keys(json)) {
                World.items[key] = json[key];
            }

        } catch (err) {
            console.error("[ITEMS] Failed to load item file:", full, err);
        }
    }
}

// --------------------------------------------------
// INITIAL LOAD (runs once at server start)
// --------------------------------------------------
loadRooms(ROOMS_ROOT);
loadItems();

console.log("[WORLD] Loaded rooms:", Object.keys(World.rooms));
console.log("[ITEMS] Loaded items:", Object.keys(World.items));

module.exports = World;
