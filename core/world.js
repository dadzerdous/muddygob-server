// ======================================
// world.js – loads rooms + item database
// ======================================

const fs = require("fs");
const path = require("path");

// --------------------------------------------------
// Load all ROOM JSON files under world/*
// (but ignore world/objects)
// --------------------------------------------------
function loadRooms() {
    const rooms = {};

    function loadRecursive(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const full = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                if (entry.name === "objects") continue; // ignore item DB folder
                loadRecursive(full);
            } else if (entry.name.endsWith(".json")) {
                try {
                    const data = JSON.parse(fs.readFileSync(full, "utf8"));
                    Object.assign(rooms, data);
                } catch (e) {
                    console.error("[WORLD] Failed to load file:", full, e);
                }
            }
        }
    }

    loadRecursive("./world");
    return rooms;
}

// --------------------------------------------------
// Load ITEM DATABASE from world/objects/*.json
// --------------------------------------------------
function loadItems() {
    const items = {};
    const dir = "./world/objects";

    if (!fs.existsSync(dir)) return items;

    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));

    for (const f of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
            Object.assign(items, data);
        } catch (e) {
            console.error("[ITEMS] Failed:", f, e);
        }
    }

    return items;
}

// --------------------------------------------------
// EXPORT
// --------------------------------------------------
const world = loadRooms();
const itemsDB = loadItems();

console.log("[WORLD] Loaded rooms:", Object.keys(world));
console.log("[ITEMS] Loaded items:", Object.keys(itemsDB));

module.exports = {
    world,
    itemsDB
};
