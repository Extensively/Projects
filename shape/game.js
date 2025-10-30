/* game.js — full prototype with editable techs, health/lives, effects */

// ---------- Basic canvas / input / settings ----------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const seedDisplay = document.getElementById("seedDisplay");
const toggleSpawn = document.getElementById("toggleSpawn");
const toggleLoot = document.getElementById("toggleLoot");
const toggleBtn = document.getElementById("toggleSettings");
const settingsBody = document.getElementById("settingsBody");
const regenSeedBtn = document.getElementById("regenSeed");
const livesDisplay = document.getElementById("livesDisplay");

const gravity = 0.5;
let keys = {};
let cameraOffsetX = 0;
let shake = { intensity: 0, time: 0 };

toggleBtn.addEventListener("click", () => {
  const collapsed = settingsBody.classList.toggle("collapsed");
  toggleBtn.textContent = collapsed ? "Settings ▸" : "Settings ◂";
});
regenSeedBtn.addEventListener("click", () => { reseed(Math.floor(Math.random() * 1e9)); resetWorld(); });

// ---------- Seeded RNG (mulberry32) ----------
let seed = Math.floor(Math.random() * 1e9);
seedDisplay.textContent = seed;
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
let rng = mulberry32(seed);
function reseed(newSeed) { seed = newSeed | 0; rng = mulberry32(seed); seedDisplay.textContent = seed; }

// ---------- Global configs (move to JSON later) ----------
const GAME_CONFIG = {
  playerBaseMaxHp: 10,
  playerBaseLives: 3,
  playerInvulnFrames: 60,
  playerHpRegenPerSec: 0, // base regen; tech can increase
  respawnInvuln: 120,
  screenShakeIntensityOnHit: 6,
  particleCountOnHit: 12
};

const WEAPON_CONFIG = {
  basic: { speed: 8, color: "#fff", damage: 1, spread: false },
  laser: { speed: 12, color: "#0ff", damage: 2, spread: false },
  spread: { speed: 7, color: "#f0f", damage: 1, spread: true }
};

// Editable tech catalogue — easy to extend or extract into a JSON file later
const TECH_CATALOG = {
  hp_boost: {
    id: "hp_boost",
    name: "HP Boost",
    description: "Increase max HP by 4",
    apply(state) { state.player.maxHp += 4; state.player.hp += 4; },
    revert(state) { state.player.maxHp -= 4; if (state.player.hp > state.player.maxHp) state.player.hp = state.player.maxHp; }
  },
  regen_boost: {
    id: "regen_boost",
    name: "HP Regen",
    description: "Restore 1 HP every 2 seconds",
    apply(state) { state.player.regen += 0.5; }, // +0.5 per sec => 1 every 2s
    revert(state) { state.player.regen = Math.max(0, state.player.regen - 0.5); }
  },
  invuln_ext: {
    id: "invuln_ext",
    name: "Extended Invuln",
    description: "Increase invulnerability frames after hit",
    apply(state) { state.player.invulnFrames += 40; },
    revert(state) { state.player.invulnFrames = Math.max(0, state.player.invulnFrames - 40); }
  },
  damage_amp: {
    id: "damage_amp",
    name: "Damage Amp",
    description: "Increase player bullet damage multiplier",
    apply(state) { state.player.damageMult *= 1.5; },
    revert(state) { state.player.damageMult /= 1.5; }
  },
  extra_life: {
    id: "extra_life",
    name: "Extra Life",
    description: "Gain one extra life",
    apply(state) { state.player.lives += 1; },
    revert(state) { state.player.lives = Math.max(0, state.player.lives - 1); }
  }
};

// ---------- Runtime state (player and game) ----------
const state = {
  player: {
    x: 100, y: 100, w: 30, h: 30, vx: 0, vy: 0,
    baseColor: "#0f0", color: "#0f0",
    maxHp: GAME_CONFIG.playerBaseMaxHp,
    hp: GAME_CONFIG.playerBaseMaxHp,
    invuln: 0, invulnFrames: GAME_CONFIG.playerInvulnFrames,
    regen: GAME_CONFIG.playerHpRegenPerSec, // HP per second
    damageMult: 1,
    lives: GAME_CONFIG.playerBaseLives,
    checkpoint: { x: 100, y: 100 }
  },
  techs: {}, // applied tech IDs => true
  equippedGun: "basic",
  weaponKeys: Object.keys(WEAPON_CONFIG)
};

// particle pool for hits/explosion
const PARTICLE_POOL = [];
for (let i = 0; i < 120; i++) PARTICLE_POOL.push({ active: false });

// ---------- Input ----------
document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);
canvas.addEventListener("click", shootBullet);

// ---------- Entities: Platform, Enemy, Loot ----------

class Platform {
  constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; this.color = "#444"; }
  draw() { ctx.fillStyle = this.color; ctx.fillRect(this.x - cameraOffsetX, this.y, this.w, this.h); }
}

class Enemy {
  constructor(x, y, type, behavior = "patrol") {
    this.x = x; this.y = y; this.w = 30; this.h = 30;
    this.type = type; this.behavior = behavior;
    this.baseColor = type === "circle" ? "#e55" : "#ffdf55";
    this.color = this.baseColor;
    this.vx = behavior === "patrol" ? (rng() < 0.5 ? -1.5 : 1.5) : 0;
    this.vy = 0; this.maxHp = 6; this.hp = this.maxHp; this.onGround = false;
    this.jumpCooldown = Math.floor(rng() * 60);
    this.shootCooldown = Math.floor(rng() * 120) + 60;
    this.hitTimer = 0;
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
    // HP bar
    const barW = this.w, barH = 5;
    const barX = this.x - cameraOffsetX, barY = this.y - 8;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
    ctx.fillStyle = `rgba(255,60,60,0.95)`;
    ctx.fillRect(barX, barY, Math.floor(barW * pct), barH);
  }
  applyDamage(dmg, sourceVx = 0) {
    this.hp -= dmg;
    this.hitTimer = 12;
    this.color = "#fff";
    this.vx += (sourceVx || 0) * 0.6;
    spawnParticles(this.x + this.w/2, this.y + this.h/2, GAME_CONFIG.particleCountOnHit);
    shakeScreen(1.6);
  }
  update() {
    if (this.hitTimer > 0) { this.hitTimer--; if (this.hitTimer === 0) this.color = this.baseColor; }
    if (this.behavior === "jump") {
      if (this.jumpCooldown <= 0 && this.onGround) { this.vy = -8; this.jumpCooldown = 90 + Math.floor(rng() * 60); }
      if (this.jumpCooldown > 0) this.jumpCooldown--;
    }
    if (this.behavior === "shooter") {
      if (this.shootCooldown <= 0) {
        enemyBullets.push({ x: this.x + this.w/2, y: this.y + this.h/2, vx: (state.player.x < this.x) ? -4 : 4, w: 6, h: 6, color: "#f80", damage: 1 });
        this.shootCooldown = 120 + Math.floor(rng() * 90);
      } else this.shootCooldown--;
    }
    this.vy += gravity;
    this.x += this.vx;
    this.y += this.vy;
  }
}

class Loot {
  constructor(x, y, type) { this.x = x; this.y = y; this.w = 20; this.h = 20; this.type = type; this.color = type === "tech" ? "#0ff" : "#f0f"; }
  draw() { ctx.fillStyle = this.color; ctx.fillRect(this.x - cameraOffsetX, this.y, this.w, this.h); }
}

// ---------- World state ----------
const floor = new Platform(-10000, canvas.height - 40, 20000, 40);
let platforms = [];
let terrainEndX = 0;
let enemies = [];
let lootDrops = [];
let bullets = [];
let enemyBullets = [];

// ---------- Utility: particles, screen shake ----------
function spawnParticles(x, y, count) {
  for (let i = 0; i < PARTICLE_POOL.length && count > 0; i++) {
    const p = PARTICLE_POOL[i];
    if (!p.active) {
      p.active = true;
      p.x = x; p.y = y;
      const ang = rng() * Math.PI * 2;
      const spd = 1 + rng() * 3;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - 1;
      p.life = 20 + Math.floor(rng() * 20);
      p.color = `hsl(${Math.floor(rng() * 60)},80%,60%)`;
      count--;
    }
  }
}
function updateParticles() {
  for (let p of PARTICLE_POOL) {
    if (!p.active) continue;
    p.x += p.vx; p.y += p.vy; p.vy += 0.12;
    p.life--;
    if (p.life <= 0) { p.active = false; continue; }
    ctx.fillStyle = p.color; ctx.fillRect(p.x - cameraOffsetX, p.y, 2, 2);
  }
}
function shakeScreen(amount = 2, time = 12) { shake.intensity = Math.max(shake.intensity, amount); shake.time = Math.max(shake.time, time); }

// ---------- Player helpers: damage, respawn, apply tech ----------
function applyTech(techId) {
  if (!TECH_CATALOG[techId] || state.techs[techId]) return;
  TECH_CATALOG[techId].apply(state);
  state.techs[techId] = true;
  updateHUD();
}
function pickupRandomTech() {
  const keys = Object.keys(TECH_CATALOG);
  const pick = keys[Math.floor(rng() * keys.length)];
  applyTech(pick);
}

function damagePlayer(amount, sourceVx = 0) {
  if (state.player.invuln > 0) return;
  state.player.hp -= amount;
  state.player.invuln = state.player.invulnFrames;
  state.player.color = "#fff";
  state.player.vx += sourceVx > 0 ? 4 : -4;
  shakeScreen(GAME_CONFIG.screenShakeIntensityOnHit, 14);
  spawnParticles(state.player.x + state.player.w/2, state.player.y + state.player.h/2, 8);
  if (state.player.hp <= 0) handlePlayerDeath();
}
function handlePlayerDeath() {
  state.player.lives = Math.max(0, state.player.lives - 1);
  if (state.player.lives <= 0) {
    // full reset (could show game over screen)
    state.player.lives = GAME_CONFIG.playerBaseLives;
    // clear some world state
    reseed(Math.floor(Math.random() * 1e9));
  }
  // respawn at checkpoint
  state.player.hp = state.player.maxHp;
  state.player.x = state.player.checkpoint.x;
  state.player.y = state.player.checkpoint.y;
  state.player.vx = 0; state.player.vy = 0;
  state.player.invuln = GAME_CONFIG.respawnInvuln;
  updateHUD();
}

// ---------- Generate platforms & spawn enemies (seeded) ----------
function generatePlatforms(startX = 0) {
  const ret = [];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const x = startX + i * 96 + Math.floor(rng() * 48);
    const y = 380 + Math.floor(rng() * 180);
    ret.push(new Platform(x, y, 88, 18));
  }
  return ret;
}
function spawnEnemiesOn(platformArray, preferVisible = false) {
  if (!toggleSpawn.checked) return;
  for (let plat of platformArray) {
    if (plat === floor) continue;
    if (rng() < 0.45) {
      const type = rng() < 0.5 ? "circle" : "triangle";
      const r = rng(); const behavior = r < 0.55 ? "patrol" : (r < 0.8 ? "jump" : "shooter");
      const minX = plat.x + 12; const maxX = Math.max(minX + 8, plat.x + plat.w - 40);
      let ex = minX + Math.floor(rng() * Math.max(1, (maxX - minX)));
      if (preferVisible) {
        const visibleMin = Math.max(0, state.player.x - 80);
        const visibleMax = state.player.x + canvas.width + 80;
        if (ex < visibleMin) ex = Math.min(maxX, visibleMin + Math.floor(rng() * Math.min(200, visibleMax - visibleMin)));
        if (ex > visibleMax) ex = Math.max(minX, visibleMax - Math.floor(rng() * Math.min(200, visibleMax - visibleMin)));
      }
      enemies.push(new Enemy(ex, plat.y - 30, type, behavior));
    }
  }
}

// ---------- Reset world (deterministic per seed) ----------
function computeTerrainEnd() { let maxX = 0; for (let p of platforms) maxX = Math.max(maxX, p.x + p.w); return maxX; }
function resetWorld() {
  rng = mulberry32(seed);
  platforms = [floor];
  terrainEndX = 960;
  const initial = generatePlatforms(0);
  platforms.push(...initial);
  enemies = []; lootDrops = []; bullets = []; enemyBullets = [];
  spawnEnemiesOn(initial, true);
  state.player.x = state.player.checkpoint.x = 100;
  state.player.y = state.player.checkpoint.y = 100;
  state.player.vx = state.player.vy = 0;
  state.player.maxHp = GAME_CONFIG.playerBaseMaxHp;
  state.player.hp = state.player.maxHp;
  state.player.invuln = 0;
  state.player.invulnFrames = GAME_CONFIG.playerInvulnFrames;
  state.player.regen = GAME_CONFIG.playerHpRegenPerSec;
  state.player.damageMult = 1;
  state.player.lives = GAME_CONFIG.playerBaseLives;
  state.techs = {};
  // optionally give one starter tech for testing
  // applyTech("hp_boost");
  updateHUD();
}
reseed(seed);
resetWorld();

// ---------- Shooting & weapon switching ----------
function shootBullet() {
  const gun = WEAPON_CONFIG[state.equippedGun] || WEAPON_CONFIG.basic;
  const originX = state.player.x + state.player.w / 2;
  const originY = state.player.y + state.player.h / 2;
  const damage = Math.max(1, Math.round((gun.damage || 1) * state.player.damageMult));
  if (gun.spread) {
    bullets.push({ x: originX, y: originY, vx: gun.speed, vy: 0, w: 10, h: 4, color: gun.color, damage });
    bullets.push({ x: originX, y: originY, vx: gun.speed * 0.88, vy: -1.8, w: 10, h: 4, color: gun.color, damage });
    bullets.push({ x: originX, y: originY, vx: gun.speed * 0.88, vy: 1.8, w: 10, h: 4, color: gun.color, damage });
  } else {
    bullets.push({ x: originX, y: originY, vx: gun.speed, vy: 0, w: 10, h: 4, color: gun.color, damage });
  }
}
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyQ") {
    const keys = Object.keys(WEAPON_CONFIG);
    let idx = keys.indexOf(state.equippedGun);
    idx = (idx + 1) % keys.length;
    state.equippedGun = keys[idx];
  }
  if (e.code === "ShiftLeft" && state.techs["dash"]) {
    state.player.vx += (keys["ArrowRight"] || keys["KeyD"]) ? 8 : (keys["ArrowLeft"] || keys["KeyA"]) ? -8 : (state.player.vx > 0 ? 8 : -8);
  }
});

// ---------- HUD ----------
function updateHUD() { livesDisplay.textContent = state.player.lives; }
function drawHUD() {
  // HUD background
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(8, 8, 320, 96);
  ctx.fillStyle = "#fff";
  ctx.font = "14px system-ui, Arial";
  ctx.fillText("Weapon: " + state.equippedGun, 16, 28);
  ctx.fillStyle = "#999";
  ctx.fillText("Press Q to cycle weapons", 16, 46);
  ctx.fillStyle = "#9f9";
  const active = Object.keys(state.techs).join(", ") || "none";
  ctx.fillText("Techs: " + active, 16, 66);
  ctx.fillStyle = "#ccc";
  ctx.fillText("Seed: " + seed, 16, 86);

  // Player HP bar
  const barX = 16, barY = 110, barW = 180, barH = 12;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
  const pct = Math.max(0, state.player.hp / state.player.maxHp);
  ctx.fillStyle = "#e44";
  ctx.fillRect(barX, barY, Math.floor(barW * pct), barH);
  ctx.strokeStyle = "#000";
  ctx.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);
  ctx.fillStyle = "#fff";
  ctx.font = "12px system-ui, Arial";
  ctx.fillText(`HP: ${Math.floor(state.player.hp)}/${state.player.maxHp}`, barX + 6, barY + 10);
  ctx.fillText(`Lives: ${state.player.lives}`, barX + 120, barY + 10);

  // Debug: enemy count
  ctx.fillStyle = "#ffd";
  ctx.fillText("Enemies: " + enemies.length, 16, 140);
}

// ---------- Game loop ----------
function gameLoop() {
  // screen shake calc
  let shakeOffsetX = 0, shakeOffsetY = 0;
  if (shake.time > 0) {
    shake.time--;
    const s = shake.intensity * (shake.time / 20);
    shakeOffsetX = (Math.random() * 2 - 1) * s;
    shakeOffsetY = (Math.random() * 2 - 1) * s;
  } else { shake.intensity = 0; }

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(Math.floor(shakeOffsetX), Math.floor(shakeOffsetY));

  // Player movement
  state.player.vx = 0;
  if (keys["ArrowLeft"] || keys["KeyA"]) state.player.vx = -5;
  if (keys["ArrowRight"] || keys["KeyD"]) state.player.vx = 5;

  // Jump input (supports double jump if tech applied)
  if ((keys["Space"] || keys["KeyW"]) && (state.player.onGround || (state.techs["double_jump"] && state.player.jumpCount < 2))) {
    if (state.player.onGround) {
      state.player.vy = -12; state.player.onGround = false; state.player.jumpCount = 1;
    } else if (state.techs["double_jump"] && state.player.jumpCount === 1) {
      state.player.vy = -11; state.player.jumpCount = 2;
    }
    keys["Space"] = false; keys["KeyW"] = false;
  }

  // Integrate physics for player
  state.player.vy += gravity;
  state.player.x += state.player.vx;
  state.player.y += state.player.vy;

  // Camera follows player
  cameraOffsetX = state.player.x - canvas.width / 2;

  // Collision for player
  state.player.onGround = false;
  for (let plat of platforms) {
    const willCollide = state.player.x < plat.x + plat.w && state.player.x + state.player.w > plat.x &&
                        state.player.y + state.player.h <= plat.y + 10 && state.player.y + state.player.h + state.player.vy >= plat.y;
    if (willCollide) {
      state.player.vy = 0; state.player.y = plat.y - state.player.h; state.player.onGround = true; state.player.jumpCount = 0;
    }
    plat.draw();
  }

  // Expand terrain
  if (state.player.x + canvas.width > terrainEndX - 400) {
    const newP = generatePlatforms(terrainEndX);
    platforms.push(...newP);
    spawnEnemiesOn(newP);
    terrainEndX = computeTerrainEnd();
  }

  // Update enemies (platform collision for enemies included)
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.onGround = false;
    for (let plat of platforms) {
      const touching = e.x < plat.x + plat.w && e.x + e.w > plat.x &&
                       e.y + e.h <= plat.y + 12 && e.y + e.h + e.vy >= plat.y;
      if (touching) { e.vy = 0; e.y = plat.y - e.h; e.onGround = true; }
    }
    if (e.behavior === "patrol") {
      const aheadX = e.x + (e.vx > 0 ? e.w + 8 : -8);
      let hasGroundAhead = false;
      for (let plat of platforms) {
        if (aheadX > plat.x && aheadX < plat.x + plat.w && e.y + e.h <= plat.y + 12) { hasGroundAhead = true; break; }
      }
      if (!hasGroundAhead) e.vx *= -1;
    }
    e.update();
    // bullet collisions
    for (let b of bullets) {
      if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
        e.applyDamage(b.damage || 1, Math.sign(b.vx || 1));
        b.vx = 0;
      }
    }
    // player contact damage
    if (state.player.x < e.x + e.w && state.player.x + state.player.w > e.x && state.player.y < e.y + e.h && state.player.y + state.player.h > e.y) {
      damagePlayer(1, e.vx || 0);
      state.player.vy = -6;
    }
    e.draw();
    if (e.hp <= 0) {
      if (toggleLoot.checked) {
        const dropType = rng() < 0.5 ? "tech" : "gun";
        lootDrops.push(new Loot(e.x, e.y, dropType));
      }
      enemies.splice(i, 1);
    }
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx; b.y += b.vy || 0;
    ctx.fillStyle = b.color; ctx.fillRect(b.x - cameraOffsetX, b.y, b.w, b.h);
    if (b.x - cameraOffsetX > canvas.width + 200 || b.vx === 0) bullets.splice(i, 1);
  }

  // Enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const eb = enemyBullets[i];
    eb.x += eb.vx; eb.y += eb.vy || 0;
    ctx.fillStyle = eb.color; ctx.fillRect(eb.x - cameraOffsetX, eb.y, eb.w, eb.h);
    if (eb.x < state.player.x + state.player.w && eb.x + eb.w > state.player.x && eb.y < state.player.y + state.player.h && eb.y + eb.h > state.player.y) {
      damagePlayer(eb.damage || 1, eb.vx || 0); enemyBullets.splice(i, 1);
    } else if (eb.x - cameraOffsetX < -200 || eb.x - cameraOffsetX > canvas.width + 200) enemyBullets.splice(i, 1);
  }

  // Loot draw & pickup
  for (let i = lootDrops.length - 1; i >= 0; i--) {
    const l = lootDrops[i];
    l.draw();
    if (state.player.x < l.x + l.w && state.player.x + state.player.w > l.x && state.player.y < l.y + l.h && state.player.y + state.player.h > l.y) {
      if (l.type === "tech") {
        // pick a random tech (or make deterministic)
        const techKeys = Object.keys(TECH_CATALOG);
        const pick = techKeys[Math.floor(rng() * techKeys.length)];
        applyTech(pick);
      } else {
        // give a random weapon
        const gunKeys = Object.keys(WEAPON_CONFIG);
        const pick = gunKeys[Math.floor(rng() * gunKeys.length)];
        state.equippedGun = pick;
      }
      lootDrops.splice(i, 1);
    }
  }

  // Draw player (with invuln flash)
  // invuln ticking and regen
  if (state.player.invuln > 0) {
    state.player.invuln--;
    state.player.color = (Math.floor(state.player.invuln / 6) % 2 === 0) ? "#fff" : state.player.baseColor;
    if (state.player.invuln === 0) state.player.color = state.player.baseColor;
  }
  // HP regen
  if (state.player.regen > 0) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.regen * (1/60));
  }

  // Player draw
  ctx.fillStyle = state.player.color;
  ctx.fillRect(state.player.x - cameraOffsetX, state.player.y, state.player.w, state.player.h);

  // Particles
  updateParticles();

  // HUD & finish frame
  drawHUD();
  ctx.restore();

  requestAnimationFrame(gameLoop);
}

// ---------- Helpers ----------
function computeTerrainEnd() { let maxX = 0; for (let p of platforms) maxX = Math.max(maxX, p.x + p.w); return maxX; }

// --- Loot class (reuse) ---
class Loot {
  constructor(x, y, type) { this.x = x; this.y = y; this.w = 20; this.h = 20; this.type = type; this.color = type === "tech" ? "#0ff" : "#f0f"; }
  draw() { ctx.fillStyle = this.color; ctx.fillRect(this.x - cameraOffsetX, this.y, this.w, this.h); }
}

// ---------- Start ----------
updateHUD();
gameLoop();