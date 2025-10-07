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
const RESPAWN_DELAY = 3000;           // 3 seconds
const STARTING_LIVES = 3;
const GRID_MIN = 10;
const GRID_MAX = 60;
const GRID_DEFAULT = 20;

// State (reset each match where noted)
let gridSize = GRID_DEFAULT; // configurable per match
let wrapEdges = false;       // configurable per match
let players = {};            // reset each match
let food = randomFood();     // reset each match
let matchEndTime = Date.now() + MATCH_DURATION;

// ----- Database (persistent across matches) -----
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
  return {
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize)
  };
}

function respawnPlayer(id) {
  const p = players[id];
  if (!p) return;
  p.snake = [{
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize)
  }];
  p.direction = "ArrowRight";
  p.alive = true;
}

function handleDeath(id) {
  const p = players[id];
  if (!p) return;

  p.lives--;
  p.alive = false;

  if (p.lives > 0) {
    setTimeout(() => {
      if (players[id]) respawnPlayer(id);
    }, RESPAWN_DELAY);
  } else {
    p.spectator = true;
  }
}

function startNewMatch() {
  players = {};
  food = randomFood();
  matchEndTime = Date.now() + MATCH_DURATION;
  io.emit("newMatch", {
    endTime: matchEndTime,
    leaderboardTop: [], // will be refreshed when queried
    gridSize,
    wrapEdges
  });
}

// ----- Socket handlers -----
io.on("connection", socket => {
  // Initialize player with defaults
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

  // Username set (persisted on client via localStorage)
  socket.on("setUsername", name => {
    if (typeof name === "string" && name.trim().length > 0) {
      players[socket.id].name = name.trim().slice(0, 32);
    }
  });

  // Prevent reversing direction (180° turns)
  socket.on("move", dir => {
    const valid = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (!valid.includes(dir) || !players[socket.id]) return;
    const current = players[socket.id].direction;
    const opposite = {
      ArrowUp: "ArrowDown",
      ArrowDown: "ArrowUp",
      ArrowLeft: "ArrowRight",
      ArrowRight: "ArrowLeft"
    };
    if (dir !== opposite[current]) {
      players[socket.id].direction = dir;
    }
  });

  // Optional: allow clients to suggest board size for next match
  socket.on("setBoardSize", size => {
    if (typeof size !== "number") return;
    const s = Math.max(GRID_MIN, Math.min(GRID_MAX, Math.floor(size)));
    // You could add authorization here; for now, accept the latest request
    gridSize = s;
    food = randomFood();
    io.emit("configUpdated", { gridSize, wrapEdges });
  });

  // Optional: toggle wrapping for next match
  socket.on("setWrapping", enabled => {
    wrapEdges = !!enabled;
    io.emit("configUpdated", { gridSize, wrapEdges });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });

  // Send initial config to this client
  socket.emit("configUpdated", { gridSize, wrapEdges });
});

// ----- Main game loop -----
setInterval(async () => {
  // Match end check
  if (Date.now() >= matchEndTime) {
    // Persist scores
    try {
      const insertValues = [];
      for (const id in players) {
        const p = players[id];
        insertValues.push(pool.query(
          "INSERT INTO leaderboard (name, score) VALUES ($1, $2)",
          [p.name || "Anonymous", p.score | 0]
        ));
      }
      await Promise.all(insertValues);

      // Fetch top 10 from DB
      const top = await pool.query(
        "SELECT name, score FROM leaderboard ORDER BY score DESC, created_at ASC LIMIT 10"
      );

      io.emit("matchOver", {
        leaderboardTop: top.rows,
        gridSize,
        wrapEdges
      });

      // Start a fresh match (keeps current gridSize and wrapEdges)
      startNewMatch();
      return;
    } catch (err) {
      console.error("DB error on match end:", err);
      // Even if DB fails, still start a new match
      io.emit("matchOver", { leaderboardTop: [], gridSize, wrapEdges });
      startNewMatch();
      return;
    }
  }

  // Update players
  for (const id in players) {
    const p = players[id];
    if (!p || !p.alive || p.spectator) continue;

    let head = { ...p.snake[0] };

    // Move head
    if (p.direction === "ArrowUp") head.y--;
    if (p.direction === "ArrowDown") head.y++;
    if (p.direction === "ArrowLeft") head.x--;
    if (p.direction === "ArrowRight") head.x++;

    // Wall handling: wrap or die
    if (wrapEdges) {
      if (head.x < 0) head.x = gridSize - 1;
      if (head.x >= gridSize) head.x = 0;
      if (head.y < 0) head.y = gridSize - 1;
      if (head.y >= gridSize) head.y = 0;
    } else {
      if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
        handleDeath(id);
        continue;
      }
    }

    // Self collision
    if (p.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      handleDeath(id);
      continue;
    }

    // Other players collision
    let collided = false;
    for (const otherId in players) {
      if (otherId === id) continue;
      const o = players[otherId];
      if (!o || !o.alive) continue;
      if (o.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
        collided = true;
        break;
      }
    }
    if (collided) {
      handleDeath(id);
      continue;
    }

    // Apply movement
    p.snake.unshift(head);

    // Food check
    if (head.x === food.x && head.y === food.y) {
      p.score++;
      food = randomFood();
    } else {
      p.snake.pop();
    }
  }

  // Broadcast state
  io.emit("state", {
    players,
    food,
    matchEndTime,
    gridSize,
    wrapEdges
  });
}, 200);

server.listen(3000, () => console.log("Server running on port 3000"));
