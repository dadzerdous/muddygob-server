// ===============================================
// commands/take.js
// Take an item from the room into inventory
// ===============================================

const fs = require("fs");
const path = require("path");

// Load item definitions (single file for now)
const itemsDB = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "../world/items/rock.json"),
        "utf8"
    )
);

module.exports = {
    name: "take",
    aliases: ["get", "grab"],

    help: "take <item>\nPick up an item you see in the room.",

    execute(ctx, arg) {
        const {
            socket,
            sess,
            accounts,
            world,
            sendRoom,
            sendSystem,
            saveAccounts
        } = ctx;

        if (!arg) {
            return sendSystem(socket, "Take what?");
        }

        const acc = accounts[sess.loginId];
        const room = world[sess.room];

        if (!room || !room.objects) {
            return sendSystem(socket, "There is nothing here to take.");
        }

        const key = arg.toLowerCase();
        const obj = room.objects[key];

        if (!obj) {
            return sendSystem(socket, "You see no such thing.");
        }

        // 🔑 Your model: items are identified by itemId
        if (!obj.itemId) {
            return sendSystem(socket, "You cannot take that.");
        }

        const itemDef = itemsDB[obj.itemId];
        if (!itemDef) {
            return sendSystem(socket, "That item cannot be taken.");
        }

        // Ensure inventory exists
        if (!acc.inventory) acc.inventory = [];

        // Add to inventory
        acc.inventory.push(obj.itemId);

        // Remove from room
        delete room.objects[key];

        saveAccounts();

        sendSystem(
            socket,
            `You pick up the ${key}.`
        );

        // Refresh room view
        sendRoom(socket, sess.room);
    }
};
