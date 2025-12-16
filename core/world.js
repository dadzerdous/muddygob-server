// ===============================================
// core/world.js — SINGLE SOURCE OF TRUTH
// ===============================================

const fs = require("fs");
const path = require("path");

// -----------------------------------------------
// LOAD ROOMS (one file per room)
// -----------------------------------------------
const roomsDir = path.join(__dirname, "../world");
const rooms = {};

for (const file of fs.readdirSync(roomsDir)) {
    if (!file.endsWith(".json")) continue;

    const id = file.replace(".json", "");
    const fullPath = path.join(roomsDir, file);

    try {
        rooms[id] = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    } catch (err) {
        console.error(`🔥 Failed to load room ${file}`, err);
    }
}

console.log("[WORLD] Loaded rooms:", Object.keys(rooms));

// -----------------------------------------------
// LOAD ITEMS
// -----------------------------------------------
const itemsDir = path.join(__dirname, "../world/items");
const items = {};

if (fs.existsSync(itemsDir)) {
    for (const file of fs.readdirSync(itemsDir)) {
        if (!file.endsWith(".json")) continue;

        try {
            Object.assign(
                items,
                JSON.parse(fs.readFileSync(path.join(itemsDir, file), "utf8"))
            );
        } catch (err) {
            console.error(`🔥 Failed to load item file ${file}`, err);
        }
    }
}

console.log("[ITEMS] Loaded items:", Object.keys(items));

// -----------------------------------------------
// EXPORT AUTHORITATIVE WORLD
// -----------------------------------------------
module.exports = {
    rooms,
    items
};
