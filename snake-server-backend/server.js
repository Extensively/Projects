// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ----- Game config -----
const MATCH_DURATION = 5 * 60 * 1000; // 5 minutes
const LOBBY_DURATION = 15000;         // 15 seconds
const RESPAWN_DELAY = 3000;
const STARTING_LIVES = 3;
const GRID_DEFAULT = 20;

let gridSize = GRID_DEFAULT;
let wrapEdges = false;
let modifiers = { doubleFood: false, fastMode: false, slowMode: false, reverseControls: false };

let players = {};
let food = randomFood();
let matchEndTime = Date.now() + MATCH_DURATION;
let lobbyActive = false;
let lobbyEndTime = null;

// ----- Database -----
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      score INT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
})();

// ----- Helpers -----
function randomFood() {
  return { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) };
}

function respawnPlayer(id) {
  const p = players[id];
  if (!p) return;
  p.snake = [{ x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) }];
  p.direction = "ArrowRight";
  p.alive = true;
}

function handleDeath(id) {
  const p = players[id];
  if (!p) return;
  p.lives--;
  p.alive = false;
  if (p.lives > 0) {
    setTimeout(() => { if (players[id]) respawnPlayer(id); }, RESPAWN_DELAY);
  } else {
    p.spectator = true;
  }
}

function startLobby() {
  lobbyActive = true;
  lobbyEndTime = Date.now() + LOBBY_DURATION;
  io.emit("lobbyStart", { lobbyEndTime, gridSize, wrapEdges, modifiers });
  setTimeout(() => {
    lobbyActive = false;
    startNewMatch();
  }, LOBBY_DURATION);
}

async function endMatch() {
  // Save scores
  const inserts = [];
  for (const id in players) {
    const p = players[id];
    inserts.push(pool.query("INSERT INTO leaderboard (name, score) VALUES ($1, $2)", [p.name, p.score]));
  }
  await Promise.all(inserts);
  const top = await pool.query("SELECT name, score FROM leaderboard ORDER BY score DESC, created_at ASC LIMIT 10");
  io.emit("matchOver", { leaderboardTop: top.rows, gridSize, wrapEdges, modifiers });
  startLobby();
}

function startNewMatch() {
  players = {};
  food = randomFood();
  matchEndTime = Date.now() + MATCH_DURATION;
  io.emit("newMatch", { endTime: matchEndTime, gridSize, wrapEdges, modifiers });
}

// ----- Socket handlers -----
io.on("connection", socket => {
  players[socket.id] = {
    name: "Anonymous",
    snake: [{ x: 5, y: 5 }],
    direction: "ArrowRight",
    color: "#" + Math.floor(Math.random() * 16777215).toString(16),
    score: 0,
    lives: STARTING_LIVES,
    alive: true,
    spectator: false
  };

  socket.on("setUsername", name => {
    if (typeof name === "string" && name.trim()) players[socket.id].name = name.trim().slice(0, 32);
  });

  socket.on("move", dir => {
    const current = players[socket.id]?.direction;
    const opposite = { ArrowUp: "ArrowDown", ArrowDown: "ArrowUp", ArrowLeft: "ArrowRight", ArrowRight: "ArrowLeft" };
    if (current && dir !== opposite[current]) players[socket.id].direction = dir;
  });

  // Settings only in lobby
  socket.on("setBoardSize", size => {
    if (!lobbyActive) return;
    if (typeof size === "number" && size >= 10 && size <= 60) {
      gridSize = size;
      food = randomFood();
      io.emit("settingsUpdated", { gridSize, wrapEdges, modifiers });
    }
  });
  socket.on("setWrapping", enabled => {
    if (!lobbyActive) return;
    wrapEdges = !!enabled;
    io.emit("settingsUpdated", { gridSize, wrapEdges, modifiers });
  });
  socket.on("toggleModifier", key => {
    if (!lobbyActive) return;
    if (modifiers.hasOwnProperty(key)) modifiers[key] = !modifiers[key];
    io.emit("settingsUpdated", { gridSize, wrapEdges, modifiers });
  });

  socket.on("disconnect", () => { delete players[socket.id]; });
});

// ----- Game loop -----
setInterval(async () => {
  if (!lobbyActive && Date.now() >= matchEndTime) {
    await endMatch();
    return;
  }

  if (lobbyActive) return; // no game updates during lobby

  for (const id in players) {
    const p = players[id];
    if (!p || !p.alive || p.spectator) continue;

    let head = { ...p.snake[0] };
    if (p.direction === "ArrowUp") head.y--;
    if (p.direction === "ArrowDown") head.y++;
    if (p.direction === "ArrowLeft") head.x--;
    if (p.direction === "ArrowRight") head.x++;

    if (wrapEdges) {
      if (head.x < 0) head.x = gridSize - 1;
      if (head.x >= gridSize) head.x = 0;
      if (head.y < 0) head.y = gridSize - 1;
      if (head.y >= gridSize) head.y = 0;
    } else {
      if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) { handleDeath(id); continue; }
    }

    if (p.snake.some(seg => seg.x === head.x && seg.y === head.y)) { handleDeath(id); continue; }
    let collided = false;
    for (const otherId in players) {
      if (otherId !== id && players[otherId].alive) {
        if (players[otherId].snake.some(seg => seg.x === head.x && seg.y === head.y)) { collided = true; break; }
      }
    }
    if (collided) { handleDeath(id); continue; }

    p.snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      p.score++;
      food = randomFood();
      if (modifiers.doubleFood) food2 = randomFood();
    } else {
      p.snake.pop();
    }
  }

  io.emit("state", { players, food, matchEndTime, gridSize, wrapEdges, modifiers });
}, 200);

server.listen(3000, () => console.log("Server running on port 3000"));
