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

// (fixed canvas size is used to preserve original HUD and aiming math)

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

// ---------- RNG ----------
let seed = Math.floor(Math.random() * 1e9);
if (seedDisplay) seedDisplay.textContent = seed;
function mulberry32(a) { return function() { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; } }
let rng = mulberry32(seed);
function reseed(newSeed) { seed = newSeed | 0; rng = mulberry32(seed); if (seedDisplay) seedDisplay.textContent = seed; }

// ---------- Game config / techs / weapons ----------
const GAME_CONFIG = { playerBaseMaxHp: 10, playerBaseLives: 3, playerInvulnSec: 1.0, playerHpRegenPerSec: 0, respawnInvulnSec: 2.0, screenShakeIntensityOnHit: 6, particleCountOnHit: 12 };
const WEAPON_CONFIG = { 
  // pierce: how many additional targets the projectile can pass through (0 = no piercing)
  // pierceDamageLoss: fraction [0..1] of damage lost per pierce (e.g. 0.25 loses 25% of damage each pierce)
  basic:  { speed:  8, color: "#fff", damage: 1, spreadCount: 1, spreadAngle: 0, attackRate: 6.0,  dropWeight: 40, pierce: 0, pierceDamageLoss: 0.0 }, // common, moderate fire
  laser:  { speed: 12, color: "#0ff", damage: 2, spreadCount: 1, spreadAngle: 0, attackRate: 2.5,  dropWeight: 15, pierce: 1, pierceDamageLoss: 0.4 }, // stronger, slower, small pierce
  spread: { speed:  7, color: "#f0f", damage: 1, spreadCount: 3, spreadAngle: 10,  attackRate: 3.0,  dropWeight: 10, pierce: 0, pierceDamageLoss: 0.0 },  // multi-shot, mid speed
  railgun: { speed:  25, color: "rgba(255, 85, 0, 1)", damage: 5, spreadCount: 1, spreadAngle: 0,  attackRate: 1.0,  dropWeight: 5, pierce: 4, pierceDamageLoss: 0.35 },  // high damage, pierces several targets but loses damage each hit
  machine_gun: { speed:  7, color: "rgba(76, 0, 255, 1)", damage: 1, spreadCount: 1, spreadAngle: 0,  attackRate: 10.0,  dropWeight: 10, pierce: 0, pierceDamageLoss: 0.0 }  // mid speed, low attack damage, high attack speed

};
// keep a deep copy of defaults so we can reset per-weapon
const WEAPON_DEFAULTS = JSON.parse(JSON.stringify(WEAPON_CONFIG));
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
// Particle settings (can be updated from settings UI)
GAME_CONFIG.particleColorA = '#ffd066';
GAME_CONFIG.particleColorB = '#ff66a0';
GAME_CONFIG.particleUseTwo = true;
GAME_CONFIG.particleSize = 2;
GAME_CONFIG.particleLife = 0.5;
GAME_CONFIG.particleCountOnHit = GAME_CONFIG.particleCountOnHit || 12;

const PARTICLE_POOL = [];
const PARTICLE_POOL_SIZE = 400; // increased to allow more simultaneous particles
for (let i=0;i<PARTICLE_POOL_SIZE;i++) PARTICLE_POOL.push({ active:false, x:0, y:0, vx:0, vy:0, life:0, color:'#fff' });

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
    spawnParticles(this.x+this.w/2,this.y+this.h/2, GAME_CONFIG.particleCountOnHit || 12); shakeScreen(1.6,0.2);
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
    if(!p.active){
      p.active = true;
      p.x = x; p.y = y;
      const ang = rng()*Math.PI*2;
      const spd = 40 + rng()*80;
      p.vx = Math.cos(ang)*spd;
      p.vy = Math.sin(ang)*spd - 60;
      // base life with small random variance; use configured particleLife
      p.life = Math.max(0.05, (GAME_CONFIG.particleLife || 0.5) * (0.8 + rng()*0.4));
      // choose color A or B
      if(GAME_CONFIG.particleUseTwo){ p.color = (rng() < 0.5) ? GAME_CONFIG.particleColorA : GAME_CONFIG.particleColorB; }
      else p.color = GAME_CONFIG.particleColorA;
      count--;
    }
  }
}
function updateParticles(dt){
  for (let p of PARTICLE_POOL){
    if(!p.active) continue;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.life -= dt;
    if(p.life <= 0) { p.active = false; continue; }
    // particle drawing moved to render() to avoid double-buffer issues
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
  spawnParticles(state.player.x + state.player.w/2, state.player.y + state.player.h/2, Math.max(4, Math.floor((GAME_CONFIG.particleCountOnHit||12) / 2)));
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
  state.player.maxHp = GAME_CONFIG.playerBaseMaxHp; state.player.hp = state.player.maxHp; state.player.invuln = 0; state.player.invulnSec = GAME_CONFIG.playerInvulnSec; state.player.regen = GAME_CONFIG.playerHpRegenPerSec; state.player.damageMult = 1; state.player.lives = GAME_CONFIG.playerBaseLives; /* keep state.ownedGuns persistent */ // preserve state.techs so techs persist across floors
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
  const weapon = (weaponId && WEAPON_CONFIG[weaponId]) ? WEAPON_CONFIG[weaponId] : null;

  // PLAYER_ATTACK_RATE remains as the global factor (from UI). It now multiplies each weapon's base attackRate.
  // If the weapon has no attackRate field, use the global value directly.
  const weaponBaseRate = (weapon && weapon.attackRate) ? Number(weapon.attackRate) : PLAYER_ATTACK_RATE;
  const effectiveRate = weaponBaseRate * Number(PLAYER_ATTACK_RATE);

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
    bullets.push({ x: originX + rx*(state.player.w/2+4), y: originY + ry*(state.player.h/2+4), vx, vy, w:8, h:4, color: gun.color, damage, angle: Math.atan2(vy, vx),
      // piercing state
      remainingPierce: (gun.pierce||0),
      pierceDamageLoss: (gun.pierceDamageLoss||0),
      currentDamage: damage
    });
  }
  // spreadCount determines how many bullets; spreadAngle is total angle in degrees
  const spreadCount = Math.max(1, (gun.spreadCount || 1));
  const spreadAngleDeg = (gun.spreadAngle || 0);
  if(spreadCount <= 1){ pushBulletWithAngle(0); }
  else {
    const totalRad = spreadAngleDeg * (Math.PI/180);
    for(let si=0; si<spreadCount; si++){
      const t = spreadCount===1 ? 0 : (si / (spreadCount - 1)); // 0..1
      const off = (t - 0.5) * totalRad; // center spread
      pushBulletWithAngle(off);
    }
  }
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
  // draw equipped weapon stats on the right side below the weapon list
  const eq = state.equippedGun && WEAPON_CONFIG[state.equippedGun];
  if(eq){
    ctx.font = "12px system-ui, Arial";
    const padding = 8;
    const startX = canvas.width - padding;
    // compute y same as HUD weapon list start + offset (we drew 'Guns' at padding+6 and then each entry at +18, so put stats after list)
    const statY = padding + 6 + 16 + (Object.keys(WEAPON_CONFIG).length * 18) + 6;
    ctx.textAlign = 'right';
    const pdlPct = Math.round((eq.pierceDamageLoss||0)*100);
    ctx.fillStyle = "#ffd";
    ctx.fillText(`Weapon: ${state.equippedGun}`, startX, statY);
    ctx.fillText(`D:${eq.damage} S:${eq.speed} P:${eq.pierce} Sp:${eq.spreadCount||1} Sa:${eq.spreadAngle||0} PDL:${pdlPct}%`, startX, statY + 14);
    ctx.textAlign = 'start';
  }
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

// ---------- Weapon Stats HUD / Settings wiring ----------
// Helper to update the small weapon stats display in the settings panel
function updateWeaponStatsPanel(weaponId){
  const w = WEAPON_CONFIG[weaponId];
  const dmgEl = document.getElementById('ws_damage');
  const spdEl = document.getElementById('ws_speed');
  const pierceEl = document.getElementById('ws_pierce');
  const pdlEl = document.getElementById('ws_pdl');
  const dmgVal = document.getElementById('ws_damage_val');
  const spdVal = document.getElementById('ws_speed_val');
  const pierceVal = document.getElementById('ws_pierce_val');
  const pdlVal = document.getElementById('ws_pdl_val');
  const spreadEl = document.getElementById('ws_spread');
  const spreadVal = document.getElementById('ws_spread_val');
  const spreadAngleEl = document.getElementById('ws_spread_angle');
  const spreadAngleVal = document.getElementById('ws_spread_angle_val');
  if(!w || !dmgEl) return;
  dmgEl.value = w.damage || 1; dmgVal.textContent = dmgEl.value;
  spdEl.value = w.speed || 8; spdVal.textContent = spdEl.value;
  pierceEl.value = w.pierce || 0; pierceVal.textContent = pierceEl.value;
  spreadEl.value = (w.spreadCount||1); spreadVal.textContent = spreadEl.value;
  spreadAngleEl.value = (w.spreadAngle||0); spreadAngleVal.textContent = spreadAngleEl.value + "°";
  // store PDL as percent 0..100 for slider
  pdlEl.value = Math.round((w.pierceDamageLoss||0) * 100); pdlVal.textContent = pdlEl.value + "%";

  // attach listeners to update WEAPON_CONFIG live
  function wire(el, cb){ el.oninput = cb; el.onchange = cb; }
  wire(dmgEl, () => { w.damage = Number(dmgEl.value); dmgVal.textContent = dmgEl.value; });
  wire(spdEl, () => { w.speed = Number(spdEl.value); spdVal.textContent = spdEl.value; });
  wire(pierceEl, () => { w.pierce = Number(pierceEl.value); pierceVal.textContent = pierceEl.value; });
  wire(spreadEl, () => { w.spreadCount = Math.max(1, Number(spreadEl.value)); spreadVal.textContent = spreadEl.value; });
  wire(spreadAngleEl, () => { w.spreadAngle = Math.max(0, Number(spreadAngleEl.value)); spreadAngleVal.textContent = spreadAngleEl.value + "°"; });
  wire(pdlEl, () => { w.pierceDamageLoss = Math.max(0, Math.min(1, Number(pdlEl.value) / 100)); pdlVal.textContent = pdlEl.value + "%"; });
  // reset button
  const resetBtn = document.getElementById('ws_reset');
  if(resetBtn){ resetBtn.onclick = () => {
    if(!WEAPON_DEFAULTS[weaponId]) return;
    const defaults = WEAPON_DEFAULTS[weaponId];
    // copy defaults back into weapon config
    for(const k of Object.keys(defaults)) w[k] = defaults[k];
    // refresh panel values
    updateWeaponStatsPanel(weaponId);
  }}
  // show spread checkbox
  const showSpreadCheckbox = document.getElementById('showSpread');
  window._showSpread = showSpreadCheckbox ? showSpreadCheckbox.checked : true;
  if(showSpreadCheckbox) showSpreadCheckbox.onchange = () => { window._showSpread = showSpreadCheckbox.checked; };
}

// update settings panel when cycling weapons or on equip
document.addEventListener('keydown', (e) => {
  if(e.code === 'KeyQ') setTimeout(() => updateWeaponStatsPanel(state.equippedGun), 50);
});

// also update on load
window.addEventListener('load', () => { setTimeout(() => updateWeaponStatsPanel(state.equippedGun), 200); });

// Changelog panel wiring
window.addEventListener('load', () => {
  const toggleBtn = document.getElementById('toggleChangelog');
  const closeBtn = document.getElementById('closeChangelog');
  const panel = document.getElementById('changelogPanel');
  const content = document.getElementById('changelogContent');
  if(toggleBtn && panel && content){
    toggleBtn.onclick = async () => {
      if(panel.style.display === 'none' || !panel.style.display){
        // fetch changelog file
        try{
          const resp = await fetch('https://extensively.github.io/Projects/shape/changelog.txt');
          const txt = await resp.text();
          content.textContent = txt;
        } catch(e){
          // Friendly guidance when running the page via file:// where fetch is blocked
          if (window && window.location && window.location.protocol === 'file:'){
            content.textContent = "Cannot load changelog when opening the HTML file directly (file://).\n" +
              "Most browsers block fetch() for local files. Start a simple local static server and open the page via http://localhost:PORT/ instead.\n\n" +
              "Example (macOS / bash) - run this in the project folder then open http://localhost:8000/shape.html:\n" +
              "  python3 -m http.server 8000\n\n" +
              "Or, if you have Node.js installed you can run (in the project folder):\n" +
              "  npx serve .\n\n" +
              "After starting a server, click Toggle Changelog again.\n";
          } else {
            content.textContent = 'Could not load changelog: ' + (e && e.message ? e.message : String(e));
          }
        }
        panel.style.display = 'block';
      } else panel.style.display = 'none';
    };
  }
  if(closeBtn && panel) closeBtn.onclick = () => { panel.style.display = 'none'; };
});

// ---------------- Persistence ----------------
const SAVE_KEY = 'shapez_save_v1';
function saveGame(){
  try{
    const payload = {
      seed,
      techs: state.techs,
      ownedGuns: state.ownedGuns,
      equippedGun: state.equippedGun,
      weaponConfig: WEAPON_CONFIG,
      player: { x: state.player.x, y: state.player.y, checkpoint: state.player.checkpoint, hp: state.player.hp, maxHp: state.player.maxHp }
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    debugLog('Game saved');
  } catch(e){ debugLog('Save failed: ' + e.message); }
}
function loadGame(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const p = JSON.parse(raw);
    if(p.seed) reseed(p.seed);
    if(p.techs) state.techs = p.techs;
    if(p.ownedGuns) state.ownedGuns = p.ownedGuns;
    if(p.equippedGun) state.equippedGun = p.equippedGun;
    if(p.weaponConfig) {
      // merge saved weapon config (overwrite defaults)
      for(const k of Object.keys(p.weaponConfig)) if(WEAPON_CONFIG[k]) Object.assign(WEAPON_CONFIG[k], p.weaponConfig[k]);
    }
    if(p.player && p.player.checkpoint) state.player.checkpoint = p.player.checkpoint;
    debugLog('Save loaded');
    return true;
  } catch(e){ debugLog('Load failed: ' + e.message); return false; }
}
function resetSave(){ localStorage.removeItem(SAVE_KEY); debugLog('Save cleared'); }

// ---------------- Main Menu / Pause ----------------
let gamePaused = true; // start paused (main menu)
let demoMode = false;
let _playerBackup = null;
let demoShootTimer = 0;
function showMainMenu(show=true){
  const mm = document.getElementById('mainMenu');
  if(mm) mm.style.display = show ? 'flex' : 'none';
  // when showing main menu we enter demo mode (AI controls player); do not pause the entire loop
  if(show){
    demoMode = true;
    gamePaused = false; // allow physics to run for demo AI while main menu is visible
    // backup player state so we can restore on Play
    try{ _playerBackup = JSON.parse(JSON.stringify(state.player)); }catch(e){ _playerBackup = null; }
    demoShootTimer = 0.5 + Math.random()*1.2;
  } else {
    demoMode = false;
    // restore player if we have a backup
    if(_playerBackup){
      try{ Object.assign(state.player, _playerBackup); }catch(e){}
      _playerBackup = null;
    }
  }
}
function showPause(show=true){ const p = document.getElementById('pauseOverlay'); if(p) p.style.display = show ? 'flex' : 'none'; gamePaused = show; }

window.addEventListener('load', () => {
  // wire menu buttons
  const mmPlay = document.getElementById('mm_play');
  const mmReset = document.getElementById('mm_resetSave');
  const pauseResume = document.getElementById('pause_resume');
  const pauseSave = document.getElementById('pause_save');
  const pauseQuit = document.getElementById('pause_quit');

  if(mmPlay) mmPlay.onclick = () => { showMainMenu(false); showPause(false); gamePaused = false; };
  if(mmReset) mmReset.onclick = () => { resetSave(); location.reload(); };
  if(pauseResume) pauseResume.onclick = () => { showPause(false); gamePaused = false; };
  if(pauseSave) pauseSave.onclick = () => { saveGame(); };
  if(pauseQuit) pauseQuit.onclick = () => { showPause(false); showMainMenu(true); };

  // load save if present — keep main menu visible but apply loaded state
  const loaded = loadGame();
  // refresh UI panels
  updateHUD();
  updateWeaponStatsPanel(state.equippedGun);
  // wire particle settings inputs if present
  const pA = document.getElementById('particleColorA');
  const pB = document.getElementById('particleColorB');
  const pTwo = document.getElementById('particleUseTwo');
  const pAmt = document.getElementById('particleAmount');
  const pLife = document.getElementById('particleLife');
  const pSize = document.getElementById('particleSize');
  if(pA) { pA.value = GAME_CONFIG.particleColorA || '#ffd066'; pA.onchange = () => { GAME_CONFIG.particleColorA = pA.value; } }
  if(pB) { pB.value = GAME_CONFIG.particleColorB || '#ff66a0'; pB.onchange = () => { GAME_CONFIG.particleColorB = pB.value; } }
  if(pTwo) { pTwo.checked = !!GAME_CONFIG.particleUseTwo; pTwo.onchange = () => { GAME_CONFIG.particleUseTwo = !!pTwo.checked; } }
  if(pAmt) { pAmt.value = GAME_CONFIG.particleCountOnHit || 12; pAmt.onchange = () => { GAME_CONFIG.particleCountOnHit = Math.max(0, Number(pAmt.value)); } }
  if(pLife) { pLife.value = GAME_CONFIG.particleLife || 0.5; pLife.onchange = () => { GAME_CONFIG.particleLife = Math.max(0.01, Number(pLife.value)); } }
  if(pSize) { pSize.value = GAME_CONFIG.particleSize || 2; pSize.onchange = () => { GAME_CONFIG.particleSize = Math.max(1, Number(pSize.value)); } }
  // ensure menu shown until user clicks Play
  showMainMenu(true);
});

// toggle pause with Escape
document.addEventListener('keydown', (e) => {
  if(e.code === 'Escape'){
    // if main menu visible, ignore
    const mm = document.getElementById('mainMenu');
    if(mm && mm.style.display !== 'none') return;
    gamePaused = !gamePaused;
    showPause(gamePaused);
  }
});

// ---------- Physics update ----------
function updatePhysics(dt){
  if(shake.time>0) { shake.time = Math.max(0, shake.time - dt); } else { shake.intensity = 0; }

  // player input
  // player input
  state.player.vx = 0;
  if(demoMode){
    // simple AI: patrol back and forth near checkpoint and shoot
    const centerX = state.player.checkpoint.x || 100;
    const roam = 160;
    const targetX = centerX + Math.sin(performance.now()/1500) * roam;
    state.player.vx = (targetX > state.player.x) ? PLAYER_SPEED * 0.6 : -PLAYER_SPEED * 0.6;
    // occasionally jump
    if(Math.random() < 0.002) { state.player.vy = -JUMP_SPEED * 0.8; }
    // demo shooting at nearest enemy
    demoShootTimer -= dt;
    if(demoShootTimer <= 0){
      // find nearest enemy
      if(enemies.length>0){
        let nearest = enemies[0]; let nd = Math.abs(nearest.x - state.player.x);
        for(let e of enemies){ const d = Math.abs(e.x - state.player.x); if(d < nd){ nd = d; nearest = e; } }
        // aim at nearest
        mouseX = (nearest.x - cameraOffsetX) + nearest.w/2; mouseY = nearest.y + nearest.h/2;
        shootBulletAtMouse();
      }
      demoShootTimer = 0.4 + Math.random()*1.4;
    }
  } else {
    if(keys["ArrowLeft"]||keys["KeyA"]) state.player.vx = -PLAYER_SPEED;
    if(keys["ArrowRight"]||keys["KeyD"]) state.player.vx = PLAYER_SPEED;
  }

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
    for(let bi=bullets.length-1; bi>=0; bi--){
      const b = bullets[bi];
      if(b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y){
        // apply current damage on the bullet (respect pierce damage reductions)
        const dmg = Math.max(1, Math.round(b.currentDamage || b.damage || 1));
        e.applyDamage(dmg, Math.sign(b.vx || 1));

        // if bullet can pierce, decrement remaining pierce and reduce damage
        if(b.remainingPierce && b.remainingPierce > 0){
          b.remainingPierce -= 1;
          // reduce current damage by fraction; ensure it doesn't go negative
          b.currentDamage = Math.max(0, (b.currentDamage||b.damage) * (1 - (b.pierceDamageLoss||0)));
          // if damage falls below 1, remove bullet
          if((b.currentDamage||0) < 1){ bullets.splice(bi,1); continue; }
          // otherwise let bullet continue (do not remove)
        } else {
          // no pierce left -> consume the bullet
          bullets.splice(bi,1);
        }
      }
    }
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

  // spread visualization (lines showing bullet directions) if enabled
  if(window._showSpread){
    const eq = state.equippedGun && WEAPON_CONFIG[state.equippedGun];
    if(eq){
      const spreadCount = Math.max(1, eq.spreadCount || 1);
      const spreadAngleDeg = eq.spreadAngle || 0;
      const totalRad = spreadAngleDeg * (Math.PI/180);
      ctx.strokeStyle = 'rgba(200,200,80,0.7)'; ctx.lineWidth = 1;
      for(let si=0; si<spreadCount; si++){
        const t = spreadCount===1 ? 0 : (si / (spreadCount - 1));
        const off = (t - 0.5) * totalRad;
        const angle = Math.atan2(mouseY - py, (mouseX + cameraOffsetX) - (state.player.x + state.player.w/2)) + off;
        const len = 160;
        const ex = px + Math.cos(angle) * len;
        const ey = py + Math.sin(angle) * len;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
      }
    }
  }

  drawHUD();
  // draw particles (on top)
  const pSize = Math.max(1, GAME_CONFIG.particleSize || 2);
  for (let p of PARTICLE_POOL){
    if(!p.active) continue;
    ctx.fillStyle = p.color || GAME_CONFIG.particleColorA;
    ctx.fillRect(p.x - cameraOffsetX - (pSize/2), p.y - (pSize/2), pSize, pSize);
  }
  ctx.restore();

  if (!gamePaused) handleAutoFire();
}

// ---------- Main loop ----------
function run(nowMs) {
    try {
        const deltaMs = nowMs - lastFrameTimeMs;
        lastFrameTimeMs = nowMs;
        deltaAccumulator += deltaMs / 1000;
        deltaAccumulator = Math.min(deltaAccumulator, MAX_ACCUM_SECONDS);

    while (deltaAccumulator >= FIXED_DT) {
      if (!gamePaused) updatePhysics(FIXED_DT);
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