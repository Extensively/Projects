/* shape-platformer — seeded terrain + fixed enemies + settings sidebar */

// Canvas & basic
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gravity = 0.5;
let keys = {};
let cameraOffsetX = 0;

// Settings controls
const seedDisplay = document.getElementById("seedDisplay");
const toggleSpawn = document.getElementById("toggleSpawn");
const toggleLoot = document.getElementById("toggleLoot");
const toggleBtn = document.getElementById("toggleSettings");
const settingsBody = document.getElementById("settingsBody");
const regenSeedBtn = document.getElementById("regenSeed");

toggleBtn.addEventListener("click", () => {
  const collapsed = settingsBody.classList.toggle("collapsed");
  toggleBtn.textContent = collapsed ? "Settings ▸" : "Settings ◂";
});

// ===== Seeded RNG (mulberry32) =====
let seed = Math.floor(Math.random() * 1e9);
seedDisplay.textContent = seed;
function mulberry32(a) {
  return function() {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
let rng = mulberry32(seed);
function reseed(newSeed) {
  seed = newSeed | 0;
  rng = mulberry32(seed);
  seedDisplay.textContent = seed;
}
regenSeedBtn.addEventListener("click", () => {
  reseed(Math.floor(Math.random() * 1e9));
  resetWorld();
});

// Input
document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);
canvas.addEventListener("click", shootBullet);

// ===== Entities =====
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
  constructor(x, y, type, behavior = "patrol") {
    this.x = x; this.y = y;
    this.w = 30; this.h = 30;
    this.type = type;
    this.behavior = behavior;
    this.color = type === "circle" ? "#e55" : "#ffdf55";
    this.vx = behavior === "patrol" ? (rng() < 0.5 ? -1.5 : 1.5) : 0;
    this.vy = 0;
    this.hp = 3;
    this.jumpCooldown = Math.floor(rng() * 60);
    this.shootCooldown = Math.floor(rng() * 120) + 60;
    this.onGround = false;
  }
  draw() {
    ctx.fillStyle = this.color;
    if (this.type === "circle") {
      ctx.beginPath();
      ctx.arc(this.x - cameraOffsetX + this.w/2, this.y + this.h/2, this.w/2, 0, Math.PI*2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(this.x - cameraOffsetX, this.y + this.h);
      ctx.lineTo(this.x - cameraOffsetX + this.w/2, this.y);
      ctx.lineTo(this.x - cameraOffsetX + this.w, this.y + this.h);
      ctx.closePath();
      ctx.fill();
    }
  }
  update() {
    if (this.behavior === "jump") {
      if (this.jumpCooldown <= 0 && this.onGround) {
        this.vy = -8;
        this.jumpCooldown = 90 + Math.floor(rng() * 60);
      }
      if (this.jumpCooldown > 0) this.jumpCooldown--;
    }
    if (this.behavior === "shooter") {
      if (this.shootCooldown <= 0) {
        enemyBullets.push({
          x: this.x + this.w/2,
          y: this.y + this.h/2,
          vx: (player.x < this.x) ? -4 : 4,
          w: 6, h: 6, color: "#f80"
        });
        this.shootCooldown = 120 + Math.floor(rng() * 90);
      } else this.shootCooldown--;
    }
    this.vy += gravity;
    this.x += this.vx;
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

// ===== World state =====
const player = new Entity(100, 100, 30, 30, "#0f0");
const floor = new Platform(-10000, canvas.height - 40, 20000, 40);
let platforms = [];
let terrainEndX = 0;
let enemies = [];
let lootDrops = [];
let bullets = [];
let enemyBullets = [];

// Weapons & tech (editable)
const weapons = {
  basic: { speed: 8, color: "#fff", damage: 1 },
  laser: { speed: 12, color: "#0ff", damage: 2 },
  spread: { speed: 7, color: "#f0f", damage: 1, spread: true }
};
const weaponKeys = Object.keys(weapons);
let weaponIndex = 0;
let equippedGun = weaponKeys[weaponIndex];

let techUpgrades = {
  doubleJump: false,
  dash: false,
  magnet: false
};
let jumpCount = 0;

// ===== Generation (seeded) =====
function generatePlatforms(startX = 0) {
  const ret = [];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const x = startX + i * 96 + Math.floor(rng() * 48); // more spacing
    const y = 380 + Math.floor(rng() * 180); // placed lower so enemies visible on screen
    ret.push(new Platform(x, y, 88, 18));
  }
  return ret;
}

function spawnEnemiesOn(platformArray) {
  if (!toggleSpawn.checked) return;
  for (let plat of platformArray) {
    // don't spawn on the floor
    if (plat === floor) continue;
    if (rng() < 0.45) {
      const type = rng() < 0.5 ? "circle" : "triangle";
      const r = rng();
      const behavior = r < 0.55 ? "patrol" : (r < 0.8 ? "jump" : "shooter");
      const e = new Enemy(plat.x + 16 + Math.floor(rng() * (plat.w - 32)), plat.y - 30, type, behavior);
      enemies.push(e);
    }
  }
}

// ===== Reset / seed application =====
function resetWorld() {
  platforms = [floor];
  terrainEndX = 800;
  const initial = generatePlatforms(0);
  platforms.push(...initial);
  enemies = [];
  lootDrops = [];
  bullets = [];
  enemyBullets = [];
  spawnEnemiesOn(initial);
  player.x = 100; player.y = 100; player.vx = 0; player.vy = 0;
}

reseed(seed);
resetWorld();

// ===== Shooting & weapon switching =====
function shootBullet() {
  const gun = weapons[equippedGun];
  if (!gun) return;
  const originX = player.x + player.w / 2;
  const originY = player.y + player.h / 2;
  if (gun.spread) {
    bullets.push({ x: originX, y: originY, vx: gun.speed, w: 10, h: 4, color: gun.color, damage: gun.damage });
    bullets.push({ x: originX, y: originY, vx: gun.speed * 0.88, vy: -1.8, w: 10, h: 4, color: gun.color, damage: gun.damage });
    bullets.push({ x: originX, y: originY, vx: gun.speed * 0.88, vy: 1.8, w: 10, h: 4, color: gun.color, damage: gun.damage });
  } else {
    bullets.push({ x: originX, y: originY, vx: gun.speed, w: 10, h: 4, color: gun.color, damage: gun.damage });
  }
}

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyQ") {
    weaponIndex = (weaponIndex + 1) % weaponKeys.length;
    equippedGun = weaponKeys[weaponIndex];
  }
  if (e.code === "ShiftLeft" && techUpgrades.dash) {
    player.vx += (keys["ArrowRight"] || keys["KeyD"]) ? 8 : (keys["ArrowLeft"] || keys["KeyA"]) ? -8 : (player.vx > 0 ? 8 : -8);
  }
});

// ===== Game Loop =====
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Player movement
  player.vx = 0;
  if (keys["ArrowLeft"] || keys["KeyA"]) player.vx = -5;
  if (keys["ArrowRight"] || keys["KeyD"]) player.vx = 5;

  // Jump logic (double jump support)
  if ((keys["Space"] || keys["KeyW"]) && (player.onGround || (techUpgrades.doubleJump && jumpCount < 2))) {
    if (player.onGround) {
      player.vy = -12;
      player.onGround = false;
      jumpCount = 1;
    } else if (techUpgrades.doubleJump && jumpCount === 1) {
      player.vy = -11;
      jumpCount = 2;
    }
    // consume jump input for a single frame to avoid repeat
    keys["Space"] = false; keys["KeyW"] = false;
  }

  player.update();
  cameraOffsetX = player.x - canvas.width / 2;

  // Collision for player
  player.onGround = false;
  for (let plat of platforms) {
    const willCollide = player.x < plat.x + plat.w &&
                        player.x + player.w > plat.x &&
                        player.y + player.h <= plat.y + 10 &&
                        player.y + player.h + player.vy >= plat.y;
    if (willCollide) {
      player.vy = 0;
      player.y = plat.y - player.h;
      player.onGround = true;
      jumpCount = 0;
    }
    plat.draw();
  }

  // Expand terrain deterministically using seeded rng (advance RNG by regenerating next platforms)
  if (player.x + canvas.width > terrainEndX - 400) {
    const newP = generatePlatforms(terrainEndX);
    platforms.push(...newP);
    spawnEnemiesOn(newP);
    terrainEndX += 960; // matches spacing in generatePlatforms
  }

  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.onGround = false;
    for (let plat of platforms) {
      const touching = e.x < plat.x + plat.w &&
                       e.x + e.w > plat.x &&
                       e.y + e.h <= plat.y + 12 &&
                       e.y + e.h + e.vy >= plat.y;
      if (touching) {
        e.vy = 0;
        e.y = plat.y - e.h;
        e.onGround = true;
      }
    }

    // Patrol edge detection
    if (e.behavior === "patrol") {
      const aheadX = e.x + (e.vx > 0 ? e.w + 8 : -8);
      let hasGroundAhead = false;
      for (let plat of platforms) {
        if (aheadX > plat.x && aheadX < plat.x + plat.w && e.y + e.h <= plat.y + 12) {
          hasGroundAhead = true;
          break;
        }
      }
      if (!hasGroundAhead) e.vx *= -1;
    }

    e.update();
    e.draw();

    // Collide with player bullets
    for (let b of bullets) {
      if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
        e.hp -= b.damage || 1;
        b.vx = 0;
      }
    }

    if (e.hp <= 0) {
      if (toggleLoot.checked) {
        const dropType = rng() < 0.5 ? "tech" : "gun";
        lootDrops.push(new Loot(e.x, e.y, dropType));
      }
      enemies.splice(i, 1);
    }
  }

  // Player bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy || 0;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - cameraOffsetX, b.y, b.w, b.h);
    if (b.x - cameraOffsetX > canvas.width + 200 || b.vx === 0) bullets.splice(i, 1);
  }

  // Enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const eb = enemyBullets[i];
    eb.x += eb.vx; eb.y += eb.vy || 0;
    ctx.fillStyle = eb.color;
    ctx.fillRect(eb.x - cameraOffsetX, eb.y, eb.w, eb.h);
    if (eb.x < player.x + player.w && eb.x + eb.w > player.x && eb.y < player.y + player.h && eb.y + eb.h > player.y) {
      player.vx += (eb.vx > 0 ? 3 : -3);
      enemyBullets.splice(i, 1);
    } else if (eb.x - cameraOffsetX < -200 || eb.x - cameraOffsetX > canvas.width + 200) {
      enemyBullets.splice(i, 1);
    }
  }

  // Loot draw & pickup
  for (let i = lootDrops.length - 1; i >= 0; i--) {
    const l = lootDrops[i];
    l.draw();
    if (player.x < l.x + l.w && player.x + player.w > l.x && player.y < l.y + l.h && player.y + player.h > l.y) {
      if (l.type === "tech") {
        const keys = Object.keys(techUpgrades);
        techUpgrades[keys[Math.floor(rng() * keys.length)]] = true;
      } else {
        const gunKeys = Object.keys(weapons);
        const pick = gunKeys[Math.floor(rng() * gunKeys.length)];
        equippedGun = pick;
        weaponIndex = weaponKeys.indexOf(pick);
      }
      lootDrops.splice(i, 1);
    }
  }

  // Draw player last
  player.draw();

  // HUD
  drawHUD();

  requestAnimationFrame(gameLoop);
}

function drawHUD() {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(8, 8, 260, 80);
  ctx.fillStyle = "#fff";
  ctx.font = "14px system-ui, Arial";
  ctx.fillText("Weapon: " + equippedGun, 16, 28);
  ctx.fillStyle = "#999";
  ctx.fillText("Press Q to cycle weapons", 16, 46);
  ctx.fillStyle = "#9f9";
  const active = Object.keys(techUpgrades).filter(k => techUpgrades[k]).join(", ") || "none";
  ctx.fillText("Techs: " + active, 16, 66);
  ctx.fillStyle = "#ccc";
  ctx.fillText("Seed: " + seed, 16, 86);
}

// world reset helper (used by regen)
function resetWorldAndKeepSeed() {
  rng = mulberry32(seed);
  resetWorld();
}
function resetWorld() {
  // reset RNG state for deterministic platform/enemy generation
  rng = mulberry32(seed);
  platforms = [floor];
  terrainEndX = 960;
  const initial = generatePlatforms(0);
  platforms.push(...initial);
  enemies = []; lootDrops = []; bullets = []; enemyBullets = [];
  spawnEnemiesOn(initial);
  player.x = 100; player.y = 100; player.vx = 0; player.vy = 0;
}

// Expose reseed in console for testing
window.reseedSession = (s) => { reseed(s); resetWorld(); };

// start
gameLoop();
