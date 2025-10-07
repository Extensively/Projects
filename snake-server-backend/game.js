const socket = io("https://your-render-app.onrender.com");
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const gridSize = 20;
const tileSize = canvas.width / gridSize;

document.addEventListener("keydown", e => {
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
    socket.emit("move", e.key);
  }
});

socket.on("state", state => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw food
  ctx.fillStyle = "red";
  ctx.fillRect(state.food.x * tileSize, state.food.y * tileSize, tileSize, tileSize);

  // Draw players
  for (let id in state.players) {
    let p = state.players[id];
    ctx.fillStyle = p.color;
    p.snake.forEach(seg => {
      ctx.fillRect(seg.x * tileSize, seg.y * tileSize, tileSize, tileSize);
    });
  }
});
