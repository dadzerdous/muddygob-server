// ===============================================
// core/accounts.js
// ===============================================

const fs = require("fs");
const World = require("./world");
const { ensureAmbientItems } = require("./itemSpawner");

const ACCOUNT_PATH = "accounts.json";

// In-memory store
let accounts = {};

// -----------------------------------------------
// Load accounts
// -----------------------------------------------
if (fs.existsSync(ACCOUNT_PATH)) {
    try {
        accounts = JSON.parse(fs.readFileSync(ACCOUNT_PATH, "utf8"));
        console.log("[ACCOUNTS] Loaded", Object.keys(accounts).length, "accounts.");
    } catch {
        accounts = {};
    }
} else {
    fs.writeFileSync(ACCOUNT_PATH, "{}");
}

// -----------------------------------------------
function save() {
    fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(accounts, null, 2));
    console.log("[ACCOUNTS] Saved accounts.json");
}

// -----------------------------------------------
// ✅ NEW: Safe vitals update (called by sessions)
// -----------------------------------------------
function updateVitals(loginId, energy, stamina) {
    const acc = accounts[loginId];
    if (!acc) return;

    acc.energy = energy;
    acc.stamina = stamina;
    save();
}

// -----------------------------------------------
// (everything else unchanged)
// -----------------------------------------------

module.exports = {
    data: accounts,
    save,
    updateVitals,
    login,
    resume
};
