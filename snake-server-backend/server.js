// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const gridSize = 20;
let players = {};
let food = randomFood();

function randomFood() {
  return {
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize)
  };
}

io.on("connection", socket => {
  console.log("Player connected:", socket.id);

  players[socket.id] = {
    snake: [{ x: 5, y: 5 }],
    direction: "ArrowRight",
    color: "#" + Math.floor(Math.random() * 16777215).toString(16),
    score: 0
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
setInterval(() => {
  for (let id in players) {
    let player = players[id];
    if (!player) continue;

    let head = { ...player.snake[0] };

    // Move head
    if (player.direction === "ArrowUp") head.y--;
    if (player.direction === "ArrowDown") head.y++;
    if (player.direction === "ArrowLeft") head.x--;
    if (player.direction === "ArrowRight") head.x++;

    // --- Collision checks ---

    // Wall collision
    if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
      delete players[id];
      continue;
    }

    // Self collision
    if (player.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      delete players[id];
      continue;
    }

    // Other player collision
    let collided = false;
    for (let otherId in players) {
      if (otherId !== id) {
        if (players[otherId].snake.some(seg => seg.x === head.x && seg.y === head.y)) {
          collided = true;
          break;
        }
      }
    }
    if (collided) {
      delete players[id];
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

  io.emit("state", { players, food });
}, 200);

server.listen(3000, () => console.log("Server running on port 3000"));
