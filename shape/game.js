const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gravity = 0.5;
let keys = {};
let cameraOffsetX = 0;

document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);
document.addEventListener("click", shootBullet);

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

class Enemy {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.w = 30; this.h = 30;
    this.type = type;
    this.color = type === "circle" ? "#f00" : "#ff0";
    this.vx = type === "circle" ? -1.5 : 1.5;
    this.vy = 0;
    this.hp = 3;
  }
  draw() {
    ctx.fillStyle = this.color;
    if (this.type === "circle") {
      ctx.beginPath();
      ctx.arc(this.x - cameraOffsetX + this.w/2, this.y + this.h/2, this.w/2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(this.x - cameraOffsetX, this.y + this.h);
      ctx.lineTo(this.x - cameraOffsetX + this.w / 2, this.y);
      ctx.lineTo(this.x - cameraOffsetX + this.w, this.y + this.h);
      ctx.closePath();
      ctx.fill();
    }
  }
  update() {
    this.x += this.vx;
    this.vy += gravity;
    this.y += this.vy;
  }
}

class Loot {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.w = 20; this.h = 20;
    this.type = type;
    this.color = type === "tech" ? "#0ff" : "#f0f";
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - cameraOffsetX, this.y, this.w, this.h);
  }
}

const player = new Entity(100, 100, 30, 30, "#0f0");
const floor = new Platform(-10000, canvas.height - 40, 20000, 40);
let platforms = [floor, ...generatePlatforms()];
let terrainEndX = 800;
let enemies = [];
let lootDrops = [];
let bullets = [];

function generatePlatforms(startX = 0) {
  const platforms = [];
  for (let i = 0; i < 10; i++) {
    const x = startX + i * 80 + Math.random() * 40;
    const y = 500 - Math.random() * 200;
    platforms.push(new Platform(x, y, 80, 20));
  }
  return platforms;
}

function spawnEnemies(platforms) {
  for (let plat of platforms) {
    if (Math.random() < 0.3) {
      enemies.push(new Enemy(plat.x + 20, plat.y - 30, Math.random() < 0.5 ? "circle" : "triangle"));
    }
  }
}

function shootBullet() {
  bullets.push({
    x: player.x + player.w / 2,
    y: player.y + player.h / 2,
    vx: 8,
    w: 10,
    h: 4,
    color: "#fff"
  });
}

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
    spawnEnemies(newPlatforms);
    terrainEndX += 800;
  }

  // Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.update();
    e.draw();

    for (let b of bullets) {
      if (b.x < e.x + e.w &&
          b.x + b.w > e.x &&
          b.y < e.y + e.h &&
          b.y + b.h > e.y) {
        e.hp -= 1;
        b.vx = 0;
      }
    }

    if (e.hp <= 0) {
      const type = Math.random() < 0.5 ? "tech" : "gun";
      lootDrops.push(new Loot(e.x, e.y, type));
      enemies.splice(i, 1);
    }
  }

  // Bullets
  for (let b of bullets) {
    b.x += b.vx;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - cameraOffsetX, b.y, b.w, b.h);
  }

  // Loot
  for (let loot of lootDrops) {
    loot.draw();
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
