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

        // Skip items and data folders
        if (entry.isDirectory() && ["items","data"].includes(entry.name)) continue;

        if (entry.isDirectory()) {
            loadRooms(full);
        }
        else if (entry.isFile() && entry.name.endsWith(".json")) {
            try {
                const json = JSON.parse(fs.readFileSync(full, "utf8"));

                // Skip recipe files and other non-room JSON
                // A room must have a title or text field
                for (const key of Object.keys(json)) {
                    const val = json[key];
                    if (val && (val.title || val.text)) {
                   val.id = key;
World.rooms[key] = val;
console.log("[WORLD] loaded room:", key, "| has events:", !!val.events, "| keys:", Object.keys(val));
                    } else {
                        console.log("[WORLD] Skipping non-room key:", key, "in", entry.name);
                    }
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

// Load recipes from world/data/recipes.json
const RECIPES_PATH = path.join(__dirname, "../world/data/recipes.json");
if (require("fs").existsSync(RECIPES_PATH)) {
    try {
        World.recipes = JSON.parse(require("fs").readFileSync(RECIPES_PATH, "utf8"));
        console.log("[RECIPES] Loaded:", Object.keys(World.recipes).length, "recipes");
    } catch(err) {
        console.error("[RECIPES] Failed to load:", err);
        World.recipes = {};
    }
} else {
    World.recipes = {};
}
console.log("[WORLD] forest-g3 events:", JSON.stringify(World.rooms['forest-g3']?.events));
module.exports = World;
