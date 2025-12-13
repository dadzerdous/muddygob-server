// ===============================================
// world.js — Smart world loader
// ===============================================
const fs = require("fs");
const path = require("path");

const ROOMS_ROOT = "./world";
const ITEMS_ROOT = "./world/items";

// Final exported data:
const World = {
    rooms: {},
    items: {}
};

// --------------------------------------------------
// Load all rooms recursively EXCEPT item folder
// --------------------------------------------------
function loadRooms(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const full = path.join(dir, entry.name);

        // Skip items folder entirely
        if (entry.isDirectory() && entry.name === "items") continue;

        if (entry.isDirectory()) {
            loadRooms(full);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {

            try {
                const json = JSON.parse(fs.readFileSync(full, "utf8"));

                // Only treat as rooms if it has a ROOM ID inside the file
                // Example: { "forest-g3": {...} }
                const keys = Object.keys(json);

                for (const key of keys) {
                    World.rooms[key] = json[key];
                }

            } catch (err) {
                console.error("[WORLD] Failed to load room:", full, err);
            }
        }
    }
}

// --------------------------------------------------
// Load all items from /world/items ONLY
// --------------------------------------------------
function loadItems() {
    if (!fs.existsSync(ITEMS_ROOT)) return;

    const itemFiles = fs.readdirSync(ITEMS_ROOT).filter(f => f.endsWith(".json"));

    for (const file of itemFiles) {
        const full = path.join(ITEMS_ROOT, file);

        try {
            const json = JSON.parse(fs.readFileSync(full, "utf8"));
            const keys = Object.keys(json);

            keys.forEach(k => {
                World.items[k] = json[k];
            });

        } catch (err) {
            console.error("[ITEMS] Failed to load item:", full, err);
        }
    }
}

// --------------------------------------------------
// INITIAL LOAD
// --------------------------------------------------
loadRooms(ROOMS_ROOT);
loadItems();

console.log("[WORLD] Loaded rooms:", Object.keys(World.rooms));
console.log("[ITEMS] Loaded items:", Object.keys(World.items));

module.exports = World;
