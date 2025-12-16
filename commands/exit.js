module.exports = {
    name: "exit",
    aliases: ["logout", "quit"],
    help: "exit\nLeave the world and return to the title screen.",

    execute({ socket, sendSystem }) {
        sendSystem(socket, "You step out of the world.");
        socket.close();
    }
};
