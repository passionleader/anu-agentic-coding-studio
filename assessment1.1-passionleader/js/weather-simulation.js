// Simulation state and physics for the weather simulator: temperature and
// atmospheric pressure as two coupled, forced, diffusing, advecting fields,
// with Coriolis rotation and land/sea-modulated surface friction driving
// wind -- not a single incompressible buoyancy-driven fluid the way
// simulation.js is. No DOM or canvas API calls belong here -- weather-app.js
// reads this module's state to draw, and weather-ui.js writes to it in
// response to input.
//
// Everything here is in physical units: meters, seconds, degrees Celsius,
// hectopascals, meters/second, degrees latitude. weather-app.js is the only
// place that ever touches CSS pixels, converting at the boundary via
// CELL_SIZE_M.
//
// This is a deliberately fresh copy of the numerical techniques
// simulation.js/fluid-grid.js established (semi-Lagrangian advection,
// implicit Jacobi diffusion) rather than an import from them -- the
// physical model is genuinely different (pressure is a forced, advected,
// relaxing field here, not an incompressibility Lagrange multiplier), and
// keeping the two experiments' numerics independent means an edit to the
// graded convection sim can never silently change this one.

import {
  advect,
  allocate,
  bilinearSample,
  diffuse,
  findLocalExtrema as findLocalExtremaKernel,
  index,
  relax,
  resample,
  setBoundary,
  traceContours as traceContoursKernel,
} from "./atmosphere-grid.js";

export const thermalSources = []; // { x, y, temperatureDeltaC, targetTemperatureC, radius } -- meters, meters, °C, °C, meters
export const pressureSources = []; // { x, y, pressureDeltaHpa, radius } -- meters, meters, hPa, meters

// Tunables the UI's sliders write to.
export const config = {
  latitudeDeg: 45, // ° -- drives both the Coriolis parameter and the equator-pole temperature gradient
  frictionMultiplier: 1, // x -- scales surface drag; land is always a further multiple of sea (see LAND_FRICTION_BOOST)
  thermalPressureCoupling: 0.45, // hPa/°C ("Ktemp") -- how strongly a temperature anomaly depresses/raises local pressure
  mixing: 3, // x -- scales diffusion of pressure, temperature, and momentum alike
  timeAccelerationHoursPerSecond: 2, // simulated hours per real second
};

// Real, unscaled physical constants -- unlike simulation.js's eddy-viscosity
// treatment of nu/alpha, these plug directly into the solver at their real
// values without going numerically unresolvable at this grid/timestep, so
// no stability-driven scale-up multiplier is needed for either one.
export const PHYSICAL_CONSTANTS = {
  earthRotationRate: 7.2921e-5, // rad/s (Ω) -- Earth's real sidereal rotation rate
  seaLevelAirDensity: 1.2, // kg/m^3 (ρ) -- real sea-level air density
};

// The grid's physical domain is a fixed-height slice of a mid-latitude
// region; only its width (and column count) varies with the canvas's aspect
// ratio on resize, same convention as simulation.js's DOMAIN_HEIGHT_M. 2000km
// tall lands a realistic ~0.85°C/100km meridional gradient (see
// ambientTemperature below) and a 25km cell size fine enough that a
// 500-1500km synoptic system spans dozens of cells.
export const GRID_ROWS = 80;
export const GRID_COLS_MIN = 56;
export const GRID_COLS_MAX = 140;
export const DOMAIN_HEIGHT_KM = 2000;
export const DOMAIN_HEIGHT_M = DOMAIN_HEIGHT_KM * 1000;
export const CELL_SIZE_M = DOMAIN_HEIGHT_M / GRID_ROWS; // 25,000 m

export const DEFAULT_THERMAL_DELTA_C = 15; // magnitude for the Warm/Cool Zone tools; the tool applies the sign
export const DEFAULT_PRESSURE_DELTA_HPA = 12; // magnitude for the High/Low Pressure tools; the tool applies the sign

const DEG_TO_RAD = Math.PI / 180;
const KM_PER_DEGREE_LATITUDE = 111;

// A moderate, defensible annual-mean-ish equator-pole spread (real
// equatorial surface means run ~26-30°C; real polar means swing colder than
// this in winter, but a wider spread would look cartoonish on a toy sim).
// PRESSURE_REFERENCE_TEMPERATURE_C is their midpoint by construction, not an
// independently chosen number -- see computePdiag's comment for why it must
// be fixed rather than a function of latitude.
const T_EQUATOR_C = 30;
const T_POLE_C = -30;
const PRESSURE_REFERENCE_TEMPERATURE_C = (T_EQUATOR_C + T_POLE_C) / 2;
const BASELINE_PRESSURE_HPA = 1013.25;

// Linear-drag e-folding rate for sea; land is always a further multiple of
// this (LAND_FRICTION_BOOST), never a separate independent constant, so
// "Friction" stays a single honest slider. Realistic linear-drag timescales
// run from days in the free atmosphere to hours in the boundary layer --
// 2e-5 s^-1 sea x 4x land at the slider's default sits inside that range.
const BASE_FRICTION_PER_S = 2e-5;
const LAND_FRICTION_BOOST = 3; // land friction reaches up to (1 + 3) = 4x sea's, at landFraction = 1

// Real thermal relaxation toward the ambient latitude gradient runs on a
// roughly diurnal timescale over water and faster over land (a toy stand-in
// for continentality) -- 1e-5 s^-1 sea is an ~28-hour e-folding time, land up
// to 4x faster. Pressure relaxes toward its diagnostic target much faster
// (~17 minutes) since it's standing in for fast-adjusting dynamics, not a
// slow thermal process.
const BASE_TEMPERATURE_RELAX_RATE_PER_S = 1e-5;
const LAND_RELAX_BOOST = 3; // land relaxes up to (1 + 3) = 4x faster than sea, at landFraction = 1
const PRESSURE_RELAX_RATE_PER_S = 1e-3;

// "Mixing" is a single slider scaling diffusion of pressure, temperature,
// and momentum alike (smooths each field across neighboring cells) --
// named for what it visibly does rather than borrowing simulation.js's
// "eddy viscosity" framing, since this sim isn't modeling a turbulence
// cascade. The base rate is chosen so the slider's default (3x) reproduces
// an effective diffusivity of ~1e5 m^2/s -- a Jacobi coefficient
// a=rate*dt/h^2 of roughly 0.04 at the default time-acceleration, mild, with
// plenty of headroom before the iteration count below needs to rise.
const BASE_MIXING_M2_PER_S = 1e5 / 3;

// This solver has real headroom versus simulation.js's since it skips the
// incompressibility projection entirely, so a slightly more generous
// iteration count than the original's tuned 12 is affordable; shared across
// pressure, temperature, and momentum's diffuse() calls since they're the
// same kernel at a similar Jacobi coefficient magnitude.
const DIFFUSION_ITERS = 16;

const SOURCE_INFLUENCE_MULTIPLIER = 2.2; // how far past its drawn radius a source's forcing reaches
const HEAT_INJECTION_RATE = 4; // how fast a grid cell picks up a nearby thermal source's target temperature
const DEFAULT_SOURCE_RADIUS_M = 200_000; // 200km, ~8 cells -- a plausible synoptic-scale system, not a single-pixel poke
const MAX_WIND_SPEED_MPS = 180; // belt-and-suspenders clamp; the momentum integrator is unconditionally stable without it

function createGrid(nx, ny) {
  const landFraction = generateCoastline(nx, ny);
  const grid = {
    nx,
    ny,
    u: allocate(nx, ny),
    v: allocate(nx, ny),
    u0: allocate(nx, ny),
    v0: allocate(nx, ny),
    t: allocate(nx, ny),
    t0: allocate(nx, ny),
    tAmbientField: allocate(nx, ny),
    p: allocate(nx, ny),
    p0: allocate(nx, ny),
    pDiag: allocate(nx, ny),
    landFraction,
    temperatureRelaxRate: computeTemperatureRelaxRate(nx, ny, landFraction),
  };
  initializeFields(grid);
  return grid;
}

function initializeFields(grid) {
  const { nx, ny, t, p } = grid;
  for (let j = 1; j <= ny; j++) {
    const y = (j - 0.5) * CELL_SIZE_M;
    const rowTemperature = ambientTemperature(y);
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      t[idx] = rowTemperature;
      p[idx] = BASELINE_PRESSURE_HPA;
    }
  }
  setBoundary(nx, ny, t);
  setBoundary(nx, ny, p);
}

function computeTemperatureRelaxRate(nx, ny, landFraction) {
  const rate = allocate(nx, ny);
  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      rate[idx] = BASE_TEMPERATURE_RELAX_RATE_PER_S * (1 + LAND_RELAX_BOOST * landFraction[idx]);
    }
  }
  return rate;
}

// A cheap, dependency-free stand-in for coherent 2D noise -- replaces an
// earlier version of this that summed seven fixed sine/cosine terms. That
// approach was smooth by construction (infinitely differentiable), so no
// amount of retuning it could ever produce a jagged, angular coastline; a
// hash-based lattice noise has genuine per-cell local variation instead of
// one globally-coherent smooth shape, and the ridge fold in ridgedNoise
// below adds real creases (a discontinuous derivative at each fold), which
// is what actually reads as sharp ridges rather than soft hills.
// Deterministic given (ix, iy) alone -- no seed/PRNG state needed. Bit-mixing
// constants are arbitrary odd multipliers chosen only to scramble bits well;
// they carry no meaning beyond that.
function noiseHash(ix, iy) {
  let h = ix * 374761393 + iy * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

function smoothstep(edge) {
  return edge * edge * (3 - 2 * edge);
}

// Smoothstep-interpolated lattice noise: blends the four integer lattice
// points surrounding (x, y), same bilinear shape as atmosphere-grid.js's
// bilinearSample but over hash values computed on demand rather than a
// stored field, so it needs no backing array.
function valueNoise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);
  const n00 = noiseHash(x0, y0);
  const n10 = noiseHash(x0 + 1, y0);
  const n01 = noiseHash(x0, y0 + 1);
  const n11 = noiseHash(x0 + 1, y0 + 1);
  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
}

// Ridged multifractal (Perlin & Musgrave's standard technique for sharp
// mountain-ridge terrain): each octave's value noise is folded around its
// midpoint, `1 - abs(2n-1)`, so it peaks in a sharp cusp at n=0.5 instead of
// a smooth round hill, then squared to sharpen that cusp further. Summing
// several octaves of these cusps at increasing frequency (frequency *=
// TERRAIN_LACUNARITY each step) is what produces genuinely jagged,
// multi-scale ridgelines -- large sweeping ridges from the low octaves, fine
// wiggle riding on top from the high ones -- rather than one smooth blob.
//
// TERRAIN_GAIN < 1 means higher-frequency octaves get LOWER amplitude
// (lower "persistence" in fBm terms); read literally, that smooths the
// result rather than sharpening it, which works against a "higher
// frequency, lower persistence" request if taken as tuning direction rather
// than intent. What actually earns the sharp/jagged/intricate look here is
// the ridge fold itself, applied at every octave -- TERRAIN_GAIN is tuned by
// eye purely for how much fine detail rides on top of the dominant coarse
// ridges without drowning them into visual mush.
const TERRAIN_BASE_FREQUENCY = 3.0; // cycles of the coarsest octave across the whole domain
const TERRAIN_OCTAVES = 6;
const TERRAIN_LACUNARITY = 2.2; // frequency multiplier per octave
const TERRAIN_GAIN = 0.55; // amplitude multiplier per octave

function terrainHeight(xFraction, yFraction) {
  let sum = 0;
  let amplitude = 0.6;
  let frequency = TERRAIN_BASE_FREQUENCY;
  let maxAmplitude = 0;
  for (let octave = 0; octave < TERRAIN_OCTAVES; octave++) {
    const n = valueNoise(xFraction * frequency, yFraction * frequency);
    const ridge = 1 - Math.abs(2 * n - 1);
    sum += ridge * ridge * amplitude;
    maxAmplitude += amplitude;
    amplitude *= TERRAIN_GAIN;
    frequency *= TERRAIN_LACUNARITY;
  }
  return sum / maxAmplitude; // normalized to roughly 0..1, non-negative (not zero-mean like the old sine/cosine sum)
}

// Raw, continuous, unclamped terrain height at every cell of an nx*ny grid --
// shared by every decorative use (weather-app.js's filled coastline mask,
// its traced outline, and its extra inland ridge-contour lines) AND by
// generateCoastline's physics-facing wrapper below, so a ridge visible in
// the decorative outline is the exact same ridge underneath the physics
// mask, not a coincidentally similar independent field. Ghost-bordered
// (allocate/index/setBoundary), same convention as every other field here,
// so it plugs straight into traceContoursKernel unchanged.
function sampleHeightField(nx, ny) {
  const height = allocate(nx, ny);
  for (let j = 1; j <= ny; j++) {
    const yFraction = (j - 0.5) / ny;
    for (let i = 1; i <= nx; i++) {
      const xFraction = (i - 0.5) / nx;
      height[index(nx, i, j)] = terrainHeight(xFraction, yFraction);
    }
  }
  setBoundary(nx, ny, height);
  return height;
}

// The single sea/land threshold against sampleHeightField's raw output,
// exported so weather-app.js's coastline fill/outline key off the exact same
// number generateCoastline uses below rather than an independently-tuned
// copy drifting apart from it over time. terrainHeight's octave weighting
// averages out to an empirical median of ~0.42 over the whole domain, not
// 0.5 -- this is tuned against that measured distribution for a roughly
// 50/50 land/sea split, the same balance the old sine/cosine version aimed
// for, not derived analytically from the noise formula.
export const COASTLINE_LEVEL = 0.4;
// Narrower than the old 0.08: sampleHeightField's ridged noise already
// varies sharply from cell to cell, so the land/sea transition band can be
// crisper too without turning into a single-pixel cliff.
const COASTLINE_BAND_HALF_WIDTH = 0.05;

// The physics-facing land/sea mask: same raw height field as
// sampleHeightField, clamped/normalized into the 0..1 "how land-like is this
// cell" fraction that friction/relaxation actually consume. Their contract
// (a narrow transition band straddling a threshold) is unchanged from the
// old sine/cosine version -- only the field underneath it is sharper now.
// Called fresh on grid creation AND on every resize (unlike u/v/t/p, which
// are bilinear-resampled across a resize to preserve simulation history) --
// landFraction has no history to preserve, so regenerating it crisp at the
// new resolution beats accumulating resample blur across repeated resizes.
function generateCoastline(nx, ny) {
  const height = sampleHeightField(nx, ny);
  const landFraction = allocate(nx, ny);
  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      const t = Math.max(-1, Math.min(1, (height[idx] - COASTLINE_LEVEL) / COASTLINE_BAND_HALF_WIDTH));
      landFraction[idx] = 0.5 + 0.5 * t;
    }
  }
  return landFraction;
}

// A purely decorative, much finer-grained twin of the raw height field
// above, resampled fresh on every resize alongside the physics grid but at
// DECORATIVE_TERRAIN_SCALE times its resolution -- cheap because it's
// computed once per resize, not once per frame, and nothing in step() ever
// reads it. This is what lets weather-app.js draw a visibly crisper,
// higher-detail coastline/ridge-contour outline than the physics grid's own
// (comparatively coarse) cell size would allow, without paying that finer
// resolution's cost anywhere in the physics itself.
const DECORATIVE_TERRAIN_SCALE = 5;

let decorativeHeight = { nx: 0, ny: 0, field: null };

export function resizeDecorativeTerrain(nx, ny) {
  const decorativeNx = nx * DECORATIVE_TERRAIN_SCALE;
  const decorativeNy = ny * DECORATIVE_TERRAIN_SCALE;
  if (decorativeHeight.nx === decorativeNx && decorativeHeight.ny === decorativeNy) return;
  decorativeHeight = { nx: decorativeNx, ny: decorativeNy, field: sampleHeightField(decorativeNx, decorativeNy) };
}

export function decorativeTerrainField() {
  return decorativeHeight;
}

// NX tracks the canvas's aspect ratio each resize, clamped so a very wide or
// very narrow window can't blow the per-frame cost past budget or collapse
// the grid to something too coarse to look like a map.
export function gridResolutionFor(aspectRatio) {
  const nx = Math.round(GRID_ROWS * aspectRatio);
  return { nx: Math.max(GRID_COLS_MIN, Math.min(GRID_COLS_MAX, nx)), ny: GRID_ROWS };
}

export let grid = createGrid(gridResolutionFor(16 / 9).nx, GRID_ROWS);

// Reallocates the grid at a new resolution, bilinear-resampling existing
// state across rather than discarding it -- a window resize shouldn't reset
// the simulation. resizeDecorativeTerrain runs unconditionally, before the
// early-return below, since it has its own independent no-op guard and must
// still populate decorativeHeight on the very first call even on the rare
// resize where the physics grid's own resolution happens not to change.
export function resizeGrid(nx, ny) {
  resizeDecorativeTerrain(nx, ny);
  if (grid.nx === nx && grid.ny === ny) return;
  const newGrid = createGrid(nx, ny);
  newGrid.u.set(resample(grid.nx, grid.ny, grid.u, nx, ny));
  newGrid.v.set(resample(grid.nx, grid.ny, grid.v, nx, ny));
  newGrid.t.set(resample(grid.nx, grid.ny, grid.t, nx, ny));
  newGrid.p.set(resample(grid.nx, grid.ny, grid.p, nx, ny));
  grid = newGrid;
}

function domainSize() {
  return { width: grid.nx * CELL_SIZE_M, height: DOMAIN_HEIGHT_M };
}

// Ties the same latitudeDeg slider that drives the Coriolis parameter to a
// real meridional coordinate, so both effects reinforce each other: near
// latitudeDeg=0, the Coriolis parameter vanishes AND the local temperature
// gradient below flattens, for physically coherent reasons rather than by
// coincidence.
//
// Subtracted (not added): yMeters increases downward (canvas/grid
// convention), and a map reads north-up regardless of hemisphere, so smaller
// y must mean a more poleward latitude -- larger y a more equatorward one.
export function latitudeOf(yMeters) {
  const domainLatitudeSpanDeg = DOMAIN_HEIGHT_KM / KM_PER_DEGREE_LATITUDE;
  return config.latitudeDeg - ((yMeters - DOMAIN_HEIGHT_M / 2) / DOMAIN_HEIGHT_M) * domainLatitudeSpanDeg;
}

// The standard simplified equator-to-pole profile shape used in toy
// energy-balance models: flatter near the equator, steepest in
// mid-latitudes, flattening again near the pole.
export function ambientTemperature(yMeters) {
  const latitudeRad = latitudeOf(yMeters) * DEG_TO_RAD;
  const s = Math.sin(latitudeRad);
  return T_EQUATOR_C - (T_EQUATOR_C - T_POLE_C) * s * s;
}

function computeAmbientTemperatureField() {
  const { nx, ny, tAmbientField } = grid;
  for (let j = 1; j <= ny; j++) {
    const y = (j - 0.5) * CELL_SIZE_M;
    const value = ambientTemperature(y);
    for (let i = 1; i <= nx; i++) {
      tAmbientField[index(nx, i, j)] = value;
    }
  }
  return tAmbientField;
}

export function coriolisParameter(latitudeDeg = config.latitudeDeg) {
  return 2 * PHYSICAL_CONSTANTS.earthRotationRate * Math.sin(latitudeDeg * DEG_TO_RAD);
}

// Returns the created source so callers (weather-ui.js) can hold onto it as
// the "selected" source for dragging, without needing a second lookup. The
// target temperature is resolved to an absolute value at creation time (this
// location's ambient plus the requested delta) so "+15" reads as "15 warmer
// than local ambient," the same way simulation.js's addSource stores an
// absolute target rather than re-deriving it every frame.
export function addThermalSource(xMeters, yMeters, temperatureDeltaC, radiusMeters = DEFAULT_SOURCE_RADIUS_M) {
  const source = {
    x: xMeters,
    y: yMeters,
    temperatureDeltaC,
    targetTemperatureC: ambientTemperature(yMeters) + temperatureDeltaC,
    radius: radiusMeters,
  };
  thermalSources.push(source);
  return source;
}

export function addPressureSource(xMeters, yMeters, pressureDeltaHpa, radiusMeters = DEFAULT_SOURCE_RADIUS_M) {
  const source = { x: xMeters, y: yMeters, pressureDeltaHpa, radius: radiusMeters };
  pressureSources.push(source);
  return source;
}

// Hit-tests both source kinds at (x, y), used so clicking directly on a
// source selects/grabs it instead of stacking a duplicate on top.
export function sourceAt(x, y) {
  return (
    thermalSources.find((source) => Math.hypot(source.x - x, source.y - y) <= source.radius) ??
    pressureSources.find((source) => Math.hypot(source.x - x, source.y - y) <= source.radius) ??
    null
  );
}

export function eraseAt(x, y, radius = DEFAULT_SOURCE_RADIUS_M) {
  for (let i = thermalSources.length - 1; i >= 0; i--) {
    if (Math.hypot(thermalSources[i].x - x, thermalSources[i].y - y) <= radius) thermalSources.splice(i, 1);
  }
  for (let i = pressureSources.length - 1; i >= 0; i--) {
    if (Math.hypot(pressureSources[i].x - x, pressureSources[i].y - y) <= radius) pressureSources.splice(i, 1);
  }
}

export function clearSources() {
  thermalSources.length = 0;
  pressureSources.length = 0;
}

export function reset() {
  thermalSources.length = 0;
  pressureSources.length = 0;
  grid.u.fill(0);
  grid.v.fill(0);
  initializeFields(grid);
}

// Named starting scenes, applied against the grid's own physical domain size
// (domainSize()) rather than fixed meters, so a preset looks right regardless
// of the window's aspect ratio. Latitude-affecting config is set BEFORE
// reset() runs (not after, the way simulation.js's applyPreset orders it) --
// reset()/initializeFields() seeds T from the current latitude gradient, so
// setting latitude afterward would leave the initial field stale until the
// next full relaxation cycle.
export const PRESETS = [
  { id: "calm-day", label: "Calm Day" },
  { id: "approaching-low", label: "Approaching Low" },
  { id: "high-pressure-ridge", label: "High-Pressure Ridge" },
  { id: "equator", label: "Equator" },
];

export function applyPreset(id) {
  if (id === "calm-day") {
    config.latitudeDeg = 45;
    config.frictionMultiplier = 1;
    config.thermalPressureCoupling = 0.45;
    config.mixing = 3;
    config.timeAccelerationHoursPerSecond = 2;
  } else if (id === "approaching-low" || id === "high-pressure-ridge") {
    config.latitudeDeg = 45;
  } else if (id === "equator") {
    config.latitudeDeg = 0; // Coriolis vanishes -- pressure gradients drive wind with ~no rotation
  }

  reset();
  const { width, height } = domainSize();

  if (id === "approaching-low") {
    addPressureSource(width * 0.25, height * 0.5, -18);
  } else if (id === "high-pressure-ridge") {
    addPressureSource(width * 0.5, height * 0.4, 16);
    addPressureSource(width * 0.5, height * 0.6, 16);
  } else if (id === "equator") {
    addPressureSource(width * 0.5, height * 0.5, -18);
  }
}

// Builds the diagnostic "target" pressure field each step: a baseline that
// falls where temperature exceeds a FIXED reference and rises where it's
// below it, plus user-placed pressure sources. The reference must be fixed
// (not a function of latitude the way Tambient(y) is) -- coupling to
// Tambient(y) instead would make the anomaly (T - Tambient(y)) identically
// zero at equilibrium, since T relaxes toward exactly that target, which
// would make spontaneous circulation from the equator-pole gradient alone
// structurally impossible. Coupling to a fixed reference instead means the
// equilibrium baseline pressure genuinely varies with latitude (a real
// "thermal low/high" effect) -- combined with Coriolis, that's what drives
// persistent mean flow even on an empty map.
function computePdiag() {
  const { nx, ny, t, pDiag } = grid;
  const ktemp = config.thermalPressureCoupling;
  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      pDiag[idx] = BASELINE_PRESSURE_HPA - ktemp * (t[idx] - PRESSURE_REFERENCE_TEMPERATURE_C);
    }
  }

  for (const source of pressureSources) {
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
        const closeness = 1 - distance / influenceRadius;
        pDiag[index(nx, i, j)] += source.pressureDeltaHpa * closeness;
      }
    }
  }
}

// Relaxes nearby grid cells toward each thermal source's target temperature
// -- a Warm/Cool Zone is a continuous small forcing on the temperature
// field, not a one-shot injection, so it keeps driving circulation every
// frame and stays draggable. Geometric falloff mirrors simulation.js's
// addSourcesHeat, but the update itself has to diverge from that naive
// explicit form: simulation.js never has a time-acceleration slider, so its
// dt is always a small fixed real-time step and rate*dt never approaches the
// explicit-Euler stability bound of 2. Here dtSim can run into the thousands
// of seconds, so this uses the same implicit-blend algebra as relax() in
// atmosphere-grid.js (field = (field + a*target)/(1+a)), just inlined
// per-source since `closeness` varies per cell within one source's own
// footprint rather than being a single field-wide rate.
function addThermalSourcesForcing(dt) {
  const { nx, ny, t } = grid;
  for (const source of thermalSources) {
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
        const closeness = 1 - distance / influenceRadius;
        const a = HEAT_INJECTION_RATE * closeness * dt;
        t[idx] = (t[idx] + a * source.targetTemperatureC) / (1 + a);
      }
    }
  }
}

// Unconditionally stable trapezoidal (Crank-Nicolson) integrator for the
// homogeneous part of the momentum equation, du/dt=-k*u+f*v, dv/dt=-f*u-k*v
// (eigenvalues -k +/- if). Forward Euler's stability bound is
// dt <= 2k/(k^2+f^2); making only friction implicit gives dt <= 2k/(f^2-k^2)
// -- in the realistic regime k << f (friction is a small correction to
// Coriolis balance, the definition of geostrophic flow) both bounds collapse
// to the same threshold, so that alone doesn't fix the risky corner (weak
// friction + high latitude + high time acceleration). Treating both terms
// with the trapezoidal rule is A-stable for any dt, f, k >= 0, and unlike
// backward Euler doesn't spuriously damp the undamped (k=0) limit -- it's
// exactly energy-conserving for pure rotation. `fx`/`fy` (the pressure
// gradient force) are forced explicitly at the old state, a standard IMEX
// split. Not exported: it operates on bare per-cell scalars, not a field.
function applyCoriolisAndFriction(u, v, fx, fy, f, k, dt) {
  const A = (k * dt) / 2;
  const B = (f * dt) / 2;
  const denom = (1 + A) * (1 + A) + B * B;
  const rotDamp = 1 - A * A - B * B;
  return [
    (rotDamp * u + 2 * B * v + (1 + A) * dt * fx + B * dt * fy) / denom,
    (-2 * B * u + rotDamp * v - B * dt * fx + (1 + A) * dt * fy) / denom,
  ];
}

// Computes the pressure-gradient force from the current pressure field, then
// applies it together with Coriolis deflection and land/sea-modulated
// surface friction to the momentum field in one implicit step per cell.
function applyPressureForceCoriolisFriction(dt) {
  const { nx, ny, u, v, p, landFraction } = grid;
  const stride = nx + 2;
  // coriolisParameter() follows the textbook x-east/y-NORTH convention (positive
  // in the NH, matching real f and the status-bar readout, so its own return
  // value must stay unnegated). This grid's v instead points y-SOUTH, like
  // every other field here (see latitudeOf's own north/south comment) -- and
  // that flips the rotational handedness the textbook du/dt=-k*u+f*v,
  // dv/dt=-f*u-k*v formula assumes. Applied unchanged to a south-pointing v,
  // every system would spin backwards (NH lows anticyclonic instead of
  // cyclonic). Negating f only here, at the point it feeds the momentum
  // integrator, corrects the handedness: the trapezoidal solution below is
  // parametric in f, and the corrected continuous equation is the same ODE
  // with f -> -f, so this one negation is exact, not approximate -- it
  // corrects the implicit fx/fy cross-coupling terms too, not just the
  // leading-order u/v rotation.
  const f = -coriolisParameter();
  const kSea = BASE_FRICTION_PER_S * config.frictionMultiplier;
  const hpaPerCellToPaPerMeter = 100 / (2 * CELL_SIZE_M); // hPa -> Pa, centered difference over 2h

  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      const dPdx = (p[idx + 1] - p[idx - 1]) * hpaPerCellToPaPerMeter;
      const dPdy = (p[idx + stride] - p[idx - stride]) * hpaPerCellToPaPerMeter;
      const fx = -dPdx / PHYSICAL_CONSTANTS.seaLevelAirDensity;
      const fy = -dPdy / PHYSICAL_CONSTANTS.seaLevelAirDensity;
      const k = kSea * (1 + LAND_FRICTION_BOOST * landFraction[idx]);

      const [uNew, vNew] = applyCoriolisAndFriction(u[idx], v[idx], fx, fy, f, k, dt);
      const speed = Math.hypot(uNew, vNew);
      const clampScale = speed > MAX_WIND_SPEED_MPS ? MAX_WIND_SPEED_MPS / speed : 1;
      u[idx] = uNew * clampScale;
      v[idx] = vNew * clampScale;
    }
  }
}

// Advances the simulation by `dtReal` real (wall-clock) seconds: pressure
// relaxes toward its diagnostic target and is diffused/advected, the
// pressure gradient then drives momentum via the unconditionally-stable
// Coriolis+friction integrator above, momentum is diffused/self-advected,
// and finally temperature picks up source forcing, diffuses, is advected by
// the wind it just produced, and relaxes toward the ambient latitude
// gradient. `timeAccelerationHoursPerSecond` is the first user-facing
// simulation-speed slider in this codebase's lineage, which is exactly why
// every relaxation step above uses the implicit relax() kernel rather than
// naive explicit relaxation -- see relax()'s own comment in atmosphere-grid.js.
export function step(dtReal) {
  const dtSim = dtReal * config.timeAccelerationHoursPerSecond * 3600;
  const { nx, ny, p, p0, u, v, u0, v0, t, t0, temperatureRelaxRate, pDiag } = grid;
  const h = CELL_SIZE_M;
  const mixingRate = BASE_MIXING_M2_PER_S * config.mixing;

  computePdiag();
  relax(nx, ny, p, pDiag, PRESSURE_RELAX_RATE_PER_S, dtSim);
  p0.set(p);
  diffuse(nx, ny, p, p0, mixingRate, dtSim, h, DIFFUSION_ITERS);
  p0.set(p);
  advect(nx, ny, p, p0, u, v, dtSim, h);

  applyPressureForceCoriolisFriction(dtSim);
  setBoundary(nx, ny, u);
  setBoundary(nx, ny, v);

  u0.set(u);
  v0.set(v);
  diffuse(nx, ny, u, u0, mixingRate, dtSim, h, DIFFUSION_ITERS);
  diffuse(nx, ny, v, v0, mixingRate, dtSim, h, DIFFUSION_ITERS);
  u0.set(u);
  v0.set(v);
  advect(nx, ny, u, u0, u0, v0, dtSim, h);
  advect(nx, ny, v, v0, u0, v0, dtSim, h);

  addThermalSourcesForcing(dtSim);
  t0.set(t);
  diffuse(nx, ny, t, t0, mixingRate, dtSim, h, DIFFUSION_ITERS);
  t0.set(t);
  advect(nx, ny, t, t0, u, v, dtSim, h);
  relax(nx, ny, t, computeAmbientTemperatureField(), temperatureRelaxRate, dtSim);
}

// Samples the solved velocity field at a physical (x, y) in meters -- lets a
// cosmetic wind arrow or the status bar read the flow directly, the same
// role sampleVelocity plays for simulation.js's tracers.
export function sampleVelocity(x, y) {
  const gx = x / CELL_SIZE_M + 0.5;
  const gy = y / CELL_SIZE_M + 0.5;
  return {
    vx: bilinearSample(grid.nx, grid.ny, grid.u, gx, gy),
    vy: bilinearSample(grid.nx, grid.ny, grid.v, gx, gy),
  };
}

export function samplePressure(x, y) {
  const gx = x / CELL_SIZE_M + 0.5;
  const gy = y / CELL_SIZE_M + 0.5;
  return bilinearSample(grid.nx, grid.ny, grid.p, gx, gy);
}

export function sampleTemperature(x, y) {
  const gx = x / CELL_SIZE_M + 0.5;
  const gy = y / CELL_SIZE_M + 0.5;
  return bilinearSample(grid.nx, grid.ny, grid.t, gx, gy);
}

// Wraps atmosphere-grid.js's generic kernels with this module's own grid, so
// weather-app.js's rendering code never needs to import atmosphere-grid.js
// directly -- the same "vocabulary stops here" boundary simulation.js draws
// around fluid-grid.js.
export function findPressureExtrema(minSeparationCells) {
  return findLocalExtremaKernel(grid.p, grid.nx, grid.ny, minSeparationCells);
}

export function tracePressureContours(levelHPa) {
  return traceContoursKernel(grid.p, grid.nx, grid.ny, levelHPa);
}

// Same kernel as tracePressureContours, run against the static decorative
// height field instead of the live pressure field -- lets weather-app.js draw
// a crisp coastline/ridge outline by reusing the existing marching-squares
// contour tracer rather than writing a second one. Deliberately reads the
// fine decorative buffer (not grid.landFraction, which is physics-resolution
// and pre-clamped) so outlines stay sharp and jagged even when the physics
// grid itself is coarse.
export function traceCoastlineContour(level) {
  const { nx, ny, field } = decorativeTerrainField();
  return traceContoursKernel(field, nx, ny, level);
}

export function pressureRange() {
  const { nx, ny, p } = grid;
  let min = Infinity;
  let max = -Infinity;
  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const value = p[index(nx, i, j)];
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  return { min, max };
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

const COLOR_MIDPOINT_C = PRESSURE_REFERENCE_TEMPERATURE_C; // 0°C -- the same fixed reference computePdiag uses
const COLOR_RANGE_C = 40; // wider than simulation.js's 35: this field's natural range is +/-30 (equator/pole) plus local anomalies

// A cell's color is white at COLOR_MIDPOINT_C, mixing toward full red/blue
// the further its temperature sits above/below that, saturating at
// +/-COLOR_RANGE_C. Unlike simulation.js's temperatureToColor, there's no
// separate "ambient tint" step -- Tambient(y) already varies spatially, so
// the heatmap showing that variation directly IS the ambient signal, with no
// second mechanism needed on top. Returns an [r, g, b] triple for writing
// straight into an ImageData buffer. Pure function, testable headlessly.
export function weatherTemperatureToColor(temperature) {
  const t = clamp1((temperature - COLOR_MIDPOINT_C) / COLOR_RANGE_C);
  return t >= 0 ? mix(WHITE, RED, t) : mix(WHITE, BLUE, -t);
}

// Clouds aren't a separately simulated field -- they're a pure reading of
// the pressure field already solved each step, the same real-world tendency
// for lows to be cloudy/unsettled and highs to be clear. 0 at/above baseline,
// rising linearly to 1 once local pressure sits CLOUD_PRESSURE_RANGE_HPA (or
// more) below it. Pure function, testable headlessly like
// weatherTemperatureToColor above.
const CLOUD_PRESSURE_RANGE_HPA = 20;

export function cloudCoverageAt(pressureHpa) {
  const anomaly = BASELINE_PRESSURE_HPA - pressureHpa;
  return Math.max(0, Math.min(1, anomaly / CLOUD_PRESSURE_RANGE_HPA));
}
