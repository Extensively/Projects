const scoreboard = document.getElementById("scoreboard");
const timerDiv = document.getElementById("timer");
const leaderboardDiv = document.getElementById("leaderboard");

socket.on("state", state => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw food
  ctx.fillStyle = "red";
  ctx.fillRect(state.food.x * tileSize, state.food.y * tileSize, tileSize, tileSize);

  // Draw snakes
  for (let id in state.players) {
    let p = state.players[id];
    if (!p.alive || p.spectator) continue;
    ctx.fillStyle = p.color;
    p.snake.forEach(seg => {
      ctx.fillRect(seg.x * tileSize, seg.y * tileSize, tileSize, tileSize);
    });
  }

  // Update scoreboard
  let scores = Object.values(state.players)
    .map(p => `<div style="color:${p.color}">${p.color}: ${p.score} (Lives: ${p.lives})</div>`)
    .join("");
  scoreboard.innerHTML = scores;

  // Update timer
  const timeLeft = Math.max(0, Math.floor((state.matchEndTime - Date.now()) / 1000));
  timerDiv.innerText = `Time left: ${timeLeft}s`;
});

// Show leaderboard after match
socket.on("matchOver", data => {
  leaderboardDiv.innerHTML = "<h3>Leaderboard</h3>" +
    data.leaderboard.map(l => `<div>${l.name}: ${l.score}</div>`).join("");
});
