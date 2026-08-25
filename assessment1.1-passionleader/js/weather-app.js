// Entry point: owns the canvas, the render/animation loop, and the
// pixel<->meter coordinate boundary. Wires weather-simulation.js (grid
// physics) to weather-ui.js (controls + input) but contains no physics
// itself -- this is the only file that ever touches CSS pixels, converting
// to/from the meters weather-simulation.js works in right at the point it
// calls into that module. Deliberately a fresh sibling of app.js (off-limits)
// rather than an import from it, adapted for a map instead of a sealed room:
// no wall tool (every tool here acts on a point), and four extra render
// layers (coastline/terrain, graticule, isobars/H-L, and a streamline wind
// particle system) in place of the single cosmetic tracer streak app.js uses
// for its windowless convection cell.

import {
  CELL_SIZE_M,
  cloudCoverageAt,
  COASTLINE_LEVEL,
  decorativeTerrainField,
  DOMAIN_HEIGHT_M,
  findPressureExtrema,
  grid,
  gridResolutionFor,
  latitudeOf,
  pressureRange,
  pressureSources,
  resizeGrid,
  sampleVelocity,
  step,
  thermalSources,
  traceCoastlineContour,
  tracePressureContours,
  weatherTemperatureToColor,
} from "./weather-simulation.js";
import {
  handleCanvasPointer,
  mountControls,
  mountControlsVisibility,
  mountStatusBar,
  state,
  updateStatus,
} from "./weather-ui.js";

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("weather-canvas"));
const ctx = canvas.getContext("2d");
const controls = document.getElementById("controls");
const controlsToggle = document.getElementById("controls-toggle");
const controlsBackdrop = document.getElementById("controls-backdrop");
const statusBar = document.getElementById("status-bar");
const fullscreenToggle = document.getElementById("fullscreen-toggle");

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

// --- Physics grid resolution & the offscreen buffers it drives -------------
//
// Three low-res offscreen canvases get scaled up to the display canvas each
// frame, same technique for all three: the heatmap and clouds (each
// repainted every frame -- temperature and pressure are both constantly
// moving) and the coastline (repainted only on resize -- landFraction is
// static geography with no per-frame change). The coastline's traced outline
// is cached alongside it, recomputed on that same resize-only schedule for
// the same reason.

const heatmapCanvas = document.createElement("canvas");
const heatmapCtx = heatmapCanvas.getContext("2d", { willReadFrequently: false });
let heatmapImageData = null;

function rebuildHeatmapBuffer() {
  heatmapCanvas.width = grid.nx;
  heatmapCanvas.height = grid.ny;
  heatmapImageData = heatmapCtx.createImageData(grid.nx, grid.ny);
  const { data } = heatmapImageData;
  for (let p = 3; p < data.length; p += 4) data[p] = 255;
}

const cloudsCanvas = document.createElement("canvas");
const cloudsCtx = cloudsCanvas.getContext("2d", { willReadFrequently: false });
let cloudsImageData = null;

// Clouds render as pure white at every pixel; only alpha varies per-cell
// (cloudCoverageAt(pressureHpa), every frame), so RGB only ever needs
// setting once here -- the same "fill the channel that never changes once,
// touch only the one that does" trick rebuildHeatmapBuffer uses above, just
// on the other three channels.
function rebuildCloudsBuffer() {
  cloudsCanvas.width = grid.nx;
  cloudsCanvas.height = grid.ny;
  cloudsImageData = cloudsCtx.createImageData(grid.nx, grid.ny);
  const { data } = cloudsImageData;
  for (let p = 0; p < data.length; p += 4) {
    data[p] = 255;
    data[p + 1] = 255;
    data[p + 2] = 255;
  }
}

const coastlineCanvas = document.createElement("canvas");
const coastlineCtx = coastlineCanvas.getContext("2d", { willReadFrequently: false });

const LAND_COLOR = [0x16, 0x24, 0x1a];
const SEA_COLOR = [0x0c, 0x1f, 0x2e];

// Both the filled mask and its outline below are deliberately sampled from
// the same fine decorativeTerrainField() (not grid.landFraction, which is
// physics-resolution and pre-clamped/smoothed for friction purposes) at the
// same COASTLINE_LEVEL cutoff -- so the crisp, jagged outline traced by
// traceCoastlineContour actually follows the filled shape's edge instead of
// two independently-sourced boundaries drifting apart.
function rebuildCoastlineBuffer() {
  const { nx, ny, field } = decorativeTerrainField();
  coastlineCanvas.width = nx;
  coastlineCanvas.height = ny;
  const imageData = coastlineCtx.createImageData(nx, ny);
  const { data } = imageData;
  for (let j = 1; j <= ny; j++) {
    const rowOffset = (j - 1) * nx;
    for (let i = 1; i <= nx; i++) {
      const [r, g, b] = field[j * (nx + 2) + i] >= COASTLINE_LEVEL ? LAND_COLOR : SEA_COLOR;
      const p = (rowOffset + i - 1) * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }
  }
  coastlineCtx.putImageData(imageData, 0, 0);
}

// Traced once per resize against the static decorative height field (not
// once per frame -- geography doesn't move) and cached here, so
// drawCoastlineOutline below is just a stroke of already-known segments,
// same split as the filled coastline itself above.
let coastlineOutlineSegments = [];

function rebuildCoastlineOutline() {
  coastlineOutlineSegments = traceCoastlineContour(COASTLINE_LEVEL);
}

// A couple of inland elevation bands above sea level, purely decorative --
// gives landmass interiors the same crisp topographic-contour look as the
// coastline itself instead of leaving them a flat fill. Reuses
// traceCoastlineContour (a plain "trace the decorative height field at this
// level" call despite the name) rather than a second tracer, and flattens
// both levels into one segment list since drawTerrainRidges strokes them
// identically.
const TERRAIN_RIDGE_LEVELS = [0.5, 0.6];

let terrainRidgeSegments = [];

function rebuildTerrainRidges() {
  terrainRidgeSegments = TERRAIN_RIDGE_LEVELS.flatMap((level) => traceCoastlineContour(level));
}

// The wind particle trail buffer (see "Wind: streamline particle system"
// below) is sized to the display canvas's own device pixels, not the
// physics grid -- unlike heatmap/clouds/coastline, which are small logical
// grids upscaled, this one wants fine per-pixel particle positioning. It's
// never cleared by render()'s clearRect; only faded a little each frame, so
// it's set up here alongside the other offscreen buffers but resized in
// lockstep with the main canvas rather than with the physics grid.
const windCanvas = document.createElement("canvas");
const windCtx = windCanvas.getContext("2d");

function resizeWindCanvas(dpr) {
  windCanvas.width = canvas.width;
  windCanvas.height = canvas.height;
  windCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// A ResizeObserver (not a `window` resize listener) so the canvas also
// re-fits when the controls sidebar opens/closes and reflows it.
function resizeCanvas() {
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  resizeWindCanvas(dpr);

  const { nx, ny } = gridResolutionFor(width / height);
  const resized = grid.nx !== nx || grid.ny !== ny;
  resizeGrid(nx, ny);
  if (resized || !heatmapImageData) {
    rebuildHeatmapBuffer();
    rebuildCloudsBuffer();
    rebuildCoastlineBuffer();
    rebuildCoastlineOutline();
    rebuildTerrainRidges();
  }
}
new ResizeObserver(resizeCanvas).observe(canvas);

// The domain's physical size in meters -- width tracks the grid's own column
// count (see resizeCanvas above); height is always DOMAIN_HEIGHT_M since ny
// never changes (gridResolutionFor always returns GRID_ROWS), the same fixed
// constant weather-simulation.js's own internal domainSize() uses.
function domainSizeM() {
  return { width: grid.nx * CELL_SIZE_M, height: DOMAIN_HEIGHT_M };
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function toMeters(point, bounds) {
  const { width, height } = domainSizeM();
  return { x: (point.x / bounds.width) * width, y: (point.y / bounds.height) * height };
}

// Every tool here acts on a point (no wall-style line-drag tool exists in
// this sim), so pointer handling is simpler than app.js's: just "drag to
// place," spaced out by MIN_PLACEMENT_SPACING so a slow drag doesn't stack
// dozens of overlapping sources under the cursor.
let isPointerDown = false;
let lastPlacementPoint = null;
let suppressDragPlacement = false; // set when a gesture grabs an existing source rather than placing a new one
const MIN_PLACEMENT_SPACING = 18;

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  isPointerDown = true;
  const point = canvasPoint(event);
  const bounds = canvas.getBoundingClientRect();
  const meters = toMeters(point, bounds);
  suppressDragPlacement = handleCanvasPointer(meters.x, meters.y);
  lastPlacementPoint = point;
});

canvas.addEventListener("pointermove", (event) => {
  if (!isPointerDown) return;
  event.preventDefault();
  const point = canvasPoint(event);
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

function endPointerGesture() {
  isPointerDown = false;
  lastPlacementPoint = null;
  suppressDragPlacement = false;
}

window.addEventListener("pointerup", endPointerGesture);
window.addEventListener("pointercancel", endPointerGesture);

// --- Drawing ----------------------------------------------------------------
//
// Render order (opaque-first): coastline + its traced outline -> inland
// terrain ridge contours -> graticule -> heatmap (translucent, gated) ->
// clouds (translucent, gated) -> isobars + H/L (gated together -- highs and
// lows are what isobars circle around, so one toggle covers both) -> wind
// particle trails (gated). Sources draw last since they're the smallest,
// most information-dense marks on the map.

function drawCoastline(bounds) {
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(coastlineCanvas, 0, 0, bounds.width, bounds.height);
}

// Purely decorative pencil-line stroke on top of the filled land/sea mask --
// makes the coastline read as a drawn map edge rather than a flat color
// boundary. gridXToPixel/gridYToPixel are defined further down (shared with
// the isobar tracer, which needs the identical fractional-grid-to-canvas
// conversion); function declarations hoist, so the forward reference is safe.
const COASTLINE_OUTLINE_COLOR = "rgba(148, 163, 184, 0.5)"; // slate-400, faint

function drawCoastlineOutline(bounds) {
  if (!coastlineOutlineSegments.length) return;
  const { nx, ny } = decorativeTerrainField();
  ctx.strokeStyle = COASTLINE_OUTLINE_COLOR;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (const segment of coastlineOutlineSegments) {
    ctx.moveTo(gridXToPixel(segment.x1, nx, bounds), gridYToPixel(segment.y1, ny, bounds));
    ctx.lineTo(gridXToPixel(segment.x2, nx, bounds), gridYToPixel(segment.y2, ny, bounds));
  }
  ctx.stroke();
}

// Fainter and thinner than the coastline outline itself so inland contours
// read as texture, not as a second, competing coastline.
const TERRAIN_RIDGE_COLOR = "rgba(148, 163, 184, 0.22)";

function drawTerrainRidges(bounds) {
  if (!terrainRidgeSegments.length) return;
  const { nx, ny } = decorativeTerrainField();
  ctx.strokeStyle = TERRAIN_RIDGE_COLOR;
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  for (const segment of terrainRidgeSegments) {
    ctx.moveTo(gridXToPixel(segment.x1, nx, bounds), gridYToPixel(segment.y1, ny, bounds));
    ctx.lineTo(gridXToPixel(segment.x2, nx, bounds), gridYToPixel(segment.y2, ny, bounds));
  }
  ctx.stroke();
}

const GRATICULE_ROWS = 6; // horizontal lines -- real latitude, via latitudeOf(y)
const GRATICULE_COLS = 8; // vertical lines -- purely decorative, no globe wraparound in a flat regional domain
const GRATICULE_COLOR = "rgba(226, 232, 240, 0.08)";
const GRATICULE_LABEL_COLOR = "rgba(226, 232, 240, 0.45)";

function formatLatitude(latitudeDeg) {
  const rounded = Math.round(latitudeDeg);
  if (rounded === 0) return "0°";
  return rounded > 0 ? `${rounded}°N` : `${-rounded}°S`;
}

function drawGraticule(bounds) {
  ctx.strokeStyle = GRATICULE_COLOR;
  ctx.lineWidth = 1;
  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = GRATICULE_LABEL_COLOR;

  for (let row = 0; row <= GRATICULE_ROWS; row++) {
    const y = (row / GRATICULE_ROWS) * bounds.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(bounds.width, y);
    ctx.stroke();

    const latitudeDeg = latitudeOf((row / GRATICULE_ROWS) * DOMAIN_HEIGHT_M);
    ctx.fillText(formatLatitude(latitudeDeg), 6, y < 14 ? y + 14 : y - 4);
  }

  for (let col = 0; col <= GRATICULE_COLS; col++) {
    const x = (col / GRATICULE_COLS) * bounds.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, bounds.height);
    ctx.stroke();
  }
}

function drawHeatmap(bounds) {
  const { t, nx, ny } = grid;
  const { data } = heatmapImageData;
  for (let j = 1; j <= ny; j++) {
    const rowOffset = (j - 1) * nx;
    for (let i = 1; i <= nx; i++) {
      const [r, g, b] = weatherTemperatureToColor(t[j * (nx + 2) + i]);
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

// Clouds are a pure reading of the already-solved pressure field, not a
// separately simulated quantity (see cloudCoverageAt in weather-simulation.js)
// -- this loop only ever writes the alpha channel, RGB stays the white
// rebuildCloudsBuffer filled in once.
const CLOUD_MAX_OPACITY = 0.75;

function drawClouds(bounds) {
  const { p, nx, ny } = grid;
  const { data } = cloudsImageData;
  for (let j = 1; j <= ny; j++) {
    const rowOffset = (j - 1) * nx;
    for (let i = 1; i <= nx; i++) {
      const coverage = cloudCoverageAt(p[j * (nx + 2) + i]);
      data[(rowOffset + i - 1) * 4 + 3] = coverage * CLOUD_MAX_OPACITY * 255;
    }
  }
  cloudsCtx.putImageData(cloudsImageData, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cloudsCanvas, 0, 0, bounds.width, bounds.height);
}

// traceContours/findLocalExtrema report positions in fractional GRID
// coordinates (integers at cell centers, same convention as
// atmosphere-grid.js's bilinearSample) -- these convert straight to canvas
// pixels without detouring through meters, since interior cell i=1..nx maps
// linearly to the full canvas width regardless of CELL_SIZE_M. `nx`/`ny` are
// explicit params (not always grid.nx/grid.ny) because coastline/ridge
// segments are traced against the finer decorativeTerrainField() buffer,
// while isobar/extrema segments stay at the physics grid's own resolution.
function gridXToPixel(gx, nx, bounds) {
  return ((gx - 0.5) / nx) * bounds.width;
}
function gridYToPixel(gy, ny, bounds) {
  return ((gy - 0.5) / ny) * bounds.height;
}

const ISOBAR_INTERVAL_HPA = 4;
const ISOBAR_COLOR = "rgba(255, 255, 255, 0.35)";
const LABEL_OUTLINE_COLOR = "rgba(15, 23, 42, 0.85)";
const ISOBAR_LABEL_COLOR = "rgba(255, 255, 255, 0.85)";

function isobarLevels() {
  const { min, max } = pressureRange();
  const levels = [];
  const start = Math.ceil(min / ISOBAR_INTERVAL_HPA) * ISOBAR_INTERVAL_HPA;
  for (let level = start; level <= max; level += ISOBAR_INTERVAL_HPA) levels.push(level);
  return levels;
}

// One label per level, on whichever segment sits nearest horizontal center --
// same "just one plausible label, not full path-following" pragmatism
// traceContours itself takes with unstitched segments.
function drawIsobars(bounds) {
  ctx.lineWidth = 1;
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "left";

  for (const level of isobarLevels()) {
    const segments = tracePressureContours(level);
    if (!segments.length) continue;

    ctx.strokeStyle = ISOBAR_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const segment of segments) {
      ctx.moveTo(gridXToPixel(segment.x1, grid.nx, bounds), gridYToPixel(segment.y1, grid.ny, bounds));
      ctx.lineTo(gridXToPixel(segment.x2, grid.nx, bounds), gridYToPixel(segment.y2, grid.ny, bounds));
    }
    ctx.stroke();

    const center = grid.nx / 2;
    const midSegment = segments.reduce((best, segment) => {
      const segmentX = (segment.x1 + segment.x2) / 2;
      const bestX = (best.x1 + best.x2) / 2;
      return Math.abs(segmentX - center) < Math.abs(bestX - center) ? segment : best;
    });
    const labelX = gridXToPixel((midSegment.x1 + midSegment.x2) / 2, grid.nx, bounds);
    const labelY = gridYToPixel((midSegment.y1 + midSegment.y2) / 2, grid.ny, bounds);
    const label = String(level);
    ctx.lineWidth = 3;
    ctx.strokeStyle = LABEL_OUTLINE_COLOR;
    ctx.strokeText(label, labelX, labelY);
    ctx.fillStyle = ISOBAR_LABEL_COLOR;
    ctx.fillText(label, labelX, labelY);
  }
}

const EXTREMA_MIN_SEPARATION_CELLS = 12;
const HIGH_COLOR = "#38bdf8"; // sky-400 -- real synoptic convention: H is blue
const LOW_COLOR = "#f87171"; // red-400 -- real synoptic convention: L is red

function drawExtremum(letter, color, value, gx, gy, bounds) {
  const x = gridXToPixel(gx, grid.nx, bounds);
  const y = gridYToPixel(gy, grid.ny, bounds);

  ctx.textAlign = "center";
  ctx.font = "bold 18px ui-monospace, monospace";
  ctx.lineWidth = 4;
  ctx.strokeStyle = LABEL_OUTLINE_COLOR;
  ctx.strokeText(letter, x, y);
  ctx.fillStyle = color;
  ctx.fillText(letter, x, y);

  const value1dp = value.toFixed(0);
  ctx.font = "10px ui-monospace, monospace";
  ctx.lineWidth = 3;
  ctx.strokeText(value1dp, x, y + 14);
  ctx.fillText(value1dp, x, y + 14);
  ctx.textAlign = "left";
}

function drawPressureExtrema(bounds) {
  const { maxima, minima } = findPressureExtrema(EXTREMA_MIN_SEPARATION_CELLS);
  for (const extremum of maxima) drawExtremum("H", HIGH_COLOR, extremum.value, extremum.i, extremum.j, bounds);
  for (const extremum of minima) drawExtremum("L", LOW_COLOR, extremum.value, extremum.i, extremum.j, bounds);
}

// --- Wind: streamline particle system ---------------------------------------
//
// MSN Weather/windy.com/earth.nullschool style: thousands of tiny particles,
// each advected every frame by sampling the solver's real velocity field
// (sampleVelocity) at its current position -- same "carries no physics of
// its own" contract as the convection simulator's own tracer streaks
// (js/app.js, off-limits to edit but the spirit this mirrors). What makes
// this read as flowing streamlines rather than a field of moving dots is
// windCanvas (declared above): it is never cleared by render()'s clearRect,
// only faded a little every frame via destination-out compositing, so a
// particle's own recent past positions persist as a fading trail rather
// than needing a second, faked "tail length" calculation the way the old
// tracers above this once did.
//
// Real wind speeds here are geophysical (tens of m/s) against a domain
// that's thousands of km wide -- a particle advected in true
// meters-per-pixel terms would cover a small fraction of a single pixel per
// frame and look completely motionless for its entire lifetime (concretely,
// this is *why* the old tracers never looked like they were flowing: their
// true position barely moved). So particle position is tracked in
// FRACTIONAL domain coordinates (0..1 on each axis, resize-proof) but
// advected using speed *mapped* onto a tunable on-screen pixels-per-second
// scale -- true relative speed and direction come straight from
// sampleVelocity untouched (a particle in 2x the wind still moves at 2x the
// on-screen speed), just rescaled so "flowing" is visible to a human at all.
const WIND_PARTICLE_COUNT = 3000;
const WIND_MIN_LIFE_S = 3;
const WIND_MAX_LIFE_S = 7;
// A particle sitting in wind at this speed moves at WIND_REFERENCE_PIXEL_SPEED
// on screen; other speeds scale linearly from there. Not a physical constant,
// tuned (like the old TRACER_REFERENCE_SPEED_MPS) so typical mid-latitude
// flow at this sim's defaults reads as a lively but readable drift.
const WIND_REFERENCE_SPEED_MPS = 20;
const WIND_REFERENCE_PIXEL_SPEED = 70;
const WIND_MAX_PIXEL_SPEED = 260; // caps one extreme gust from streaking a particle across the whole map in one frame
const WIND_LINE_WIDTH_PX = 1.15;
// Trail fade: destination-out erases this fraction of windCanvas's alpha
// every WIND_TRAIL_HALF_LIFE_S seconds of real time (converted to a
// per-frame fraction from dt below, so the decay rate is frame-rate
// independent) -- long enough to read as a trailing streak, short enough
// that streaks don't smear across the whole map.
const WIND_TRAIL_HALF_LIFE_S = 0.4;
const WIND_COLOR_RGB = "226, 232, 240"; // slate-200, matches the old tracer color
// Fades a segment in/out across the start/end of its particle's life so a
// respawn never pops a full-brightness streak into view or cuts one off
// mid-alpha.
const WIND_FADE_IN_S = 0.4;
const WIND_FADE_OUT_S = 0.6;
// How far past the visible edge (in fractional domain units) a particle may
// drift before respawning -- lets it exit gracefully rather than snapping
// exactly at the boundary.
const WIND_EDGE_MARGIN = 0.04;
// Segments are bucketed by their (rounded) alpha and each non-empty bucket
// gets exactly one ctx.stroke() call, so drawing thousands of
// individually-faded segments costs a handful of stroke calls per frame,
// not thousands.
const WIND_ALPHA_BUCKETS = 10;

const windParticles = [];
let windLayerWasVisible = false;

function randomWindLife() {
  return WIND_MIN_LIFE_S + Math.random() * (WIND_MAX_LIFE_S - WIND_MIN_LIFE_S);
}

function respawnWindParticle(particle) {
  particle.xf = Math.random();
  particle.yf = Math.random();
  particle.age = 0;
  particle.life = randomWindLife();
  particle.justSpawned = true; // suppresses one connecting segment back to wherever it respawns from
}

function ensureWindParticleCount() {
  while (windParticles.length < WIND_PARTICLE_COUNT) {
    const particle = { xf: 0, yf: 0, age: 0, life: 0, justSpawned: true };
    respawnWindParticle(particle);
    particle.age = Math.random() * particle.life; // stagger initial respawns
    windParticles.push(particle);
  }
  windParticles.length = Math.min(windParticles.length, WIND_PARTICLE_COUNT);
}

// A resize invalidates windCanvas's pixel content (setting width/height
// always clears a canvas) but not windParticles' own fractional positions,
// which stay meaningful across a resize -- only this off/on layer-visibility
// transition needs an explicit clear, so a re-enabled Wind layer never pops a
// stale frozen frame back into view.
function clearWindCanvas() {
  windCtx.save();
  windCtx.setTransform(1, 0, 0, 1, 0, 0);
  windCtx.clearRect(0, 0, windCanvas.width, windCanvas.height);
  windCtx.restore();
}

// Advances every particle and redraws windCanvas's trail buffer in one pass
// (not two separate update/draw passes over the same array) since building
// the alpha-bucketed stroke paths needs each particle's freshly-advected
// position anyway.
function updateAndDrawWindParticles(dt, bounds) {
  const { width, height } = domainSizeM();
  const buckets = Array.from({ length: WIND_ALPHA_BUCKETS }, () => []);

  for (const particle of windParticles) {
    const prevPxX = particle.xf * bounds.width;
    const prevPxY = particle.yf * bounds.height;

    const { vx, vy } = sampleVelocity(particle.xf * width, particle.yf * height);
    const speed = Math.hypot(vx, vy);
    if (speed > 1e-9) {
      const pixelSpeed = Math.min(
        (speed / WIND_REFERENCE_SPEED_MPS) * WIND_REFERENCE_PIXEL_SPEED,
        WIND_MAX_PIXEL_SPEED,
      );
      particle.xf += ((vx / speed) * pixelSpeed * dt) / bounds.width;
      particle.yf += ((vy / speed) * pixelSpeed * dt) / bounds.height;
    }
    particle.age += dt;

    const outOfBounds =
      particle.xf < -WIND_EDGE_MARGIN ||
      particle.xf > 1 + WIND_EDGE_MARGIN ||
      particle.yf < -WIND_EDGE_MARGIN ||
      particle.yf > 1 + WIND_EDGE_MARGIN;
    if (particle.age >= particle.life || outOfBounds) {
      respawnWindParticle(particle);
      continue;
    }

    if (particle.justSpawned) {
      particle.justSpawned = false;
      continue; // no segment this frame -- it would connect to an unrelated old position
    }

    const fadeIn = Math.min(particle.age / WIND_FADE_IN_S, 1);
    const fadeOut = Math.min((particle.life - particle.age) / WIND_FADE_OUT_S, 1);
    const speedAlpha = Math.min(0.35 + (speed / WIND_REFERENCE_SPEED_MPS) * 0.65, 1);
    const alpha = fadeIn * fadeOut * speedAlpha;
    if (alpha <= 0.02) continue;

    const bucket = Math.min(WIND_ALPHA_BUCKETS - 1, Math.floor(alpha * WIND_ALPHA_BUCKETS));
    buckets[bucket].push(prevPxX, prevPxY, particle.xf * bounds.width, particle.yf * bounds.height);
  }

  // destination-out subtracts alpha uniformly and leaves color alone, which
  // is what lets a fully transparent buffer fade toward nothing without ever
  // tinting toward black the way fading with a normal fillRect would.
  const fadeAlpha = 1 - Math.pow(0.5, dt / WIND_TRAIL_HALF_LIFE_S);
  windCtx.save();
  windCtx.globalCompositeOperation = "destination-out";
  windCtx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
  windCtx.fillRect(0, 0, bounds.width, bounds.height);
  windCtx.restore();

  windCtx.lineCap = "round";
  windCtx.lineWidth = WIND_LINE_WIDTH_PX;
  for (let bucket = 0; bucket < WIND_ALPHA_BUCKETS; bucket++) {
    const points = buckets[bucket];
    if (!points.length) continue;
    windCtx.strokeStyle = `rgba(${WIND_COLOR_RGB}, ${(bucket + 0.5) / WIND_ALPHA_BUCKETS})`;
    windCtx.beginPath();
    for (let i = 0; i < points.length; i += 4) {
      windCtx.moveTo(points[i], points[i + 1]);
      windCtx.lineTo(points[i + 2], points[i + 3]);
    }
    windCtx.stroke();
  }
}

// windCanvas is sized in device pixels identical to the main canvas (see
// resizeWindCanvas), so compositing it is a 1:1 pixel copy -- drawImage is
// deliberately run against an identity transform here rather than ctx's own
// dpr-scaled one, which would otherwise scale this already-device-pixel-sized
// bitmap a second time.
function drawWind() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(windCanvas, 0, 0);
  ctx.restore();
}

const WARM_COLOR = "#f97316"; // orange-500
const WARM_GLOW = "rgba(249, 115, 22, 0.55)";
const COOL_COLOR = "#38bdf8"; // sky-400
const COOL_GLOW = "rgba(56, 189, 248, 0.55)";
const HIGH_PRESSURE_COLOR = "#a78bfa"; // violet-400 -- matches the High Pressure tool button's own hue
const HIGH_PRESSURE_GLOW = "rgba(167, 139, 250, 0.55)";
const LOW_PRESSURE_COLOR = "#34d399"; // emerald-400 -- matches the Low Pressure tool button's own hue
const LOW_PRESSURE_GLOW = "rgba(52, 211, 153, 0.55)";

// Cosmetic-only: shrinks the drawn circle (and, since haloRadius derives from
// it below, its glow too) without touching the radius argument itself, which
// stays load-bearing physics -- computePdiag/addThermalSourcesForcing's
// spatial falloff and sourceAt's click-to-grab hit test both key off
// source.radius, so scaling that instead would make sources both harder to
// grab and different in how far they actually reach, not just how they look.
const SOURCE_MARKER_DRAW_SCALE = 0.5;

function drawGlowingMarker(x, y, radius, color, glow, scaleX, scaleY) {
  const px = x * scaleX;
  const py = y * scaleY;
  const radiusPx = radius * SOURCE_MARKER_DRAW_SCALE * scaleX;
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

function drawSources(scaleX, scaleY) {
  for (const source of thermalSources) {
    const isWarm = source.temperatureDeltaC >= 0;
    drawGlowingMarker(
      source.x,
      source.y,
      source.radius,
      isWarm ? WARM_COLOR : COOL_COLOR,
      isWarm ? WARM_GLOW : COOL_GLOW,
      scaleX,
      scaleY,
    );
  }
  for (const source of pressureSources) {
    const isHigh = source.pressureDeltaHpa >= 0;
    drawGlowingMarker(
      source.x,
      source.y,
      source.radius,
      isHigh ? HIGH_PRESSURE_COLOR : LOW_PRESSURE_COLOR,
      isHigh ? HIGH_PRESSURE_GLOW : LOW_PRESSURE_GLOW,
      scaleX,
      scaleY,
    );
  }
}

function render(bounds) {
  const { width, height } = domainSizeM();
  const scaleX = bounds.width / width;
  const scaleY = bounds.height / height;

  ctx.clearRect(0, 0, bounds.width, bounds.height);
  drawCoastline(bounds);
  drawCoastlineOutline(bounds);
  drawTerrainRidges(bounds);
  drawGraticule(bounds);

  if (state.layerTemperature) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawHeatmap(bounds);
    ctx.restore();
  }

  if (state.layerClouds) {
    drawClouds(bounds);
  }

  // One toggle covers isobars and H/L together -- highs and lows are what
  // isobars circle around, not an independent layer of their own.
  if (state.layerIsobars) {
    drawIsobars(bounds);
    drawPressureExtrema(bounds);
  }

  if (state.layerWind) {
    drawWind();
  }

  drawSources(scaleX, scaleY);
}

// --- The loop ---------------------------------------------------------------
//
// Same fixed-timestep accumulator as app.js, reused verbatim: physics always
// advances in fixed FIXED_DT substeps regardless of display frame rate, so a
// stalled tab slows the sim down visibly rather than freezing trying to catch
// up or blowing up from one giant step. This solver has no incompressibility
// projection to benchmark against, but 30Hz keeps parity with the known-good
// budget rather than assuming this cheaper step() has room to spare.
const FIXED_DT = 1 / 30;
const MAX_ACCUMULATED_DT = 0.25;
const MAX_STEPS_PER_FRAME = 3;
const MAX_FRAME_DT = 1 / 15;

let lastTime = performance.now();
let statusAccumulator = 0;
let physicsAccumulator = 0;
let fps = 0;

function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, MAX_FRAME_DT);
  lastTime = time;
  fps = fps === 0 ? 1 / dt : fps + (1 / dt - fps) * 0.1;

  if (state.playing) {
    physicsAccumulator = Math.min(physicsAccumulator + dt, MAX_ACCUMULATED_DT);
    let steps = 0;
    while (physicsAccumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      step(FIXED_DT);
      physicsAccumulator -= FIXED_DT;
      steps++;
    }
  }

  const bounds = canvas.getBoundingClientRect();

  // Gated by state.layerWind (unlike the old tracers, which updated
  // unconditionally): at WIND_PARTICLE_COUNT this update is the single most
  // expensive thing in the frame, and unlike a handful of app.js-style
  // tracers, paying that cost while the layer is invisible buys nothing.
  if (state.layerWind) {
    if (!windLayerWasVisible) clearWindCanvas();
    windLayerWasVisible = true;
    ensureWindParticleCount();
    updateAndDrawWindParticles(dt, bounds);
  } else {
    windLayerWasVisible = false;
  }

  render(bounds);

  statusAccumulator += dt;
  if (statusAccumulator >= 0.25) {
    statusAccumulator = 0;
    updateStatus({ fps });
  }

  requestAnimationFrame(frame);
}

console.log(
  "%c\u{1F32C}️ Weather & Atmosphere Simulator%c\nBuilt by Seongsu Kim — u8321477@anu.edu.au",
  "font-weight:bold;font-size:14px;color:#7dd3fc",
  "font-weight:normal;color:#94a3b8",
);

// Order matters: the sidebar's open/closed width classes must land before the
// first resizeCanvas() call, since canvas is a replaced element -- setting
// its width/height attributes against a not-yet-final layout locks in a
// min-content size flexbox then refuses to shrink below.
mountControlsVisibility(controls, controlsToggle, controlsBackdrop);
mountControls(controls);
mountStatusBar(statusBar);
resizeCanvas();
requestAnimationFrame(frame);
