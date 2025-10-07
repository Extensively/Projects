// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // allow GitHub Pages frontend
});

let players = {};
let food = { x: 10, y: 10 };
const gridSize = 20;

io.on("connection", socket => {
  console.log("Player connected:", socket.id);

  // Initialize player
  players[socket.id] = {
    snake: [{ x: 5, y: 5 }],
    direction: "ArrowRight",
    color: "#" + Math.floor(Math.random()*16777215).toString(16),
    score: 0
  };

  socket.on("move", dir => {
    players[socket.id].direction = dir;
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

// Game loop
setInterval(() => {
  for (let id in players) {
    let player = players[id];
    let head = { ...player.snake[0] };

    if (player.direction === "ArrowUp") head.y--;
    if (player.direction === "ArrowDown") head.y++;
    if (player.direction === "ArrowLeft") head.x--;
    if (player.direction === "ArrowRight") head.x++;

    player.snake.unshift(head);

    // Check food
    if (head.x === food.x && head.y === food.y) {
      player.score++;
      food = { 
        x: Math.floor(Math.random() * gridSize), 
        y: Math.floor(Math.random() * gridSize) 
      };
    } else {
      player.snake.pop();
    }
  }

  io.emit("state", { players, food });
}, 200);

server.listen(3000, () => console.log("Server running on port 3000"));
