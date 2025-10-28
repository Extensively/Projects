const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gravity = 0.5;
let keys = {};
let cameraOffsetX = 0;

document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);

class Entity {
  constructor(x, y, w, h, color) {
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.color = color;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - cameraOffsetX, this.y, this.w, this.h);
  }
  update() {
    this.vy += gravity;
    this.x += this.vx;
    this.y += this.vy;
  }
}

class Platform {
  constructor(x, y, w, h) {
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.color = "#444";
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - cameraOffsetX, this.y, this.w, this.h);
  }
}

function generatePlatforms(startX = 0) {
  const platforms = [];
  for (let i = 0; i < 10; i++) {
    const x = startX + i * 80 + Math.random() * 40;
    const y = 500 - Math.random() * 200;
    platforms.push(new Platform(x, y, 80, 20));
  }
  return platforms;
}

const player = new Entity(100, 100, 30, 30, "#0f0");
const floor = new Platform(-10000, canvas.height - 40, 20000, 40); // wide floor
let platforms = [floor, ...generatePlatforms()];
let terrainEndX = 800;

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Movement
  player.vx = 0;
  if (keys["ArrowLeft"] || keys["KeyA"]) player.vx = -5;
  if (keys["ArrowRight"] || keys["KeyD"]) player.vx = 5;
  if ((keys["Space"] || keys["KeyW"]) && player.onGround) {
    player.vy = -12;
    player.onGround = false;
  }

  player.update();

  // Camera follows player
  cameraOffsetX = player.x - canvas.width / 2;

  // Collision
  player.onGround = false;
  for (let plat of platforms) {
    const isColliding =
      player.x < plat.x + plat.w &&
      player.x + player.w > plat.x &&
      player.y + player.h <= plat.y + 10 &&
      player.y + player.h + player.vy >= plat.y;

    if (isColliding) {
      player.vy = 0;
      player.y = plat.y - player.h;
      player.onGround = true;
    }

    plat.draw();
  }

  player.draw();

  // Expand terrain
  if (player.x + canvas.width > terrainEndX - 400) {
    const newPlatforms = generatePlatforms(terrainEndX);
    platforms.push(...newPlatforms);
    terrainEndX += 800;
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
