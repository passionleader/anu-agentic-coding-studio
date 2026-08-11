// Entry point: owns the canvas and the render/animation loop. Wires
// simulation.js (state + physics) to ui.js (controls + input) but contains
// no simulation logic itself.

import {
  addWall,
  config,
  particles,
  sources,
  step,
  temperatureToColor,
  walls,
  WALL_COLLISION_RADIUS,
} from "./simulation.js";
import {
  handleCanvasPointer,
  mountControls,
  mountControlsVisibility,
  mountStatusBar,
  state,
  syncSliderDisplay,
  updateStatus,
} from "./ui.js";

// Matches the "Particle Count" slider's max in ui.js — density rescaling
// below must never push config.particleCount past what the slider can show.
const MAX_PARTICLE_COUNT = 1000;

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
// Fullscreening anything narrower than the whole document would strand that
// button outside the fullscreened subtree, leaving no way to reach the tool
// menu at all.
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

// Tracks the canvas's own area across resizes so particle count can scale
// with it (see resizeCanvas below) — null until the first real measurement.
let previousArea = null;

// A ResizeObserver (not a `window` resize listener) so the canvas also
// re-fits when the controls sidebar opens/closes and reflows it — a layout
// change a `resize` event never fires for. Also keeps particle density
// (particles per pixel of canvas) roughly constant across the resize: going
// fullscreen reveals a lot of new canvas area, and without this the same
// fixed particle count would leave that new area looking empty until random
// drift happened to wander into it.
function resizeCanvas() {
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const area = width * height;
  if (previousArea) {
    const scaled = Math.round((config.particleCount * area) / previousArea);
    config.particleCount = Math.max(0, Math.min(MAX_PARTICLE_COUNT, scaled));
    syncSliderDisplay(controls, "particle-count", config.particleCount);
  }
  previousArea = area;
}
new ResizeObserver(resizeCanvas).observe(canvas);

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

// Pointer Events (not separate mouse/touch listeners) unify mouse, touch, and
// pen input in one code path across evergreen browsers — listening to raw
// touchstart/touchmove/touchend as well would just fire a second, redundant
// event stream for the same gesture. Canvas already carries Tailwind's
// `touch-none` class (`touch-action: none`) in index.html, which is what
// stops the browser from hijacking a drag as a page-scroll/zoom gesture on
// mobile — Pointer Events alone don't guarantee that.
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
  // Defense in depth: `touch-action: none` (index.html's `touch-none` class)
  // already stops the browser from turning this into a page-scroll/zoom on
  // mobile, but preventDefault() here covers browsers with edge-case gaps.
  event.preventDefault();
  isPointerDown = true;
  const point = canvasPoint(event);
  if (state.tool === "wall") {
    wallDragStart = point;
    wallDragCurrent = point;
  } else {
    suppressDragPlacement = handleCanvasPointer(point.x, point.y);
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
    handleCanvasPointer(point.x, point.y);
    lastPlacementPoint = point;
  }
});

function endPointerGesture(event) {
  if (wallDragStart) {
    const point = canvasPoint(event);
    if (pointDistance(wallDragStart, point) >= MIN_WALL_DRAG_DISTANCE) {
      addWall(wallDragStart.x, wallDragStart.y, point.x, point.y);
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

const PARTICLE_RADIUS = 2.6;
// Barely-moving air still needs to read as something on screen, so below this
// speed a particle draws as the old dot rather than a near-invisible sliver.
const STILL_AIR_SPEED = 4;
const STREAK_MIN_LENGTH = 4;
const STREAK_MAX_LENGTH = 60;
// Speed at which a streak reaches its full length. Deliberately below the
// simulation's hard MAX_SPEED clamp (rarely reached in practice) so ordinary
// currents stretch out visibly instead of only the most extreme outliers.
const STREAK_REFERENCE_SPEED = 140;
const WALL_THICKNESS = WALL_COLLISION_RADIUS * 2;
const WALL_FILL = "#94a3b8"; // slate-400 — a solid obstacle, not just a boundary line
const BOUNDARY_COLOR = "#94a3b8"; // slate-400 — marks the sealed canvas edge particles bounce off, bright enough to read against a black canvas
const BOUNDARY_THICKNESS = 3;
const HEAT_COLOR = "#f97316"; // orange-500
const HEAT_GLOW = "rgba(249, 115, 22, 0.55)";
const COLD_COLOR = "#38bdf8"; // sky-400
const COLD_GLOW = "rgba(56, 189, 248, 0.55)";

// A wall's collision hitbox is a rounded capsule (see closestPointOnSegment +
// WALL_COLLISION_RADIUS in simulation.js), so drawing it as a thick
// round-capped stroke — rather than a thin center line — makes the solid
// filled shape match exactly what particles actually collide with.
function drawWall(wall) {
  ctx.strokeStyle = WALL_FILL;
  ctx.lineWidth = WALL_THICKNESS;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(wall.x1, wall.y1);
  ctx.lineTo(wall.x2, wall.y2);
  ctx.stroke();
}

// temperatureToColor returns "rgb(r, g, b)" — reused here as the opaque head
// of a streak's gradient, faded to transparent at the tail.
function fadedRgb(rgbString) {
  return rgbString.replace("rgb(", "rgba(").replace(")", ", 0)");
}

// Wind-map style: air in motion draws as a short streamline trailing behind
// its direction of travel, tapered from transparent tail to solid head,
// rather than a static dot — length and opacity both scale with speed so a
// fast current visibly reads as "faster" than a lazy drift.
function drawWindStreak(particle, speed) {
  const color = temperatureToColor(particle.temperature);
  const reach = Math.min(speed, STREAK_REFERENCE_SPEED) / STREAK_REFERENCE_SPEED;
  const length = STREAK_MIN_LENGTH + reach * (STREAK_MAX_LENGTH - STREAK_MIN_LENGTH);
  const dirX = particle.vx / speed;
  const dirY = particle.vy / speed;
  const tailX = particle.x - dirX * length;
  const tailY = particle.y - dirY * length;

  const gradient = ctx.createLinearGradient(tailX, tailY, particle.x, particle.y);
  gradient.addColorStop(0, fadedRgb(color));
  gradient.addColorStop(1, color);

  ctx.strokeStyle = gradient;
  ctx.lineWidth = PARTICLE_RADIUS * 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(particle.x, particle.y);
  ctx.stroke();
}

// A soft radial halo behind a solid core reads as "glowing" without a costly
// per-particle light — shadowBlur alone would also work but washes out at
// small radii, so the gradient halo carries most of the glow.
function drawGlowingSource(source) {
  const isHeat = source.temperature >= 0;
  const color = isHeat ? HEAT_COLOR : COLD_COLOR;
  const glow = isHeat ? HEAT_GLOW : COLD_GLOW;
  const haloRadius = source.radius * 2.2;

  const gradient = ctx.createRadialGradient(source.x, source.y, source.radius * 0.3, source.x, source.y, haloRadius);
  gradient.addColorStop(0, glow);
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(source.x, source.y, haloRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(source.x, source.y, source.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// The simulation treats the canvas edge as a solid wall (resolveBoundaryCollisions
// in simulation.js) but drew nothing there, so particles bouncing off it looked
// like they were drifting off-screen and vanishing. This traces that same edge
// so the sealed boundary is visible, not just physically real.
function drawBoundary(bounds) {
  ctx.strokeStyle = BOUNDARY_COLOR;
  ctx.lineWidth = BOUNDARY_THICKNESS;
  ctx.strokeRect(
    BOUNDARY_THICKNESS / 2,
    BOUNDARY_THICKNESS / 2,
    bounds.width - BOUNDARY_THICKNESS,
    bounds.height - BOUNDARY_THICKNESS,
  );
}

// Draws walls, the in-progress wall drag, every particle (colored by
// temperature), and the glowing sources on top so their markers stay visible
// even where particles cluster around them.
function render(bounds) {
  ctx.clearRect(0, 0, bounds.width, bounds.height);

  drawBoundary(bounds);

  for (const wall of walls) {
    drawWall(wall);
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

  for (const particle of particles) {
    const speed = Math.hypot(particle.vx, particle.vy);
    if (speed < STILL_AIR_SPEED) {
      ctx.fillStyle = temperatureToColor(particle.temperature);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, PARTICLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    drawWindStreak(particle, speed);
  }

  for (const source of sources) {
    drawGlowingSource(source);
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
    ctx.arc(state.selectedSource.x, state.selectedSource.y, state.selectedSource.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

let lastTime = performance.now();
let statusAccumulator = 0;
let fps = 0;

const MAX_DT = 1 / 15; // clamp long gaps (tab backgrounded, first frame) to one slow step

function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, MAX_DT);
  lastTime = time;
  fps = fps === 0 ? 1 / dt : fps + (1 / dt - fps) * 0.1; // smoothed, not raw-per-frame

  // Measured once and shared: step() needs it for boundary collisions, render()
  // for clearRect — one layout read instead of two.
  const bounds = canvas.getBoundingClientRect();
  if (state.playing) step(dt, bounds);
  render(bounds);

  // Four times a second is plenty for a readout a human is looking at, and
  // far cheaper than a DOM write every frame.
  statusAccumulator += dt;
  if (statusAccumulator >= 0.25) {
    statusAccumulator = 0;
    updateStatus({ fps, particleCount: particles.length });
  }

  requestAnimationFrame(frame);
}

// Order matters: the sidebar's open/closed width classes must land before the
// first resizeCanvas() call, since canvas is a replaced element — setting its
// width/height attributes against a not-yet-final layout locks in a min-content
// size that flexbox then refuses to shrink below, permanently overflowing the
// container once the sidebar's real width applies.
mountControlsVisibility(controls, controlsToggle, controlsBackdrop);
mountControls(controls, () => canvas.getBoundingClientRect());
mountStatusBar(statusBar);
resizeCanvas();
requestAnimationFrame(frame);
