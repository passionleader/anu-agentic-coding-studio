// Simulation state and physics: heat/cold sources, wall obstacles, the
// particle field, and the per-frame update step. No DOM or canvas API calls
// belong here — app.js reads this module's state to draw, and ui.js writes
// to it in response to input. Keeping the split lets either half be replaced
// without touching the other.
//
// `step(dt, bounds)` takes canvas-space `{ width, height }` as a plain value
// rather than measuring the canvas itself — that's what keeps this module
// free of DOM/Canvas API calls while still letting particles bounce off the
// real edges app.js is drawing into.

export const sources = []; // { x, y, temperature, radius }
export const walls = []; // { x1, y1, x2, y2 }
export const particles = []; // Particle[]

// Tunables the UI's sliders write to.
export const config = {
  particleCount: 300,
  viscosity: 85, // 0-100, higher = more drag on particles — heavy air by default, not chaotic
  roomTemperature: 0, // -60..60, the ambient baseline air relaxes toward and new air spawns at
};

const SOURCE_INFLUENCE_MULTIPLIER = 9; // how far past its drawn radius a source heats/cools
const HEAT_TRANSFER_RATE = 4; // how fast a particle picks up a nearby source's temperature
const AMBIENT_RELAXATION_RATE = 0.03; // how fast a particle cools/warms back toward ambient
const BUOYANCY_COEFFICIENT = 2.4; // temperature -> vertical accel
const CIRCULATION_STRENGTH = 130; // tangential accel driving the rolling current between a hot/cold pair
const CIRCULATION_MARGIN = 60; // how far past the hot/cold pair's own span the rolling current reaches
const TURBULENCE_STRENGTH = 6; // random horizontal jitter, breaks up perfectly straight rise/fall
const DIFFUSION_RADIUS = 26;
const DIFFUSION_RATE = 0.5;
const DRAG_PER_SECOND = 6; // scales with config.viscosity — high enough that a particle sheds a source's push and settles within a short distance, rather than cruising at a steady speed indefinitely
const RESTITUTION = 0.55; // velocity retained (mirrored) on bounce
// Exported so app.js can draw walls at exactly this thickness — the visual
// obstacle and the collision hitbox should always match, or particles will
// appear to clip through (or bounce off thin air near) the drawn wall.
export const WALL_COLLISION_RADIUS = 6;
const MAX_SPEED = 220; // px/s clamp, keeps extreme slider values from blowing up
const GRID_CELL_SIZE = DIFFUSION_RADIUS * 2;

export class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.temperature = config.roomTemperature;
  }
}

function spawnParticle(bounds) {
  return new Particle(Math.random() * bounds.width, Math.random() * bounds.height);
}

// The canvas is a closed system: air already in it keeps circulating forever,
// nothing is drawn in from outside and nothing leaves. So particle count only
// ever changes in response to the density slider (below) — never a per-frame
// teleport-and-relabel of an existing dot, which would look like air quietly
// vanishing and reappearing elsewhere mid-simulation.
function reconcileParticleCount(bounds) {
  while (particles.length < config.particleCount) {
    particles.push(spawnParticle(bounds));
  }
  if (particles.length > config.particleCount) {
    particles.length = config.particleCount;
  }
}

// Returns the created source so callers (ui.js) can hold onto it as the
// "selected" source for live slider edits, without needing a second lookup.
export function addSource(x, y, temperature, radius = 24) {
  const source = { x, y, temperature, radius };
  sources.push(source);
  return source;
}

export function addWall(x1, y1, x2, y2) {
  walls.push({ x1, y1, x2, y2 });
}

// Hit-tests an existing source at (x, y), used so clicking directly on a
// source selects it for editing instead of stacking a duplicate on top.
export function sourceAt(x, y) {
  return sources.find((source) => Math.hypot(source.x - x, source.y - y) <= source.radius) ?? null;
}

// Removes anything within `radius` of (x, y): sources centered there, and
// walls passing within `radius` of the point anywhere along their length
// (not just at an endpoint) — a click on the middle of a long wall must
// erase it just as well as a click on its tip.
export function eraseAt(x, y, radius = 24) {
  for (let i = sources.length - 1; i >= 0; i--) {
    if (Math.hypot(sources[i].x - x, sources[i].y - y) <= radius) sources.splice(i, 1);
  }

  for (let i = walls.length - 1; i >= 0; i--) {
    if (closestPointOnSegment(x, y, walls[i]).distance <= radius) walls.splice(i, 1);
  }
}

export function clearSources() {
  sources.length = 0;
}

export function reset() {
  sources.length = 0;
  walls.length = 0;
  particles.length = 0;
}

// Named starting scenes, applied against canvas-space `bounds` the same way
// `step` is — proportional to canvas size rather than fixed pixels, so a
// preset looks right regardless of the viewport it's applied on.
export const PRESETS = [
  { id: "empty-canvas", label: "Empty Canvas" },
  { id: "convection-cell", label: "Standard Convection Cell" },
  { id: "thermal-chimney", label: "Thermal Chimney Effect" },
  { id: "insulated-room", label: "Insulated Room with AC" },
];

// Each preset's config.viscosity below is tuned well under what the slider's
// own 0..100 range would suggest — DRAG_PER_SECOND is high enough that the
// slider's default (85) settles a particle almost immediately, and a preset
// needs enough sustained circulation speed to actually read as convection.
export function applyPreset(id, bounds) {
  reset();
  const { width, height } = bounds;

  if (id === "empty-canvas") {
    // reset() above already cleared sources, walls, and particles — a blank
    // canvas at whatever tuning the user last had.
    return;
  }

  if (id === "convection-cell") {
    // One heat source low, one cold source high and opposite — the simplest
    // setup that drives a single rolling convection current.
    addSource(width * 0.25, height * 0.85, 15, 26);
    addSource(width * 0.75, height * 0.15, -15, 26);
    config.particleCount = 400;
    config.viscosity = 16;
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
    addSource((flueLeft + flueRight) / 2, flueBottom - height * 0.04, 15, 20);
    config.particleCount = 350;
    config.viscosity = 8;
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
    addSource(right - 40, top + 40, -15, 20);
    config.particleCount = 350;
    config.viscosity = 22;
  }
}

// Heat/cold sources pull a nearby particle's temperature toward their own,
// faster the closer the particle is. The same formula handles both — a heat
// source's temperature is above ambient, a cold source's is below, so the
// sign of (source.temperature - particle.temperature) takes care of the
// direction on its own.
function applySources(particle, dt) {
  for (const source of sources) {
    const dx = particle.x - source.x;
    const dy = particle.y - source.y;
    const distance = Math.hypot(dx, dy);
    const influenceRadius = source.radius * SOURCE_INFLUENCE_MULTIPLIER;
    if (distance >= influenceRadius) continue;
    const closeness = 1 - distance / influenceRadius;
    particle.temperature += (source.temperature - particle.temperature) * HEAT_TRANSFER_RATE * closeness * dt;
  }
}

function applyAmbientRelaxation(particle, dt) {
  particle.temperature += (config.roomTemperature - particle.temperature) * AMBIENT_RELAXATION_RATE * dt;
}

// Positive temperature (hot) accelerates upward (negative vy); negative
// temperature (cold) accelerates downward. One line handles both signs.
function applyBuoyancy(particle, dt) {
  particle.vy -= BUOYANCY_COEFFICIENT * particle.temperature * dt;
}

// The extent of the enclosure the walls form, used to anchor a virtual cold
// side for a lone heat source (see buildCirculationPairs) — null if nothing's
// been drawn.
function wallsBoundingBox() {
  if (walls.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const wall of walls) {
    minX = Math.min(minX, wall.x1, wall.x2);
    maxX = Math.max(maxX, wall.x1, wall.x2);
    minY = Math.min(minY, wall.y1, wall.y2);
    maxY = Math.max(maxY, wall.y1, wall.y2);
  }
  return { minX, maxX, minY, maxY };
}

const ENCLOSURE_EDGE_TOLERANCE = 4; // px, how closely a wall must hug a bounding-box edge to seal it

// True only when walls close off all four sides of their own bounding box —
// a real sealed room, not just any wall (or pair of walls) that happens to
// have a bounding box. The thermal-chimney preset's flue is two parallel
// walls open at both ends: it has a bounding box like any other wall set, but
// no wall seals its top or bottom, so it must not read as enclosed here.
function isEnclosed(enclosure) {
  const { minX, maxX, minY, maxY } = enclosure;

  const spansHorizontally = (wall) =>
    Math.min(wall.x1, wall.x2) <= minX + ENCLOSURE_EDGE_TOLERANCE &&
    Math.max(wall.x1, wall.x2) >= maxX - ENCLOSURE_EDGE_TOLERANCE;
  const spansVertically = (wall) =>
    Math.min(wall.y1, wall.y2) <= minY + ENCLOSURE_EDGE_TOLERANCE &&
    Math.max(wall.y1, wall.y2) >= maxY - ENCLOSURE_EDGE_TOLERANCE;
  const atY = (wall, y) =>
    Math.abs(wall.y1 - y) <= ENCLOSURE_EDGE_TOLERANCE && Math.abs(wall.y2 - y) <= ENCLOSURE_EDGE_TOLERANCE;
  const atX = (wall, x) =>
    Math.abs(wall.x1 - x) <= ENCLOSURE_EDGE_TOLERANCE && Math.abs(wall.x2 - x) <= ENCLOSURE_EDGE_TOLERANCE;

  const hasTop = walls.some((wall) => atY(wall, minY) && spansHorizontally(wall));
  const hasBottom = walls.some((wall) => atY(wall, maxY) && spansHorizontally(wall));
  const hasLeft = walls.some((wall) => atX(wall, minX) && spansVertically(wall));
  const hasRight = walls.some((wall) => atX(wall, maxX) && spansVertically(wall));

  return hasTop && hasBottom && hasLeft && hasRight;
}

// The two points a rising plume with no real cold partner splits toward once
// it reaches the top of its enclosure — the ceiling corners, one on each
// side.
function ceilingAnchors(enclosure) {
  return [
    { x: enclosure.minX, y: enclosure.minY },
    { x: enclosure.maxX, y: enclosure.minY },
  ];
}

// The mirror image of ceilingAnchors for a sinking current with no real hot
// partner: the floor corners it splits toward on its way down.
function floorAnchors(enclosure) {
  return [
    { x: enclosure.minX, y: enclosure.maxY },
    { x: enclosure.maxX, y: enclosure.maxY },
  ];
}

// One rolling current per hot/cold pairing. A real hot source pairs with
// every real cold source in the scene same as always; a LONE source (hot with
// no cold anywhere, or cold with no hot anywhere) doesn't just float with
// nothing to circulate against — the canvas itself is a closed box (particles
// already bounce off its edges in resolveBoundaryCollisions), so it's always
// exchanging heat with *something* at roughly ambient temperature, and that's
// enough of an opposite side to drive a real loop. When walls actually seal
// off a smaller sub-room (see isEnclosed), that sub-room is the box the
// source really exchanges heat with; otherwise (no walls, or an open channel
// like the thermal-chimney's flue) it falls back to the full canvas.
//
// A single source doesn't drive one lopsided loop, though — true convection
// off a centered source rises in the middle and comes back down on *both*
// sides symmetrically (a heater at the bottom center of a room, or the sun
// heating the middle of a room, doesn't just spin the whole room one way).
// So a lone hot source pairs against BOTH ceiling corners of its enclosure at
// once (ceilingAnchors), and a lone cold source against both floor corners
// (floorAnchors) — two counter-rotating cells sharing the same central
// current, mirror images of each other by construction, splitting evenly for
// a centered source and unevenly (a tight loop to the near wall, a wide one
// to the far wall) for an off-center one.
export function buildCirculationPairs(bounds) {
  const hots = sources.filter((source) => source.temperature > 0);
  const colds = sources.filter((source) => source.temperature < 0);
  const pairs = [];

  for (const hot of hots) {
    for (const cold of colds) {
      pairs.push({
        hotX: hot.x,
        hotY: hot.y,
        coldX: cold.x,
        coldY: cold.y,
        intensity: (Math.min(hot.temperature, 100) + Math.min(-cold.temperature, 100)) / 200,
      });
    }
  }

  const wallEnclosure = wallsBoundingBox();
  const enclosure = wallEnclosure && isEnclosed(wallEnclosure)
    ? wallEnclosure
    : { minX: 0, maxX: bounds.width, minY: 0, maxY: bounds.height };

  if (colds.length === 0) {
    for (const hot of hots) {
      const coldness = hot.temperature - config.roomTemperature;
      if (coldness <= 0) continue;
      const intensity = Math.min(coldness, 100) / 100;
      for (const anchor of ceilingAnchors(enclosure)) {
        pairs.push({ hotX: hot.x, hotY: hot.y, coldX: anchor.x, coldY: anchor.y, intensity });
      }
    }
  }

  if (hots.length === 0) {
    for (const cold of colds) {
      const hotness = config.roomTemperature - cold.temperature;
      if (hotness <= 0) continue;
      const intensity = Math.min(hotness, 100) / 100;
      for (const anchor of floorAnchors(enclosure)) {
        pairs.push({ hotX: anchor.x, hotY: anchor.y, coldX: cold.x, coldY: cold.y, intensity });
      }
    }
  }

  return pairs;
}

// Buoyancy alone only ever pushes a particle straight up or straight down —
// hot air reaching the ceiling has nothing to carry it sideways, so it just
// falls back through itself and rises again. Real convection closes into a
// loop because rising air has to displace something, dragging a return
// current along with it; the simplest way to get that here without a full
// pressure/continuity solver is a swirl centered on each pair from
// buildCirculationPairs, oriented so it points upward at the hot side
// (reinforcing buoyancy there) and downward at the cold one — which
// necessarily makes it flow hot-to-cold along the top and cold-to-hot along
// the bottom in between.
function applyCirculation(particle, dt, pairs) {
  for (const pair of pairs) {
    const centerX = (pair.hotX + pair.coldX) / 2;
    const centerY = (pair.hotY + pair.coldY) / 2;
    const spanX = pair.hotX - centerX;
    const spanY = pair.hotY - centerY;
    // Whichever rotation direction makes the flow point upward right at
    // the hot side is the one used for this pair.
    const handedness = spanX === 0 ? 1 : -Math.sign(spanX);
    const cellRadius = Math.hypot(spanX, spanY) + CIRCULATION_MARGIN;

    const dx = particle.x - centerX;
    const dy = particle.y - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance >= cellRadius || distance < 1) continue;

    const spread = distance / cellRadius;
    const taper = 4 * spread * (1 - spread); // 0 at the cell's center and outer edge, peak in between
    const accel = (handedness * CIRCULATION_STRENGTH * taper * pair.intensity) / distance;

    particle.vx += -dy * accel * dt;
    particle.vy += dx * accel * dt;
  }
}

function applyTurbulence(particle, dt) {
  particle.vx += (Math.random() - 0.5) * TURBULENCE_STRENGTH * dt;
}

function applyDrag(particle, dt) {
  const drag = Math.max(0, 1 - (config.viscosity / 100) * DRAG_PER_SECOND * dt);
  particle.vx *= drag;
  particle.vy *= drag;
}

function clampSpeed(particle) {
  const speed = Math.hypot(particle.vx, particle.vy);
  if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed;
    particle.vx *= scale;
    particle.vy *= scale;
  }
}

function cellKeyFor(x, y) {
  return `${Math.floor(x / GRID_CELL_SIZE)}:${Math.floor(y / GRID_CELL_SIZE)}`;
}

// A uniform grid keyed by cell, rebuilt each frame, so diffusion only checks
// particles in the same and adjacent cells instead of every pair — the
// difference between O(n) and O(n^2) at a particle count of up to 1000.
function buildDiffusionGrid(particleList) {
  const grid = new Map();
  for (const particle of particleList) {
    const key = cellKeyFor(particle.x, particle.y);
    let bucket = grid.get(key);
    if (!bucket) grid.set(key, (bucket = []));
    bucket.push(particle);
  }
  return grid;
}

function applyDiffusion(particle, grid, dt) {
  const cx = Math.floor(particle.x / GRID_CELL_SIZE);
  const cy = Math.floor(particle.y / GRID_CELL_SIZE);
  let temperatureSum = 0;
  let neighborCount = 0;

  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const bucket = grid.get(`${cx + ox}:${cy + oy}`);
      if (!bucket) continue;
      for (const neighbor of bucket) {
        if (neighbor === particle) continue;
        const dx = neighbor.x - particle.x;
        const dy = neighbor.y - particle.y;
        if (dx * dx + dy * dy > DIFFUSION_RADIUS * DIFFUSION_RADIUS) continue;
        temperatureSum += neighbor.temperature;
        neighborCount++;
      }
    }
  }

  if (neighborCount === 0) return;
  const averageNeighborTemperature = temperatureSum / neighborCount;
  particle.temperature += (averageNeighborTemperature - particle.temperature) * DIFFUSION_RATE * dt;
}

function closestPointOnSegment(px, py, wall) {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - wall.x1) * dx + (py - wall.y1) * dy) / lengthSquared));
  const x = wall.x1 + t * dx;
  const y = wall.y1 + t * dy;
  return { x, y, distance: Math.hypot(px - x, py - y) };
}

function resolveWallCollisions(particle) {
  for (const wall of walls) {
    const closest = closestPointOnSegment(particle.x, particle.y, wall);
    if (closest.distance === 0 || closest.distance >= WALL_COLLISION_RADIUS) continue;

    const nx = (particle.x - closest.x) / closest.distance;
    const ny = (particle.y - closest.y) / closest.distance;
    particle.x = closest.x + nx * WALL_COLLISION_RADIUS;
    particle.y = closest.y + ny * WALL_COLLISION_RADIUS;

    const inwardSpeed = particle.vx * nx + particle.vy * ny;
    if (inwardSpeed < 0) {
      particle.vx -= (1 + RESTITUTION) * inwardSpeed * nx;
      particle.vy -= (1 + RESTITUTION) * inwardSpeed * ny;
    }
  }
}

function resolveBoundaryCollisions(particle, bounds) {
  if (particle.x < 0) {
    particle.x = 0;
    particle.vx *= -RESTITUTION;
  } else if (particle.x > bounds.width) {
    particle.x = bounds.width;
    particle.vx *= -RESTITUTION;
  }

  if (particle.y < 0) {
    particle.y = 0;
    particle.vy *= -RESTITUTION;
  } else if (particle.y > bounds.height) {
    particle.y = bounds.height;
    particle.vy *= -RESTITUTION;
  }
}

// Advances the simulation by `dt` seconds within a canvas-space `bounds`
// rectangle ({ width, height }). Rising hot air and sinking cold air give
// convection its vertical motion, applyCirculation closes it into a rolling
// loop for each hot/cold pairing (real, or for a lone source the two virtual
// pairings from buildCirculationPairs), and boundary rebounds plus a little
// turbulence round out the rest.
export function step(dt, bounds) {
  reconcileParticleCount(bounds);

  const grid = buildDiffusionGrid(particles);
  const circulationPairs = buildCirculationPairs(bounds);

  for (const particle of particles) {
    applyDiffusion(particle, grid, dt);
    applySources(particle, dt);
    applyAmbientRelaxation(particle, dt);
    applyBuoyancy(particle, dt);
    applyCirculation(particle, dt, circulationPairs);
    applyTurbulence(particle, dt);
    applyDrag(particle, dt);
    clampSpeed(particle);

    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;

    resolveWallCollisions(particle);
    resolveBoundaryCollisions(particle, bounds);
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Blue = cold, white = ambient, red = hot, clamped to the -100..100 range the
// UI's temperature slider uses. Pure function (no canvas/DOM), so it's
// testable headlessly like the rest of this module.
export function temperatureToColor(temperature) {
  const t = Math.max(-100, Math.min(100, temperature)) / 100;
  if (t >= 0) {
    return `rgb(255, ${Math.round(lerp(255, 68, t))}, ${Math.round(lerp(255, 68, t))})`;
  }
  const s = -t;
  return `rgb(${Math.round(lerp(255, 56, s))}, ${Math.round(lerp(255, 189, s))}, ${Math.round(lerp(255, 248, s))})`;
}
