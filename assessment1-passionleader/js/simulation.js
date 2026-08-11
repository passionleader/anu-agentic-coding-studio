// Simulation state and physics: a real semi-Lagrangian incompressible fluid
// solver ("Stable Fluids", Stam 1999) under the Boussinesq approximation for
// buoyancy, plus heat/cold sources and wall obstacles. No DOM or canvas API
// calls belong here — app.js reads this module's state to draw, and ui.js
// writes to it in response to input.
//
// Everything in this module is in physical units: meters, seconds, degrees
// Celsius, meters/second. app.js is the only place that ever touches CSS
// pixels, converting at the boundary via CELL_SIZE_M. The grid owns its own
// physical domain size, so step() and applyPreset() take no bounds argument.
//
// fluid-grid.js supplies the pure numeric kernels (diffuse/project/advect/
// resample) this module drives; this file adds the vocabulary the kernels
// don't know about — sources, walls, temperature, presets.

import { advect, allocate, bilinearSample, diffuse, index, project, resample } from "./fluid-grid.js";

export const sources = []; // { x, y, temperature, radius } — meters, meters, °C, meters
export const walls = []; // { x1, y1, x2, y2 } — meters

// Tunables the UI's sliders write to.
export const config = {
  ambientTemperature: 20, // °C — the baseline the whole domain starts at and relaxes toward
  // Real air (nu=1.5e-5 m^2/s, alpha=2.2e-5 m^2/s) is far too diffusive-poor
  // to resolve on a real-time grid this coarse — its actual Rayleigh number at
  // room scale is in the hundreds of millions, deep turbulence a 96-row grid
  // has no hope of capturing. Instead the solver's own diffusion uses
  // nu_eff = kinematicViscosityAir * eddyViscosityMultiplier (same for
  // alpha_eff), which boosts the MAGNITUDE of diffusion for numerical
  // stability while keeping their RATIO (the effective Prandtl number)
  // identical to real air's — the same move real-time/LES turbulence models
  // make with an eddy viscosity. See PHYSICAL_CONSTANTS.prandtlAir.
  eddyViscosityMultiplier: 300,
  // Purely a rendering density knob for app.js's cosmetic tracer streaks —
  // lives here (not in app.js) only so ui.js can bind a slider to it without
  // an import pointing the wrong way across the module boundary.
  tracerCount: 400,
};

// Real, unscaled physical constants for air at room temperature — used only
// for the "if this were real air" Rayleigh number shown alongside the
// solver's own, never fed into the solver's actual diffusion (see
// config.eddyViscosityMultiplier above).
export const PHYSICAL_CONSTANTS = {
  kinematicViscosityAir: 1.5e-5, // m^2/s
  thermalDiffusivityAir: 2.1127e-5, // m^2/s — chosen so nu/alpha lands on air's real Pr below
  gravity: 9.81, // m/s^2
  prandtlAir: 0.71, // nu/alpha for air — dimensionless, a material constant
};

// The grid's physical domain is a fixed-height slice of room air; only its
// width (and therefore its column count) varies with the canvas's aspect
// ratio on resize, so the physical meaning of a cell and of
// eddyViscosityMultiplier stays roughly constant across window sizes.
export const DOMAIN_HEIGHT_M = 0.75;
// Benchmarked against the Jacobi/Gauss-Seidel iteration counts above: a
// 96-row grid measured ~24ms per physics step even after removing the
// per-cell allocation in fluid-grid.js's hot loops — too slow to run even one
// step per rendered 60fps frame. 80 rows keeps cells small enough to still
// read as a fluid (not a blocky grid) while cutting solver cost by ~30%.
export const GRID_ROWS = 80;
export const GRID_COLS_MIN = 56;
export const GRID_COLS_MAX = 140;
export const CELL_SIZE_M = DOMAIN_HEIGHT_M / GRID_ROWS;
export const WALL_THICKNESS_M = CELL_SIZE_M * 2;
const DEFAULT_SOURCE_RADIUS_M = 0.05;

// Jacobi/Gauss-Seidel-hybrid iteration counts — the biggest performance lever
// in the whole solver (project() alone runs at 2x these iterations per step,
// twice per frame). Tuned down from a naive first pass (20/20/40) after
// benchmarking showed that cost made 60fps unreachable even at a single
// physics step per rendered frame; these values keep divergence and thermal
// smoothing within the same tolerances spec/simulation.test.ts already checks
// while cutting per-step cost by roughly half.
const VISC_ITERS = 12;
const TEMP_DIFF_ITERS = 12;
const PROJ_ITERS = 24;
const SOURCE_INFLUENCE_MULTIPLIER = 2.2; // how far past its drawn radius a source heats/cools
const HEAT_INJECTION_RATE = 4; // how fast a grid cell picks up a nearby source's temperature
const COLOR_RANGE_C = 35; // +/- this many degrees from ambient maps to full red/blue

// The Ambient Temperature slider's own range (ui.js's slider bounds mirror
// these) -- also doubles as the scale temperatureToColor tints an
// ambient-only room by, so dragging the slider all the way to
// AMBIENT_TEMPERATURE_MIN visibly turns the whole room blue and all the way
// to AMBIENT_TEMPERATURE_MAX turns it red, even with no sources placed.
export const AMBIENT_TEMPERATURE_MIN = -10;
export const AMBIENT_TEMPERATURE_MAX = 40;

function createGrid(nx, ny, ambientTemperature) {
  const grid = {
    nx,
    ny,
    u: allocate(nx, ny),
    v: allocate(nx, ny),
    u0: allocate(nx, ny),
    v0: allocate(nx, ny),
    t: allocate(nx, ny),
    t0: allocate(nx, ny),
    p: allocate(nx, ny),
    div: allocate(nx, ny),
    solid: new Uint8Array((nx + 2) * (ny + 2)),
  };
  grid.t.fill(ambientTemperature);
  return grid;
}

// NX tracks the canvas's aspect ratio each resize, clamped so a very wide or
// very narrow window can't blow the per-frame Jacobi cost past budget or
// collapse the grid to something too coarse to look like a fluid.
export function gridResolutionFor(aspectRatio) {
  const nx = Math.round(GRID_ROWS * aspectRatio);
  return { nx: Math.max(GRID_COLS_MIN, Math.min(GRID_COLS_MAX, nx)), ny: GRID_ROWS };
}

export let grid = createGrid(gridResolutionFor(16 / 9).nx, GRID_ROWS, config.ambientTemperature);

// Reallocates the grid at a new resolution, bilinear-resampling the existing
// velocity/temperature state across rather than discarding it — a window
// resize shouldn't reset the simulation.
export function resizeGrid(nx, ny) {
  if (grid.nx === nx && grid.ny === ny) return;
  const newGrid = createGrid(nx, ny, config.ambientTemperature);
  newGrid.u.set(resample(grid.nx, grid.ny, grid.u, nx, ny));
  newGrid.v.set(resample(grid.nx, grid.ny, grid.v, nx, ny));
  newGrid.t.set(resample(grid.nx, grid.ny, grid.t, nx, ny));
  grid = newGrid;
  // The new grid's solid mask starts all-zero regardless of what `walls`
  // already contains — it needs rasterizing against the current walls even
  // though the walls themselves didn't change.
  wallsDirty = true;
}

function domainSize() {
  return { width: grid.nx * CELL_SIZE_M, height: DOMAIN_HEIGHT_M };
}

function closestPointOnSegment(px, py, wall) {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - wall.x1) * dx + (py - wall.y1) * dy) / lengthSquared));
  const x = wall.x1 + t * dx;
  const y = wall.y1 + t * dy;
  return { x, y, distance: Math.hypot(px - x, py - y) };
}

// Returns the created source so callers (ui.js) can hold onto it as the
// "selected" source for live slider edits, without needing a second lookup.
export function addSource(x, y, temperature, radius = DEFAULT_SOURCE_RADIUS_M) {
  const source = { x, y, temperature, radius };
  sources.push(source);
  return source;
}

export function addWall(x1, y1, x2, y2) {
  walls.push({ x1, y1, x2, y2 });
  wallsDirty = true;
}

// Hit-tests an existing source at (x, y), used so clicking directly on a
// source selects it for editing instead of stacking a duplicate on top.
export function sourceAt(x, y) {
  return sources.find((source) => Math.hypot(source.x - x, source.y - y) <= source.radius) ?? null;
}

// Removes anything within `radius` of (x, y): sources centered there, and
// walls passing within `radius` of the point anywhere along their length.
export function eraseAt(x, y, radius = DEFAULT_SOURCE_RADIUS_M) {
  for (let i = sources.length - 1; i >= 0; i--) {
    if (Math.hypot(sources[i].x - x, sources[i].y - y) <= radius) sources.splice(i, 1);
  }

  for (let i = walls.length - 1; i >= 0; i--) {
    if (closestPointOnSegment(x, y, walls[i]).distance <= radius) {
      walls.splice(i, 1);
      wallsDirty = true;
    }
  }
}

export function clearSources() {
  sources.length = 0;
}

export function reset() {
  sources.length = 0;
  walls.length = 0;
  wallsDirty = true;
  grid.u.fill(0);
  grid.v.fill(0);
  grid.t.fill(config.ambientTemperature);
  ambientBuoyancyReference = config.ambientTemperature;
}

// Named starting scenes, applied against the grid's own physical domain size
// (domainSize()) rather than fixed meters, so a preset looks right regardless
// of the window's aspect ratio.
export const PRESETS = [
  { id: "empty-canvas", label: "Empty Canvas" },
  { id: "convection-cell", label: "Standard Convection Cell" },
  { id: "thermal-chimney", label: "Thermal Chimney Effect" },
  { id: "insulated-room", label: "Insulated Room with AC" },
];

export function applyPreset(id) {
  reset();
  const { width, height } = domainSize();

  if (id === "empty-canvas") {
    // reset() above already cleared sources and walls — a blank domain at
    // whatever tuning the user last had.
    return;
  }

  if (id === "convection-cell") {
    // One heat source low, one cold source high and opposite — the simplest
    // setup that drives a single rolling convection current.
    addSource(width * 0.25, height * 0.85, config.ambientTemperature + 25);
    addSource(width * 0.75, height * 0.15, config.ambientTemperature - 25);
    config.eddyViscosityMultiplier = 200;
    return;
  }

  if (id === "thermal-chimney") {
    // A narrow vertical flue with a heat source at its base — walls funnel
    // the buoyant plume into a fast, constrained updraft (the stack effect).
    const flueLeft = width * 0.42;
    const flueRight = width * 0.58;
    const flueTop = height * 0.2;
    const flueBottom = height * 0.82;
    addWall(flueLeft, flueTop, flueLeft, flueBottom);
    addWall(flueRight, flueTop, flueRight, flueBottom);
    addSource((flueLeft + flueRight) / 2, flueBottom - height * 0.04, config.ambientTemperature + 30, DEFAULT_SOURCE_RADIUS_M * 0.8);
    config.eddyViscosityMultiplier = 150;
    return;
  }

  if (id === "insulated-room") {
    // A closed box of walls (the insulated room) with a cold source in a
    // top corner (the AC unit) chilling the air trapped inside.
    const left = width * 0.2;
    const right = width * 0.8;
    const top = height * 0.15;
    const bottom = height * 0.85;
    addWall(left, top, right, top);
    addWall(right, top, right, bottom);
    addWall(right, bottom, left, bottom);
    addWall(left, bottom, left, top);
    addSource(right - width * 0.06, top + height * 0.06, config.ambientTemperature - 25, DEFAULT_SOURCE_RADIUS_M * 0.8);
    config.eddyViscosityMultiplier = 400;
  }
}

// Rebuilt from `walls` whenever they change, rather than baked permanently
// into grid state — walls stay simple continuous geometry, the single source
// of truth. Guarded by wallsDirty since step() calls this every physics
// substep (up to MAX_STEPS_PER_FRAME times per rendered frame) but walls only
// change on user interaction — re-testing every grid cell against every wall
// that often, when nothing moved, was pure waste.
let wallsDirty = true;

function rasterizeWalls() {
  if (!wallsDirty) return;
  wallsDirty = false;

  grid.solid.fill(0);
  if (walls.length === 0) return;

  const halfThickness = WALL_THICKNESS_M / 2;
  for (let j = 1; j <= grid.ny; j++) {
    const y = (j - 0.5) * CELL_SIZE_M;
    for (let i = 1; i <= grid.nx; i++) {
      const x = (i - 0.5) * CELL_SIZE_M;
      for (const wall of walls) {
        if (closestPointOnSegment(x, y, wall).distance <= halfThickness) {
          grid.solid[index(grid.nx, i, j)] = 1;
          break;
        }
      }
    }
  }
}

// Boussinesq buoyancy: a parcel warmer than ambient accelerates upward
// (screen-space -y), colder accelerates downward, magnitude g*beta*deltaT.
// beta (thermal expansion coefficient) is recomputed from the current
// ambient temperature each call rather than hardcoded, since it depends on
// absolute temperature (beta = 1/T0 in Kelvin for an ideal gas).
function addBuoyancy(dt) {
  const beta = 1 / (config.ambientTemperature + 273.15);
  const g = PHYSICAL_CONSTANTS.gravity;
  const { nx, ny, v, t, solid } = grid;
  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      if (solid[idx]) continue;
      v[idx] -= g * beta * (t[idx] - config.ambientTemperature) * dt;
    }
  }
}

// Relaxes nearby grid cells toward each source's temperature — a heat/cold
// source is modeled as a continuous small forcing on the temperature field,
// not a one-shot injection, so it keeps driving convection every frame.
function addSourcesHeat(dt) {
  const { nx, ny, t, solid } = grid;
  for (const source of sources) {
    const influenceRadius = source.radius * SOURCE_INFLUENCE_MULTIPLIER;
    for (let j = 1; j <= ny; j++) {
      const y = (j - 0.5) * CELL_SIZE_M;
      const dy = y - source.y;
      if (Math.abs(dy) > influenceRadius) continue;
      for (let i = 1; i <= nx; i++) {
        const x = (i - 0.5) * CELL_SIZE_M;
        const dx = x - source.x;
        const distance = Math.hypot(dx, dy);
        if (distance >= influenceRadius) continue;
        const idx = index(nx, i, j);
        if (solid[idx]) continue;
        const closeness = 1 - distance / influenceRadius;
        t[idx] += (source.temperature - t[idx]) * HEAT_INJECTION_RATE * closeness * dt;
      }
    }
  }
}

// Every cell drifts back toward the current ambient temperature, same shape
// as addSourcesHeat's forcing but uniform and much weaker -- this is what
// makes the Ambient Temperature slider visibly recolor a room with no
// sources in it (see temperatureToColor's ambient base tint) instead of
// leaving empty air stuck at whatever absolute number it already held.
// Weak enough that an active source's own HEAT_INJECTION_RATE still wins
// near itself.
const AMBIENT_RELAXATION_RATE = 1.2;

// A single scalar that lags config.ambientTemperature at the exact same rate
// every cell's own temperature does (reset alongside grid.t in reset()). The
// gap between the live slider value and this lagging reference is positive
// exactly while the room is being heated and negative while it's being
// cooled, which addAmbientRelaxation below turns into a whole-room buoyant
// push -- see the comment there for why that can't just reuse each cell's
// own (t - ambient).
let ambientBuoyancyReference = config.ambientTemperature;

// Dragging the Ambient Temperature slider up should read as "heating the
// room" (air rising) and dragging it down as "cooling the room" (air
// sinking) -- but driving that from each cell's own (t - ambient), the way
// addBuoyancy does for real sources, gets it backwards here: a cell that
// hasn't yet warmed up to a freshly-raised ambient is *momentarily colder*
// than its new surroundings, so the standard Boussinesq sign would sink it,
// exactly opposite of what turning the dial to "hot" should look like.
// Comparing the live target against ambientBuoyancyReference instead (a
// single lagging scalar, not per-cell) gives the correct, intuitive
// direction, and -- because every cell gets the same uniform push regardless
// of its own temperature -- it never fights or reverses a real source's own,
// much larger, correctly-signed local buoyancy.
function addAmbientRelaxation(dt) {
  const { nx, ny, t, v, solid } = grid;
  const ambient = config.ambientTemperature;
  const g = PHYSICAL_CONSTANTS.gravity;
  const beta = 1 / (ambient + 273.15);
  const warmingDelta = ambient - ambientBuoyancyReference;
  ambientBuoyancyReference += warmingDelta * AMBIENT_RELAXATION_RATE * dt;

  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      if (solid[idx]) continue;
      t[idx] += (ambient - t[idx]) * AMBIENT_RELAXATION_RATE * dt;
      v[idx] -= g * beta * warmingDelta * dt;
    }
  }
}

// Advances the simulation by `dt` seconds: a real (if coarse) incompressible
// Navier-Stokes step under the Boussinesq approximation. See fluid-grid.js
// for what each kernel does; this is Stam's Stable Fluids ordering — add
// forces, diffuse, project (enforce incompressibility), advect, project
// again, then the same diffuse+advect treatment for temperature as a passive
// scalar carried by the flow — plus wall rasterization and heat injection at
// either end.
export function step(dt) {
  rasterizeWalls();
  addBuoyancy(dt);

  const nu = PHYSICAL_CONSTANTS.kinematicViscosityAir * config.eddyViscosityMultiplier;
  const alpha = PHYSICAL_CONSTANTS.thermalDiffusivityAir * config.eddyViscosityMultiplier;
  const h = CELL_SIZE_M;
  const { nx, ny, u, v, u0, v0, t, t0, p, div, solid } = grid;

  u0.set(u);
  v0.set(v);
  diffuse(nx, ny, u, u0, nu, dt, h, VISC_ITERS, solid, "x");
  diffuse(nx, ny, v, v0, nu, dt, h, VISC_ITERS, solid, "y");
  project(nx, ny, u, v, p, div, h, PROJ_ITERS, solid);

  u0.set(u);
  v0.set(v);
  advect(nx, ny, u, u0, u0, v0, dt, h, solid, "x");
  advect(nx, ny, v, v0, u0, v0, dt, h, solid, "y");
  project(nx, ny, u, v, p, div, h, PROJ_ITERS, solid);

  t0.set(t);
  diffuse(nx, ny, t, t0, alpha, dt, h, TEMP_DIFF_ITERS, solid, "scalar");
  t0.set(t);
  advect(nx, ny, t, t0, u, v, dt, h, solid, "scalar");

  addSourcesHeat(dt);
  addAmbientRelaxation(dt);
}

// Samples the solved velocity field at a physical (x, y) in meters — the only
// thing the cosmetic tracer particles in app.js need from the solver; they
// are advected by literally reading this, not by any heuristic of their own.
export function sampleVelocity(x, y) {
  const gx = x / CELL_SIZE_M + 0.5;
  const gy = y / CELL_SIZE_M + 0.5;
  return {
    vx: bilinearSample(grid.nx, grid.ny, grid.u, gx, gy),
    vy: bilinearSample(grid.nx, grid.ny, grid.v, gx, gy),
  };
}

// Samples the solved temperature field at a physical (x, y) in meters — lets
// a cosmetic tracer in app.js color itself by the fluid it's actually riding
// through, the same way sampleVelocity lets it move through that fluid.
export function sampleTemperature(x, y) {
  const gx = x / CELL_SIZE_M + 0.5;
  const gy = y / CELL_SIZE_M + 0.5;
  return bilinearSample(grid.nx, grid.ny, grid.t, gx, gy);
}

// Rayleigh number: the ratio of buoyant driving force to dissipative
// (viscous x thermal) resistance. Ra above roughly 1700 is the classic
// Rayleigh-Benard threshold for convection to begin at all; nu/alpha default
// to real, unscaled air, so a bare call answers "if this patch of air were
// real air, would it convect" — pass the solver's own effective nu/alpha to
// get the number that actually governs what's on screen.
export function rayleighNumber(
  deltaTC,
  lengthM,
  {
    g = PHYSICAL_CONSTANTS.gravity,
    nu = PHYSICAL_CONSTANTS.kinematicViscosityAir,
    alpha = PHYSICAL_CONSTANTS.thermalDiffusivityAir,
    ambientC = config.ambientTemperature,
  } = {},
) {
  const beta = 1 / (ambientC + 273.15);
  return (g * beta * deltaTC * lengthM ** 3) / (nu * alpha);
}

export function prandtlNumber(nu, alpha) {
  return nu / alpha;
}

// A plain-language label for what a given Rayleigh number implies about the
// flow — thresholds are the textbook ones: ~1708 is the critical Ra for the
// onset of Rayleigh-Benard convection in a fluid layer heated from below,
// and turbulence sets in somewhere in the 10^6-10^9 range depending on
// geometry, so 1e6 is used here as a representative (not exact) boundary.
export function flowRegime(ra) {
  const magnitude = Math.abs(ra);
  if (magnitude < 1700) return "conduction-dominated";
  if (magnitude < 1e6) return "steady convection cells";
  return "turbulent convection";
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp1(x) {
  return Math.max(-1, Math.min(1, x));
}

const WHITE = [255, 255, 255];
const RED = [255, 68, 68];
const BLUE = [56, 189, 248];

function mix(from, to, t) {
  return [Math.round(lerp(from[0], to[0], t)), Math.round(lerp(from[1], to[1], t)), Math.round(lerp(from[2], to[2], t))];
}

const AMBIENT_TEMPERATURE_MID_C = (AMBIENT_TEMPERATURE_MIN + AMBIENT_TEMPERATURE_MAX) / 2;
const AMBIENT_TEMPERATURE_HALF_RANGE_C = (AMBIENT_TEMPERATURE_MAX - AMBIENT_TEMPERATURE_MIN) / 2;

// The room's own base color: white at the midpoint of the Ambient
// Temperature slider's range, tinting toward blue as ambient drops to
// AMBIENT_TEMPERATURE_MIN and toward red as it rises to
// AMBIENT_TEMPERATURE_MAX -- so the slider visibly colors the whole room
// even where nothing is hotter or colder than ambient.
function ambientBaseColor(ambientTemperature) {
  const fraction = clamp1((ambientTemperature - AMBIENT_TEMPERATURE_MID_C) / AMBIENT_TEMPERATURE_HALF_RANGE_C);
  return fraction >= 0 ? mix(WHITE, RED, fraction) : mix(WHITE, BLUE, -fraction);
}

// A cell's color starts from the room's own ambient-tinted base color (see
// ambientBaseColor above) and mixes toward full red/blue the further the
// cell's own temperature sits above/below ambient, saturating at
// +/-COLOR_RANGE_C. Returns an [r, g, b] triple (rather than a CSS color
// string) since the caller writes it straight into an ImageData buffer once
// per grid cell every frame. Pure function (no canvas/DOM), so it's testable
// headlessly like the rest of this module.
export function temperatureToColor(temperature, ambientTemperature = config.ambientTemperature) {
  const base = ambientBaseColor(ambientTemperature);
  const t = clamp1((temperature - ambientTemperature) / COLOR_RANGE_C);
  return t >= 0 ? mix(base, RED, t) : mix(base, BLUE, -t);
}
