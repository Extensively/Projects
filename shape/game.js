function debugLog(message) {
    const debugDiv = document.getElementById('debugOutput');
    if (debugDiv) {
        debugDiv.innerHTML += message + '<br>';
    }
}

// Basic error checking
window.addEventListener('load', () => {
    debugLog('Window loaded');
    if (!canvas) {
        debugLog('ERROR: Canvas element not found');
        return;
    }
    
    if (!ctx) {
        debugLog('ERROR: Could not get canvas context');
        return;
    }

    // Test draw
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    debugLog('Initial canvas draw complete');
    
    // Initialize game
    init();  // Make sure you have this function defined
    requestAnimationFrame(run);  // Start the game loop
});

// ---------- Config / Physics ----------
const FIXED_HZ = 60;
const FIXED_DT = 1 / FIXED_HZ;
let lastFrameTimeMs = performance.now();
let deltaAccumulator = 0;
const MAX_ACCUM_SECONDS = 0.25;

const FPS_BASIS = 60;
const PLAYER_SPEED = 5 * FPS_BASIS;
const JUMP_SPEED = 12 * FPS_BASIS;
const GRAVITY = 0.5 * FPS_BASIS * FPS_BASIS;
const ENEMY_PATROL_SPEED = 1.5 * FPS_BASIS;
const BULLET_SPEED_SCALE = FPS_BASIS;
const shake = { intensity: 0, time: 0 };

// ---------- DOM / Settings ----------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const seedDisplay = document.getElementById("seedDisplay");
const toggleSpawn = document.getElementById("toggleSpawn");
const toggleLoot = document.getElementById("toggleLoot");
const toggleBtn = document.getElementById("toggleSettings");
const settingsBody = document.getElementById("settingsBody");
const regenSeedBtn = document.getElementById("regenSeed");
const livesDisplay = document.getElementById("livesDisplay");

// wall visual / collision thickness (px)
const WALL_THICKNESS = 40;

// new settings inputs (optional in index.html)
const expansionAmountInput = document.getElementById("expansionAmount");
const wallDistanceInput = document.getElementById("wallDistance");
const infiniteWallsCheckbox = document.getElementById("infiniteWalls");
const attackRateInput = document.getElementById("attackRateInput");

// generation tunables
const genChunkSizeInput = document.getElementById("gen_chunkSize");
const genSpacingXInput = document.getElementById("gen_spacingX");
const genPlatWidthInput = document.getElementById("gen_platWidth");
const genBaseYInput = document.getElementById("gen_baseY");
const genVarYInput = document.getElementById("gen_varY");
const genJitterXInput = document.getElementById("gen_jitterX");
const genClusterInput = document.getElementById("gen_cluster");

// door spawn chance input (already present if you added earlier)
const doorSpawnInput = document.getElementById("doorSpawnRate");

// new drop rate inputs (Tech / Gun)
const dropRateTechInput = document.getElementById("dropRateTech");
const dropRateGunInput = document.getElementById("dropRateGun");

// enemy spawn chance input
const enemySpawnRateInput = document.getElementById("enemySpawnRate");

// runtime params (use DOM values if present, else sensible defaults)
let GEN_CHUNK_SIZE = genChunkSizeInput ? Math.max(1, Number(genChunkSizeInput.value)) : 10;
let GEN_SPACING_X  = genSpacingXInput ? Math.max(32, Number(genSpacingXInput.value)) : 96;
let GEN_PLAT_W     = genPlatWidthInput ? Math.max(24, Number(genPlatWidthInput.value)) : 88;
let GEN_BASE_Y     = genBaseYInput ? Math.max(100, Number(genBaseYInput.value)) : 380;
let GEN_VAR_Y      = genVarYInput ? Math.max(0, Number(genVarYInput.value)) : 180;
let GEN_JITTER_X   = genJitterXInput ? Math.max(0, Number(genJitterXInput.value)) : 48;
let GEN_CLUSTER    = genClusterInput ? Math.min(1, Math.max(0, Number(genClusterInput.value))) : 0.0;

if (genChunkSizeInput) genChunkSizeInput.addEventListener("change", () => { GEN_CHUNK_SIZE = Math.max(1, Number(genChunkSizeInput.value)); });
if (genSpacingXInput)  genSpacingXInput.addEventListener("change", () => { GEN_SPACING_X = Math.max(1, Number(genSpacingXInput.value)); });
if (genPlatWidthInput) genPlatWidthInput.addEventListener("change", () => { GEN_PLAT_W = Math.max(1, Number(genPlatWidthInput.value)); });
if (genBaseYInput)     genBaseYInput.addEventListener("change", () => { GEN_BASE_Y = Math.max(0, Number(genBaseYInput.value)); });
if (genVarYInput)      genVarYInput.addEventListener("change", () => { GEN_VAR_Y = Math.max(0, Number(genVarYInput.value)); });
if (genJitterXInput)   genJitterXInput.addEventListener("change", () => { GEN_JITTER_X = Math.max(0, Number(genJitterXInput.value)); });
if (genClusterInput)   genClusterInput.addEventListener("change", () => { GEN_CLUSTER = Math.min(1, Math.max(0, Number(genClusterInput.value))); });

// door spawn chance
let DOOR_SPAWN_CHANCE = doorSpawnInput ? Math.max(0, Math.min(1, Number(doorSpawnInput.value))) : 0.12;
if (doorSpawnInput) doorSpawnInput.addEventListener("change", () => { DOOR_SPAWN_CHANCE = Math.max(0, Math.min(1, Number(doorSpawnInput.value))); });

// drop rates
let DROP_RATE_TECH = dropRateTechInput ? Math.min(1, Math.max(0, Number(dropRateTechInput.value))) : 0.12;
let DROP_RATE_GUN  = dropRateGunInput  ? Math.min(1, Math.max(0, Number(dropRateGunInput.value)))  : 0.12;
if (dropRateTechInput) dropRateTechInput.addEventListener("change", () => { DROP_RATE_TECH = Math.min(1, Math.max(0, Number(dropRateTechInput.value))); });
if (dropRateGunInput)  dropRateGunInput.addEventListener("change", () => { DROP_RATE_GUN  = Math.min(1, Math.max(0, Number(dropRateGunInput.value))); });

// enemy spawn rate (per platform)
let ENEMY_SPAWN_CHANCE = enemySpawnRateInput ? Math.min(1, Math.max(0, Number(enemySpawnRateInput.value))) : 0.45;
if (enemySpawnRateInput) enemySpawnRateInput.addEventListener("change", () => { ENEMY_SPAWN_CHANCE = Math.min(1, Math.max(0, Number(enemySpawnRateInput.value))); });

// defaults and runtime params
const SETTINGS_DEFAULTS = { WORLD_EXPANSION_CHUNKS: 10, WALL_DISTANCE: 3000, ENABLE_WALLS: true, PLAYER_ATTACK_RATE: 6 };

let WORLD_EXPANSION_CHUNKS = expansionAmountInput ? Math.max(1, Number(expansionAmountInput.value)) : SETTINGS_DEFAULTS.WORLD_EXPANSION_CHUNKS;
let WALL_DISTANCE = wallDistanceInput ? Math.max(200, Number(wallDistanceInput.value)) : SETTINGS_DEFAULTS.WALL_DISTANCE;
let ENABLE_WALLS = infiniteWallsCheckbox ? infiniteWallsCheckbox.checked : SETTINGS_DEFAULTS.ENABLE_WALLS;
let PLAYER_ATTACK_RATE = attackRateInput ? Math.max(0.1, Number(attackRateInput.value)) : SETTINGS_DEFAULTS.PLAYER_ATTACK_RATE;

debugLog('Game script loaded');

// bind inputs if present
if (expansionAmountInput) expansionAmountInput.addEventListener("change", () => { WORLD_EXPANSION_CHUNKS = Math.max(1, Number(expansionAmountInput.value)); });
if (wallDistanceInput) wallDistanceInput.addEventListener("change", () => { WALL_DISTANCE = Math.max(200, Number(wallDistanceInput.value)); updateWalls(); });
if (infiniteWallsCheckbox) infiniteWallsCheckbox.addEventListener("change", () => { ENABLE_WALLS = infiniteWallsCheckbox.checked; updateWalls(); });
if (attackRateInput) attackRateInput.addEventListener("change", () => { PLAYER_ATTACK_RATE = Math.max(0.1, Number(attackRateInput.value)); });

// small UI guards
if (toggleBtn && settingsBody) {
  toggleBtn.addEventListener("click", () => {
    const collapsed = settingsBody.classList.toggle("collapsed");
    toggleBtn.textContent = collapsed ? "Settings ▸" : "Settings ◂";
  });
}
if (regenSeedBtn) regenSeedBtn.addEventListener("click", () => { reseed(Math.floor(Math.random() * 1e9)); resetWorld(); });

const changelogBtn = document.getElementById("showChangelog");
const changelogDisplay = document.getElementById("changelogDisplay");

if (changelogBtn && changelogDisplay) {
  changelogBtn.addEventListener("click", () => {
    fetch("changelog.txt")
      .then(response => {
        if (!response.ok) throw new Error("Failed to load changelog");
        return response.text();
      })
      .then(text => {
        changelogDisplay.textContent = text;
      })
      .catch(err => {
        changelogDisplay.textContent = "Error loading changelog.";
      });
  });
}

// ---------- RNG ----------
let seed = Math.floor(Math.random() * 1e9);
if (seedDisplay) seedDisplay.textContent = seed;
function mulberry32(a) { return function() { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; } }
let rng = mulberry32(seed);
function reseed(newSeed) { seed = newSeed | 0; rng = mulberry32(seed); if (seedDisplay) seedDisplay.textContent = seed; }

// ---------- Game config / techs / weapons ----------
const GAME_CONFIG = { playerBaseMaxHp: 10, playerBaseLives: 3, playerInvulnSec: 1.0, playerHpRegenPerSec: 0, respawnInvulnSec: 2.0, screenShakeIntensityOnHit: 6, particleCountOnHit: 12 };
const WEAPON_CONFIG = { 
  basic:  { speed:  8, color: "#fff", damage: 1, spread: false, attackRate: 6.0,  dropWeight: 40 }, // common, moderate fire
  laser:  { speed: 12, color: "#0ff", damage: 2, spread: false, attackRate: 2.5,  dropWeight: 15 }, // stronger, slower
  spread: { speed:  7, color: "#f0f", damage: 1, spread: true,  attackRate: 3.0,  dropWeight: 10 }  // multi-shot, mid speed
};
const TECH_CATALOG = {
  hp_boost: { id: "hp_boost", name: "HP Boost", description: "Increase max HP by 4", apply(s){ s.player.maxHp +=4; s.player.hp +=4 }, revert(s){ s.player.maxHp -=4; if(s.player.hp>s.player.maxHp) s.player.hp=s.player.maxHp } },
  regen_boost: { id:"regen_boost", name:"HP Regen", description:"Restore 1 HP every 2s", apply(s){ s.player.regen += 0.5 }, revert(s){ s.player.regen = Math.max(0,s.player.regen-0.5) } },
  invuln_ext: { id:"invuln_ext", name:"Extended Invuln", description:"Increase invuln seconds", apply(s){ s.player.invulnSec = (s.player.invulnSec||GAME_CONFIG.playerInvulnSec)+0.66 }, revert(s){ s.player.invulnSec = Math.max(0.1, (s.player.invulnSec||GAME_CONFIG.playerInvulnSec)-0.66) } },
  damage_amp: { id:"damage_amp", name:"Damage Amp", description:"Increase damage", apply(s){ s.player.damageMult *= 1.5 }, revert(s){ s.player.damageMult /= 1.5 } },
  extra_life: { id:"extra_life", name:"Extra Life", description:"Gain one life", apply(s){ s.player.lives += 1 }, revert(s){ s.player.lives = Math.max(0, s.player.lives-1) } },
  double_jump: { id:"double_jump", name:"Double Jump", description:"Allows an extra jump in mid-air", apply(s){ s.player.jumpCount += 1 }, revert(s){ s.player.jumpCount = Math.max(0, s.player.jumpCount-1) } },
  dash: { id:"dash", name:"Dash", description:"Allows a quick dash in the direction you're facing", apply(s){ s.player.dash = true }, revert(s){ s.player.dash = false } }
};

// ---------- State ----------
const state = {
  player: { x:100, y:100, w:30, h:30, vx:0, vy:0, baseColor:"#0f0", color:"#0f0", maxHp:GAME_CONFIG.playerBaseMaxHp, hp:GAME_CONFIG.playerBaseMaxHp, invuln:0, invulnSec:GAME_CONFIG.playerInvulnSec, regen:GAME_CONFIG.playerHpRegenPerSec, damageMult:1, lives:GAME_CONFIG.playerBaseLives, checkpoint:{x:100,y:100}, jumpCount:0, lastShotTime:-999 },
  techs: {},
  // weapon ownership: map id => true when unlocked
  ownedGuns: { "basic": true }, // player starts with basic unlocked
  equippedGun: "basic",
  floor: 1
};
let cameraOffsetX = 0;

// ---------- Particle pool ----------
const PARTICLE_POOL = []; for (let i=0;i<120;i++) PARTICLE_POOL.push({ active:false });

// ---------- Input / mouse aim ----------
let keys = {};
document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);

let mouseX = 0, mouseY = 0, mouseDown = false;
if (canvas) {
  canvas.addEventListener("mousemove", e => { const r=canvas.getBoundingClientRect(); mouseX = e.clientX - r.left; mouseY = e.clientY - r.top; });
  canvas.addEventListener("mousedown", e => { mouseDown = true; shootBulletAtMouse(); });
  canvas.addEventListener("mouseup", () => mouseDown = false);
  canvas.addEventListener("touchstart", e => { const t = e.touches[0]; const r=canvas.getBoundingClientRect(); mouseX = t.clientX - r.left; mouseY = t.clientY - r.top; mouseDown = true; shootBulletAtMouse(); });
  canvas.addEventListener("touchmove", e => { const t = e.touches[0]; const r=canvas.getBoundingClientRect(); mouseX = t.clientX - r.left; mouseY = t.clientY - r.top; });
  canvas.addEventListener("touchend", () => mouseDown = false);
}

// compatibility wrapper
function shootBullet() { shootBulletAtMouse(); }

// ---------- Entities ----------
class Platform { constructor(x,y,w,h){this.x=x;this.y=y;this.w=w;this.h=h;this.color="#444"} draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x-cameraOffsetX,this.y,this.w,this.h) } }
class Enemy {
  constructor(x,y,type,behavior="patrol"){
    this.x=x;this.y=y;this.w=30;this.h=30;this.type=type;this.behavior=behavior;
    this.baseColor = type==="circle" ? "#e55" : "#ffdf55";
    this.color=this.baseColor; this.vx = behavior==="patrol" ? (rng()<0.5?-ENEMY_PATROL_SPEED:ENEMY_PATROL_SPEED) : 0;
    this.vy=0; this.maxHp=6; this.hp=this.maxHp; this.onGround=false;
    this.jumpCooldown = rng()*1.0; this.shootCooldown = rng()*2.0 + 1.0; this.hitTimer=0;
  }
  draw(){
    ctx.fillStyle=this.color;
    if(this.type==="circle"){ ctx.beginPath(); ctx.arc(this.x-cameraOffsetX+this.w/2,this.y+this.h/2,this.w/2,0,Math.PI*2); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(this.x-cameraOffsetX,this.y+this.h); ctx.lineTo(this.x-cameraOffsetX+this.w/2,this.y); ctx.lineTo(this.x-cameraOffsetX+this.w,this.y+this.h); ctx.closePath(); ctx.fill(); }
    const barW=this.w, barH=5, barX=this.x-cameraOffsetX, barY=this.y-8;
    ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(barX-1,barY-1,barW+2,barH+2);
    const pct = Math.max(0,Math.min(1,this.hp/this.maxHp));
    ctx.fillStyle="rgba(255,60,60,0.95)"; ctx.fillRect(barX,barY,Math.floor(barW*pct),barH);
  }
  applyDamage(dmg, sourceVx=0){
    this.hp -= dmg; this.hitTimer = 0.2; this.color="#fff"; this.vx += (sourceVx||0)*0.6;
    spawnParticles(this.x+this.w/2,this.y+this.h/2,GAME_CONFIG.particleCountOnHit); shakeScreen(1.6,0.2);
  }
  update(dt){
    if(this.hitTimer>0){ this.hitTimer = Math.max(0,this.hitTimer - dt); if(this.hitTimer===0) this.color=this.baseColor; }
    if(this.behavior==="jump"){
      if(this.jumpCooldown<=0 && this.onGround){ this.vy = -JUMP_SPEED * 0.66; this.jumpCooldown = 1.5 + rng()*1.0; }
      if(this.jumpCooldown>0) this.jumpCooldown = Math.max(0,this.jumpCooldown - dt);
    }
    if(this.behavior==="shooter"){
      if(this.shootCooldown<=0){
        const vx = (state.player.x < this.x) ? -4 * FPS_BASIS : 4 * FPS_BASIS;
        const vy = 0;
        enemyBullets.push({ x:this.x+this.w/2, y:this.y+this.h/2, vx, vy, w:6, h:6, color:"#f80", damage:1, angle:Math.atan2(vy,vx) });
        this.shootCooldown = 2.0 + rng()*1.5;
      } else this.shootCooldown = Math.max(0,this.shootCooldown - dt);
    }
    this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}

class Loot { constructor(x,y,type){ this.x=x;this.y=y;this.w=20;this.h=20;this.type=type;this.color = type==="tech" ? "#0ff" : "#f0f"; } draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x-cameraOffsetX,this.y,this.w,this.h) } }
class Door { constructor(x,y){ this.x=x; this.y=y; this.w=48; this.h=72; this.color="#66ffff"; this.outline="#006d6d"; } draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x-cameraOffsetX,this.y,this.w,this.h); ctx.strokeStyle=this.outline; ctx.lineWidth=2; ctx.strokeRect(this.x-cameraOffsetX+1,this.y+1,this.w-2,this.h-2); } }

// ---------- World state ----------
const floor = new Platform(-10000, canvas.height - 40, 20000, 40);
let platforms = [];
let worldLeftX = 0, worldRightX = 0, terrainEndX = 0;
let enemies = [], lootDrops = [], bullets = [], enemyBullets = [], doors = [];

// walls
let leftWallX = -SETTINGS_DEFAULTS.WALL_DISTANCE, rightWallX = SETTINGS_DEFAULTS.WALL_DISTANCE;
let leftWallHalf = Math.floor(WALL_THICKNESS/2), rightWallHalf = Math.floor(WALL_THICKNESS/2);
function updateWalls(){ leftWallX = ENABLE_WALLS ? -WALL_DISTANCE : -999999; rightWallX = ENABLE_WALLS ? WALL_DISTANCE : 999999; leftWallHalf = Math.floor(WALL_THICKNESS/2); rightWallHalf = Math.floor(WALL_THICKNESS/2); }
updateWalls();

// ---------- Particles / shake ----------
function spawnParticles(x,y,count){
  for(let i=0;i<PARTICLE_POOL.length && count>0;i++){
    const p = PARTICLE_POOL[i];
    if(!p.active){ p.active=true; p.x=x; p.y=y; const ang=rng()*Math.PI*2; const spd=40 + rng()*80; p.vx=Math.cos(ang)*spd; p.vy=Math.sin(ang)*spd - 60; p.life = 0.2 + rng()*0.6; p.color = `hsl(${Math.floor(rng()*60)},80%,60%)`; count--; }
  }
}
function updateParticles(dt){
  for (let p of PARTICLE_POOL){
    if(!p.active) continue;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.life -= dt;
    if(p.life <= 0) { p.active = false; continue; }
    ctx.fillStyle = p.color; ctx.fillRect(p.x - cameraOffsetX, p.y, 2, 2);
  }
}
function shakeScreen(amount=2, time=0.18){ shake.intensity = Math.max(shake.intensity, amount); shake.time = Math.max(shake.time, time); }

// ---------- Player helpers ----------
function applyTech(techId){ if(!TECH_CATALOG[techId] || state.techs[techId]) return; TECH_CATALOG[techId].apply(state); state.techs[techId]=true; updateHUD(); }
function pickupRandomTech(){ const ks = Object.keys(TECH_CATALOG); applyTech( ks[Math.floor(rng()*ks.length)] ); }

function damagePlayer(amount, sourceVx=0){
  if(state.player.invuln>0) return;
  state.player.hp -= amount;
  state.player.invuln = state.player.invulnSec || GAME_CONFIG.playerInvulnSec;
  state.player.color = "#fff";
  state.player.vx += sourceVx>0 ? 200 : -200;
  shakeScreen(GAME_CONFIG.screenShakeIntensityOnHit, 0.25);
  spawnParticles(state.player.x + state.player.w/2, state.player.y + state.player.h/2, 8);
  if(state.player.hp <= 0) handlePlayerDeath();
}
function handlePlayerDeath(){
  state.player.lives = Math.max(0, state.player.lives - 1);
  if(state.player.lives <= 0){ state.player.lives = GAME_CONFIG.playerBaseLives; reseed(Math.floor(Math.random()*1e9)); }
  state.player.hp = state.player.maxHp; state.player.x = state.player.checkpoint.x; state.player.y = state.player.checkpoint.y; state.player.vx = 0; state.player.vy = 0; state.player.invuln = GAME_CONFIG.respawnInvulnSec; updateHUD();
}

// ---------- Generation ----------
function generatePlatforms(startX = 0, count = GEN_CHUNK_SIZE){
  const ret = [];
  for(let i=0;i<count;i++){ const baseSpacing = GEN_SPACING_X; const jitter = Math.floor((rng()*2-1)*GEN_JITTER_X); let x = startX + i*baseSpacing + jitter;
    if(GEN_CLUSTER>0 && rng()<GEN_CLUSTER) x = (i>0)? (ret[i-1].x + Math.floor(rng()*(baseSpacing/2))) : x;
    const y = GEN_BASE_Y + Math.floor(rng()*GEN_VAR_Y); const w = GEN_PLAT_W;
    ret.push(new Platform(x,y,w,18));
  }
  return ret;
}

function spawnEnemiesOn(platformArray, preferVisible=false){
  if(!toggleSpawn || !toggleSpawn.checked) return;
  for(let plat of platformArray){
    if(plat===floor) continue;
    if(rng() < ENEMY_SPAWN_CHANCE){
      const type = rng() < 0.5 ? "circle" : "triangle";
      const r = rng(); const behavior = r < 0.55 ? "patrol" : (r < 0.8 ? "jump" : "shooter");
      const minX = plat.x + 12; const maxX = Math.max(minX+8, plat.x + plat.w - 40);
      let ex = minX + Math.floor(rng()*Math.max(1,(maxX-minX)));
      if(preferVisible){
        const visibleMin = Math.max(0, state.player.x - 80);
        const visibleMax = state.player.x + canvas.width + 80;
        if(ex < visibleMin) ex = Math.min(maxX, visibleMin + Math.floor(rng()*Math.min(200, visibleMax-visibleMin)));
        if(ex > visibleMax) ex = Math.max(minX, visibleMax - Math.floor(rng()*Math.min(200, visibleMax-visibleMin)));
      }
      enemies.push(new Enemy(ex, plat.y - 30, type, behavior));
    }
  }
}
function spawnDoorsOn(platformArray, guarantee=false){
  for(let plat of platformArray){
    if (rng() < DOOR_SPAWN_CHANCE || (guarantee && doors.length === 0)) {
      const dx = plat.x + Math.floor(plat.w/2) - 24 + Math.floor(rng()*40 - 20);
      const dy = plat.y - 72;
      doors.push(new Door(dx, dy));
    }
  }
}

// ---------- Reset world ----------
function computeTerrainEnd(){ let maxX=0; for(let p of platforms) maxX = Math.max(maxX, p.x + p.w); return maxX; }
function resetWorld(){
  rng = mulberry32(seed);
  platforms = [floor];
  const initial = generatePlatforms(0, WORLD_EXPANSION_CHUNKS);
  platforms.push(...initial);
  enemies = []; lootDrops = []; bullets = []; enemyBullets = []; doors = [];
  worldLeftX = initial[0].x - 400;
  worldRightX = initial[initial.length-1].x + 400;
  terrainEndX = computeTerrainEnd();
  updateWalls();
  spawnEnemiesOn(initial, true);
  spawnDoorsOn(initial, false);
  if (ENABLE_WALLS) {
    const leftDoorX = leftWallX + leftWallHalf + 8;
    const leftDoorY = canvas.height - 40 - 72 - 8;
    doors.push(new Door(leftDoorX, leftDoorY));
    const rightDoorX = rightWallX - rightWallHalf - 48 - 8;
    const rightDoorY = canvas.height - 40 - 72 - 8;
    doors.push(new Door(rightDoorX, rightDoorY));
  }
  state.player.x = state.player.checkpoint.x = 100; state.player.y = state.player.checkpoint.y = 100; state.player.vx = state.player.vy = 0;
  state.player.maxHp = GAME_CONFIG.playerBaseMaxHp; state.player.hp = state.player.maxHp; state.player.invuln = 0; state.player.invulnSec = GAME_CONFIG.playerInvulnSec; state.player.regen = GAME_CONFIG.playerHpRegenPerSec; state.player.damageMult = 1; state.player.lives = GAME_CONFIG.playerBaseLives; /* keep state.ownedGuns persistent */ state.techs = {};
  // ensure an equipped gun if none
  if (!state.equippedGun) {
    const owned = Object.keys(state.ownedGuns).filter(k => state.ownedGuns[k]);
    state.equippedGun = owned.length ? owned[0] : null;
  }
  updateHUD();
}
reseed(seed); resetWorld();

// ---------- Attack rate handling ----------
// enforce global cap AND per-weapon rate (effective rate = min(global, weapon.attackRate))
function canFireNow() {
  const now = performance.now() / 1000;
  const weaponId = state.equippedGun;
  const weapon = (weaponId && WEAPON_CONFIG[weaponId]) ? WEAPON_CONFIG[weaponId] : WEAPON_CONFIG.basic;
  const perWeaponRate = (weapon && weapon.attackRate) ? Number(weapon.attackRate) : PLAYER_ATTACK_RATE;
  const effectiveRate = Math.min(PLAYER_ATTACK_RATE, perWeaponRate);
  const minDelay = 1 / effectiveRate;
  return (now - (state.player.lastShotTime || -999)) >= minDelay;
}
function noteShotFired(){ state.player.lastShotTime = performance.now()/1000; }
function handleAutoFire(){ if(mouseDown && canFireNow()){ shootBulletAtMouse(); noteShotFired(); } }

// ---------- Shooting ----------
function shootBulletAtMouse(){
  if(!canFireNow()) return;
  if(!state.equippedGun) return;
  const gun = WEAPON_CONFIG[state.equippedGun];
  if(!gun) return;
  const originX = state.player.x + state.player.w/2; const originY = state.player.y + state.player.h/2;
  const worldMouseX = mouseX + cameraOffsetX; const worldMouseY = mouseY;
  let dx = worldMouseX - originX; let dy = worldMouseY - originY; const dist = Math.hypot(dx,dy)||1; dx/=dist; dy/=dist;
  const baseSpeed = (gun.speed||8) * BULLET_SPEED_SCALE; const damage = Math.max(1, Math.round((gun.damage||1)*state.player.damageMult));
  function pushBulletWithAngle(angleOffset, speedMultiplier=1){
    const cos = Math.cos(angleOffset), sin = Math.sin(angleOffset);
    const rx = dx * cos - dy * sin, ry = dx * sin + dy * cos;
    const vx = rx * baseSpeed * speedMultiplier, vy = ry * baseSpeed * speedMultiplier;
    bullets.push({ x: originX + rx*(state.player.w/2+4), y: originY + ry*(state.player.h/2+4), vx, vy, w:8, h:4, color: gun.color, damage, angle: Math.atan2(vy, vx) });
  }
  if(gun.spread){ const spreadAngle = 10 * (Math.PI/180); pushBulletWithAngle(-spreadAngle); pushBulletWithAngle(0); pushBulletWithAngle(spreadAngle); }
  else pushBulletWithAngle(0);
  noteShotFired();
}

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyQ") {
    const owned = Object.keys(state.ownedGuns).filter(k => state.ownedGuns[k]);
    if (owned.length === 0) return;
    let idx = owned.indexOf(state.equippedGun);
    idx = (idx + 1) % owned.length;
    state.equippedGun = owned[idx];
  }
  if (e.code === "ShiftLeft" && state.techs["dash"]) {
    state.player.vx += (keys["ArrowRight"] || keys["KeyD"]) ? 8 * FPS_BASIS : (keys["ArrowLeft"] || keys["KeyA"]) ? -8 * FPS_BASIS : (state.player.vx > 0 ? 8 * FPS_BASIS : -8 * FPS_BASIS);
  }
});

// ---------- HUD ----------
function updateHUD(){ if(livesDisplay) livesDisplay.textContent = state.player.lives; }
function drawHUD(){
  // left HUD (existing)
  ctx.fillStyle="rgba(0,0,0,0.45)"; ctx.fillRect(8,8,360,132);
  ctx.fillStyle="#fff"; ctx.font="14px system-ui, Arial"; ctx.fillText("Weapon: " + (state.equippedGun || "none"), 16, 28);
  ctx.fillStyle="#999"; ctx.fillText("Press Q to cycle weapons", 16, 46);
  ctx.fillStyle="#9f9"; ctx.fillText("Techs: " + (Object.keys(state.techs).join(", ") || "none"), 16, 66);
  ctx.fillStyle="#ccc"; ctx.fillText("Seed: " + seed, 16, 86);
  ctx.fillStyle="#9cf"; ctx.fillText("Floor: " + (state.floor||1), 16, 106);
  ctx.fillStyle = "#cff";
  ctx.fillText(`Plat: size=${GEN_CHUNK_SIZE} spacing=${GEN_SPACING_X} width=${GEN_PLAT_W}`, 16, 170);
  ctx.fillText(`Height: base=${GEN_BASE_Y} var=${GEN_VAR_Y} cluster=${GEN_CLUSTER}`, 16, 186);

  // HP bar
  const barX=16, barY=120, barW=220, barH=12;
  ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(barX-2,barY-2,barW+4,barH+4);
  const pct = Math.max(0, state.player.hp / state.player.maxHp);
  ctx.fillStyle="#e44"; ctx.fillRect(barX,barY,Math.floor(barW*pct),barH);
  ctx.strokeStyle="#000"; ctx.strokeRect(barX-2,barY-2,barW+4,barH+4);
  ctx.fillStyle="#fff"; ctx.font="12px system-ui, Arial"; ctx.fillText(`HP: ${Math.floor(state.player.hp)}/${state.player.maxHp}`, barX+6, barY+10);
  ctx.fillText(`Lives: ${state.player.lives}`, barX+160, barY+10);
  ctx.fillStyle="#ffd"; ctx.fillText("Enemies: " + enemies.length, 16, 144);

  // Top-right: owned guns HUD
  const padding = 8;
  const iconSize = 12;
  const startX = canvas.width - padding;
  let y = padding + 6;
  ctx.textAlign = "right";
  ctx.font = "13px system-ui, Arial";
  ctx.fillStyle = "#fff";
  ctx.fillText("Guns", startX, y);
  y += 16;
  ctx.font = "11px system-ui, Arial";
  const ownedList = Object.keys(WEAPON_CONFIG);
  for (let gid of ownedList) {
    const unlocked = !!state.ownedGuns[gid];
    const color = unlocked ? WEAPON_CONFIG[gid].color : "rgba(255,255,255,0.18)";
    // swatch
    ctx.fillStyle = color;
    ctx.fillRect(startX - 12, y - iconSize + 2, iconSize, iconSize);
    // label (highlight equipped)
    ctx.fillStyle = (state.equippedGun === gid) ? "#ffd" : (unlocked ? "#fff" : "#888");
    ctx.fillText(gid, startX - 18, y + 2);
    y += 18;
  }
  ctx.textAlign = "start";
}

// ---------- Physics update ----------
function updatePhysics(dt){
  if(shake.time>0) { shake.time = Math.max(0, shake.time - dt); } else { shake.intensity = 0; }

  // player input
  state.player.vx = 0;
  if(keys["ArrowLeft"]||keys["KeyA"]) state.player.vx = -PLAYER_SPEED;
  if(keys["ArrowRight"]||keys["KeyD"]) state.player.vx = PLAYER_SPEED;

  // jump
  if((keys["Space"]||keys["KeyW"]) && (state.player.onGround || (state.techs["double_jump"] && state.player.jumpCount < 2))){
    if(state.player.onGround){ state.player.vy = -JUMP_SPEED; state.player.onGround=false; state.player.jumpCount=1; }
    else if(state.techs["double_jump"] && state.player.jumpCount===1){ state.player.vy = -JUMP_SPEED*0.92; state.player.jumpCount=2; }
    keys["Space"]=false; keys["KeyW"]=false;
  }

  state.player.vy += GRAVITY * dt;
  state.player.x += state.player.vx * dt;
  state.player.y += state.player.vy * dt;

  cameraOffsetX = state.player.x - canvas.width / 2;

  // Wall collision
  if (ENABLE_WALLS) {
    const leftWallRightX = leftWallX + leftWallHalf;
    if (state.player.x < leftWallRightX) { state.player.x = leftWallRightX; if (state.player.vx < 0) state.player.vx = 0; }
    const rightWallLeftX = rightWallX - rightWallHalf;
    if (state.player.x + state.player.w > rightWallLeftX) { state.player.x = rightWallLeftX - state.player.w; if (state.player.vx > 0) state.player.vx = 0; }
  }

  // collisions with platforms
  state.player.onGround = false;
  for(let plat of platforms){
    const will = state.player.x < plat.x + plat.w && state.player.x + state.player.w > plat.x && state.player.y + state.player.h <= plat.y + 10 && state.player.y + state.player.h + state.player.vy * dt >= plat.y;
    if(will){ state.player.vy = 0; state.player.y = plat.y - state.player.h; state.player.onGround = true; state.player.jumpCount = 0; }
  }

  // expand right / left
  const EXPAND_THRESHOLD = 400;
  if(state.player.x + canvas.width > worldRightX - EXPAND_THRESHOLD){
    const newStart = worldRightX + 16;
    const newP = generatePlatforms(newStart, WORLD_EXPANSION_CHUNKS);
    platforms.push(...newP);
    spawnEnemiesOn(newP);
    spawnDoorsOn(newP,false);
    worldRightX = computeTerrainEnd();
  }
  if(state.player.x < worldLeftX + EXPAND_THRESHOLD){
    const startX = worldLeftX - (WORLD_EXPANSION_CHUNKS * 96);
    const newP = generatePlatforms(startX, WORLD_EXPANSION_CHUNKS);
    platforms.push(...newP);
    spawnEnemiesOn(newP);
    spawnDoorsOn(newP,false);
    worldLeftX = Math.min(...platforms.map(p=>p.x));
  }

  // enemies
  for(let i=enemies.length-1;i>=0;i--){
    const e = enemies[i]; e.onGround = false;
    for(let plat of platforms){ const touching = e.x < plat.x + plat.w && e.x + e.w > plat.x && e.y + e.h <= plat.y + 12 && e.y + e.h + e.vy * dt >= plat.y; if(touching){ e.vy=0; e.y = plat.y - e.h; e.onGround = true; } }
    if(e.behavior==="patrol"){ const aheadX = e.x + (e.vx>0 ? e.w + 8 : -8); let has=false; for(let plat of platforms){ if(aheadX > plat.x && aheadX < plat.x + plat.w && e.y + e.h <= plat.y + 12){ has=true; break; } } if(!has) e.vx *= -1; }
    e.update(dt);
    for(let b of bullets) if(b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y){ e.applyDamage(b.damage || 1, Math.sign(b.vx || 1)); b.vx = 0; b.vy = 0; }
    if(state.player.x < e.x + e.w && state.player.x + state.player.w > e.x && state.player.y < e.y + e.h && state.player.y + state.player.h > e.y){ damagePlayer(1, e.vx || 0); state.player.vy = -JUMP_SPEED * 0.5; }
    if(e.hp <= 0){
      if(toggleLoot && toggleLoot.checked) {
        // tech drop
        if (rng() < DROP_RATE_TECH) lootDrops.push(new Loot(e.x, e.y, "tech"));
        // gun drop: prefer unowned guns
        // gun drop: choose weapon by weight, prefer unowned weapons
      if (rng() < DROP_RATE_GUN) {
        const gunKeys = Object.keys(WEAPON_CONFIG);
        // prefer unowned guns if any
        const unowned = gunKeys.filter(k => !state.ownedGuns[k]);
        let candidateKeys = unowned.length > 0 ? unowned : gunKeys;

        // build cumulative weights
        const weights = candidateKeys.map(k => (WEAPON_CONFIG[k].dropWeight || 1));
        const total = weights.reduce((s, w) => s + w, 0);
        let r = rng() * total;
        let chosen = candidateKeys[0];
        for (let i = 0; i < candidateKeys.length; i++) {
          r -= weights[i];
          if (r <= 0) { chosen = candidateKeys[i]; break; }
        }
        lootDrops.push(new Loot(e.x, e.y, "gun_" + chosen));
      }

      }
      enemies.splice(i,1);
    }
  }

  // bullets
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.angle = Math.atan2(b.vy||0,b.vx||0);
    if (ENABLE_WALLS) {
      const bWorldX = b.x;
      const lwRight = leftWallX + leftWallHalf;
      const rwLeft = rightWallX - rightWallHalf;
      if (bWorldX < lwRight || bWorldX > rwLeft) { bullets.splice(i,1); continue; }
    }
    if(b.x - cameraOffsetX > canvas.width + 200 || (Math.abs(b.vx) < 1 && Math.abs(b.vy||0) < 1)) bullets.splice(i,1);
  }
  for(let i=enemyBullets.length-1;i>=0;i--){
    const eb = enemyBullets[i]; eb.x += eb.vx * dt; eb.y += eb.vy * dt; eb.angle = Math.atan2(eb.vy||0, eb.vx||0);
    if(eb.x < state.player.x + state.player.w && eb.x + eb.w > state.player.x && eb.y < state.player.y + state.player.h && eb.y + eb.h > state.player.y){ damagePlayer(eb.damage||1, eb.vx||0); enemyBullets.splice(i,1); }
    else {
      if (ENABLE_WALLS) {
        const lwRight = leftWallX + leftWallHalf;
        const rwLeft = rightWallX - rightWallHalf;
        if (eb.x < lwRight || eb.x > rwLeft) { enemyBullets.splice(i,1); continue; }
      }
      if(eb.x - cameraOffsetX < -200 || eb.x - cameraOffsetX > canvas.width + 200) enemyBullets.splice(i,1);
    }
  }

  // loot pickup
  for(let i=lootDrops.length-1;i>=0;i--){
    const l = lootDrops[i];
    if(state.player.x < l.x + l.w && state.player.x + state.player.w > l.x && state.player.y < l.y + l.h && state.player.y + state.player.h > l.y){
      if (l.type === "tech") {
        const techKeys = Object.keys(TECH_CATALOG);
        const pick = techKeys[Math.floor(rng() * techKeys.length)];
        applyTech(pick);
      } else if (typeof l.type === "string" && l.type.startsWith("gun_")) {
        const gunId = l.type.slice(4);
        if (WEAPON_CONFIG[gunId]) {
          state.ownedGuns[gunId] = true;
          // optional: auto-equip new gun — uncomment next line if desired
          // state.equippedGun = gunId;
        } else {
          const gunKeys = Object.keys(WEAPON_CONFIG);
          state.ownedGuns[gunKeys[Math.floor(rng()*gunKeys.length)]] = true;
        }
      } else {
        // legacy gun pickup: unlock a random gun
        const gunKeys = Object.keys(WEAPON_CONFIG);
        const pick = gunKeys[Math.floor(rng() * gunKeys.length)];
        state.ownedGuns[pick] = true;
      }
      lootDrops.splice(i,1);
    }
  }

  // doors (enter -> advance floor, give tech, reseed & reset)
  for(let i=doors.length-1;i>=0;i--){
    const d = doors[i];
    if(state.player.x < d.x + d.w && state.player.x + state.player.w > d.x && state.player.y < d.y + d.h && state.player.y + state.player.h > d.y){
      state.floor = (state.floor||0) + 1; reseed(Math.floor(Math.random()*1e9)); resetWorld(); break;
    }
  }

  // invuln & regen
  if(state.player.invuln > 0){ state.player.invuln = Math.max(0, state.player.invuln - dt); state.player.color = (Math.floor(state.player.invuln * 6) % 2 === 0) ? "#fff" : state.player.baseColor; if(state.player.invuln === 0) state.player.color = state.player.baseColor; }
  if(state.player.regen > 0) state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.regen * dt);

  updateParticles(dt);
}

// ---------- Render ----------
function render(){
  ctx.save();
  let shakeOffsetX = 0, shakeOffsetY = 0;
  if(shake.time > 0){ const s = shake.intensity * (shake.time / 0.18); shakeOffsetX = (Math.random()*2-1)*s; shakeOffsetY = (Math.random()*2-1)*s; }
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.translate(Math.floor(shakeOffsetX), Math.floor(shakeOffsetY));

  // thick walls
  if(ENABLE_WALLS){
    ctx.fillStyle = "#222";
    ctx.fillRect(leftWallX - leftWallHalf - cameraOffsetX, -2000, WALL_THICKNESS, 4000);
    ctx.fillRect(rightWallX - rightWallHalf - cameraOffsetX, -2000, WALL_THICKNESS, 4000);
  }

  for(let plat of platforms) plat.draw();
  for(let e of enemies) e.draw();

  // bullets rotated
  for(let b of bullets){ ctx.save(); const bx=b.x-cameraOffsetX, by=b.y, cx=bx+b.w/2, cy=by+b.h/2; ctx.translate(cx,cy); ctx.rotate(b.angle || 0); ctx.fillStyle=b.color; ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h); ctx.restore(); }
  for(let eb of enemyBullets){ ctx.save(); const ex=eb.x-cameraOffsetX, ey=eb.y, cx=ex+eb.w/2, cy=ey+eb.h/2; ctx.translate(cx,cy); ctx.rotate(eb.angle || 0); ctx.fillStyle=eb.color; ctx.fillRect(-eb.w/2,-eb.h/2,eb.w,eb.h); ctx.restore(); }

  for(let l of lootDrops) l.draw();
  for(let d of doors) d.draw();
  ctx.fillStyle = state.player.color; ctx.fillRect(state.player.x - cameraOffsetX, state.player.y, state.player.w, state.player.h);

  ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1;
  ctx.beginPath(); const px = state.player.x + state.player.w/2 - cameraOffsetX, py = state.player.y + state.player.h/2; ctx.moveTo(px,py); ctx.lineTo(mouseX, mouseY); ctx.stroke();

  drawHUD();
  ctx.restore();

  handleAutoFire();
}

// ---------- Main loop ----------
function run(nowMs) {
    try {
        const deltaMs = nowMs - lastFrameTimeMs;
        lastFrameTimeMs = nowMs;
        deltaAccumulator += deltaMs / 1000;
        deltaAccumulator = Math.min(deltaAccumulator, MAX_ACCUM_SECONDS);

        while (deltaAccumulator >= FIXED_DT) {
            updatePhysics(FIXED_DT);
            deltaAccumulator -= FIXED_DT;
        }

        render();
        requestAnimationFrame(run);
    } catch (e) {
        debugLog('ERROR in game loop: ' + e.message);
    }
}

// ---------- Helpers ----------
function computeTerrainEnd(){ let maxX=0; for(let p of platforms) maxX = Math.max(maxX, p.x + p.w); return maxX; }

// ---------- Start ----------
updateHUD();
lastFrameTimeMs = performance.now();
requestAnimationFrame(run);