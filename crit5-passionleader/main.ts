// Playable slice of the Crit 5 game: a scrolling camera over multi-map
// stages (see stages.ts), each ending in a boss. Sprites/bg/audio from
// public/assets/ (see CREDITS.md). game-rules.ts stays the pure rule engine
// this file drives.
import { applyHit, bossHp, isGameOver, isMonsterDead, loseLife, STARTING_LIVES, type Weapon } from "./game-rules.ts";
import { buildMap, STAGES, type MapSpec } from "./stages.ts";
import { isTouchDevice, setupTouchControls } from "./touch-controls.ts";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 300;
const GROUND_Y = 260;
const PLAYER_WIDTH = 28;
const PLAYER_HEIGHT = 40;
const PLAYER_SPRITE_HEIGHT = 42;
const BASE_MONSTER_SIZE = 35;
const MOVE_SPEED = 4;
const PROJECTILE_SPEED = 7;
const MONSTER_PROJECTILE_SPEED = 4;
const FIRE_COOLDOWN_MS = 500;
const HURT_FLASH_MS = 260;
const INVULNERABLE_MS = 900;
const HIT_FLASH_MS = 120;
const POP_LIFE_MS = 320;
const SHAKE_MS = 220;
const GRAVITY = 0.6;
const JUMP_SPEED = 10;
const MAP_EDGE_MARGIN = 20;
const MONSTER_ATTACK_RANGE = 260;
const MONSTER_ATTACK_COOLDOWN_MS = 1400;
const GUIDE_TIMEOUT_MS = 4000;

type PlayerAnim = "idle" | "run" | "hurt";

interface Monster {
  x: number;
  hp: number;
  alive: boolean;
  isBoss: boolean;
  width: number;
  height: number;
  flashUntil: number;
  lastAttackAt: number;
}

interface Projectile {
  x: number;
  vx: number;
  owner: "player" | "monster";
  weapon?: Weapon;
}

interface Pickup {
  x: number;
  kind: "gun" | "fruit" | "heart";
  fruitEmoji: string;
  taken: boolean;
}

interface Obstacle {
  x: number;
  width: number;
  kind: "block" | "gap";
}

interface Pop {
  x: number;
  y: number;
  glyph: string;
  startedAt: number;
}

interface Banner {
  text: string;
  startedAt: number;
}

function must<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

function loadFrames(dir: string, name: string, count: number): Promise<HTMLImageElement[]> {
  return Promise.all(
    Array.from({ length: count }, (_, i) => loadImage(`./assets/${dir}/${name}-${i + 1}.png`)),
  );
}

function makeSfxPool(src: string, size = 4): HTMLAudioElement[] {
  return Array.from({ length: size }, () => {
    const audio = new Audio(src);
    audio.volume = 0.5;
    return audio;
  });
}

function playSfx(pool: HTMLAudioElement[]): void {
  const free = pool.find((a) => a.paused || a.ended) ?? pool[0];
  free.currentTime = 0;
  free.play().catch(() => {});
}

function overlap(ax: number, aw: number, bx: number, bw: number): boolean {
  return ax < bx + bw && ax + aw > bx;
}

const canvas = must(document.querySelector<HTMLCanvasElement>("#game"), "missing #game canvas");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const ctx = must(canvas.getContext("2d"), "2d canvas context unavailable");
const pauseBtn = must(document.querySelector<HTMLButtonElement>("#pause-btn"), "missing #pause-btn");
const resumeBtn = must(document.querySelector<HTMLButtonElement>("#resume-btn"), "missing #resume-btn");
const resetBtn = must(document.querySelector<HTMLButtonElement>("#reset-btn"), "missing #reset-btn");
const muteBtn = must(document.querySelector<HTMLButtonElement>("#mute-btn"), "missing #mute-btn");
const fullscreenBtn = must(document.querySelector<HTMLButtonElement>("#fullscreen-btn"), "missing #fullscreen-btn");
const gameWrap = must(document.querySelector<HTMLElement>("#game-wrap"), "missing #game-wrap");

const player = { x: 60, y: 0, vy: 0, vx: 0, facing: 1 as 1 | -1, grounded: true };
let weapon: Weapon = "boomerang";
let lives = STARTING_LIVES;
let score = 0;
let gameOver = false;
let victory = false;
let lastFireAt = -Infinity;
let hurtUntil = -Infinity;
let invulnerableUntil = -Infinity;
let shakeUntil = -Infinity;
let banner: Banner | null = null;
let firstInputGiven = false;
let guideStartedAt = -Infinity;
let paused = false;
let muted = false;

let stageIndex = 0;
let mapIndex = 0;
let mapSpec: MapSpec = buildMap(0, 0);
let cameraX = 0;

let monsters: Monster[] = [];
let pickups: Pickup[] = [];
let obstacles: Obstacle[] = [];
const projectiles: Projectile[] = [];
const pops: Pop[] = [];
const keys = new Set<string>();

const bgm = new Audio("./assets/audio/seong_retro_adventure.mp3");
bgm.loop = true;
bgm.volume = 0.35;
const sfxHit = makeSfxPool("./assets/audio/hit.wav");
const sfxHurt = makeSfxPool("./assets/audio/hurt.wav", 2);
const sfxPickup = makeSfxPool("./assets/audio/pickup.wav");
const sfxPowerup = makeSfxPool("./assets/audio/powerup.wav", 1);
let bgmStarted = false;

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(e.code)) e.preventDefault();
  if (!bgmStarted) {
    bgmStarted = true;
    bgm.play().catch(() => {});
  }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(e.code)) firstInputGiven = true;
  if (e.code === "Space") fire();
  else if (e.code === "ArrowUp") jump();
  else keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

pauseBtn.addEventListener("click", () => pauseGame());
resumeBtn.addEventListener("click", () => resumeGame());
resetBtn.addEventListener("click", () => resetGame());
muteBtn.addEventListener("click", () => toggleMute());
fullscreenBtn.addEventListener("click", () => toggleFullscreen());
document.addEventListener("fullscreenchange", () => {
  const active = document.fullscreenElement != null;
  fullscreenBtn.textContent = active ? "⛗" : "⛶";
  fullscreenBtn.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
});

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    gameWrap.requestFullscreen().catch(() => {});
  }
}

function instantiateMonster(spec: { x: number; hp: number; isBoss: boolean }): Monster {
  const stage = STAGES[stageIndex];
  const scale = spec.isBoss ? stage.monsterScale * 1.8 : stage.monsterScale;
  return {
    x: spec.x,
    hp: spec.hp,
    alive: true,
    isBoss: spec.isBoss,
    width: BASE_MONSTER_SIZE * scale,
    height: BASE_MONSTER_SIZE * scale,
    flashUntil: -Infinity,
    lastAttackAt: -Infinity,
  };
}

function loadMap(newStageIndex: number, newMapIndex: number): void {
  stageIndex = newStageIndex;
  mapIndex = newMapIndex;
  mapSpec = buildMap(stageIndex, mapIndex);
  monsters = mapSpec.monsters.map(instantiateMonster);
  pickups = mapSpec.pickups.map((p) => ({ ...p, taken: false }));
  obstacles = mapSpec.obstacles.slice();
  projectiles.length = 0;
  resetPlayerToMapStart();
}

function resetPlayerToMapStart(): void {
  player.x = 60;
  player.y = 0;
  player.vy = 0;
  player.grounded = true;
  cameraX = 0;
}

function advanceMap(): void {
  loadMap(stageIndex, mapIndex + 1);
}

function endGame(): void {
  gameOver = true;
  bgm.pause();
  pauseBtn.hidden = true;
  resumeBtn.hidden = true;
  resetBtn.hidden = false;
}

function advanceStage(): void {
  if (stageIndex >= STAGES.length - 1) {
    victory = true;
    endGame();
    return;
  }
  loadMap(stageIndex + 1, 0);
  banner = { text: `STAGE ${stageIndex + 1}`, startedAt: performance.now() };
}

function takeHit(now: number): void {
  lives = loseLife(lives);
  hurtUntil = now + HURT_FLASH_MS;
  invulnerableUntil = now + INVULNERABLE_MS;
  shakeUntil = now + SHAKE_MS;
  playSfx(sfxHurt);
  if (isGameOver(lives)) endGame();
}

function fallIntoGap(now: number): void {
  takeHit(now);
  if (!gameOver) resetPlayerToMapStart();
}

function pauseGame(): void {
  if (paused) return;
  paused = true;
  bgm.pause();
  pauseBtn.hidden = true;
  resumeBtn.hidden = false;
  resetBtn.hidden = false;
}

function resumeGame(): void {
  if (!paused) return;
  paused = false;
  if (bgmStarted) bgm.play().catch(() => {});
  pauseBtn.hidden = false;
  resumeBtn.hidden = true;
  resetBtn.hidden = true;
}

function resetGame(): void {
  weapon = "boomerang";
  lives = STARTING_LIVES;
  score = 0;
  gameOver = false;
  victory = false;
  paused = true;
  lastFireAt = -Infinity;
  hurtUntil = -Infinity;
  invulnerableUntil = -Infinity;
  shakeUntil = -Infinity;
  loadMap(0, 0);
  banner = { text: "STAGE 1", startedAt: performance.now() };
  resumeGame();
}

function toggleMute(): void {
  muted = !muted;
  bgm.muted = muted;
  for (const pool of [sfxHit, sfxHurt, sfxPickup, sfxPowerup]) {
    for (const audio of pool) audio.muted = muted;
  }
  muteBtn.textContent = muted ? "🔇" : "🔊";
  muteBtn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
}

function fire(): void {
  if (gameOver || paused) return;
  const now = performance.now();
  if (now - lastFireAt < FIRE_COOLDOWN_MS) return;
  lastFireAt = now;
  const dir = player.facing;
  projectiles.push({
    x: player.x + (dir === 1 ? PLAYER_WIDTH : -6),
    vx: PROJECTILE_SPEED * dir,
    owner: "player",
    weapon,
  });
}

function jump(): void {
  if (gameOver || paused) return;
  if (player.grounded) {
    player.vy = JUMP_SPEED;
    player.grounded = false;
  }
}

function obstacleAt(worldX: number): Obstacle | undefined {
  return obstacles.find((o) => worldX >= o.x && worldX <= o.x + o.width);
}

function update(): void {
  if (gameOver || paused) return;
  const now = performance.now();
  const stage = STAGES[stageIndex];

  player.vx = 0;
  if (keys.has("ArrowLeft")) player.vx = -MOVE_SPEED;
  if (keys.has("ArrowRight")) player.vx = MOVE_SPEED;
  if (player.vx !== 0) player.facing = player.vx > 0 ? 1 : -1;

  let nextX = player.x + player.vx;
  const footX = nextX + PLAYER_WIDTH / 2;
  const blocking = player.grounded ? obstacleAt(footX) : undefined;
  if (blocking?.kind === "block") {
    nextX = player.vx > 0 ? blocking.x - PLAYER_WIDTH : blocking.x + blocking.width;
  }
  player.x = Math.max(0, Math.min(mapSpec.width - PLAYER_WIDTH, nextX));

  player.y += player.vy;
  player.vy -= GRAVITY;
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  if (player.grounded) {
    const gap = obstacleAt(player.x + PLAYER_WIDTH / 2);
    if (gap?.kind === "gap") {
      fallIntoGap(now);
      return;
    }
  }

  cameraX = Math.max(0, Math.min(player.x - CANVAS_WIDTH / 2, mapSpec.width - CANVAS_WIDTH));

  for (const p of projectiles) p.x += p.vx;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    if (projectiles[i].x < -50 || projectiles[i].x > mapSpec.width + 50) projectiles.splice(i, 1);
  }

  for (const monster of monsters) {
    if (!monster.alive) continue;

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const shot = projectiles[i];
      if (shot.owner !== "player" || !shot.weapon) continue;
      if (overlap(shot.x, 6, monster.x, monster.width)) {
        monster.hp = applyHit(monster.hp, shot.weapon);
        monster.flashUntil = now + HIT_FLASH_MS;
        playSfx(sfxHit);
        projectiles.splice(i, 1);
        if (isMonsterDead(monster.hp)) {
          monster.alive = false;
          score += monster.isBoss ? 500 : 50;
        }
        break;
      }
    }

    if (monster.alive && stage.monsterAttacks && now - monster.lastAttackAt > MONSTER_ATTACK_COOLDOWN_MS) {
      const dist = Math.abs(player.x - monster.x);
      if (dist < MONSTER_ATTACK_RANGE) {
        monster.lastAttackAt = now;
        const dir = player.x > monster.x ? 1 : -1;
        projectiles.push({ x: monster.x, vx: MONSTER_PROJECTILE_SPEED * dir, owner: "monster" });
      }
    }

    if (
      monster.alive &&
      player.grounded &&
      now >= invulnerableUntil &&
      overlap(player.x, PLAYER_WIDTH, monster.x, monster.width)
    ) {
      takeHit(now);
    }

    if (!monster.alive && monster.isBoss) {
      advanceStage();
      return;
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const shot = projectiles[i];
    if (shot.owner === "monster" && player.grounded && overlap(shot.x, 8, player.x, PLAYER_WIDTH)) {
      projectiles.splice(i, 1);
      if (now >= invulnerableUntil) takeHit(now);
    }
  }

  for (const pickup of pickups) {
    if (pickup.taken) continue;
    if (overlap(player.x, PLAYER_WIDTH, pickup.x, 20)) {
      pickup.taken = true;
      let glyph = "+10";
      if (pickup.kind === "fruit") {
        score += 10;
        playSfx(sfxPickup);
      } else if (pickup.kind === "gun") {
        weapon = "gun";
        playSfx(sfxPowerup);
        glyph = "+GUN";
      } else {
        lives = Math.min(STARTING_LIVES, lives + 1);
        playSfx(sfxPowerup);
        glyph = "+1❤";
      }
      pops.push({ x: pickup.x + 10, y: GROUND_Y - 30, glyph, startedAt: now });
    }
  }

  for (let i = pops.length - 1; i >= 0; i--) {
    if (now - pops[i].startedAt > POP_LIFE_MS) pops.splice(i, 1);
  }

  if (!mapSpec.isBossMap && player.x + PLAYER_WIDTH >= mapSpec.width - MAP_EDGE_MARGIN) {
    advanceMap();
  }
}

function playerFrame(state: PlayerAnim, now: number): HTMLImageElement {
  if (state === "hurt") {
    const frames = sprites.playerHurt;
    return frames[Math.floor(now / 100) % frames.length];
  }
  if (state === "run") {
    const frames = sprites.playerRun;
    return frames[Math.floor(now / 80) % frames.length];
  }
  const frames = sprites.playerIdle;
  return frames[Math.floor(now / 220) % frames.length];
}

function drawSpriteFeetAt(img: HTMLImageElement, footX: number, footY: number, height: number, facing: 1 | -1): void {
  const width = (img.width / img.height) * height;
  ctx.save();
  if (facing === -1) {
    ctx.translate(footX + width, footY - height);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, width, height);
  } else {
    ctx.drawImage(img, footX, footY - height, width, height);
  }
  ctx.restore();
}

function drawBanner(now: number): void {
  if (!banner) return;
  const elapsed = now - banner.startedAt;
  if (elapsed > 1000) {
    banner = null;
    return;
  }
  const alpha = elapsed < 750 ? 1 : 1 - (elapsed - 750) / 250;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, CANVAS_HEIGHT / 2 - 34, CANVAS_WIDTH, 44);
  ctx.fillStyle = "#f4f4f0";
  ctx.font = "bold 28px monospace";
  ctx.textAlign = "center";
  ctx.fillText(banner.text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 4);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawKeyGuide(now: number): void {
  if (stageIndex !== 0 || mapIndex !== 0) return;
  if (firstInputGiven) return;
  if (now - guideStartedAt > GUIDE_TIMEOUT_MS) return;

  const baseX = 60 - cameraX;
  const y = GROUND_Y - 46;
  const alpha = 0.55 + 0.25 * Math.sin(now / 220);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#f4f4f0";
  ctx.strokeStyle = "#f4f4f0";
  ctx.lineWidth = 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const keycap = (cx: number, glyph: string): void => {
    ctx.fillStyle = "rgba(10,10,10,0.55)";
    ctx.fillRect(cx - 16, y - 16, 32, 32);
    ctx.strokeRect(cx - 16, y - 16, 32, 32);
    ctx.fillStyle = "#f4f4f0";
    ctx.font = "bold 18px monospace";
    ctx.fillText(glyph, cx, y + 1);
  };

  keycap(baseX, "←");
  keycap(baseX + 40, "→");

  const spaceX = baseX + 100;
  ctx.fillStyle = "rgba(10,10,10,0.55)";
  ctx.fillRect(spaceX - 30, y - 16, 60, 32);
  ctx.strokeRect(spaceX - 30, y - 16, 60, 32);
  ctx.fillStyle = "#f4f4f0";
  ctx.beginPath();
  ctx.arc(spaceX, y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

function draw(): void {
  const now = performance.now();
  const stage = STAGES[stageIndex];

  ctx.save();
  if (now < shakeUntil) {
    const t = (shakeUntil - now) / SHAKE_MS;
    ctx.translate((Math.random() - 0.5) * 6 * t, (Math.random() - 0.5) * 4 * t);
  }

  ctx.drawImage(sprites.bgFar, -cameraX, 0, mapSpec.width, GROUND_Y + 10);

  const treeH = 150;
  for (const worldX of [40, mapSpec.width - 100]) {
    const tw = (sprites.tree.width / sprites.tree.height) * treeH;
    ctx.drawImage(sprites.tree, worldX - cameraX, GROUND_Y - treeH + 20, tw, treeH);
  }
  const plantH = 46;
  for (let i = 0; i < mapSpec.width; i += 260) {
    const pw = (sprites.plant.width / sprites.plant.height) * plantH;
    ctx.drawImage(sprites.plant, i + 90 - cameraX, GROUND_Y - plantH, pw, plantH);
  }

  const tile = 40;
  for (let gx = 0; gx < mapSpec.width; gx += tile) {
    ctx.drawImage(sprites.ground, gx - cameraX, GROUND_Y, tile, CANVAS_HEIGHT - GROUND_Y);
  }
  for (const obstacle of obstacles) {
    const sx = obstacle.x - cameraX;
    if (obstacle.kind === "gap") {
      ctx.fillStyle = "#0a0f0b";
      ctx.fillRect(sx, GROUND_Y, obstacle.width, CANVAS_HEIGHT - GROUND_Y);
    } else {
      ctx.fillStyle = "#6b5334";
      ctx.fillRect(sx, GROUND_Y - 28, obstacle.width, 28);
    }
  }

  if (stage.bgTint) {
    ctx.fillStyle = stage.bgTint;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  for (const pickup of pickups) {
    if (pickup.taken) continue;
    const sx = pickup.x - cameraX;
    ctx.font = "22px system-ui, sans-serif";
    if (pickup.kind === "fruit") {
      ctx.fillText(pickup.fruitEmoji, sx, GROUND_Y - 4);
    } else if (pickup.kind === "heart") {
      ctx.fillText("❤️", sx, GROUND_Y - 4);
    } else {
      ctx.fillStyle = "#3a4a4d";
      ctx.fillRect(sx + 2, GROUND_Y - 12, 6, 9);
      ctx.fillStyle = "#7fb0b8";
      ctx.fillRect(sx, GROUND_Y - 20, 20, 10);
      ctx.fillStyle = "#bfe3e6";
      ctx.fillRect(sx, GROUND_Y - 20, 20, 3);
      ctx.fillStyle = "#4d6b6e";
      ctx.fillRect(sx + 18, GROUND_Y - 17, 10, 5);
      ctx.fillStyle = "#f2e94e";
      ctx.fillRect(sx + 27, GROUND_Y - 16, 3, 3);
      ctx.beginPath();
      ctx.arc(sx + 6, GROUND_Y - 15, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const shot of projectiles) {
    const sx = shot.x - cameraX;
    if (shot.owner === "monster") {
      ctx.fillStyle = "#c23b3b";
      ctx.beginPath();
      ctx.ellipse(sx + 5, GROUND_Y - PLAYER_HEIGHT / 2, 6, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (shot.weapon === "boomerang") {
      ctx.strokeStyle = "#f0d24a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx + 5, GROUND_Y - PLAYER_HEIGHT / 2, 6, 0.3, Math.PI * 1.7);
      ctx.stroke();
    } else {
      const by = GROUND_Y - PLAYER_HEIGHT / 2;
      ctx.fillStyle = "rgba(90, 209, 230, 0.35)";
      ctx.beginPath();
      ctx.ellipse(sx + 5, by, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5ad1e6";
      ctx.beginPath();
      ctx.ellipse(sx + 5, by, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#eafeff";
      ctx.beginPath();
      ctx.ellipse(sx + 3, by, 3, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const monster of monsters) {
    if (!monster.alive) continue;
    const sx = monster.x - cameraX;
    const frame = sprites.slime[Math.floor(now / 140) % sprites.slime.length];
    drawSpriteFeetAt(frame, sx, GROUND_Y, monster.height, 1);
    if (monster.isBoss) {
      ctx.fillStyle = "rgba(194,59,59,0.6)";
      ctx.fillRect(sx, GROUND_Y - monster.height - 12, monster.width, 5);
      ctx.fillStyle = "#c23b3b";
      const fullBossHp = bossHp(STAGES[stageIndex].monsterHp);
      ctx.fillRect(sx, GROUND_Y - monster.height - 12, monster.width * Math.max(0, monster.hp / fullBossHp), 5);
    }
    if (now < monster.flashUntil) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(sx, GROUND_Y - monster.height, monster.width, monster.height);
      ctx.restore();
    }
  }

  const playerState: PlayerAnim = now < hurtUntil ? "hurt" : player.vx !== 0 ? "run" : "idle";
  drawSpriteFeetAt(
    playerFrame(playerState, now),
    player.x - cameraX,
    GROUND_Y - player.y,
    PLAYER_SPRITE_HEIGHT,
    player.facing,
  );

  for (const pop of pops) {
    const t = (now - pop.startedAt) / POP_LIFE_MS;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.fillStyle = "#f4f4f0";
    ctx.font = "bold 14px monospace";
    ctx.fillText(pop.glyph, pop.x - cameraX, pop.y - t * 16);
    ctx.restore();
  }

  drawKeyGuide(now);

  ctx.fillStyle = "rgba(10,10,10,0.45)";
  ctx.fillRect(6, 6, 230, 46);
  ctx.fillStyle = "#f4f4f0";
  ctx.font = "16px monospace";
  ctx.fillText("❤️".repeat(Math.max(0, lives)), 14, 26);
  ctx.fillText(`SCORE ${score}  ${weapon.toUpperCase()}`, 14, 44);

  drawBanner(now);
  ctx.restore();

  if (gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#f4f4f0";
    ctx.font = "28px monospace";
    ctx.textAlign = "center";
    ctx.fillText(victory ? "YOU WIN" : "GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.textAlign = "left";
  } else if (paused) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#f4f4f0";
    ctx.font = "28px monospace";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.textAlign = "left";
  }
}

function loop(): void {
  update();
  draw();
  requestAnimationFrame(loop);
}

interface Sprites {
  playerIdle: HTMLImageElement[];
  playerRun: HTMLImageElement[];
  playerHurt: HTMLImageElement[];
  slime: HTMLImageElement[];
  bgFar: HTMLImageElement;
  ground: HTMLImageElement;
  tree: HTMLImageElement;
  plant: HTMLImageElement;
}

let sprites: Sprites;

Promise.all([
  loadFrames("player", "idle", 4),
  loadFrames("player", "run", 6),
  loadFrames("player", "hurt", 2),
  loadFrames("monster", "slime", 4),
  loadImage("./assets/bg/jungle-far.png"),
  loadImage("./assets/bg/ground.png"),
  loadImage("./assets/bg/tree.png"),
  loadImage("./assets/bg/plant.png"),
]).then(([playerIdle, playerRun, playerHurt, slime, bgFar, ground, tree, plant]) => {
  sprites = { playerIdle, playerRun, playerHurt, slime, bgFar, ground, tree, plant };
  loadMap(0, 0);
  banner = { text: "STAGE 1", startedAt: performance.now() };
  guideStartedAt = performance.now();
  if (isTouchDevice()) {
    const touchControls = must(document.querySelector<HTMLElement>("#touch-controls"), "missing #touch-controls");
    touchControls.hidden = false;
    setupTouchControls(keys, fire, jump);
    if (document.fullscreenEnabled) fullscreenBtn.hidden = false;
  }
  loop();
});
