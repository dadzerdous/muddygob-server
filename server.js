// ===============================================
// render.js (Room + System Output Rendering)
// ===============================================

export function renderSystem(msg) {
    const output = document.getElementById("output");
    output.innerHTML += `<div class="system-msg">${msg}</div><br>`;
    output.scrollTop = output.scrollHeight;
}

export function renderRoom(room) {
    const output = document.getElementById("output");

    let html = `
        <div class="room-title">${room.title}</div>
        <div class="room-desc">
            ${room.desc.map(l => `<p>${l}</p>`).join("")}
        </div>
        <div class="room-exits">
            <b>Exits:</b>
            ${room.exits.map(e => `<span class="exit">${e}</span>`).join(", ")}
        </div>
    `;

    output.innerHTML += html + "<br>";
    output.scrollTop = output.scrollHeight;

    if (room.background)
        document.body.style.backgroundImage = `url('images/${room.background}.jpg')`;
}
