const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gravity = 0.5;
let keys = {};
let cameraOffsetX = 0;

document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);
document.addEventListener("click", shootBullet);

// ======= Entity, Platform, Enemy, Loot =======
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
  // Added behavior param: "patrol", "jump", "shooter"
  constructor(x, y, type, behavior = "patrol") {
    this.x = x; this.y = y;
    this.w = 30; this.h = 30;
    this.type = type;
    this.behavior = behavior;
    this.color = type === "circle" ? "#e55" : "#ffdf55";
    // patrol moves left/right; shooter stands and fires periodically
    this.vx = behavior === "patrol" ? (Math.random() < 0.5 ? -1.5 : 1.5) : 0;
    this.vy = 0;
    this.hp = 3;
    this.jumpCooldown = 0;
    this.shootCooldown = Math.floor(Math.random() * 120) + 60;
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
    // Behavior: patrol (walk and reverse on platform edges), jump (periodic jump), shooter (fires)
    if (this.behavior === "jump") {
      if (this.jumpCooldown <= 0 && this.onGround) {
        this.vy = -8;
        this.jumpCooldown = 90 + Math.floor(Math.random() * 60);
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
        this.shootCooldown = 120 + Math.floor(Math.random() * 90);
      } else {
        this.shootCooldown--;
      }
    }

    // simple gravity and movement
    this.vy += gravity;
    this.x += this.vx;
    this.y += this.vy;
  }
}

class Loot {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.w = 20; this.h = 20;
    this.type = type; // 'tech' or 'gun'
    this.color = type === "tech" ? "#0ff" : "#f0f";
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - cameraOffsetX, this.y, this.w, this.h);
  }
}

// ======= Player, floor, world =======
const player = new Entity(100, 100, 30, 30, "#0f0");
const floor = new Platform(-10000, canvas.height - 40, 20000, 40); // wide floor
let platforms = [floor, ...generatePlatforms()];
let terrainEndX = 800;
let enemies = [];
let lootDrops = [];
let bullets = [];
let enemyBullets = [];

// ======= Weapons & Tech upgrades (editable) =======
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

// jump tracking for double jump
let jumpCount = 0;

// ======= Terrain generation & enemy spawning =======
function generatePlatforms(startX = 0) {
  const ret = [];
  for (let i = 0; i < 10; i++) {
    const x = startX + i * 80 + Math.random() * 40;
    const y = 420 - Math.random() * 200;
    ret.push(new Platform(x, y, 80, 20));
  }
  return ret;
}

function spawnEnemiesOn(platformArray) {
  for (let plat of platformArray) {
    if (Math.random() < 0.35) {
      const type = Math.random() < 0.5 ? "circle" : "triangle";
      const r = Math.random();
      const behavior = r < 0.55 ? "patrol" : (r < 0.8 ? "jump" : "shooter");
      const e = new Enemy(plat.x + 20 + Math.random() * 20, plat.y - 30, type, behavior);
      enemies.push(e);
    }
  }
}

// spawn initial enemies on initial platforms (excluding the floor)
spawnEnemiesOn(platforms.filter(p => p !== floor));

// ======= Shooting =======
function shootBullet() {
  const gun = weapons[equippedGun];
  if (!gun) return;
  // basic forward bullet; spread creates three bullets
  const originX = player.x + player.w / 2;
  const originY = player.y + player.h / 2;
  if (gun.spread) {
    bullets.push({ x: originX, y: originY, vx: gun.speed, w: 10, h: 4, color: gun.color, damage: gun.damage });
    bullets.push({ x: originX, y: originY, vx: gun.speed * 0.9, vy: -1.6, w: 10, h: 4, color: gun.color, damage: gun.damage });
    bullets.push({ x: originX, y: originY, vx: gun.speed * 0.9, vy: 1.6, w: 10, h: 4, color: gun.color, damage: gun.damage });
  } else {
    bullets.push({ x: originX, y: originY, vx: gun.speed, w: 10, h: 4, color: gun.color, damage: gun.damage });
  }
}

// weapon switching (Q cycles)
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyQ") {
    weaponIndex = (weaponIndex + 1) % weaponKeys.length;
    equippedGun = weaponKeys[weaponIndex];
  }
  // dash (if unlocked)
  if (e.code === "ShiftLeft" && techUpgrades.dash) {
    player.vx += (keys["ArrowRight"] || keys["KeyD"]) ? 8 : (keys["ArrowLeft"] || keys["KeyA"]) ? -8 : (player.vx > 0 ? 8 : -8);
  }
});

// ======= Game loop =======
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Player movement (A/D or Arrows), jumping supports double jump when unlocked
  player.vx = 0;
  if (keys["ArrowLeft"] || keys["KeyA"]) player.vx = -5;
  if (keys["ArrowRight"] || keys["KeyD"]) player.vx = 5;

  // Jump input: only trigger on keydown moment. We emulate "pressed" by checking key and small threshold.
  if ((keys["Space"] || keys["KeyW"]) && (player.onGround || (techUpgrades.doubleJump && jumpCount < 2))) {
    if (player.onGround) {
      player.vy = -12;
      player.onGround = false;
      jumpCount = 1;
    } else if (techUpgrades.doubleJump && jumpCount === 1) {
      player.vy = -11;
      jumpCount = 2;
    }
    // prevent holding jump from repeatedly triggering mid-air by clearing the key for a frame:
    keys["Space"] = false;
    keys["KeyW"] = false;
  }

  player.update();

  // Camera follows player
  cameraOffsetX = player.x - canvas.width / 2;

  // Collision with platforms (and detect ground state for enemies and player)
  player.onGround = false;
  // simple ground check and resolve
  for (let plat of platforms) {
    // player collision
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

  // Expand terrain when approaching end
  if (player.x + canvas.width > terrainEndX - 400) {
    const newPlatforms = generatePlatforms(terrainEndX);
    platforms.push(...newPlatforms);
    spawnEnemiesOn(newPlatforms);
    terrainEndX += 800;
  }

  // Enemies update/draw and simple platform-edge reversal for patrols
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    // gravity and simple ground detect (reusing platforms)
    e.onGround = false;
    for (let plat of platforms) {
      const touching = e.x < plat.x + plat.w &&
                       e.x + e.w > plat.x &&
                       e.y + e.h <= plat.y + 10 &&
                       e.y + e.h + e.vy >= plat.y;
      if (touching) {
        e.vy = 0;
        e.y = plat.y - e.h;
        e.onGround = true;
      }
    }

    // patrol reversal when no platform under next step
    if (e.behavior === "patrol") {
      const aheadX = e.x + (e.vx > 0 ? e.w + 6 : -6);
      // check if there's any platform under aheadX
      let hasGroundAhead = false;
      for (let plat of platforms) {
        if (aheadX > plat.x && aheadX < plat.x + plat.w && e.y + e.h <= plat.y + 12) {
          hasGroundAhead = true;
          break;
        }
      }
      // reverse if no ground ahead or random small chance to change direction
      if (!hasGroundAhead || Math.random() < 0.002) e.vx *= -1;
    }

    e.update();
    e.draw();

    // enemy collides with player bullets
    for (let b of bullets) {
      if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
        e.hp -= b.damage || 1;
        b.vx = 0; // mark for removal (stops moving)
      }
    }

    // enemy hit by player (optional): if enemy contacts player, push player back and reduce hp later

    // destroy and drop loot
    if (e.hp <= 0) {
      const dropType = Math.random() < 0.5 ? "tech" : "gun";
      lootDrops.push(new Loot(e.x, e.y, dropType));
      enemies.splice(i, 1);
    }
  }

  // Update bullets (player)
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy || 0;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - cameraOffsetX, b.y, b.w, b.h);
    // remove if off-screen or stopped
    if (b.x - cameraOffsetX > canvas.width + 200 || b.vx === 0) bullets.splice(i, 1);
  }

  // Update enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const eb = enemyBullets[i];
    eb.x += eb.vx;
    eb.y += eb.vy || 0;
    ctx.fillStyle = eb.color;
    ctx.fillRect(eb.x - cameraOffsetX, eb.y, eb.w, eb.h);
    // collision with player
    if (eb.x < player.x + player.w && eb.x + eb.w > player.x && eb.y < player.y + player.h && eb.y + eb.h > player.y) {
      // simple feedback: push player and remove bullet
      player.vx += (eb.vx > 0 ? 3 : -3);
      enemyBullets.splice(i, 1);
    } else if (eb.x - cameraOffsetX < -200 || eb.x - cameraOffsetX > canvas.width + 200) {
      enemyBullets.splice(i, 1);
    }
  }

  // Loot draw and pickup
  for (let i = lootDrops.length - 1; i >= 0; i--) {
    const l = lootDrops[i];
    l.draw();
    // pickup
    if (player.x < l.x + l.w && player.x + player.w > l.x && player.y < l.y + l.h && player.y + player.h > l.y) {
      if (l.type === "tech") {
        // choose an upgrade deterministically random-ish
        const keys = Object.keys(techUpgrades);
        const pick = keys[Math.floor(Math.random() * keys.length)];
        techUpgrades[pick] = true;
      } else if (l.type === "gun") {
        // give player a random weapon that's not basic
        const gunKeys = Object.keys(weapons);
        const pick = gunKeys[Math.floor(Math.random() * gunKeys.length)];
        equippedGun = pick;
        weaponIndex = weaponKeys.indexOf(pick);
      }
      lootDrops.splice(i, 1);
    }
  }

  // Draw player last so it's on top
  player.draw();

  // HUD: equipped weapon + techs (quick overlay)
  drawHUD();

  requestAnimationFrame(gameLoop);
}

function drawHUD() {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(8, 8, 220, 72);
  ctx.fillStyle = "#fff";
  ctx.font = "14px system-ui, Arial";
  ctx.fillText("Weapon: " + equippedGun, 16, 28);
  ctx.fillStyle = "#999";
  ctx.fillText("Press Q to cycle weapons", 16, 46);
  ctx.fillStyle = "#9f9";
  ctx.fillText("Techs: " + Object.keys(techUpgrades).filter(k => techUpgrades[k]).join(", ") || "none", 16, 64);
}

// start loop
gameLoop();
