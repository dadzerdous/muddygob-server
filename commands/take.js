// ===============================================
// commands/take.js
// Take an item from the room into inventory
// ===============================================

const fs = require("fs");
const path = require("path");
const Room = require("../core/room");

// Load item definitions
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
            sendSystem,
            sendRoom
        } = ctx;

        if (!arg) {
            return sendSystem(socket, "Take what?");
        }

        const acc = accounts[sess.loginId];
        if (!acc) {
            return sendSystem(socket, "You feel strangely insubstantial.");
        }

        // ✅ AUTHORITATIVE ROOM ACCESS
        const room = Room.getRoom(sess.room);

        if (!room || !room.objects) {
            return sendSystem(socket, "There is nothing here to take.");
        }

        const key = arg.toLowerCase();
        const obj = room.objects[key];

        if (!obj) {
            return sendSystem(socket, "You see no such thing.");
        }

        if (!obj.itemId) {
            return sendSystem(socket, "You cannot take that.");
        }

        const itemDef = itemsDB[obj.itemId];
        if (!itemDef) {
            return sendSystem(socket, "That item cannot be taken.");
        }

        if (!acc.inventory) acc.inventory = [];
        acc.inventory.push(obj.itemId);

        delete room.objects[key];

        sendSystem(socket, `You pick up the ${key}.`);
        sendRoom(socket, sess.room);
    }
};
