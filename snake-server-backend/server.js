// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const gridSize = 20;
const MATCH_DURATION = 5 * 60 * 1000; // 5 minutes
const RESPAWN_DELAY = 3000; // 3 seconds
const STARTING_LIVES = 3;

const { Pool } = require("pg");

// Use environment variable for security
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create table if not exists
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id SERIAL PRIMARY KEY,
      name TEXT,
      score INT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
})();



let players = {};
let food = randomFood();
let leaderboard = []; // persists across matches
let matchEndTime = Date.now() + MATCH_DURATION;

function randomFood() {
  return {
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize)
  };
}

function startNewMatch() {
  players = {};
  food = randomFood();
  matchEndTime = Date.now() + MATCH_DURATION;
  io.emit("newMatch", { endTime: matchEndTime, leaderboard });
}

function respawnPlayer(id) {
  if (!players[id]) return;
  players[id].snake = [{
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize)
  }];
  players[id].direction = "ArrowRight";
  players[id].alive = true;
}

function handleDeath(id) {
  let player = players[id];
  if (!player) return;

  player.lives--;
  player.alive = false;

  if (player.lives > 0) {
    // Respawn after delay
    setTimeout(() => {
      if (players[id]) respawnPlayer(id);
    }, RESPAWN_DELAY);
  } else {
    // Out of lives → spectator
    player.spectator = true;
  }
}

io.on("connection", socket => {
  console.log("Player connected:", socket.id);

  players[socket.id] = {
    snake: [{ x: 5, y: 5 }],
    direction: "ArrowRight",
    color: "#" + Math.floor(Math.random() * 16777215).toString(16),
    score: 0,
    lives: STARTING_LIVES,
    alive: true,
    spectator: false
  };

  socket.on("move", dir => {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(dir)) {
      players[socket.id].direction = dir;
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

// Game loop
setInterval(async () => {
  // Check match timer
  if (Date.now() >= matchEndTime) {
    // Push scores to leaderboard
    for (let id in players) {
      let p = players[id];
      leaderboard.push({ name: p.color, score: p.score });
    }
    leaderboard.sort((a, b) => b.score - a.score);

    io.emit("matchOver", { leaderboard });
    if (Date.now() >= matchEndTime) {
  for (let id in players) {
    let p = players[id];
    await pool.query(
      "INSERT INTO leaderboard (name, score) VALUES ($1, $2)",
      [p.color, p.score]
    );
  }

  // Fetch top 10 scores
  const result = await pool.query(
    "SELECT name, score FROM leaderboard ORDER BY score DESC LIMIT 10"
  );

  io.emit("matchOver", { leaderboard: result.rows });
  startNewMatch();
  return;
}

    startNewMatch();
    return;
  }

  // Update each player
  for (let id in players) {
    let player = players[id];
    if (!player || !player.alive || player.spectator) continue;

    let head = { ...player.snake[0] };

    // Move head
    if (player.direction === "ArrowUp") head.y--;
    if (player.direction === "ArrowDown") head.y++;
    if (player.direction === "ArrowLeft") head.x--;
    if (player.direction === "ArrowRight") head.x++;

    // --- Collision checks ---
    // Wall
    if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
      handleDeath(id);
      continue;
    }

    // Self
    if (player.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      handleDeath(id);
      continue;
    }

    // Other players
    let collided = false;
    for (let otherId in players) {
      if (otherId !== id && players[otherId].alive) {
        if (players[otherId].snake.some(seg => seg.x === head.x && seg.y === head.y)) {
          collided = true;
          break;
        }
      }
    }
    if (collided) {
      handleDeath(id);
      continue;
    }

    // --- Update snake ---
    player.snake.unshift(head);

    // Food check
    if (head.x === food.x && head.y === food.y) {
      player.score++;
      food = randomFood();
    } else {
      player.snake.pop();
    }
  }

  io.emit("state", { players, food, matchEndTime });
}, 200);

server.listen(3000, () => console.log("Server running on port 3000"));
