// game.js
const SERVER_URL = "https://snake-text.onrender.com"; // update
const socket = io(SERVER_URL);

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let gridSize = 20;
let tileSize = canvas.width / gridSize;
let wrapEdges = false;
let modifiers = {};
let inLobby = false;
let lobbyEndTime = null;
let matchEndTime = Date.now() + 60_000;

const usernameInput = document.getElementById("username");
const saveUsernameBtn = document.getElementById("saveUsername");
const scoreboardDiv = document.getElementById("scoreboard");
const leaderboardDiv = document.getElementById("leaderboard");
const lobbyOverlay = document.getElementById("lobbyOverlay");
const lobbyTimerEl = document.getElementById("lobbyTimer");
const lobbyBoardSize = document.getElementById("lobbyBoardSize");
const lobbyWrap = document.getElementById("lobbyWrap");
const modifierList = document.getElementById("modifierList");
const respawnOverlay = document.getElementById("respawnOverlay");
const endOverlay = document.getElementById("endOverlay");
const endBox = document.getElementById("endBox");
const lobbyStatus = document.getElementById("lobbyStatus");
const nextMatchTimer = document.getElementById("nextMatchTimer");

let foods = [];
let players = {};

// Username persistence
let savedName = localStorage.getItem("snakeUsername") || "";
usernameInput.value = savedName;
if (savedName) socket.emit("setUsername", savedName);

saveUsernameBtn.addEventListener("click", () => {
  const n = (usernameInput.value || "").trim().slice(0,32);
  if (!n) return;
  localStorage.setItem("snakeUsername", n);
  socket.emit("setUsername", n);
});

// WASD controls mapped to arrow keys
document.addEventListener("keydown", e => {
  const map = { w:"ArrowUp", a:"ArrowLeft", s:"ArrowDown", d:"ArrowRight" };
  const key = e.key.toLowerCase();
  if (map[key]) {
    e.preventDefault();
    // If reverseControls modifier enabled, invert mapping client-side for UX (server also enforces movement checks)
    const effective = modifiers.reverseControls ? invertDirection(map[key]) : map[key];
    socket.emit("move", effective);
  }
});

function invertDirection(dir) {
  const opp = { ArrowUp:"ArrowDown", ArrowDown:"ArrowUp", ArrowLeft:"ArrowRight", ArrowRight:"ArrowLeft" };
  return opp[dir] || dir;
}

// Lobby UI actions (only active in lobby)
document.getElementById("applyBoard").addEventListener("click", () => {
  const s = parseInt(lobbyBoardSize.value, 10);
  if (!inLobby) return;
  socket.emit("setBoardSize", s);
});
lobbyWrap.addEventListener("change", () => {
  if (!inLobby) return;
  socket.emit("setWrapping", lobbyWrap.checked);
});

// Toggle modifiers checkboxes created dynamically
function renderModifiersUI(mods) {
  modifierList.innerHTML = "";
  for (const key of Object.keys(mods)) {
    const id = "mod-" + key;
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" id="${id}" ${mods[key] ? "checked":""}> ${key}`;
    modifierList.appendChild(label);
    document.getElementById(id).addEventListener("change", () => {
      if (!inLobby) {
        // revert checkbox if not lobby
        document.getElementById(id).checked = modifiers[key];
        return;
      }
      socket.emit("toggleModifier", key);
    });
  }
}

// Server events
socket.on("connect", () => {
  console.log("connected to server");
});

socket.on("config", cfg => {
  gridSize = cfg.gridSize || gridSize;
  wrapEdges = cfg.wrapEdges || wrapEdges;
  modifiers = cfg.modifiers || modifiers;
  inLobby = cfg.inLobby || false;
  lobbyEndTime = cfg.lobbyEndTime || lobbyEndTime;
  matchEndTime = cfg.matchEndTime || matchEndTime;
  tileSize = canvas.width / gridSize;
  renderModifiersUI(modifiers);
  updateLobbyUI();
});

socket.on("lobbyStart", data => {
  inLobby = true;
  lobbyEndTime = data.lobbyEndTime;
  gridSize = data.gridSize;
  wrapEdges = data.wrapEdges;
  modifiers = data.modifiers;
  tileSize = canvas.width / gridSize;
  lobbyBoardSize.value = gridSize;
  lobbyWrap.checked = wrapEdges;
  renderModifiersUI(modifiers);
  lobbyOverlay.style.display = "flex";
  updateLobbyUI();
});

socket.on("lobbyUpdate", data => {
  gridSize = data.gridSize || gridSize;
  wrapEdges = data.wrapEdges ?? wrapEdges;
  modifiers = data.modifiers || modifiers;
  tileSize = canvas.width / gridSize;
  lobbyBoardSize.value = gridSize;
  lobbyWrap.checked = wrapEdges;
  renderModifiersUI(modifiers);
  updateLobbyUI();
});

socket.on("newMatch", data => {
  inLobby = false;
  lobbyOverlay.style.display = "none";
  gridSize = data.gridSize || gridSize;
  wrapEdges = data.wrapEdges ?? wrapEdges;
  modifiers = data.modifiers || modifiers;
  matchEndTime = data.matchEndTime || matchEndTime;
  tileSize = canvas.width / gridSize;
});

socket.on("state", state => {
  players = state.players || players;
  foods = state.foods || foods;
  matchEndTime = state.matchEndTime || matchEndTime;
  gridSize = state.gridSize || gridSize;
  wrapEdges = state.wrapEdges ?? wrapEdges;
  modifiers = state.modifiers || modifiers;
  tileSize = canvas.width / gridSize;
  draw();
  updateHUD();
});

socket.on("matchOver", data => {
  // show final leaderboard
  const top = data.leaderboardTop || [];
  leaderboardDiv.innerHTML = top.map(r => `${escapeHtml(r.name)}: ${r.score}`).join("<br>") || "—";
  endBox.innerHTML = `<h2>Match Over</h2>
    <div>${top.map(r => `<div>${escapeHtml(r.name)}: ${r.score}</div>`).join("")}</div>
    <div style="margin-top:8px;">Lobby begins for new match.</div>`;
  endOverlay.style.display = "flex";
  setTimeout(()=> endOverlay.style.display = "none", 2500);
});

// Update visuals of lobby status and timers
function updateLobbyUI() {
  if (inLobby) {
    lobbyStatus.textContent = "Lobby open — change settings";
    lobbyOverlay.style.display = "flex";
    // start countdown interval
    clearInterval(window._lobbyTick);
    window._lobbyTick = setInterval(() => {
      const secs = Math.max(0, Math.ceil((lobbyEndTime - Date.now())/1000));
      lobbyTimerEl.textContent = secs;
      lobbyStatus.textContent = `Lobby open — ${secs}s to start`;
      nextMatchTimer.textContent = `Starts in ${secs}s`;
      if (secs <= 0) { clearInterval(window._lobbyTick); }
    }, 250);
  } else {
    lobbyStatus.textContent = "Match in progress";
    lobbyOverlay.style.display = "none";
    clearInterval(window._lobbyTick);
  }
}

// draw function
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw grid background lightly (optional)
  // draw foods
  for (const f of foods) {
    ctx.fillStyle = "red";
    ctx.fillRect(f.x * tileSize, f.y * tileSize, tileSize, tileSize);
  }
  // draw snakes
  for (const id in players) {
    const p = players[id];
    if (!p || p.spectator) continue;
    ctx.fillStyle = p.color || "#0f0";
    for (const s of p.snake) {
      ctx.fillRect(s.x * tileSize, s.y * tileSize, tileSize, tileSize);
    }
  }
}

// HUD update
function updateHUD() {
  scoreboardDiv.innerHTML = Object.values(players).map(p => {
    const status = p.spectator ? " (Spectator)" : p.alive ? "" : " (Down)";
    return `<div><span style="color:${p.color}">■</span> ${escapeHtml(p.name)}: ${p.score} — Lives: ${p.lives}${status}</div>`;
  }).join("") || "—";

  // leaderboard remains from matchOver events; show current match timer too
  const secs = Math.max(0, Math.floor((matchEndTime - Date.now())/1000));
  nextMatchTimer.textContent = `Time left: ${secs}s`;
  // show respawn overlay for local player
  const me = players[socket.id];
  if (me && !me.alive && !me.spectator) respawnOverlay.style.display = "flex";
  else respawnOverlay.style.display = "none";
}

function escapeHtml(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
