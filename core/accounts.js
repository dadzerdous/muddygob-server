// ===============================================
// core/accounts.js
// ===============================================

const fs = require("fs");

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
// Account helpers
// -----------------------------------------------
function get(loginId) {
    return accounts[loginId];
}

function set(loginId, data) {
    accounts[loginId] = data;
    save();
}

// -----------------------------------------------
// ✅ Safe vitals update (used by sessions)
// -----------------------------------------------
function updateVitals(loginId, energy, stamina) {
    const acc = accounts[loginId];
    if (!acc) return;

    acc.energy = energy;
    acc.stamina = stamina;
    save();
}

// -----------------------------------------------
module.exports = {
    data: accounts,
    get,
    set,
    save,
    updateVitals
};
