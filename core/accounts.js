// core/accounts.js
const fs = require("fs");

const ACCOUNT_PATH = "accounts.json";
let accounts = {};

// Load accounts.json on startup
function loadAccounts() {
    if (fs.existsSync(ACCOUNT_PATH)) {
        try {
            accounts = JSON.parse(fs.readFileSync(ACCOUNT_PATH, "utf8"));
            console.log("[ACCOUNTS] Loaded:", Object.keys(accounts).length);
        } catch (e) {
            console.error("[ACCOUNTS] Failed to parse:", e);
            accounts = {};
        }
    } else {
        fs.writeFileSync(ACCOUNT_PATH, "{}");
        console.log("[ACCOUNTS] Created new accounts.json");
    }
}

// Save accounts.json
function saveAccounts() {
    try {
        fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(accounts, null, 2));
    } catch (e) {
        console.error("[ACCOUNTS] Failed to save:", e);
    }
}

module.exports = {
    accounts,
    loadAccounts,
    saveAccounts,
    ACCOUNT_PATH
};
