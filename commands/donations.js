// commands/donations.js
module.exports = {
    name: "donations",
    aliases: ["donate", "support"],

    help: [
        "Show ways to support the project.",
        "",
        "Usage:",
        "  donations",
        "  donate",
        "  support"
    ].join("\n"),

    execute(ctx) {
        const { socket, sendSystem } = ctx;

        const message = [
            "💰 DONATIONS & SUPPORT",
            "",
            "Help keep MuddyGob and SingleFrameGames alive!",
            "",
            "☕ Ko-fi (tips, monthly, one-offs):",
            "  https://ko-fi.com/dadzerdous",
            "",
            "💳 PayPal (direct support):",
            "  https://paypal.me/YOUR_HANDLE_HERE",
            "",
            "Even small amounts help — testing, playing, and sharing help too!",
            "Thank you for supporting the mud and the goblins. 🐾"
        ].join("\n");

        sendSystem(socket, message);
    }
};
