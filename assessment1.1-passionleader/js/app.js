// Entry point: owns the canvas, the render/animation loop, and the
// pixel<->meter coordinate boundary. Wires simulation.js (grid physics) to
// ui.js (controls + input) but contains no physics itself — this is the only
// file that ever touches CSS pixels, converting to/from the meters
// simulation.js works in right at the point it calls into that module.

import {
  addWall,
  CELL_SIZE_M,
  config,
  grid,
  gridResolutionFor,
  resizeGrid,
  sampleTemperature,
  sampleVelocity,
  sources,
  step,
  temperatureToColor,
  walls,
} from "./simulation.js";
import {
  handleCanvasPointer,
  mountControls,
  mountControlsVisibility,
  mountStatusBar,
  state,
  updateStatus,
} from "./ui.js";

const SELECTION_RING_COLOR = "#facc15"; // amber-400 — distinct from both the heat and cold palettes

const canvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("simulation-canvas")
);
const ctx = canvas.getContext("2d");
const controls = document.getElementById("controls");
const controlsToggle = document.getElementById("controls-toggle");
const controlsBackdrop = document.getElementById("controls-backdrop");
const statusBar = document.getElementById("status-bar");
const fullscreenToggle = document.getElementById("fullscreen-toggle");

// Fullscreening the whole page (not just <main>, and not just the canvas's
// own wrapper) keeps the header visible too — on a narrow/mobile layout the
// controls panel starts as a closed drawer, and the only way to open it is
// the "Controls" toggle button that lives in the header, not in <main>.
fullscreenToggle.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
});
document.addEventListener("fullscreenchange", () => {
  const isFullscreen = document.fullscreenElement === document.documentElement;
  fullscreenToggle.textContent = isFullscreen ? "Exit Fullscreen" : "Fullscreen";
  fullscreenToggle.setAttribute("aria-pressed", String(isFullscreen));
});

// --- Physics grid resolution & the offscreen heatmap buffer it drives -----
//
// The grid's row count is fixed (GRID_ROWS in simulation.js); only its column
// count tracks the canvas's own aspect ratio, so gridResolutionFor needs the
// canvas's *display* aspect ratio, not its device-pixel one (both are equal,
// but computed from bounds so this reads directly from CSS layout).

const heatmapCanvas = document.createElement("canvas");
const heatmapCtx = heatmapCanvas.getContext("2d", { willReadFrequently: false });
let heatmapImageData = null;

function rebuildHeatmapBuffer() {
  heatmapCanvas.width = grid.nx;
  heatmapCanvas.height = grid.ny;
  heatmapImageData = heatmapCtx.createImageData(grid.nx, grid.ny);
  // Alpha is opaque everywhere and never changes — set once up front rather
  // than every frame in the hot loop below.
  const { data } = heatmapImageData;
  for (let p = 3; p < data.length; p += 4) data[p] = 255;
}

// A ResizeObserver (not a `window` resize listener) so the canvas also
// re-fits when the controls sidebar opens/closes and reflows it — a layout
// change a `resize` event never fires for.
function resizeCanvas() {
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const { nx, ny } = gridResolutionFor(width / height);
  const resized = grid.nx !== nx || grid.ny !== ny;
  resizeGrid(nx, ny);
  if (resized || !heatmapImageData) rebuildHeatmapBuffer();
}
new ResizeObserver(resizeCanvas).observe(canvas);

// The domain's physical size in meters — width tracks the grid's own column
// count (see resizeCanvas above), height is always grid.ny * CELL_SIZE_M
// (equivalently DOMAIN_HEIGHT_M, since ny never changes) computed the same
// way for symmetry rather than importing a second constant.
function domainSizeM() {
  return { width: grid.nx * CELL_SIZE_M, height: grid.ny * CELL_SIZE_M };
}

// Raw pointer coordinates stay in CSS pixels for gesture bookkeeping (drag
// thresholds, the in-progress wall preview line) — only converted to meters
// right at the point a value crosses into simulation.js.
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function toMeters(point, bounds) {
  const { width, height } = domainSizeM();
  return { x: (point.x / bounds.width) * width, y: (point.y / bounds.height) * height };
}

// Pointer Events (not separate mouse/touch listeners) unify mouse, touch, and
// pen input in one code path across evergreen browsers. Canvas already
// carries Tailwind's `touch-none` class (`touch-action: none`) in index.html,
// which is what stops the browser from hijacking a drag as a page-scroll/zoom
// gesture on mobile — Pointer Events alone don't guarantee that.
//
// Wall obstacles are a line, not a point, so that tool needs the full
// pointerdown → pointerup drag. Every other tool (heat/cold/erase) acts on a
// point, but "drag to place" still means re-applying that point tool as the
// pointer moves — spaced out by MIN_PLACEMENT_SPACING so a slow drag doesn't
// stack dozens of overlapping sources under the cursor.
let wallDragStart = null;
let wallDragCurrent = null;
let isPointerDown = false;
let lastPlacementPoint = null;
const MIN_PLACEMENT_SPACING = 18;
const MIN_WALL_DRAG_DISTANCE = 4; // ignore a plain click/tap with the wall tool selected

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Set when a gesture starts by grabbing an *existing* source (to edit its
// temperature via the slider) rather than placing a new one — suppresses
// drag-to-place for the rest of that gesture so dragging away from the
// selected source doesn't also paint a trail of new sources.
let suppressDragPlacement = false;

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  isPointerDown = true;
  const point = canvasPoint(event);
  if (state.tool === "wall") {
    wallDragStart = point;
    wallDragCurrent = point;
  } else {
    const bounds = canvas.getBoundingClientRect();
    const meters = toMeters(point, bounds);
    suppressDragPlacement = handleCanvasPointer(meters.x, meters.y);
    lastPlacementPoint = point;
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!isPointerDown) return;
  event.preventDefault();
  const point = canvasPoint(event);

  if (state.tool === "wall") {
    wallDragCurrent = point;
    return;
  }

  if (
    !suppressDragPlacement &&
    (!lastPlacementPoint || pointDistance(point, lastPlacementPoint) >= MIN_PLACEMENT_SPACING)
  ) {
    const bounds = canvas.getBoundingClientRect();
    const meters = toMeters(point, bounds);
    handleCanvasPointer(meters.x, meters.y);
    lastPlacementPoint = point;
  }
});

function endPointerGesture(event) {
  if (wallDragStart) {
    const point = canvasPoint(event);
    if (pointDistance(wallDragStart, point) >= MIN_WALL_DRAG_DISTANCE) {
      const bounds = canvas.getBoundingClientRect();
      const start = toMeters(wallDragStart, bounds);
      const end = toMeters(point, bounds);
      addWall(start.x, start.y, end.x, end.y);
    }
    wallDragStart = null;
    wallDragCurrent = null;
  }
  isPointerDown = false;
  lastPlacementPoint = null;
  suppressDragPlacement = false;
}

window.addEventListener("pointerup", endPointerGesture);
// A touch drag can be interrupted by the OS (an incoming call, a system
// gesture) without ever firing pointerup — without this the wall tool would
// silently drop the very next pointerdown into a stale in-progress drag.
window.addEventListener("pointercancel", endPointerGesture);

// --- Cosmetic tracer streaks -----------------------------------------------
//
// Tracers carry no physics of their own: each frame they're advected by
// literally sampling the solver's own solved velocity field
// (sampleVelocity), the same field the heatmap is drawn from. They exist
// purely to make the flow direction and speed legible on top of the
// temperature heatmap — a wind-map streak per tracer, not a particle system.

const tracers = [];
const TRACER_MIN_LIFE_S = 3;
const TRACER_MAX_LIFE_S = 8;

function randomLife() {
  return TRACER_MIN_LIFE_S + Math.random() * (TRACER_MAX_LIFE_S - TRACER_MIN_LIFE_S);
}

function respawnTracer(tracer) {
  const { width, height } = domainSizeM();
  tracer.x = Math.random() * width;
  tracer.y = Math.random() * height;
  tracer.life = randomLife();
  tracer.vx = 0;
  tracer.vy = 0;
}

function ensureTracerCount() {
  while (tracers.length < config.tracerCount) {
    const tracer = { x: 0, y: 0, life: 0, vx: 0, vy: 0 };
    respawnTracer(tracer);
    tracer.life = Math.random() * TRACER_MAX_LIFE_S; // stagger initial respawns
    tracers.push(tracer);
  }
  tracers.length = Math.min(tracers.length, config.tracerCount);
}

function updateTracers(dt) {
  const { width, height } = domainSizeM();
  for (const tracer of tracers) {
    const { vx, vy } = sampleVelocity(tracer.x, tracer.y);
    tracer.vx = vx;
    tracer.vy = vy;
    tracer.x += vx * dt;
    tracer.y += vy * dt;
    tracer.life -= dt;

    const outOfBounds = tracer.x < 0 || tracer.x > width || tracer.y < 0 || tracer.y > height;
    if (tracer.life <= 0 || outOfBounds) respawnTracer(tracer);
  }
}

const TRACER_RADIUS_PX = 2.2;
// Below this speed a tracer reads as a static dot rather than a
// near-invisible sliver of a streak — tuned against the solver's actual
// (eddy-viscosity-boosted, not real-air) velocity scale, not real wind speed.
const STILL_AIR_SPEED_MPS = 0.03;
const STREAK_MIN_LENGTH_PX = 4;
const STREAK_MAX_LENGTH_PX = 46;
// Speed at which a streak reaches its full drawn length. Empirically tuned
// against the convection-cell preset's typical plume speed, not any physical
// constant — see Task #6 in the project plan for further calibration.
const STREAK_REFERENCE_SPEED_MPS = 0.5;

function rgbaString([r, g, b], a = 1) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Runs once per tracer per frame (up to config.tracerCount of them), so this
// builds its rgba strings directly from the [r,g,b] triple rather than going
// through a "rgb(...)" string and re-parsing it with .replace() for the
// gradient's transparent stop — a meaningful allocation cost at a few hundred
// tracers a frame.
// Room air near the ambient temperature maps to white (temperatureToColor's
// t=0 case), which is also what the heatmap itself renders for an ambient
// cell — an undisguised tracer there is a white dot on a white background,
// invisible by construction rather than by accident. A dark, semi-transparent
// outline drawn underneath every tracer guarantees contrast against any
// heatmap color (white, orange, or blue) without changing the temperature
// tint that's the whole point of coloring them.
const OUTLINE_COLOR = "rgba(15, 23, 42, 0.55)";

function drawTracer(tracer, scaleX, scaleY) {
  const px = tracer.x * scaleX;
  const py = tracer.y * scaleY;
  const rgb = temperatureToColor(sampleTemperature(tracer.x, tracer.y), config.ambientTemperature);
  const speed = Math.hypot(tracer.vx, tracer.vy);

  if (speed < STILL_AIR_SPEED_MPS) {
    // One path, fill (color) then stroke (outline) — two draw calls per
    // tracer instead of two full beginPath/arc/fill passes, since at a few
    // hundred tracers a frame the path construction itself is most of the
    // cost, not the fill/stroke.
    ctx.beginPath();
    ctx.arc(px, py, TRACER_RADIUS_PX, 0, Math.PI * 2);
    ctx.fillStyle = rgbaString(rgb);
    ctx.fill();
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();
    return;
  }

  const reach = Math.min(speed, STREAK_REFERENCE_SPEED_MPS) / STREAK_REFERENCE_SPEED_MPS;
  const length = STREAK_MIN_LENGTH_PX + reach * (STREAK_MAX_LENGTH_PX - STREAK_MIN_LENGTH_PX);
  const dirX = tracer.vx / speed;
  const dirY = tracer.vy / speed;
  // Direction is computed in meter-space (dirX/dirY from vx/vy directly) and
  // only the drawn length is in pixels — scaleX ~= scaleY in practice (the
  // grid's aspect ratio tracks the canvas's), so this doesn't need a
  // per-axis correction to look right.
  const tailX = px - dirX * length;
  const tailY = py - dirY * length;

  const gradient = ctx.createLinearGradient(tailX, tailY, px, py);
  gradient.addColorStop(0, rgbaString(rgb, 0));
  gradient.addColorStop(1, rgbaString(rgb, 1));

  // One path, stroked twice (wide outline, then narrower color on top) —
  // same path-reuse saving as the still-dot case above.
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(px, py);
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = TRACER_RADIUS_PX * 1.4 + 1.6;
  ctx.stroke();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = TRACER_RADIUS_PX * 1.4;
  ctx.stroke();
}

// --- Drawing ----------------------------------------------------------------

const WALL_COLOR = "#94a3b8"; // slate-400 — a solid obstacle
const HEAT_COLOR = "#f97316"; // orange-500
const HEAT_GLOW = "rgba(249, 115, 22, 0.55)";
const COLD_COLOR = "#38bdf8"; // sky-400
const COLD_GLOW = "rgba(56, 189, 248, 0.55)";

function drawHeatmap(bounds) {
  const { t, nx, ny } = grid;
  const { data } = heatmapImageData;
  for (let j = 1; j <= ny; j++) {
    const rowOffset = (j - 1) * nx;
    for (let i = 1; i <= nx; i++) {
      const [r, g, b] = temperatureToColor(t[j * (nx + 2) + i], config.ambientTemperature);
      const p = (rowOffset + i - 1) * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
    }
  }
  heatmapCtx.putImageData(heatmapImageData, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(heatmapCanvas, 0, 0, bounds.width, bounds.height);
}

function drawWall(wall, scaleX, scaleY) {
  ctx.strokeStyle = WALL_COLOR;
  ctx.lineWidth = Math.max(3, CELL_SIZE_M * 2 * scaleX);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(wall.x1 * scaleX, wall.y1 * scaleY);
  ctx.lineTo(wall.x2 * scaleX, wall.y2 * scaleY);
  ctx.stroke();
}

// A soft radial halo behind a solid core reads as "glowing" without a costly
// per-tracer light. Color is decided against the live ambient temperature
// (not a fixed sign) since a "cold" source is only cold relative to whatever
// the room is currently set to.
function drawGlowingSource(source, scaleX, scaleY) {
  const px = source.x * scaleX;
  const py = source.y * scaleY;
  const radiusPx = source.radius * scaleX;
  const isHeat = source.temperature >= config.ambientTemperature;
  const color = isHeat ? HEAT_COLOR : COLD_COLOR;
  const glow = isHeat ? HEAT_GLOW : COLD_GLOW;
  const haloRadius = radiusPx * 2.2;

  const gradient = ctx.createRadialGradient(px, py, radiusPx * 0.3, px, py, haloRadius);
  gradient.addColorStop(0, glow);
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(px, py, haloRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, py, radiusPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Draws the heatmap background, walls, the in-progress wall drag, the
// glowing sources, and every tracer streak on top — sources are the biggest
// opaque shapes on the canvas, and the interesting tracer motion is right at
// a plume's edge, so drawing them first keeps a source's own glow from
// blotting out the tracers swirling around it.
function render(bounds) {
  const { width, height } = domainSizeM();
  const scaleX = bounds.width / width;
  const scaleY = bounds.height / height;

  ctx.clearRect(0, 0, bounds.width, bounds.height);
  drawHeatmap(bounds);

  for (const wall of walls) {
    drawWall(wall, scaleX, scaleY);
  }
  if (wallDragStart && wallDragCurrent) {
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(wallDragStart.x, wallDragStart.y);
    ctx.lineTo(wallDragCurrent.x, wallDragCurrent.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const source of sources) {
    drawGlowingSource(source, scaleX, scaleY);
  }

  for (const tracer of tracers) {
    drawTracer(tracer, scaleX, scaleY);
  }

  // Marks which source the temperature slider currently edits live — without
  // this a user dragging the slider after selecting a source has no visual
  // confirmation of which one is changing.
  if (state.selectedSource) {
    ctx.save();
    ctx.strokeStyle = SELECTION_RING_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(
      state.selectedSource.x * scaleX,
      state.selectedSource.y * scaleY,
      state.selectedSource.radius * scaleX + 8,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
  }
}

// --- The loop ---------------------------------------------------------------
//
// Stable Fluids is unconditionally stable for any dt, but its accuracy still
// degrades at a large one — so physics always advances in fixed FIXED_DT
// substeps via an accumulator, decoupled from however fast (or slow, or
// jittery) the display's real frame rate is. MAX_ACCUMULATED_DT and
// MAX_STEPS_PER_FRAME together mean a stall (a backgrounded tab, a slow
// device) makes the sim visibly slow down rather than either freezing the
// page trying to catch up or blowing up numerically from one giant step.

// 30Hz rather than 60Hz: benchmarking the Jacobi/Gauss-Seidel solver
// (js/simulation.js's VISC_ITERS/PROJ_ITERS/TEMP_DIFF_ITERS) showed a single
// step() on the default grid resolution costs close to a 60fps frame budget
// on its own — Stable Fluids stays unconditionally stable at this larger dt
// (that's the method's whole point), just with proportionally less temporal
// resolution, which convection's slow (multi-second) timescales don't need.
const FIXED_DT = 1 / 30;
const MAX_ACCUMULATED_DT = 0.25;
const MAX_STEPS_PER_FRAME = 3;

let lastTime = performance.now();
let statusAccumulator = 0;
let physicsAccumulator = 0;
let fps = 0;

const MAX_FRAME_DT = 1 / 15; // clamp long gaps (tab backgrounded, first frame)

function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, MAX_FRAME_DT);
  lastTime = time;
  fps = fps === 0 ? 1 / dt : fps + (1 / dt - fps) * 0.1; // smoothed, not raw-per-frame

  if (state.playing) {
    physicsAccumulator = Math.min(physicsAccumulator + dt, MAX_ACCUMULATED_DT);
    let steps = 0;
    while (physicsAccumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      step(FIXED_DT);
      physicsAccumulator -= FIXED_DT;
      steps++;
    }
  }

  ensureTracerCount();
  updateTracers(dt);

  const bounds = canvas.getBoundingClientRect();
  render(bounds);

  // Four times a second is plenty for a readout a human is looking at, and
  // far cheaper than a DOM write every frame.
  statusAccumulator += dt;
  if (statusAccumulator >= 0.25) {
    statusAccumulator = 0;
    updateStatus({ fps, tracerCount: tracers.length });
  }

  requestAnimationFrame(frame);
}

// Order matters: the sidebar's open/closed width classes must land before the
// first resizeCanvas() call, since canvas is a replaced element — setting its
// width/height attributes against a not-yet-final layout locks in a min-content
// size that flexbox then refuses to shrink below, permanently overflowing the
// container once the sidebar's real width applies.
mountControlsVisibility(controls, controlsToggle, controlsBackdrop);
mountControls(controls);
mountStatusBar(statusBar);
resizeCanvas();
requestAnimationFrame(frame);
