function debugLog(message) {
    const debugDiv = document.getElementById('debugOutput');
    if (debugDiv) {
        debugDiv.innerHTML += message + '<br>';
    }
let DEBUG_ENABLED = true; // default on

function debugLog(message) {
  if (!DEBUG_ENABLED) return; // respect toggle
  const debugDiv = document.getElementById('debugOutput');
  if (debugDiv) {
    debugDiv.innerHTML += message + '<br>';
  }
}
}
// Simple radar chart renderer used by the shape game.
window.RadarChart = (function(){
	function drawRadar(canvas, labels, values, options={}){
		if(!canvas) return;
		const ctx = canvas.getContext('2d');
		const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h);
		const cx = w/2, cy = h/2; const radius = Math.min(w,h)/2 - 36;
		ctx.save(); ctx.translate(cx, cy);
		// background web
		const steps = options.steps || 4;
		ctx.strokeStyle = options.gridColor || 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
		for(let s=1;s<=steps;s++){
			ctx.beginPath();
			const r = radius * (s/steps);
			for(let i=0;i<labels.length;i++){
				const ang = (i / labels.length) * Math.PI*2 - Math.PI/2;
				const x = Math.cos(ang)*r, y = Math.sin(ang)*r;
				if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
			}
			ctx.closePath(); ctx.stroke();
		}
		// spokes and labels (compact)
		ctx.fillStyle = options.labelColor || '#ccc'; ctx.font = options.labelFont || '11px system-ui, Arial';
		for(let i=0;i<labels.length;i++){
			const ang = (i / labels.length) * Math.PI*2 - Math.PI/2;
			const x = Math.cos(ang)*radius, y = Math.sin(ang)*radius;
			ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(x,y); ctx.stroke();
			// place labels slightly closer to the chart and use smaller offset
			const lx = Math.cos(ang)*(radius+18), ly = Math.sin(ang)*(radius+18);
			ctx.textAlign = (lx>0)?'left':(lx<0)?'right':'center'; ctx.textBaseline = (ly>0)?'top':(ly<0)?'bottom':'middle';
			ctx.fillText(labels[i], lx, ly);
		}
		// data polygon
		ctx.beginPath();
		for(let i=0;i<labels.length;i++){
			const v = Math.max(0, Math.min(1, values[i] || 0));
			const ang = (i / labels.length) * Math.PI*2 - Math.PI/2;
			const x = Math.cos(ang)*radius*v, y = Math.sin(ang)*radius*v;
			if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
		}
		ctx.closePath(); ctx.fillStyle = options.fillColor || 'rgba(255,200,80,0.12)'; ctx.fill(); ctx.strokeStyle = options.lineColor || 'rgba(255,200,80,0.8)'; ctx.lineWidth=2; ctx.stroke();
		// highlight points
		for(let i=0;i<labels.length;i++){
			const v = Math.max(0, Math.min(1, values[i] || 0));
			const ang = (i / labels.length) * Math.PI*2 - Math.PI/2;
			const x = Math.cos(ang)*radius*v, y = Math.sin(ang)*radius*v;
			ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fillStyle = options.pointColor || '#ffd066'; ctx.fill();
		}
		ctx.restore();
	}
	return { drawRadar };
})();


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

let ENEMY_HP_SCALE = 10;
let ENEMY_SPEED_SCALE = 5;
let ENEMY_DMG_SCALE = 10;


let gameOver = false;
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




const damageNumbers = [];
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
const SETTINGS_DEFAULTS = { WORLD_EXPANSION_CHUNKS: 10, WALL_DISTANCE: 3000, ENABLE_WALLS: true, PLAYER_ATTACK_RATE: 1 };

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

const toggleDebug = document.getElementById("toggleDebug");
if (toggleDebug) {
  DEBUG_ENABLED = toggleDebug.checked;
  toggleDebug.addEventListener("change", () => {
    DEBUG_ENABLED = toggleDebug.checked;
    if (!DEBUG_ENABLED) {
      const debugDiv = document.getElementById('debugOutput');
      if (debugDiv) debugDiv.innerHTML = ""; // clear log when disabled
    }
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
// player stat defaults (editable in Settings)
GAME_CONFIG.playerDamageMult = 1.0; // global damage multiplier applied to weapon damage
GAME_CONFIG.playerDefencePct = 0;   // percent damage reduction applied to incoming damage (0..100)
GAME_CONFIG.playerSpeedMult = 1.0;   // multiplier applied to movement speed
// Luck: percent (0..100) increases drop chances and upgrade rarity bias
GAME_CONFIG.playerLuckPct = 0; // percent luck
// player attack speed multiplier (1.0 = normal)
GAME_CONFIG.playerAttackMult = 0.5;
const WEAPON_CONFIG = { 
  
  // pierce: how many additional targets the projectile can pass through (0 = no piercing)
  // pierceDamageLoss: fraction [0..1] of damage lost per pierce (e.g. 0.25 loses 25% of damage each pierce)
  basic:  { speed:  8, color: "#fff", damage: 1, spreadCount: 1, spreadAngle: 0, attackRate: 6.0,  dropWeight: 400, pierce: 0, pierceDamageLoss: 0.0 }, // common, moderate fire
  laser:  { speed: 12, color: "#0ff", damage: 2, spreadCount: 1, spreadAngle: 0, attackRate: 2.5,  dropWeight: 150, pierce: 1, pierceDamageLoss: 0.4 }, // stronger, slower, small pierce
  spread: { speed:  7, color: "#f0f", damage: 1, spreadCount: 3, spreadAngle: 10,  attackRate: 3.0,  dropWeight: 100, pierce: 0, pierceDamageLoss: 0.0 },  // multi-shot, mid speed
  railgun: { speed:  25, color: "rgba(255, 85, 0, 1)", damage: 5, spreadCount: 1, spreadAngle: 0,  attackRate: 1.0,  dropWeight: 50, pierce: 4, pierceDamageLoss: 0.35 },  // high damage, pierces several targets but loses damage each hit
  machine_gun: { speed:  7, color: "rgba(76, 0, 255, 1)", damage: 1, spreadCount: 1, spreadAngle: 0,  attackRate: 10.0,  dropWeight: 100, pierce: 0, pierceDamageLoss: 0.0 },  // mid speed, low attack damage, high attack speed
  nail_gun: { speed: 6, color: "rgba(200, 200, 50, 1)", damage: 2, spreadCount: 5, spreadAngle: 15, attackRate: 4.0, dropWeight: 8, pierce: 2, pierceDamageLoss: 0.3 }, // shotgun style, multiple pellets with some pierce
  sniper: { speed: 20, color: "rgba(255, 0, 0, 1)", damage: 8, spreadCount: 1, spreadAngle: 0, attackRate: 0.8, dropWeight: 20, pierce: 5, pierceDamageLoss: 0.2 }, // very high damage, high pierce, very slow attack rate
  mortar: { speed: 5, color: "rgba(0, 255, 0, 1)", damage: 6, spreadCount: 1, spreadAngle: 0, attackRate: 0.5, dropWeight: 10, pierce: 0, pierceDamageLoss: 0.0 }, // very high damage, arcing projectile, very slow attack rate
  plasma: { speed: 9, color: "rgba(0, 255, 255, 1)", damage: 3, spreadCount: 1, spreadAngle: 0, attackRate: 2.0, dropWeight: 40, pierce: 2, pierceDamageLoss: 0.25 }, // energy weapon, moderate damage and pierce
  wave: { speed: 8, color: "rgba(255, 0, 255, 1)", damage: 2, spreadCount: 3, spreadAngle: 20, attackRate: 3.5, dropWeight: 30, pierce: 1, pierceDamageLoss: 0.3 }, // wave-like spread shot with some pierce
  lightning: { speed: 15, color: "rgba(255, 255, 0, 1)", damage: 4, spreadCount: 1, spreadAngle: 0, attackRate: 1.5, dropWeight: 20, pierce: 3, pierceDamageLoss: 0.4 }, // fast energy bolt with moderate pierce
  ultra: { speed: 18, color: "rgba(255, 128, 0, 1)", damage: 10, spreadCount: 1, spreadAngle: 0, attackRate: 0.6, dropWeight: 4, pierce: 6, pierceDamageLoss: 0.15 }, // ultimate weapon, very high damage and pierce, very slow
  kinetic: { speed: 14, color: "rgba(128, 128, 128, 1)", damage: 3, spreadCount: 1, spreadAngle: 0, attackRate: 2.2, dropWeight: 25, pierce: 2, pierceDamageLoss: 0.2 }, // balanced kinetic weapon
  drill: { speed: 10, color: "rgba(0, 128, 255, 1)", damage: 2, spreadCount: 1, spreadAngle: 0, attackRate: 3.8, dropWeight: 15, pierce: 4, pierceDamageLoss: 0.3 }, // piercing weapon with moderate damage
  divine: { speed: 12, color: "rgba(255, 215, 0, 1)", damage: 4, spreadCount: 1, spreadAngle: 0, attackRate: 1.8, dropWeight: 10, pierce: 5, pierceDamageLoss: 0.25 }, // holy energy weapon with high pierce
  magnetic: { speed: 11, color: "rgba(0, 255, 128, 1)", damage: 3, spreadCount: 1, spreadAngle: 0, attackRate: 2.5, dropWeight: 18, pierce: 3, pierceDamageLoss: 0.2 }, // magnetic projectile with balanced stats
  absolute_finality: { speed: 20, color: "rgba(255, 20, 147, 1)", damage: 12, spreadCount: 1, spreadAngle: 0, attackRate: 0.4, dropWeight: 1, pierce: 8, pierceDamageLoss: 0.1 } // ultimate endgame weapon

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
// reroll bank persists between levels
state.rerollBank = 0;
let cameraOffsetX = 0;


const CHEAT_WATERMARK_KEY = "cheatsUsed";

// Show watermark
function showCheatWatermark() {
  let wm = document.getElementById("cheatWatermark");
  if (!wm) {
    wm = document.createElement("div");
    wm.id = "cheatWatermark";
    wm.textContent = "CHEATS USED";
    wm.style.position = "fixed";
    wm.style.right = "24px";
    wm.style.bottom = "18px";
    wm.style.color = "#ff4444";
    wm.style.fontWeight = "bold";
    wm.style.fontSize = "22px";
    wm.style.opacity = "0.85";
    wm.style.pointerEvents = "none";
    wm.style.zIndex = "2000";
    document.body.appendChild(wm);
  }
  wm.style.display = "block";
}

// Hide watermark
function hideCheatWatermark() {
  let wm = document.getElementById("cheatWatermark");
  if (wm) wm.style.display = "none";
}

// Set/clear cheats used in localStorage
function setCheatsUsed() {
  localStorage.setItem(CHEAT_WATERMARK_KEY, "1");
  showCheatWatermark();
}
function clearCheatsUsed() {
  localStorage.removeItem(CHEAT_WATERMARK_KEY);
  hideCheatWatermark();
}
function cheatsWereUsed() {
  return localStorage.getItem(CHEAT_WATERMARK_KEY) === "1";
}

// On load, wire up cheat toggle and section
window.addEventListener("load", () => {
  // Show watermark if cheats were used
  if (cheatsWereUsed()) showCheatWatermark();

  // Wire up cheat toggle and section
  const cheatToggle = document.getElementById("cheatModeToggle");
  const cheatSection = document.getElementById("cheatSection");
  if (cheatToggle && cheatSection) {
    cheatToggle.checked = false;
    cheatSection.disabled = true;
    cheatToggle.addEventListener("change", () => {
      cheatSection.disabled = !cheatToggle.checked;
      if (cheatToggle.checked) setCheatsUsed();
    });
  }
});

window.addEventListener('load', () => {
  const debugOutput = document.getElementById('debugOutput');
  const debugToggle = document.getElementById('toggleDebug');
  function updateDebugVisibility() {
    if (debugToggle && debugOutput) {
      debugOutput.style.display = debugToggle.checked ? 'block' : 'none';
    }
  }
  if (debugToggle && debugOutput) {
    debugToggle.checked = false; // ensure off by default
    updateDebugVisibility();
    debugToggle.addEventListener('change', updateDebugVisibility);
  }
});

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


function isBossRound(floor) {
  return floor > 0 && floor % 10 === 0;
}

// Enemy type registry
const ENEMY_TYPES = {
  circle: {
    name: "Circle",
    color: "#e55",
    w: 30, h: 30,
    maxHp: 6,
    behaviors: ["patrol", "jump", "shooter", "chase", "ranged"],
    weight: 3
  },
  triangle: {
    name: "Triangle",
    color: "#ffdf55",
    w: 30, h: 30,
    maxHp: 6,
    behaviors: ["patrol", "jump", "shooter", "chase", "ranged"],
    weight: 2
  },
  square: {
    name: "Square",
    color: "#55f",
    w: 36, h: 36,
    maxHp: 12,
    behaviors: ["patrol", "shooter", "chase", "ranged"],
    weight: 1
  },
  fast: {
    name: "Fast",
    color: "#0cf",
    w: 24, h: 24,
    maxHp: 4,
    behaviors: ["patrol", "chase"],
    speedMult: 2.0,
    weight: 1
  }
  // ...add more as needed...
};

// ...existing code...
class Enemy {
  constructor(x, y, typeKey, behavior = "patrol") {
    const type = ENEMY_TYPES[typeKey] || ENEMY_TYPES.circle;
    this.typeKey = typeKey;
    this.x = x;
    this.y = y;
    this.w = type.w;
    this.h = type.h;
    this.type = typeKey;
    this.behavior = behavior;
    this.baseColor = type.color;
    this.color = this.baseColor;

    // --- Level scaling ---
    const floor = (state.floor || 1);
    const hpScale = Math.pow(1 + ENEMY_HP_SCALE / 100, floor - 1);
    const speedScale = Math.pow(1 + ENEMY_SPEED_SCALE / 100, floor - 1);
    const dmgScale = Math.pow(1 + ENEMY_DMG_SCALE / 100, floor - 1);

    this.maxHp = Math.round(type.maxHp * hpScale);
    this.hp = this.maxHp;
    this.speedMult = (type.speedMult || 1) * speedScale;
    this.damage = Math.round((type.damage || 1) * dmgScale);

    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.jumpCooldown = rng() * 1.0;
    this.shootCooldown = rng() * 2.0 + 1.0;
    this.hitTimer = 0;
  }
  draw() {
    ctx.fillStyle = this.color;
    if (this.typeKey === "circle") {
      ctx.beginPath();
      ctx.arc(this.x - cameraOffsetX + this.w / 2, this.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.typeKey === "triangle") {
      ctx.beginPath();
      ctx.moveTo(this.x - cameraOffsetX, this.y + this.h);
      ctx.lineTo(this.x - cameraOffsetX + this.w / 2, this.y);
      ctx.lineTo(this.x - cameraOffsetX + this.w, this.y + this.h);
      ctx.closePath();
      ctx.fill();
    } else {
      // Default: square
      ctx.fillRect(this.x - cameraOffsetX, this.y, this.w, this.h);
    }
    // HP bar
    const barW = this.w, barH = 5, barX = this.x - cameraOffsetX, barY = this.y - 8;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
    ctx.fillStyle = "rgba(255,60,60,0.95)";
    ctx.fillRect(barX, barY, Math.floor(barW * pct), barH);
  }
    applyDamage(dmg, sourceVx=0){
if (dmg > 0) {
  damageNumbers.push({
    x: this.x + this.w / 2,
    y: this.y,
    vx: (Math.random() - 0.5) * 1.5, // random slight side movement
    vy: -1.5 - Math.random(),         // float up
    value: dmg,
    alpha: 1,
    time: 0
  });
}
    this.hp -= dmg; this.hitTimer = 0.2; this.color="#fff"; this.vx += (sourceVx||0)*0.6;
    spawnParticles(this.x+this.w/2,this.y+this.h/2, GAME_CONFIG.particleCountOnHit || 12); shakeScreen(1.6,0.2);
  }
update(dt){
  if(this.hitTimer>0){ this.hitTimer = Math.max(0,this.hitTimer - dt); if(this.hitTimer===0) this.color=this.baseColor; }
  if(this.behavior==="jump"){
    if(this.jumpCooldown<=0 && this.onGround){ this.vy = -JUMP_SPEED * 0.66; this.jumpCooldown = 1.5 + rng()*1.0; }
    if(this.jumpCooldown>0) this.jumpCooldown = Math.max(0,this.jumpCooldown - dt);
    if(this.behavior==="shooter"){
      if(this.shootCooldown<=0){
        const vx = (state.player.x < this.x) ? -4 * FPS_BASIS : 4 * FPS_BASIS;
        const vy = 0;
        enemyBullets.push({ x:this.x+this.w/2, y:this.y+this.h/2, vx, vy, w:6, h:6, color:"#f80", damage:1, angle:Math.atan2(vy,vx) });
        this.shootCooldown = 2.0 + rng()*1.5;
      } else this.shootCooldown = Math.max(0,this.shootCooldown - dt);
    }
  } else if(this.behavior==="patrol"){
    if(this.vx === 0) this.vx = (rng() < 0.5 ? -ENEMY_PATROL_SPEED : ENEMY_PATROL_SPEED) * this.speedMult;
  }
  this.vy += GRAVITY * dt;
  this.x += this.vx * dt;
  this.y += this.vy * dt;

  // --- Enemy wall collision and turn-around ---
  if (ENABLE_WALLS) {
    const leftWallRightX = leftWallX + leftWallHalf;
    const rightWallLeftX = rightWallX - rightWallHalf;
    // If enemy hits left wall, clamp and turn right
    if (this.x < leftWallRightX) {
      this.x = leftWallRightX;
      if (this.vx < 0) this.vx = Math.abs(this.vx);
    }
    // If enemy hits right wall, clamp and turn left
    if (this.x + this.w > rightWallLeftX) {
      this.x = rightWallLeftX - this.w;
      if (this.vx > 0) this.vx = -Math.abs(this.vx);
    }
  }

  // --- NEW AI BEHAVIORS ---
  if(this.behavior === "chase") {
    // Move toward player horizontally
    const px = state.player.x + state.player.w/2;
    const ex = this.x + this.w/2;
    const dir = px > ex ? 1 : -1;
    this.vx = dir * ENEMY_PATROL_SPEED * this.speedMult;
    if(this.onGround && Math.abs(px - ex) < 40 && state.player.y + state.player.h < this.y) {
      this.vy = -JUMP_SPEED * 0.5;
    }
  } else if(this.behavior === "ranged") {
    // Maintain distance: approach if too far, retreat if too close
    const px = state.player.x + state.player.w/2;
    const ex = this.x + this.w/2;
    const dist = px - ex;
    const absDist = Math.abs(dist);
    const minDist = 180, maxDist = 260;
    if(absDist < minDist) {
      this.vx = -Math.sign(dist) * ENEMY_PATROL_SPEED * this.speedMult; // back away
    } else if(absDist > maxDist) {
      this.vx = Math.sign(dist) * ENEMY_PATROL_SPEED * this.speedMult; // approach
    } else {
      this.vx = 0; // hold position
    }
    // Shoot if within range and cooldown
    if(this.shootCooldown<=0 && absDist < maxDist && absDist > minDist/2){
      const dx = px - ex;
      const dy = (state.player.y + state.player.h/2) - (this.y + this.h/2);
      const mag = Math.hypot(dx, dy) || 1;
      const vx = dx / mag * 6 * FPS_BASIS;
      const vy = dy / mag * 6 * FPS_BASIS;
      enemyBullets.push({ x:this.x+this.w/2, y:this.y+this.h/2, vx, vy, w:6, h:6, color:"#f80", damage:1, angle:Math.atan2(vy,vx) });
      this.shootCooldown = 2.0 + rng()*1.5;
    }
    if(this.shootCooldown>0) this.shootCooldown = Math.max(0,this.shootCooldown - dt);
  }
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
  // apply defence percentage: reduce incoming damage by GAME_CONFIG.playerDefencePct percent
  const defPct = Math.max(0, Math.min(100, GAME_CONFIG.playerDefencePct || 0));
  const reducedAmount = Math.max(0, Math.round(amount * (1 - defPct / 100)));
  state.player.hp -= reducedAmount;
  state.player.invuln = state.player.invulnSec || GAME_CONFIG.playerInvulnSec;
  state.player.color = "#fff";
  // knockback removed; previously altered player's vx here but was causing issues
  shakeScreen(GAME_CONFIG.screenShakeIntensityOnHit, 0.25);
  spawnParticles(state.player.x + state.player.w/2, state.player.y + state.player.h/2, Math.max(4, Math.floor((GAME_CONFIG.particleCountOnHit||12) / 2)));
  if(state.player.hp <= 0) handlePlayerDeath();
}
function handlePlayerDeath(){
  state.player.lives = Math.max(0, state.player.lives - 1);
  if(state.player.lives <= 0){
    // Game Over!
    gameOver = true;

    // Reset player stats to defaults
    GAME_CONFIG.playerDamageMult = 1.0;
    GAME_CONFIG.playerDefencePct = 0;
    GAME_CONFIG.playerSpeedMult = 1.0;
    GAME_CONFIG.playerLuckPct = 0;
    GAME_CONFIG.playerAttackMult = 0.5;
    state.techs = {};
    state.rerollBank = 0;

    // Reset gun stats to defaults
    for(const k of Object.keys(WEAPON_CONFIG)){
      if(WEAPON_DEFAULTS[k]) Object.assign(WEAPON_CONFIG[k], WEAPON_DEFAULTS[k]);
    }
    // Optionally reset owned/equipped guns:
    state.ownedGuns = { "basic": true };
    state.equippedGun = "basic";

    // Show Game Over overlay (handled in render)
    return;
  }
  state.player.hp = state.player.maxHp; state.player.x = state.player.checkpoint.x; state.player.y = state.player.checkpoint.y; state.player.vx = 0; state.player.vy = 0; state.player.invuln = GAME_CONFIG.respawnInvulnSec; updateHUD();
}

// ---------- Generation ----------
function generatePlatforms(startX = 0, count = GEN_CHUNK_SIZE){
  const ret = [];
  const leftLimit = leftWallX + leftWallHalf;
  const rightLimit = rightWallX - rightWallHalf;
  for(let i=0;i<count;i++){
    const baseSpacing = GEN_SPACING_X;
    const jitter = Math.floor((rng()*2-1)*GEN_JITTER_X);
    let x = startX + i*baseSpacing + jitter;
    if(GEN_CLUSTER>0 && rng()<GEN_CLUSTER)
      x = (i>0)? (ret[i-1].x + Math.floor(rng()*(baseSpacing/2))) : x;
    const y = GEN_BASE_Y + Math.floor(rng()*GEN_VAR_Y);
    const w = GEN_PLAT_W;
    // Only add platform if it fits within the wall boundaries
    if (x >= leftLimit && (x + w) <= rightLimit) {
      ret.push(new Platform(x, y, w, 18));
    }
  }
  return ret;
}

function spawnEnemiesOn(platformArray, preferVisible = false) {
  if (!toggleSpawn || !toggleSpawn.checked) return;
  let availableTypes = ["circle", "triangle"];
  if ((state.floor || 1) >= 3) availableTypes.push("square");
  if ((state.floor || 1) >= 5) availableTypes.push("fast");

  // Build weighted pool
  let weightedPool = [];
  for (let typeKey of availableTypes) {
    const weight = ENEMY_TYPES[typeKey]?.weight || 1;
    for (let i = 0; i < weight; i++) weightedPool.push(typeKey);
  }

  for (let plat of platformArray) {
    if (plat === floor) continue;
    if (rng() < ENEMY_SPAWN_CHANCE) {
      const typeKey = weightedPool[Math.floor(rng() * weightedPool.length)];
      const type = ENEMY_TYPES[typeKey];
      const behaviors = type.behaviors;
      const behavior = behaviors[Math.floor(rng() * behaviors.length)];
      const minX = plat.x + 12;
      const maxX = Math.max(minX + 8, plat.x + plat.w - 40);
      let ex = minX + Math.floor(rng() * Math.max(1, (maxX - minX)));
      if (preferVisible) {
        const visibleMin = Math.max(0, state.player.x - 80);
        const visibleMax = state.player.x + canvas.width + 80;
        if (ex < visibleMin) ex = Math.min(maxX, visibleMin + Math.floor(rng() * Math.min(200, visibleMax - visibleMin)));
        if (ex > visibleMax) ex = Math.max(minX, visibleMax - Math.floor(rng() * Math.min(200, visibleMax - visibleMin)));
      }
      enemies.push(new Enemy(ex, plat.y - type.h, typeKey, behavior));
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
// ...existing code...

function resetWorld(fullHeal = true){
  rng = mulberry32(seed);

  // --- Calculate level width based on scaling ---
  const floorNum = state.floor || 1;
  const BASE_LEVEL_WIDTH = 1200; // base width for level 1
  const LEVEL_WIDTH_SCALE = 120;  // px per level, or use your slider value
  const levelWidth = BASE_LEVEL_WIDTH + LEVEL_WIDTH_SCALE * (floorNum - 1);

  // --- Sync platform generation to fill levelWidth ---
  // Use GEN_SPACING_X and GEN_CHUNK_SIZE to fill levelWidth
// --- Platform generation: more platforms per level, constant width ---
const BASE_PLATFORM_COUNT = 10; // platforms at level 1
const PLATFORM_COUNT_SCALE = 2; // extra platforms per level
const BASE_PLATFORM_WIDTH = 88; // constant platform width

GEN_CHUNK_SIZE = BASE_PLATFORM_COUNT + PLATFORM_COUNT_SCALE * (floorNum - 1);
GEN_PLAT_W = BASE_PLATFORM_WIDTH;
GEN_SPACING_X = Math.max(GEN_PLAT_W + 8, Math.floor(levelWidth / GEN_CHUNK_SIZE));

  // --- Sync floor width to match levelWidth ---
  const floorX = -1 * levelWidth / 2 - 100;
  const floorY = canvas.height - 40;
  const floorW = levelWidth * 2;
  const floorH = 40;
  floor.x = floorX;
  floor.y = floorY;
  floor.w = floorW;
  floor.h = floorH;


  // --- Sync wall positions to match level edges ---
  WALL_DISTANCE = Math.floor(levelWidth / 2) + 100; // walls just outside level edges
  updateWalls();

  // --- Generate platforms across the level ---
  platforms = [floor];
  const initial = generatePlatforms(floorX, GEN_CHUNK_SIZE);
  platforms.push(...initial);
  enemies = []; lootDrops = []; bullets = []; enemyBullets = []; doors = [];
  worldLeftX = initial[0].x - 400;
  worldRightX = initial[initial.length-1].x + 400;
  terrainEndX = computeTerrainEnd();
  spawnEnemiesOn(initial, true);
  spawnDoorsOn(initial, false);

  if (isBossRound(state.floor)) {
    // Pick a random enemy type for the boss
    const bossTypes = Object.keys(ENEMY_TYPES);
    const bossType = bossTypes[Math.floor(rng() * bossTypes.length)];
    const bossBase = ENEMY_TYPES[bossType];
    // Place boss in the center of the level, on the floor
    const bossX = floor.x + floor.w / 2 - bossBase.w * 2.5;
    const bossY = floor.y - bossBase.h * 2.5;
    // Boss stats: 5x normal
    const boss = new Enemy(bossX, bossY, bossType, "chase");
    boss.w = bossBase.w * 2.5;
    boss.h = bossBase.h * 2.5;
    boss.maxHp *= 5;
    boss.hp = boss.maxHp;
    boss.damage *= 5;
    boss.isBoss = true;
    boss.color = "#ff00ff"; // Make boss visually distinct
    enemies.push(boss);
  }


if (ENABLE_WALLS) {
    // Only spawn the right wall door
    const rightDoorX = rightWallX - rightWallHalf - 48 - 8;
    const rightDoorY = canvas.height - 40 - 72 - 8;
    doors.push(new Door(rightDoorX, rightDoorY));
}

  state.player.x = state.player.checkpoint.x = 100;
  state.player.y = state.player.checkpoint.y = 100;
  state.player.vx = state.player.vy = 0;
  state.player.maxHp = GAME_CONFIG.playerBaseMaxHp;
  if(fullHeal) state.player.hp = state.player.maxHp;
  else state.player.hp = Math.min(state.player.hp || 0, state.player.maxHp);
  state.player.invuln = 0;
  state.player.invulnSec = GAME_CONFIG.playerInvulnSec;
  state.player.regen = GAME_CONFIG.playerHpRegenPerSec;
  state.player.damageMult = 1;
  state.player.lives = GAME_CONFIG.playerBaseLives;
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
  // effective rate combines weapon base, global PLAYER_ATTACK_RATE and player's attack multiplier
  const effectiveRate = weaponBaseRate * Number(PLAYER_ATTACK_RATE) * (GAME_CONFIG.playerAttackMult || 1);

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
  const baseSpeed = (gun.speed||8) * BULLET_SPEED_SCALE;
  // effective damage = weapon base * global player damage multiplier * any per-player damageMult
  const damage = Math.max(1, Math.round((gun.damage||1) * (GAME_CONFIG.playerDamageMult || 1) * (state.player.damageMult || 1)));
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
function updateHUD(){ if(livesDisplay) livesDisplay.textContent = state.player.lives; 

  const psLuck = document.getElementById('ps_luck');
  const psLuckVal = document.getElementById('ps_luck_val');
  if (psLuck && psLuckVal) {
    psLuck.value = GAME_CONFIG.playerLuckPct;
    psLuckVal.textContent = GAME_CONFIG.playerLuckPct + '%';
  }
}
function drawHUD(){
  // left HUD (existing)
  ctx.fillStyle="rgba(0,0,0,0.45)"; ctx.fillRect(8,8,360,132);
  ctx.fillStyle="#fff"; ctx.font="14px system-ui, Arial";
  // build a stack of enabled lines instead of using fixed y positions
  const hudLeftX = 16;
  let stackY = 28;
  const lineH = 18;
  // populate lines based on HUD_TOGGLES
  const lines = [];
  if(window.HUD_TOGGLES === undefined) window.HUD_TOGGLES = { weapon:true, tips:true, techs:true, seed:true, floor:true, platform:true, enemies:true, stats:true, rerolls:true };
  if(window.HUD_TOGGLES.weapon) lines.push({ text: 'Weapon: ' + (state.equippedGun || 'none') });
  if(window.HUD_TOGGLES.tips) lines.push({ text: 'Press Q to cycle weapons' });
  if(window.HUD_TOGGLES.techs) lines.push({ text: 'Techs: ' + (Object.keys(state.techs).join(', ') || 'none') });
  if(window.HUD_TOGGLES.seed) lines.push({ text: 'Seed: ' + seed });
  if(window.HUD_TOGGLES.floor) lines.push({ text: 'Floor: ' + (state.floor||1) });
  if(window.HUD_TOGGLES.platform) lines.push({ text: `Plat: size=${GEN_CHUNK_SIZE} spacing=${GEN_SPACING_X} width=${GEN_PLAT_W}` });
  if(window.HUD_TOGGLES.enemies) lines.push({ text: 'Enemies: ' + enemies.length });
  if(window.HUD_TOGGLES.stats) lines.push({ text: `Dmg: ${(GAME_CONFIG.playerDamageMult||1).toFixed(2)}  Def: ${Math.round(GAME_CONFIG.playerDefencePct||0)}%  Spd: ${(GAME_CONFIG.playerSpeedMult||1).toFixed(2)}  Atk: ${(GAME_CONFIG.playerAttackMult||1).toFixed(2)}` });  
  if(window.HUD_TOGGLES.rerolls) lines.push({ text: 'Rerolls: ' + (state.rerollBank || 0) });

  // draw stacked lines
  ctx.fillStyle = '#fff'; ctx.textAlign = 'start'; ctx.font = '14px system-ui, Arial';
  for(const ln of lines){ ctx.fillText(ln.text, hudLeftX, stackY); stackY += lineH; }

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
  // HP bar: draw at bottom-left of canvas
  const barW = 260, barH = 14;
  const barX = 12;
  const barY = canvas.height - 12 - barH; // small padding from bottom
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(barX-2, barY-2, barW+4, barH+4);
  const pct = Math.max(0, state.player.hp / state.player.maxHp);
  ctx.fillStyle = "#e44"; ctx.fillRect(barX, barY, Math.floor(barW * pct), barH);
  ctx.strokeStyle = "#000"; ctx.strokeRect(barX-2, barY-2, barW+4, barH+4);
  ctx.fillStyle = "#fff"; ctx.font = "12px system-ui, Arial"; ctx.fillText(`HP: ${Math.floor(state.player.hp)}/${state.player.maxHp}`, barX+6, barY+11);
  ctx.fillText(`Lives: ${state.player.lives}`, barX+170, barY+11);

  // update external radar panel (if present)
  try{
    const radarCanvas = document.getElementById('radarCanvas');
    if(radarCanvas && window.RadarChart){
      // normalize stats to 0..1 for display
  
      const maxValues = { speedPct:200, attack:12.0, damagePct:200, health:300.0, defencePct:95.0, luckPct:100 };
  const labels = ['SPD','ATK','DMG','HP','DEF','LCK'];
  const vals = [];
  // convert percent sliders to 0..1 (0% -> 0, 100% -> 1) where current stored values are multipliers
  const speedPct = Math.round(((GAME_CONFIG.playerSpeedMult||1) - 1) * 100);
  vals.push( Math.min(1, speedPct / maxValues.speedPct) );
      // attack speed: compute effective shots/sec for current weapon
      // New:
      const attackMult = GAME_CONFIG.playerAttackMult || 1;
      vals.push(Math.min(1, attackMult / 2)); // 2x = full scale
  const dmgPct = Math.round(((GAME_CONFIG.playerDamageMult||1) - 1) * 100);
  vals.push( Math.min(1, dmgPct / maxValues.damagePct) );
  vals.push( Math.min(1, (state.player.maxHp || GAME_CONFIG.playerBaseMaxHp) / maxValues.health) );
  vals.push( Math.min(1, (GAME_CONFIG.playerDefencePct||0) / maxValues.defencePct) );
  const luckPct = Math.round((GAME_CONFIG.playerLuckPct||0));
  vals.push( Math.min(1, luckPct / maxValues.luckPct) );
      window.RadarChart.drawRadar(radarCanvas, labels, vals, { fillColor:'rgba(80,200,255,0.07)', lineColor:'rgba(80,200,255,0.9)', pointColor:'#7be', labelColor:'#ddd' });
    }
  }catch(e){ /* ignore radar errors */ }

  // If level menu is open, draw rarity odds on the game canvas next to the overlay
  try{
    if(levelMenuOpen){
      const overlay = document.getElementById('levelMenuOverlay');
      if(overlay){
        const rect = overlay.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        // map overlay rect into canvas-local coordinates
        const localLeft = rect.left - canvasRect.left;
        const localTop = rect.top - canvasRect.top;
        const localRight = rect.right - canvasRect.left;
        const localBottom = rect.bottom - canvasRect.top;
        // prefer to draw to the right of the overlay box, but clamp inside canvas
        const boxWidth = Math.min(canvas.width, localRight - localLeft);
        let startX = Math.min(canvas.width - 180, Math.max(8, localRight + 8));
        if(startX + 160 > canvas.width) startX = Math.max(8, localLeft - 168); // try left side of box
        const startY = Math.max(32, localTop + 48);
        const odds = computeRarityOdds();
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(startX-8, startY-20, 160, (odds.length*18)+28);
        ctx.fillStyle = '#fff'; ctx.font = '13px system-ui, Arial'; ctx.textAlign = 'left';
        ctx.fillText('Rarity Odds', startX, startY);
        let oy = startY + 18;
        for(const o of odds){ ctx.fillStyle = '#ddd'; ctx.fillText(`${o.name}: ${(o.prob*100).toFixed(2)}%`, startX, oy); oy += 18; }
        ctx.restore();
      }
    }
  }catch(e){ /* ignore */ }

try {
  const weaponRadarCanvas = document.getElementById('weaponRadarCanvas');
  if (weaponRadarCanvas && window.RadarChart) {
    const eq = state.equippedGun && WEAPON_CONFIG[state.equippedGun];
    if (eq) {
      // max values chosen for normalization
      const maxValues = {
        damage: 20,       // slider max
        speed: 40,        // slider max
        attackRate: 12,   // fastest gun (machine_gun = 10, give some headroom)
        pierce: 8,        // slider max
        spreadCount: 9,   // slider max
        spreadAngle: 90,  // slider max
        pdl: 100          // percent
      };
      const labels = ['DMG','SPD','ATK','PIERCE','SPREAD','ANGLE','PDL'];
      const vals = [];
      vals.push(Math.min(1, (eq.damage||1) / maxValues.damage));
      vals.push(Math.min(1, (eq.speed||8) / maxValues.speed));
      vals.push(Math.min(1, (eq.attackRate||1) / maxValues.attackRate));
      vals.push(Math.min(1, (eq.pierce||0) / maxValues.pierce));
      vals.push(Math.min(1, (eq.spreadCount||1) / maxValues.spreadCount));
      vals.push(Math.min(1, (eq.spreadAngle||0) / maxValues.spreadAngle));
      vals.push(Math.min(1, ((eq.pierceDamageLoss||0) * 100) / maxValues.pdl));

      window.RadarChart.drawRadar(weaponRadarCanvas, labels, vals, {
        fillColor:'rgba(255,150,80,0.07)',
        lineColor:'rgba(255,150,80,0.9)',
        pointColor:'#fa6',
        labelColor:'#ddd'
      });
    }
  }
} catch(e) { /* ignore radar errors */ }


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
  const luckVal = document.getElementById('ws_luck_val')

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
      floor: state.floor,
      player: { x: state.player.x, y: state.player.y, checkpoint: state.player.checkpoint, hp: state.player.hp, maxHp: state.player.maxHp },
      playerStats: { damageMult: GAME_CONFIG.playerDamageMult, defencePct: GAME_CONFIG.playerDefencePct, speedMult: GAME_CONFIG.playerSpeedMult, luckPct: GAME_CONFIG.playerLuckPct, attackMult: GAME_CONFIG.playerAttackMult }
    };
    // persist reroll bank
    payload.rerollBank = state.rerollBank || 0;
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
    if(p.player){
      if(p.player.checkpoint) state.player.checkpoint = p.player.checkpoint;
      if(typeof p.player.x !== 'undefined') state.player.x = Number(p.player.x);
      if(typeof p.player.y !== 'undefined') state.player.y = Number(p.player.y);
      if(typeof p.player.maxHp !== 'undefined') { state.player.maxHp = Number(p.player.maxHp); GAME_CONFIG.playerBaseMaxHp = Number(p.player.maxHp); }
      if(typeof p.player.hp !== 'undefined') { state.player.hp = Number(p.player.hp); }
    }
    if(typeof p.floor !== 'undefined') state.floor = Number(p.floor);
    // restore player stat overrides if present
    if(p.playerStats){
      if(typeof p.playerStats.damageMult !== 'undefined') GAME_CONFIG.playerDamageMult = Number(p.playerStats.damageMult);
      if(typeof p.playerStats.defencePct !== 'undefined') GAME_CONFIG.playerDefencePct = Number(p.playerStats.defencePct);
      if(typeof p.playerStats.speedMult !== 'undefined') GAME_CONFIG.playerSpeedMult = Number(p.playerStats.speedMult);
      if(typeof p.playerStats.luckPct !== 'undefined') GAME_CONFIG.playerLuckPct = Number(p.playerStats.luckPct);
      if(typeof p.playerStats.attackMult !== 'undefined') GAME_CONFIG.playerAttackMult = Number(p.playerStats.attackMult);
    // restore reroll bank
    if(typeof p.rerollBank !== 'undefined') state.rerollBank = Number(p.rerollBank);
    }
    debugLog('Save loaded');
    return true;
  } catch(e){ debugLog('Load failed: ' + e.message); return false; }
}
function resetSave(){ localStorage.removeItem(SAVE_KEY); debugLog('Save cleared'); clearCheatsUsed();}

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
  // player stats inputs (percent sliders: 0..200 where 100 = +100% => 2x)
  const psDmg = document.getElementById('ps_damage');
  const psDmgVal = document.getElementById('ps_damage_val');
  const psAttack = document.getElementById('ps_attack');
  const psAttackVal = document.getElementById('ps_attack_val');
  const psDef = document.getElementById('ps_defence');
  const psDefVal = document.getElementById('ps_defence_val');
  const psHealth = document.getElementById('ps_health');
  const psHealthVal = document.getElementById('ps_health_val');
  const psSpd = document.getElementById('ps_speed');
  const psSpdVal = document.getElementById('ps_speed_val');

  if(psDmg && psDmgVal){ const pct = Math.round(((GAME_CONFIG.playerDamageMult||1) - 1) * 100); psDmg.value = Math.max(0, pct); psDmgVal.textContent = psDmg.value + '%'; psDmg.oninput = psDmg.onchange = () => { const mult = 1 + (Number(psDmg.value)/100); GAME_CONFIG.playerDamageMult = mult; psDmgVal.textContent = psDmg.value + '%'; } }
  if(psAttack && psAttackVal){ const pct = Math.round(((GAME_CONFIG.playerAttackMult||1) - 1) * 100 || 0); psAttack.value = Math.max(0, pct); psAttackVal.textContent = psAttack.value + '%'; psAttack.oninput = psAttack.onchange = () => { const mult = 1 + (Number(psAttack.value)/100); GAME_CONFIG.playerAttackMult = mult; psAttackVal.textContent = psAttack.value + '%'; } }
  if(psDef && psDefVal){ psDef.value = GAME_CONFIG.playerDefencePct || 0; psDefVal.textContent = psDef.value + '%'; psDef.oninput = psDef.onchange = () => { GAME_CONFIG.playerDefencePct = Math.min(95, Number(psDef.value)); psDefVal.textContent = psDef.value + '%'; } }
  if(psHealth && psHealthVal){ psHealth.value = state.player.maxHp || GAME_CONFIG.playerBaseMaxHp || 10; psHealthVal.textContent = psHealth.value; psHealth.oninput = psHealth.onchange = () => { const v = Math.max(1, Number(psHealth.value)); state.player.maxHp = v; GAME_CONFIG.playerBaseMaxHp = v; state.player.hp = Math.min(state.player.hp, state.player.maxHp); psHealthVal.textContent = psHealth.value; } }
  if(psSpd && psSpdVal){ const pct = Math.round(((GAME_CONFIG.playerSpeedMult||1) - 1) * 100); psSpd.value = Math.max(0, pct); psSpdVal.textContent = psSpd.value + '%'; psSpd.oninput = psSpd.onchange = () => { const mult = 1 + (Number(psSpd.value)/100); GAME_CONFIG.playerSpeedMult = mult; psSpdVal.textContent = psSpd.value + '%'; } }
  
const psLuck = document.getElementById('ps_luck');
const psLuckVal = document.getElementById('ps_luck_val');
if (psLuck && psLuckVal) {
  // initialize from GAME_CONFIG
  psLuck.value = GAME_CONFIG.playerLuckPct || 0;
  psLuckVal.textContent = psLuck.value + '%';

  // update on change
  psLuck.oninput = psLuck.onchange = () => {
    const v = Math.max(0, Math.min(100, Number(psLuck.value)));
    GAME_CONFIG.playerLuckPct = v;
    psLuckVal.textContent = v + '%';
  };
}
// ---------- Player Stats Sliders ----------
function bindStatSlider(id, valId, min, max, applyFn, formatFn = v => v) {
  const el = document.getElementById(id);
  const valEl = document.getElementById(valId);
  if (!el || !valEl) return;

  // initialize from GAME_CONFIG
  const current = applyFn('get');
  el.value = Math.max(min, Math.min(max, current));
  valEl.textContent = formatFn(el.value);

  // update on change
  el.oninput = el.onchange = () => {
    const v = Math.max(min, Math.min(max, Number(el.value)));
    applyFn('set', v);
    valEl.textContent = formatFn(v);
  };
}



// Damage (% over baseline)
bindStatSlider("ps_damage", "ps_damage_val", 0, 200,
  (mode, v) => mode === 'get' ? Math.round((GAME_CONFIG.playerDamageMult - 1) * 100) : GAME_CONFIG.playerDamageMult = 1 + v/100,
  v => v + "%"
);

// Attack Speed (% over baseline)
bindStatSlider("ps_attack", "ps_attack_val", 0, 200,
  (mode, v) => mode === 'get' ? Math.round((GAME_CONFIG.playerAttackMult - 1) * 100) : GAME_CONFIG.playerAttackMult = 1 + v/100,
  v => v + "%"
);

// Defence (% damage reduction)
bindStatSlider("ps_defence", "ps_defence_val", 0, 95,
  (mode, v) => mode === 'get' ? GAME_CONFIG.playerDefencePct : GAME_CONFIG.playerDefencePct = v,
  v => v + "%"
);

// Health (max HP boost)
bindStatSlider("ps_health", "ps_health_val", 0, 300,
  (mode, v) => mode === 'get' ? (GAME_CONFIG.playerBaseMaxHp - 10) : GAME_CONFIG.playerBaseMaxHp = 10 + v,
  v => v
);

// Speed (% over baseline)
bindStatSlider("ps_speed", "ps_speed_val", 0, 200,
  (mode, v) => mode === 'get' ? Math.round((GAME_CONFIG.playerSpeedMult - 1) * 100) : GAME_CONFIG.playerSpeedMult = 1 + v/100,
  v => v + "%"
);

// Luck (%)
bindStatSlider("ps_luck", "ps_luck_val", 0, 100,
  (mode, v) => mode === 'get' ? GAME_CONFIG.playerLuckPct : GAME_CONFIG.playerLuckPct = v,
  v => v + "%"
);

  
  // ensure menu shown until user clicks Play
  showMainMenu(true);

  // HUD toggles persistence: read saved toggles or default
  try{
    const HUD_KEY = 'shape_hud_toggles';
    let saved = {};
    try{ const raw = localStorage.getItem(HUD_KEY); if(raw) saved = JSON.parse(raw); }catch(e){}
    window.HUD_TOGGLES = Object.assign({ weapon:true, tips:true, techs:true, seed:true, floor:true, platform:true, enemies:true, stats:true, rerolls:true }, saved || {});
    // wire inputs
    const map = { weapon:'hud_weapon', tips:'hud_tips', techs:'hud_techs', seed:'hud_seed', floor:'hud_floor', platform:'hud_platform', enemies:'hud_enemies', stats:'hud_stats', rerolls:'hud_rerolls' };
    for(const key of Object.keys(map)){
      const el = document.getElementById(map[key]); if(!el) continue; el.checked = !!window.HUD_TOGGLES[key]; el.onchange = () => { window.HUD_TOGGLES[key] = !!el.checked; try{ localStorage.setItem(HUD_KEY, JSON.stringify(window.HUD_TOGGLES)); }catch(e){} } }
  }catch(e){ /* ignore HUD toggle init errors */ }
  // Collapsible settings sections with persistence
  try{
    const settingsRoot = document.getElementById('settings');
    const settingsBody = document.getElementById('settingsBody');
    const COLLAPSE_KEY = 'shape_settings_collapsed';
    const ORDER_KEY = 'shape_settings_order';
    let collapsedState = {};
    let savedOrder = [];
    try{ const raw = localStorage.getItem(COLLAPSE_KEY); if(raw) collapsedState = JSON.parse(raw); }catch(e){}
    try{ const raw = localStorage.getItem(ORDER_KEY); if(raw) savedOrder = JSON.parse(raw); }catch(e){}
    if(settingsRoot && settingsBody){
      // collect headings that are direct children of settingsBody
      const headings = Array.from(settingsBody.querySelectorAll('h3, h4'));
      const containers = [];

      headings.forEach(h => {
        // unique key for this section
        const key = (h.textContent||'').trim();
        // build a section: heading + nodes until next heading
        const nodes = [];
        let n = h.nextElementSibling;
        while(n && !(/^H[34]$/i.test(n.tagName))){ nodes.push(n); n = n.nextElementSibling; }
        // wrap nodes in a container for animation
        const wrapper = document.createElement('div'); wrapper.className = 'collapsible';
        if(nodes.length){
          nodes[0].parentNode.insertBefore(wrapper, nodes[0]);
          nodes.forEach(nd => wrapper.appendChild(nd));
        }

        // create outer draggable section container
        const section = document.createElement('div');
  section.className = 'settings-section';
        section.dataset.sectionId = key;
        // move heading and wrapper into section
        h.parentNode.insertBefore(section, h);
        section.appendChild(h);
        section.appendChild(wrapper);

  // add drag handle (make only the handle draggable so sliders remain usable)
  const handle = document.createElement('span'); handle.textContent = '☰';
  handle.style.cursor = 'grab'; handle.style.marginRight = '8px'; handle.title = 'Drag to reorder';
  handle.setAttribute('draggable', 'true');
  h.insertBefore(handle, h.firstChild);

        // chevron for collapse
        const chev = document.createElement('span'); chev.textContent = (collapsedState[key] ? '▸ ' : '▾ ');
        chev.style.marginRight = '6px'; chev.style.color = '#ccc'; h.insertBefore(chev, handle.nextSibling);
        h.style.cursor = 'pointer';

        // set initial max-height based on stored state
        const isCollapsed = !!collapsedState[key];
        if(isCollapsed) { wrapper.style.maxHeight = '0px'; }
        else { wrapper.style.maxHeight = wrapper.scrollHeight + 'px'; }

        // toggle function with animation
        function setVisible(show){ if(show){ wrapper.style.maxHeight = wrapper.scrollHeight + 'px'; chev.textContent = '▾ '; delete collapsedState[key]; } else { wrapper.style.maxHeight = '0px'; chev.textContent = '▸ '; collapsedState[key]=true; } localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsedState)); }
        h.addEventListener('click', (ev) => { // prevent dragging when clicking the handle
          if(ev.target === handle) return; const cur = wrapper.style.maxHeight !== '0px'; setVisible(!cur); });

  // drag events (bound to handle so inner controls like sliders don't initiate drags)
  handle.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', key); section.classList.add('dragging'); });
  handle.addEventListener('dragend', () => { section.classList.remove('dragging'); });
        section.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; section.style.outline = '2px dashed rgba(255,255,255,0.06)'; });
        section.addEventListener('dragleave', () => { section.style.outline = ''; });
        section.addEventListener('drop', (ev) => {
          ev.preventDefault(); section.style.outline = '';
          const draggedId = ev.dataTransfer.getData('text/plain');
          if(!draggedId) return;
          if(draggedId === section.dataset.sectionId) return;
          const draggedEl = settingsBody.querySelector(`[data-section-id="${CSS.escape(draggedId)}"]`);
          if(!draggedEl) return;
          settingsBody.insertBefore(draggedEl, section);
          // persist new order
          const order = Array.from(settingsBody.querySelectorAll('.settings-section')).map(s => s.dataset.sectionId);
          try{ localStorage.setItem(ORDER_KEY, JSON.stringify(order)); }catch(e){}
        });

        containers.push(section);
      });

      // reorder containers based on savedOrder
      if(savedOrder && savedOrder.length){
        const map = {};
        containers.forEach(c => map[c.dataset.sectionId] = c);
        const ordered = [];
        savedOrder.forEach(k => { if(map[k]){ ordered.push(map[k]); delete map[k]; } });
        // append remaining
        Object.keys(map).forEach(k => ordered.push(map[k]));
        // append to DOM in order
        ordered.forEach(c => settingsBody.appendChild(c));
      }

      // wire expand/collapse all buttons
      const expandBtn = document.getElementById('expandAll');
      const collapseBtn = document.getElementById('collapseAll');
      if(expandBtn) expandBtn.addEventListener('click', () => { containers.forEach(s => { const w = s.querySelector('.collapsible'); w.style.maxHeight = w.scrollHeight + 'px'; const headingKey = s.dataset.sectionId; delete collapsedState[headingKey]; }); localStorage.setItem(COLLAPSE_KEY, JSON.stringify({})); });
      if(collapseBtn) collapseBtn.addEventListener('click', () => { containers.forEach(s => { const w = s.querySelector('.collapsible'); w.style.maxHeight = '0px'; const headingKey = s.dataset.sectionId; collapsedState[headingKey]=true; }); const all = {}; containers.forEach(s => { all[s.dataset.sectionId] = true; }); localStorage.setItem(COLLAPSE_KEY, JSON.stringify(all)); });
    }
  }catch(e){ console.warn('settings collapse/init/reorder failed', e); }

  const hpSlider = document.getElementById('enemyHpScale');
  const hpVal = document.getElementById('enemyHpScaleVal');
  const spdSlider = document.getElementById('enemySpeedScale');
  const spdVal = document.getElementById('enemySpeedScaleVal');
  const dmgSlider = document.getElementById('enemyDmgScale');
  const dmgVal = document.getElementById('enemyDmgScaleVal');

  if (hpSlider && hpVal) {
    hpSlider.value = ENEMY_HP_SCALE;
    hpVal.textContent = hpSlider.value + '%';
    hpSlider.oninput = () => {
      ENEMY_HP_SCALE = Number(hpSlider.value);
      hpVal.textContent = hpSlider.value + '%';
    };
  }
  if (spdSlider && spdVal) {
    spdSlider.value = ENEMY_SPEED_SCALE;
    spdVal.textContent = spdSlider.value + '%';
    spdSlider.oninput = () => {
      ENEMY_SPEED_SCALE = Number(spdSlider.value);
      spdVal.textContent = spdSlider.value + '%';
    };
  }
  if (dmgSlider && dmgVal) {
    dmgSlider.value = ENEMY_DMG_SCALE;
    dmgVal.textContent = dmgSlider.value + '%';
    dmgSlider.oninput = () => {
      ENEMY_DMG_SCALE = Number(dmgSlider.value);
      dmgVal.textContent = dmgSlider.value + '%';
    };
  }

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
  state.player.vx = (targetX > state.player.x) ? PLAYER_SPEED * 0.6 * (GAME_CONFIG.playerSpeedMult || 1) : -PLAYER_SPEED * 0.6 * (GAME_CONFIG.playerSpeedMult || 1);
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
  if(keys["ArrowLeft"]||keys["KeyA"]) state.player.vx = -PLAYER_SPEED * (GAME_CONFIG.playerSpeedMult || 1);
  if(keys["ArrowRight"]||keys["KeyD"]) state.player.vx = PLAYER_SPEED * (GAME_CONFIG.playerSpeedMult || 1);
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
if(state.player.x < worldLeftX + EXPAND_THRESHOLD){
  const leftLimit = leftWallX + leftWallHalf;
  // Only expand if there is space left
  if (worldLeftX > leftLimit + 1) {
    let startX = worldLeftX - (WORLD_EXPANSION_CHUNKS * GEN_SPACING_X);
    if (startX < leftLimit) startX = leftLimit;
    const newP = generatePlatforms(startX, WORLD_EXPANSION_CHUNKS);
    platforms.push(...newP);
    spawnEnemiesOn(newP);
    spawnDoorsOn(newP,false);
    worldLeftX = Math.min(...platforms.map(p=>p.x));
  }
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
    if(state.player.x < e.x + e.w && state.player.x + state.player.w > e.x && state.player.y < e.y + e.h && state.player.y + state.player.h > e.y){
      damagePlayer(e.damage || 1, e.vx || 0); // Use enemy's scaled damage!
      state.player.vy = -JUMP_SPEED * 0.5;
    } 
    if(e.hp <= 0){
      if(toggleLoot && toggleLoot.checked) {
        // tech drop
  // compute effective drop chances using same nonlinear luck scaling as the UI
  const luck = Math.max(0, Math.min(100, GAME_CONFIG.playerLuckPct || 0));
  const luckFactor = Math.sqrt(luck) / 100.0; // 0..0.1 for 100 luck -> 0.1
  const effTech = Math.min(1, DROP_RATE_TECH + luckFactor * 0.5);
  if (rng() < effTech) lootDrops.push(new Loot(e.x, e.y, "tech"));
        // gun drop: prefer unowned guns
        // gun drop: choose weapon by weight, prefer unowned weapons
  const effGun = Math.min(1, DROP_RATE_GUN + luckFactor * 1.5);
  if (rng() < effGun) {
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
    // If boss round, only allow if boss is dead
    if (isBossRound(state.floor) && enemies.some(e => e.isBoss)) {
      // Optionally show a message or effect here
      // e.g. flash "Defeat the Boss!" on screen
      continue;
    }
    openLevelUpMenu();
    break;
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

  // Draw damage numbers on top of everything
  updateAndDrawDamageNumbers(FIXED_DT);


  if (!gamePaused) handleAutoFire();


    // ...existing render code...

  // Draw Game Over overlay
  if (gameOver) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2 - 40);
    ctx.font = "28px Arial";
    ctx.fillText("You reached Floor " + (state.floor || 1), canvas.width/2, canvas.height/2 + 10);
    ctx.font = "20px Arial";
    ctx.fillText("Press any key or click to restart", canvas.width/2, canvas.height/2 + 60);
    ctx.restore();
  }
}

// ---------- Level-up / Upgrade Menu ----------
const RARITY_TABLE = [
  { name: 'Common', weight: 50, mult: 0.02 },
  { name: 'Uncommon', weight: 30, mult: 0.05 },
  { name: 'Rare', weight: 12, mult: 0.1 },
  { name: 'Legendary', weight: 5, mult: 0.15 },
  { name: 'Mythic', weight: 2, mult: 0.2 },
  { name: 'Divine', weight: 1, mult: 0.35 }
];

function weightedPick(rngFunc){
  // create a working weight array that can be biased by player luck
  const luck = Math.max(0, Math.min(100, GAME_CONFIG.playerLuckPct || 0));
  // nonlinear bias mapping: use sqrt to get diminishing returns
  const bias = Math.sqrt(luck) / 14.1421; // sqrt(100)=10 -> 10/14.1421 ~= 0.707
  let total = 0;
  const mod = RARITY_TABLE.map((r, idx) => {
    // scale index so highest rarities get more boost; idx 0 => common
    const extra = idx * bias * r.weight;
    const w = Math.max(0.1, r.weight + extra);
    total += w;
    return w;
  });
  let v = Math.floor(rngFunc() * total);
  for(let i=0;i<RARITY_TABLE.length;i++){
    if(v < mod[i]) return RARITY_TABLE[i];
    v -= mod[i];
  }
  return RARITY_TABLE[0];
}

// Compute effective drop chances taking into account luck (non-linear) and update UI
function computeEffectiveDropRates(){
  const baseTech = Number(document.getElementById('dropRateTech')?.value || DROP_RATE_TECH);
  const baseGun = Number(document.getElementById('dropRateGun')?.value || DROP_RATE_GUN);
  const luck = Math.max(0, Math.min(100, GAME_CONFIG.playerLuckPct || 0));
  // nonlinear luck effect: sqrt scaling for diminishing returns
  const luckFactor = Math.sqrt(luck) / 100.0; // 0..0.1 for 100 luck -> 0.1
  const effTech = Math.min(1, baseTech + luckFactor * 1.5); // scale so max ~ +0.15
  const effGun = Math.min(1, baseGun + luckFactor * 1.5);
  const tEl = document.getElementById('effDropTech'); const bTechEl = document.getElementById('baseDropTech');
  const gEl = document.getElementById('effDropGun'); const bGunEl = document.getElementById('baseDropGun');
  if(tEl) tEl.textContent = effTech.toFixed(3);
  if(gEl) gEl.textContent = effGun.toFixed(3);
  if(bTechEl) bTechEl.textContent = baseTech.toFixed(2);
  if(bGunEl) bGunEl.textContent = baseGun.toFixed(2);
  return { effTech, effGun };
}

// Compute rarity odds based on the same mod weights used by weightedPick; returns array of {name,prob}
function computeRarityOdds(){
  const luck = Math.max(0, Math.min(100, GAME_CONFIG.playerLuckPct || 0));
  const bias = Math.sqrt(luck) / 14.1421;
  const mod = RARITY_TABLE.map((r, idx) => Math.max(0.1, r.weight + idx * bias * r.weight));
  const total = mod.reduce((s,x)=>s+x,0);
  return RARITY_TABLE.map((r,idx)=>({ name: r.name, prob: mod[idx] / total }));
}

// UI wiring: update drop rates and rarity odds when relevant controls change
window.addEventListener('load', () => {
  const drTech = document.getElementById('dropRateTech');
  const drGun = document.getElementById('dropRateGun');
  const showOdds = document.getElementById('showRarityOdds');
  const oddsPanel = document.getElementById('rarityOddsPanel');
  function refresh(){ computeEffectiveDropRates(); if(showOdds && showOdds.checked && oddsPanel){ const odds = computeRarityOdds(); oddsPanel.innerHTML = odds.map(o=>`${o.name}: ${(o.prob*100).toFixed(2)}%`).join('<br>'); oddsPanel.style.display='block'; } else if(oddsPanel) oddsPanel.style.display='none'; }
  if(drTech) drTech.onchange = refresh; if(drGun) drGun.onchange = refresh; if(showOdds) showOdds.onchange = refresh;
  // update when luck changes via slider wiring elsewhere
  const psLuck = document.getElementById('ps_luck'); if(psLuck) psLuck.onchange = psLuck.oninput = () => { computeEffectiveDropRates(); if(showOdds && showOdds.checked) { const odds = computeRarityOdds(); if(oddsPanel) oddsPanel.innerHTML = odds.map(o=>`${o.name}: ${(o.prob*100).toFixed(2)}%`).join('<br>'); } };
  // initial refresh
  setTimeout(refresh, 200);
});

function applyWeaponUpgrade(choice) {
  const stat = choice.stat;
  const pct = choice.rarity.mult;
  const gunId = state.equippedGun;
  if (!gunId || !WEAPON_CONFIG[gunId]) return;
  const gun = WEAPON_CONFIG[gunId];
  switch(stat) {
    case 'damage': gun.damage = (gun.damage || 1) * (1 + pct); break;
    case 'speed': gun.speed = (gun.speed || 8) * (1 + pct); break;
    case 'attackRate': gun.attackRate = (gun.attackRate || 1) * (1 + pct); break;
    case 'pierce': gun.pierce = Math.round((gun.pierce || 0) + pct * 10); break;
    case 'pierceDamageLoss': gun.pierceDamageLoss = Math.max(0, (gun.pierceDamageLoss || 0) - pct); break;
    case 'spreadCount': gun.spreadCount = Math.round((gun.spreadCount || 1) + pct * 10); break;
    case 'spreadAngle': gun.spreadAngle = Math.round((gun.spreadAngle || 0) + pct * 10); break;
  }
  updateWeaponStatsPanel(gunId);
  saveGame();
}

function makeUpgradeOptions(){
  const stats = ['Speed','Attack','Damage','Health','Defence','Luck'];
  const choices = [];
  const pool = stats.slice();
  const bossRound = isBossRound(state.floor);

  for(let i=0;i<3;i++){
    const idx = Math.floor(rng()*pool.length);
    const stat = pool.splice(idx,1)[0];
    let rarity = weightedPick(rng);
    if (bossRound) {
      // Legendary, Mythic, or Divine only
      const bossRarities = RARITY_TABLE.filter(r => ['Legendary','Mythic','Divine'].includes(r.name));
      rarity = bossRarities[Math.floor(rng()*bossRarities.length)];
    }
    choices.push({ stat, rarity });
  }

  // --- Weapon upgrades ---
  const weaponStats = ['damage', 'speed', 'attackRate', 'pierce', 'pierceDamageLoss', 'spreadCount', 'spreadAngle'];
  const weaponChoices = [];
  const weaponPool = weaponStats.slice();
  let tries = 0;
  while (weaponChoices.length < 3 && tries < 20) {
    tries++;
    const idx = Math.floor(rng()*weaponPool.length);
    const stat = weaponPool[idx];
    let rarity = weightedPick(rng);
    if (bossRound) {
      const bossRarities = RARITY_TABLE.filter(r => ['Legendary','Mythic','Divine'].includes(r.name));
      rarity = bossRarities[Math.floor(rng()*bossRarities.length)];
    }
    // Only allow spread upgrades if Divine
    if ((stat === 'spreadCount' || stat === 'spreadAngle') && rarity.name !== 'Divine') continue;
    weaponChoices.push({ stat, rarity });
    weaponPool.splice(idx,1);
  }

  return { player: choices, weapon: weaponChoices };
}
let levelMenuOpen = false;
let levelMenuRerolls = 1;
let currentLevelChoices = [];

function createLevelMenuIfNeeded(){
  if(document.getElementById('levelMenuOverlay')) return;
  const gameArea = document.getElementById('gameArea');
  if(!gameArea) return;
  const overlay = document.createElement('div'); overlay.id = 'levelMenuOverlay';
  overlay.style.position = 'absolute'; overlay.style.left = '0'; overlay.style.top = '0'; overlay.style.width = '100%'; overlay.style.height = '100%'; overlay.style.display='none'; overlay.style.alignItems='center'; overlay.style.justifyContent='center'; overlay.style.background='rgba(0,0,0,0.7)'; overlay.style.zIndex='2000';
  // inner container holds the menu box and the odds panel side-by-side
  const inner = document.createElement('div'); inner.style.display = 'flex'; inner.style.alignItems = 'flex-start'; inner.style.gap = '12px';
  const box = document.createElement('div'); box.style.background='#111'; box.style.border='2px solid #444'; box.style.padding='14px'; box.style.width='520px'; box.style.color='#fff'; box.style.textAlign='center';
  const title = document.createElement('div'); title.textContent='Level Up! Choose one reward'; title.style.fontSize='18px'; title.style.marginBottom='8px'; box.appendChild(title);
  const opts = document.createElement('div'); opts.id='levelMenuOptions'; opts.style.display='flex'; opts.style.gap='8px'; opts.style.justifyContent='center'; box.appendChild(opts);
  const footer = document.createElement('div'); footer.style.marginTop='10px';
  const rerollBtn = document.createElement('button'); rerollBtn.textContent='Reroll (1)'; rerollBtn.id='levelMenuReroll'; rerollBtn.style.marginRight='8px'; footer.appendChild(rerollBtn);
  const skipBtn = document.createElement('button'); skipBtn.textContent='Skip & Full Heal'; skipBtn.id='levelMenuSkip'; skipBtn.style.marginRight='8px'; footer.appendChild(skipBtn);
  const closeBtn = document.createElement('button'); closeBtn.textContent='Skip & +1 Reroll'; closeBtn.id='levelMenuClose'; footer.appendChild(closeBtn);
  box.appendChild(footer);
  // odds panel (to the right of the box) — not darkened, simple text
  const oddsPanel = document.createElement('div'); oddsPanel.id = 'levelMenuOdds';
  oddsPanel.style.minWidth = '160px'; oddsPanel.style.color = '#fff'; oddsPanel.style.padding = '8px 6px'; oddsPanel.style.background = 'transparent'; oddsPanel.style.border = '1px solid rgba(255,255,255,0.06)'; oddsPanel.style.borderRadius = '6px';
  oddsPanel.style.display = 'none';
  inner.appendChild(box);
  inner.appendChild(oddsPanel);
  overlay.appendChild(inner);
  gameArea.appendChild(overlay);

  rerollBtn.onclick = () => {
    if(levelMenuRerolls > 0){ levelMenuRerolls--; }
    else if(state.rerollBank > 0){ state.rerollBank--; }
    else { return; }
    currentLevelChoices = makeUpgradeOptions(); renderLevelMenuOptions(); document.getElementById('levelMenuReroll').textContent = 'Reroll ('+levelMenuRerolls + (state.rerollBank ? ' +' + state.rerollBank : '') +')';
  };
  // Skip: full heal + advance
  skipBtn.onclick = () => { closeLevelMenu(true); advanceFloor(true); };
  // Close: Skip without heal, but give +1 reroll and advance (no heal)
  closeBtn.onclick = () => { state.rerollBank = (state.rerollBank||0) + 1; closeLevelMenu(false); advanceFloor(false); document.getElementById('levelMenuReroll').textContent = 'Reroll ('+levelMenuRerolls + (state.rerollBank ? ' +' + state.rerollBank : '') +')'; };
}



function renderLevelMenuOptions(){
  const container = document.getElementById('levelMenuOptions'); if(!container) return;
  container.innerHTML = '';

  // Make the container a column flexbox
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '18px';

  // Player upgrades (top row)
  const playerRow = document.createElement('div');
  playerRow.style.display = 'flex';
  playerRow.style.flexDirection = 'row';
  playerRow.style.gap = '8px';
  playerRow.style.justifyContent = 'center';
  playerRow.style.marginBottom = '0';
  currentLevelChoices.player.forEach((c, idx) => {
    const col = document.createElement('div'); col.style.padding='8px'; col.style.width='150px'; col.style.borderRadius='6px';
    // rarity color mapping
    const rarityColors = {
      'Common': { bg:'#1e1e1e', border:'#444', text:'#ddd' },
      'Uncommon': { bg:'#113322', border:'#2a8f57', text:'#9ff' },
      'Rare': { bg:'#1a1a33', border:'#5b6bd6', text:'#aef' },
      'Legendary': { bg:'#332214', border:'#d48f2a', text:'#ffd' },
      'Mythic': { bg:'#2b1830', border:'#b14fd1', text:'#f8c' },
      'Divine': { bg:'#2b2a1b', border:'#ffd34d', text:'#fff7c8' }
    };
    const rc = rarityColors[c.rarity.name] || { bg:'#222', border:'#333', text:'#ffd' };
    col.style.background = rc.bg; col.style.border = '1px solid ' + rc.border; col.style.color = rc.text;
    if(c.rarity.name === 'Divine') col.classList.add('divine-chroma');
    const r = document.createElement('div'); r.textContent = c.rarity.name; r.style.color = rc.text; r.style.fontWeight='700'; col.appendChild(r);
    const s = document.createElement('div'); s.textContent = c.stat; s.style.margin='8px 0'; col.appendChild(s);
    const amt = document.createElement('div'); amt.textContent = '+' + Math.round(c.rarity.mult * 100) + '%'; amt.style.color='#afa'; col.appendChild(amt);
    const take = document.createElement('button'); take.textContent='Take'; take.style.marginTop='8px'; take.onclick = () => { applyUpgrade(c); closeLevelMenu(false); advanceFloor(); }; col.appendChild(take);
    playerRow.appendChild(col);
  });
  container.appendChild(playerRow);

  // Weapon upgrades (bottom row)
  const weaponRow = document.createElement('div');
  weaponRow.style.display = 'flex';
  weaponRow.style.flexDirection = 'row';
  weaponRow.style.gap = '8px';
  weaponRow.style.justifyContent = 'center';
  currentLevelChoices.weapon.forEach((c, idx) => {
    const col = document.createElement('div'); col.style.padding='8px'; col.style.width='150px'; col.style.borderRadius='6px';
    // rarity color mapping
    const rarityColors = {
      'Common': { bg:'#1e1e1e', border:'#444', text:'#ddd' },
      'Uncommon': { bg:'#113322', border:'#2a8f57', text:'#9ff' },
      'Rare': { bg:'#1a1a33', border:'#5b6bd6', text:'#aef' },
      'Legendary': { bg:'#332214', border:'#d48f2a', text:'#ffd' },
      'Mythic': { bg:'#2b1830', border:'#b14fd1', text:'#f8c' },
      'Divine': { bg:'#2b2a1b', border:'#ffd34d', text:'#fff7c8' }
    };
    const rc = rarityColors[c.rarity.name] || { bg:'#222', border:'#333', text:'#ffd' };
    col.style.background = rc.bg; col.style.border = '1px solid ' + rc.border; col.style.color = rc.text;
    if(c.rarity.name === 'Divine') col.classList.add('divine-chroma');
    const r = document.createElement('div'); r.textContent = c.rarity.name; r.style.color = rc.text; r.style.fontWeight='700'; col.appendChild(r);
    const s = document.createElement('div'); s.textContent = weaponStatLabel(c.stat); s.style.margin='8px 0'; col.appendChild(s);
    const amt = document.createElement('div'); amt.textContent = weaponStatAmount(c.stat, c.rarity.mult); amt.style.color='#afa'; col.appendChild(amt);
    const take = document.createElement('button'); take.textContent='Take'; take.style.marginTop='8px'; take.onclick = () => { applyWeaponUpgrade(c); closeLevelMenu(false); advanceFloor(); }; col.appendChild(take);
    weaponRow.appendChild(col);
  });
  container.appendChild(weaponRow);

  // update odds panel in DOM (right side of overlay) if present and if user wants it
  const oddsPanel = document.getElementById('levelMenuOdds');
  const showOddsCheckbox = document.getElementById('showRarityOdds');
  if(oddsPanel && showOddsCheckbox && showOddsCheckbox.checked){
    const odds = computeRarityOdds();
    oddsPanel.style.display = 'block';
    oddsPanel.innerHTML = '<strong>Rarity Odds</strong><br/>' + odds.map(o=>`<div style="margin-top:6px;">${o.name}: <strong>${(o.prob*100).toFixed(2)}%</strong></div>`).join('');
  } else if(oddsPanel) {
    oddsPanel.style.display = 'none';
  }
}
// Helper for weapon stat labels
function weaponStatLabel(stat) {
  switch(stat) {
    case 'damage': return 'Weapon Damage';
    case 'speed': return 'Projectile Speed';
    case 'attackRate': return 'Fire Rate';
    case 'pierce': return 'Pierce';
    case 'pierceDamageLoss': return 'Pierce Dmg Loss';
    case 'spreadCount': return 'Spread Count';
    case 'spreadAngle': return 'Spread Angle';
    default: return stat;
  }
}
function weaponStatAmount(stat, mult) {
  if(stat === 'pierceDamageLoss') return '-' + Math.round(mult * 100) + '%';
  if(stat === 'spreadCount' || stat === 'pierce' || stat === 'spreadAngle') return '+' + Math.round(mult * 10);
  return '+' + Math.round(mult * 100) + '%';
}


let enemyStatGraphHoverLevel = null; // Track which level the mouse is over
let enemyStatGraphLockedLevel = null; // Track locked level
let enemyStatGraphMouseY = null; // Track mouse Y for stat box

function drawEnemyStatGraph() {
  const canvas = document.getElementById('enemyStatGraph');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Graph config
  const W = canvas.width, H = canvas.height;
  const margin = 36;
  const graphW = W - margin * 2, graphH = H - margin * 2;
  const baseLevel = 1;
  const playerLevel = state.floor || 1;
  const minLevel = 0;
  const maxLevel = playerLevel + 5;

  // Get scaling factors from sliders
  const hpScale = ENEMY_HP_SCALE / 100;
  const spdScale = ENEMY_SPEED_SCALE / 100;
  const dmgScale = ENEMY_DMG_SCALE / 100;

  // Pick a reference enemy type (circle)
  const baseType = ENEMY_TYPES.circle;

  // Compute stat values for each level
  const levels = [];
  for (let lvl = minLevel; lvl <= maxLevel; lvl++) {
    levels.push({
      lvl,
      hp: Math.round(baseType.maxHp * (1 + (lvl - 1) * hpScale)),
      spd: (baseType.speedMult || 1) * (1 + (lvl - 1) * spdScale),
      dmg: Math.round((baseType.damage || 1) * (1 + (lvl - 1) * dmgScale))
    });
  }

  // Find max values for scaling
  const maxHp = Math.max(...levels.map(l => l.hp));
  const maxSpd = Math.max(...levels.map(l => l.spd));
  const maxDmg = Math.max(...levels.map(l => l.dmg));

  // Draw axes
  ctx.save();
  ctx.translate(margin, margin);
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, graphH); ctx.lineTo(graphW, graphH);
  ctx.stroke();

  // Draw stat lines
  function plotLine(stat, color, maxVal) {
    ctx.beginPath();
    for (let i = 0; i < levels.length; i++) {
      const x = i / (levels.length - 1) * graphW;      const y = graphH - (levels[i][stat] / maxVal) * graphH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  plotLine('hp', '#ff6666', maxHp);
  plotLine('spd', '#66cfff', maxSpd);
  plotLine('dmg', '#ffd066', maxDmg);

  // Draw legend
  ctx.font = "12px Arial";
  ctx.fillStyle = "#ff6666"; ctx.fillText("HP", graphW - 40, 16);
  ctx.fillStyle = "#66cfff"; ctx.fillText("Speed", graphW - 40, 32);
  ctx.fillStyle = "#ffd066"; ctx.fillText("Damage", graphW - 40, 48);

  // Draw level labels
  ctx.fillStyle = "#bbb";
  ctx.font = "11px Arial";
  for (let i = 0; i < levels.length; i++) {
    const x = (levels[i].lvl - minLevel) / (maxLevel - minLevel) * graphW;
    if (levels[i].lvl % 2 === 0 || levels[i].lvl === playerLevel) {
      ctx.fillText(levels[i].lvl, x - 6, graphH + 16);
    }
  }

  // Draw vertical red line at player level
  const px = (playerLevel - minLevel) / (maxLevel - minLevel) * graphW;
  ctx.strokeStyle = "#ff2222";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, graphH);
  ctx.stroke();

  // Draw stat values at player level
  const cur = levels.find(l => l.lvl === playerLevel);
  if (cur) {
    ctx.fillStyle = "#fff";
    ctx.font = "13px Arial";
    ctx.fillText(`Level ${playerLevel}`, px + 8, 18);
    ctx.fillStyle = "#ff6666";
    ctx.fillText(`HP: ${cur.hp}`, px + 8, 36);
    ctx.fillStyle = "#66cfff";
    ctx.fillText(`Speed: ${cur.spd.toFixed(2)}`, px + 8, 54);
    ctx.fillStyle = "#ffd066";
    ctx.fillText(`Damage: ${cur.dmg}`, px + 8, 72);
  }

  // --- Moveable/lockable vertical line and stat box ---
  let hoverLevel = enemyStatGraphLockedLevel !== null ? enemyStatGraphLockedLevel : enemyStatGraphHoverLevel;
  if (hoverLevel === null) hoverLevel = playerLevel; // fallback to player level
  if (hoverLevel < minLevel) hoverLevel = minLevel;
  if (hoverLevel > maxLevel) hoverLevel = maxLevel;
  const hoverX = (hoverLevel - minLevel) / (maxLevel - minLevel) * graphW;

  // Draw moveable line (blue)
  ctx.strokeStyle = "#33aaff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hoverX, 0);
  ctx.lineTo(hoverX, graphH);
  ctx.stroke();

  // Draw stat box at mouse Y (clamped inside graph area)
  const hoverStats = levels.find(l => l.lvl === hoverLevel);
  if (hoverStats) {
    // Use mouse Y if available, else default to middle of graph
    let boxY = typeof enemyStatGraphMouseY === "number" ? enemyStatGraphMouseY - margin : graphH / 2;
    // Clamp boxY so it doesn't go outside the graph
    boxY = Math.max(0, Math.min(graphH - 54, boxY));
    const boxX = hoverX + 12;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#181c22";
    ctx.fillRect(boxX, boxY, 110, 54);
    ctx.globalAlpha = 1.0;
    ctx.font = "12px Arial";
    ctx.fillStyle = "#fff";
    ctx.fillText(`Level ${hoverLevel}`, boxX + 8, boxY + 16);
    ctx.fillStyle = "#ff6666";
    ctx.fillText(`HP: ${hoverStats.hp}`, boxX + 8, boxY + 30);
    ctx.fillStyle = "#66cfff";
    ctx.fillText(`Speed: ${hoverStats.spd.toFixed(2)}`, boxX + 8, boxY + 44);
    ctx.fillStyle = "#ffd066";
    ctx.fillText(`Damage: ${hoverStats.dmg}`, boxX + 8, boxY + 58);
    ctx.restore();
  }

  ctx.restore();
}

// Mouse interaction for the graph with line locking and stat box at mouse
(function wireEnemyStatGraphMouse() {
  const canvas = document.getElementById('enemyStatGraph');
  if (!canvas) return;
  canvas.style.cursor = "pointer";
  let lastMouseLevel = null;

  canvas.addEventListener('mousemove', function(e) {
    if (enemyStatGraphLockedLevel !== null) return; // Don't update if locked
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const margin = 36;
    const graphW = canvas.width - margin * 2;
    const minLevel = 0;
    const playerLevel = state.floor || 1;
    const maxLevel = playerLevel + 5;
    let relX = x - margin;
    relX = Math.max(0, Math.min(graphW, relX));
    const level = Math.round((relX / graphW) * (maxLevel - minLevel) + minLevel);
    enemyStatGraphHoverLevel = level;
    enemyStatGraphMouseY = y;
    lastMouseLevel = level;
    drawEnemyStatGraph();
  });
  canvas.addEventListener('mouseleave', function() {
    if (enemyStatGraphLockedLevel === null) {
      enemyStatGraphHoverLevel = null;
      enemyStatGraphMouseY = null;
      drawEnemyStatGraph();
    }
  });
  canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const margin = 36;
    const graphW = canvas.width - margin * 2;
    const minLevel = 0;
    const playerLevel = state.floor || 1;
    const maxLevel = playerLevel + 5;
    let relX = x - margin;
    relX = Math.max(0, Math.min(graphW, relX));
    const level = Math.round((relX / graphW) * (maxLevel - minLevel) + minLevel);

    if (enemyStatGraphLockedLevel !== null) {
      // Unlock if already locked
      enemyStatGraphLockedLevel = null;
      enemyStatGraphHoverLevel = level;
      enemyStatGraphMouseY = y;
    } else {
      // Lock to current level
      enemyStatGraphLockedLevel = level;
      enemyStatGraphMouseY = y;
    }
    drawEnemyStatGraph();
  });
})();



// Wire Give Rerolls input/button
window.addEventListener('load', () => {
  const giveInput = document.getElementById('giveRerollsInput');
  const giveBtn = document.getElementById('giveRerollsBtn');
  if(giveBtn && giveInput){
    giveBtn.onclick = () => {
      const n = Math.max(0, Math.floor(Number(giveInput.value) || 0));
      if(n <= 0) return;
      state.rerollBank = (state.rerollBank || 0) + n;
      saveGame();
      updateHUD();
      // if level menu open, refresh reroll button text
      const rerollBtn = document.getElementById('levelMenuReroll');
  if(rerollBtn) rerollBtn.textContent = 'Reroll ('+ (typeof levelMenuRerolls !== 'undefined' ? levelMenuRerolls : 1) + (state.rerollBank ? ' +' + state.rerollBank : '') +')';
    };
  }
});

function openLevelUpMenu(){
  if(levelMenuOpen) return; levelMenuOpen = true; gamePaused = true; demoMode = false; createLevelMenuIfNeeded(); levelMenuRerolls = 1;
  currentLevelChoices = makeUpgradeOptions(); // now returns {player, weapon}
  renderLevelMenuOptions();
  const overlay = document.getElementById('levelMenuOverlay'); if(overlay) overlay.style.display='flex';
}

function closeLevelMenu(fullHeal=false){ levelMenuOpen=false; gamePaused=false; const overlay = document.getElementById('levelMenuOverlay'); if(overlay) overlay.style.display='none'; if(fullHeal){ state.player.hp = state.player.maxHp; } }

function applyUpgrade(choice){
  const stat = choice.stat;
  const pct = choice.rarity.mult; // e.g. 0.1 => +10%
  switch(stat){
    case 'Speed': GAME_CONFIG.playerSpeedMult = (GAME_CONFIG.playerSpeedMult || 1) + pct; break;
    case 'Attack': GAME_CONFIG.playerAttackMult = (GAME_CONFIG.playerAttackMult || 1) + pct; break;
    case 'Damage': GAME_CONFIG.playerDamageMult = (GAME_CONFIG.playerDamageMult || 1) + pct; break;
    case 'Health': state.player.maxHp = (state.player.maxHp || GAME_CONFIG.playerBaseMaxHp) + Math.round(pct * 100); GAME_CONFIG.playerBaseMaxHp = state.player.maxHp; break;
    case 'Defence': GAME_CONFIG.playerDefencePct = Math.min(95, (GAME_CONFIG.playerDefencePct||0) + Math.round(pct * 100)); break;
    case 'Luck': GAME_CONFIG.playerLuckPct = Math.min(100, (GAME_CONFIG.playerLuckPct||0) + Math.round(pct * 100)); break;
  }
  // full heal on taking an upgrade
  state.player.hp = state.player.maxHp;
  saveGame();
}

function updateAndDrawDamageNumbers(dt) {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const dn = damageNumbers[i];
    dn.x += dn.vx * dt * 60;
    dn.y += dn.vy * dt * 60;
    dn.vy += 0.08 * dt * 60; // gravity
    dn.time += dt;
    dn.alpha = 1 - dn.time / 0.8; // fade out over 0.8s

    // Draw
    ctx.save();
    ctx.globalAlpha = Math.max(0, dn.alpha);
    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#ff4444";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeText(dn.value, dn.x - cameraOffsetX, dn.y);
    ctx.fillText(dn.value, dn.x - cameraOffsetX, dn.y);
    ctx.restore();

    if (dn.alpha <= 0) damageNumbers.splice(i, 1);
  }
}
window.addEventListener('keydown', tryRestartGameOver);
window.addEventListener('mousedown', tryRestartGameOver);

function tryRestartGameOver() {
  if (!gameOver) return;
  gameOver = false;
  state.floor = 1;
  state.player.lives = GAME_CONFIG.playerBaseLives;
  state.player.hp = state.player.maxHp = GAME_CONFIG.playerBaseMaxHp;
  state.player.x = state.player.checkpoint.x = 100;
  state.player.y = state.player.checkpoint.y = 100;
  state.player.vx = state.player.vy = 0;
  state.techs = {};
  state.rerollBank = 0;
  // Reset gun stats and ownership
  for(const k of Object.keys(WEAPON_CONFIG)){
    if(WEAPON_DEFAULTS[k]) Object.assign(WEAPON_CONFIG[k], WEAPON_DEFAULTS[k]);
  }
  state.ownedGuns = { "basic": true };
  state.equippedGun = "basic";
  updateHUD();
  reseed(Math.floor(Math.random()*1e9));
  resetWorld(true);
}


function advanceFloor(fullHeal = true){ state.floor = (state.floor||0) + 1; reseed(Math.floor(Math.random()*1e9)); resetWorld(fullHeal); }


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