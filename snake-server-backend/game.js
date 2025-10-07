// Update this URL to your Render backend
const socket = io("https://snake-text.onrender.com");

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let gridSize = 20;
let tileSize = canvas.width / gridSize;
let wrapEdges = false;

// HUD elements
const scoreboard = document.getElementById("scoreboard");
const timerDiv = document.getElementById("timer");
const leaderboardDiv = document.getElementById("leaderboard");

// Overlays
const respawnPopup = document.getElementById("respawnPopup");
const endOverlay = document.getElementById("endOverlay");

// Username persistence
const usernameInput = document.getElementById("username");
const saveUsernameBtn = document.getElementById("saveUsername");
let username = localStorage.getItem("snakeUsername") || "";
usernameInput.value = username;

function saveUsername() {
  const name = (usernameInput.value || "").trim().slice(0, 32);
  if (!name) return;
  username = name;
  localStorage.setItem("snakeUsername", name);
  socket.emit("setUsername", name);
}
saveUsernameBtn.addEventListener("click", saveUsername);
if (username) socket.emit("setUsername", username);
else {
  // Prompt once, then store
  const n = prompt("Enter your username:");
  if (n) {
    usernameInput.value = n;
    saveUsername();
  }
}

// Board controls
const boardSizeInput = document.getElementById("boardSize");
const applyBoardBtn = document.getElementById("applyBoard");
applyBoardBtn.addEventListener("click", () => {
  const size = parseInt(boardSizeInput.value, 10);
  if (Number.isFinite(size)) socket.emit("setBoardSize", size);
});

const wrapToggle = document.getElementById("wrapToggle");
const applyWrapBtn = document.getElementById("applyWrap");
applyWrapBtn.addEventListener("click", () => {
  socket.emit("setWrapping", wrapToggle.checked);
});

// Input: prevent 180° handled on server, still send directions
document.addEventListener("keydown", e => {
  const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  if (keys.includes(e.key)) socket.emit("move", e.key);
});

// Config updates from server
socket.on("configUpdated", cfg => {
  if (typeof cfg.gridSize === "number") {
    gridSize = cfg.gridSize;
    tileSize = canvas.width / gridSize;
    boardSizeInput.value = gridSize;
  }
  if (typeof cfg.wrapEdges === "boolean") {
    wrapEdges = cfg.wrapEdges;
    wrapToggle.checked = wrapEdges;
  }
});

// Render loop: on server state
socket.on("state", state => {
  // Keep local config in sync
  gridSize = state.gridSize ?? gridSize;
  wrapEdges = state.wrapEdges ?? wrapEdges;
  tileSize = canvas.width / gridSize;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw food
  ctx.fillStyle = "red";
  ctx.fillRect(state.food.x * tileSize, state.food.y * tileSize, tileSize, tileSize);

  // Draw snakes
  for (const id in state.players) {
    const p = state.players[id];
    if (!p.alive || p.spectator) continue;
    ctx.fillStyle = p.color;
    for (const seg of p.snake) {
      ctx.fillRect(seg.x * tileSize, seg.y * tileSize, tileSize, tileSize);
    }
  }

  // Update scoreboard
  scoreboard.innerHTML = Object.values(state.players)
    .map(p => {
      const status = p.spectator ? " (Spectator)" : p.alive ? "" : " (Down)";
      return `<div><span style="color:${p.color}">■</span> ${escapeHtml(p.name || "Anonymous")}: ${p.score} — Lives: ${p.lives}${status}</div>`;
    })
    .join("");

  // Update timer
  const timeLeft = Math.max(0, Math.floor((state.matchEndTime - Date.now()) / 1000));
  timerDiv.innerText = `Time left: ${timeLeft}s`;

  // Respawn popup
  const me = state.players[socket.id];
  if (me && !me.alive && !me.spectator) {
    respawnPopup.style.display = "flex";
  } else {
    respawnPopup.style.display = "none";
  }
});

// Match over overlay + leaderboard
socket.on("matchOver", data => {
  const top = data.leaderboardTop || [];
  leaderboardDiv.innerHTML = top
    .map(row => `<div>${escapeHtml(row.name)}: ${row.score}</div>`)
    .join("");

  endOverlay.innerHTML = `
    <h1>Game Over</h1>
    <h2>Leaderboard (Top 10)</h2>
    ${top.map(row => `<div>${escapeHtml(row.name)}: ${row.score}</div>`).join("")}
    <p style="margin-top:12px;">A new match is starting…</p>
  `;
  endOverlay.style.display = "flex";

  // Hide overlay shortly after new match arrives
  setTimeout(() => { endOverlay.style.display = "none"; }, 4000);
});

// New match broadcast (keep UI synced)
socket.on("newMatch", data => {
  if (typeof data.gridSize === "number") {
    gridSize = data.gridSize;
    tileSize = canvas.width / gridSize;
    boardSizeInput.value = gridSize;
  }
  if (typeof data.wrapEdges === "boolean") {
    wrapEdges = data.wrapEdges;
    wrapToggle.checked = wrapEdges;
  }
  // Refresh leaderboard immediately if provided
  leaderboardDiv.innerHTML = (data.leaderboardTop || [])
    .map(row => `<div>${escapeHtml(row.name)}: ${row.score}</div>`)
    .join("");
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
