// Low-level numerical kernels for the weather simulator: diffusion,
// relaxation, advection, contour tracing, and extrema detection on a 2D
// grid stored as flat typed arrays.
//
// This file knows nothing about temperature, pressure, wind, or land — just
// grid indices and numbers, same spirit as fluid-grid.js. `nx`/`ny` mean
// INTERIOR cell counts; every field is allocated at (nx+2)x(ny+2) with a
// 1-cell ghost border (interior indices run 1..nx / 1..ny).
//
// Unlike fluid-grid.js, no function here takes a `solid` mask. Land isn't a
// hard obstacle in this simulation — wind blows freely over land, just with
// more friction, which is modeled as a per-cell rate, not an excluded
// neighbor. So every cell, land or sea, is an ordinary fluid cell in every
// kernel below.

export function index(nx, i, j) {
  return j * (nx + 2) + i;
}

export function allocate(nx, ny) {
  return new Float32Array((nx + 2) * (ny + 2));
}

// Zero-gradient (Neumann) copy across all four edges, for every field alike
// (temperature, pressure, velocity). There is no sealed-wall/no-slip case
// here: the domain edge is the edge of the visible map, not a wall, so
// every quantity should pass through it unimpeded rather than reflecting.
// Corners are averaged from their two edge neighbors, same as fluid-grid.js.
export function setBoundary(nx, ny, field) {
  for (let i = 1; i <= nx; i++) {
    field[index(nx, i, 0)] = field[index(nx, i, 1)];
    field[index(nx, i, ny + 1)] = field[index(nx, i, ny)];
  }
  for (let j = 1; j <= ny; j++) {
    field[index(nx, 0, j)] = field[index(nx, 1, j)];
    field[index(nx, nx + 1, j)] = field[index(nx, nx, j)];
  }
  field[index(nx, 0, 0)] = 0.5 * (field[index(nx, 1, 0)] + field[index(nx, 0, 1)]);
  field[index(nx, 0, ny + 1)] = 0.5 * (field[index(nx, 1, ny + 1)] + field[index(nx, 0, ny)]);
  field[index(nx, nx + 1, 0)] = 0.5 * (field[index(nx, nx, 0)] + field[index(nx, nx + 1, 1)]);
  field[index(nx, nx + 1, ny + 1)] = 0.5 * (field[index(nx, nx, ny + 1)] + field[index(nx, nx + 1, ny)]);
}

// Implicit (Jacobi) diffusion: solves (I - a*Laplacian) field = field0 for
// `field`, where a = rate * dt / h^2. Unconditionally stable for any `a` —
// a large `a` only costs convergence speed (more iterations), never blow-up.
export function diffuse(nx, ny, field, field0, rate, dt, h, iterations) {
  const a = (rate * dt) / (h * h);
  const stride = nx + 2;

  for (let iter = 0; iter < iterations; iter++) {
    for (let j = 1; j <= ny; j++) {
      let idx = j * stride + 1;
      for (let i = 1; i <= nx; i++, idx++) {
        field[idx] =
          (field0[idx] + a * (field[idx - 1] + field[idx + 1] + field[idx - stride] + field[idx + stride])) /
          (1 + 4 * a);
      }
    }
    setBoundary(nx, ny, field);
  }
}

// Unconditionally stable implicit relaxation toward `target`: solves
// field_new = field_old + a*(target - field_new) for field_new, where
// a = rate*dt. Replaces the naive `field += (target-field)*rate*dt`, which
// overshoots and oscillates once rate*dt exceeds 2 — a real risk once a
// time-acceleration slider can push dt into the thousands of seconds.
// `rate` may be a plain number (uniform) or a per-cell Float32Array.
export function relax(nx, ny, field, target, rate, dt) {
  const uniform = typeof rate === "number";
  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      const a = (uniform ? rate : rate[idx]) * dt;
      field[idx] = (field[idx] + a * target[idx]) / (1 + a);
    }
  }
}

// Bilinear sample of `field` at fractional grid coordinates (x, y), where
// integer coordinates line up with cell centers (including ghost cells at
// 0 and nx+1/ny+1) — identical convention to fluid-grid.js's version.
export function bilinearSample(nx, ny, field, x, y) {
  const cx = Math.max(0.5, Math.min(nx + 0.5, x));
  const cy = Math.max(0.5, Math.min(ny + 0.5, y));

  const i0 = Math.floor(cx);
  const i1 = i0 + 1;
  const j0 = Math.floor(cy);
  const j1 = j0 + 1;
  const sx1 = cx - i0;
  const sx0 = 1 - sx1;
  const sy1 = cy - j0;
  const sy0 = 1 - sy1;

  return (
    sx0 * (sy0 * field[index(nx, i0, j0)] + sy1 * field[index(nx, i0, j1)]) +
    sx1 * (sy0 * field[index(nx, i1, j0)] + sy1 * field[index(nx, i1, j1)])
  );
}

// Semi-Lagrangian advection: for every interior cell, trace backward through
// (u, v) by dt to find where its contents came from, and bilinear-sample
// field0 there. Unconditionally stable regardless of dt or velocity
// magnitude.
export function advect(nx, ny, field, field0, u, v, dt, h) {
  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      const x = i - (u[idx] * dt) / h;
      const y = j - (v[idx] * dt) / h;
      field[idx] = bilinearSample(nx, ny, field0, x, y);
    }
  }
  setBoundary(nx, ny, field);
}

// Bilinear-resizes the interior region of `field` to a new interior size,
// used to carry simulation state across a resolution change (canvas
// resize) instead of discarding it.
export function resample(nx, ny, field, newNx, newNy) {
  const out = allocate(newNx, newNy);
  for (let j = 1; j <= newNy; j++) {
    const srcY = ((j - 0.5) / newNy) * ny + 0.5;
    for (let i = 1; i <= newNx; i++) {
      const srcX = ((i - 0.5) / newNx) * nx + 0.5;
      out[index(newNx, i, j)] = bilinearSample(nx, ny, field, srcX, srcY);
    }
  }
  return out;
}

// Cap on how many raw local-extrema candidates get carried into
// suppress()'s O(k^2) pairwise pass. A synoptic chart only ever labels a
// handful of highs/lows anyway, so keeping only the most extreme candidates
// before suppression is both visually correct and a defensive bound against
// a pathological (very noisy, weak-mixing) pressure field producing
// thousands of raw single-cell local extrema in one frame.
const MAX_EXTREMA_CANDIDATES = 64;

function isLocalMax(field, nx, i, j) {
  const idx = index(nx, i, j);
  const stride = nx + 2;
  const v = field[idx];
  return (
    v >= field[idx - 1] &&
    v >= field[idx + 1] &&
    v >= field[idx - stride] &&
    v >= field[idx + stride] &&
    v >= field[idx - stride - 1] &&
    v >= field[idx - stride + 1] &&
    v >= field[idx + stride - 1] &&
    v >= field[idx + stride + 1]
  );
}

function isLocalMin(field, nx, i, j) {
  const idx = index(nx, i, j);
  const stride = nx + 2;
  const v = field[idx];
  return (
    v <= field[idx - 1] &&
    v <= field[idx + 1] &&
    v <= field[idx - stride] &&
    v <= field[idx + stride] &&
    v <= field[idx - stride - 1] &&
    v <= field[idx - stride + 1] &&
    v <= field[idx + stride - 1] &&
    v <= field[idx + stride + 1]
  );
}

// Greedily accepts the most extreme candidates first, rejecting any that
// falls within `minSeparationCells` of an already-accepted one — the
// non-max-suppression step that turns "every bump" into "the systems worth
// labeling."
function suppress(candidates, minSeparationCells) {
  const pool = candidates.slice(0, MAX_EXTREMA_CANDIDATES);
  const minSepSq = minSeparationCells * minSeparationCells;
  const accepted = [];
  for (const candidate of pool) {
    let farEnough = true;
    for (const kept of accepted) {
      const di = candidate.i - kept.i;
      const dj = candidate.j - kept.j;
      if (di * di + dj * dj < minSepSq) {
        farEnough = false;
        break;
      }
    }
    if (farEnough) accepted.push(candidate);
  }
  return accepted;
}

// Finds local maxima/minima (8-neighbor) in `field`, non-max-suppressed so
// that only well-separated systems (at least `minSeparationCells` apart)
// survive — for placing H/L labels the way a real synoptic chart does, not
// one per noisy wiggle. A perfectly flat neighborhood counts as a maximum,
// never both, so a degenerate uniform field can't double-count.
export function findLocalExtrema(field, nx, ny, minSeparationCells) {
  const maximaCandidates = [];
  const minimaCandidates = [];
  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const value = field[index(nx, i, j)];
      if (isLocalMax(field, nx, i, j)) {
        maximaCandidates.push({ i, j, value });
      } else if (isLocalMin(field, nx, i, j)) {
        minimaCandidates.push({ i, j, value });
      }
    }
  }
  maximaCandidates.sort((a, b) => b.value - a.value);
  minimaCandidates.sort((a, b) => a.value - b.value);
  return {
    maxima: suppress(maximaCandidates, minSeparationCells),
    minima: suppress(minimaCandidates, minSeparationCells),
  };
}

// Marching-squares case table: corner bits are NW*8 + NE*4 + SE*2 + SW*1;
// threshold-crossing edges are named N (NW-NE), E (NE-SE), S (SW-SE), W
// (NW-SW). Each entry lists the edge-pairs to connect with a segment. Cases
// 5 and 10 are the ambiguous saddle configurations; each is resolved with
// one fixed diagonal reading rather than an asymptotic-decider check — a
// cosmetic isobar doesn't need topological correctness through a saddle.
const CASE_EDGES = {
  0: [],
  1: [["W", "S"]],
  2: [["S", "E"]],
  3: [["W", "E"]],
  4: [["N", "E"]],
  5: [
    ["N", "W"],
    ["S", "E"],
  ],
  6: [["N", "S"]],
  7: [["N", "W"]],
  8: [["N", "W"]],
  9: [["N", "S"]],
  10: [
    ["N", "E"],
    ["S", "W"],
  ],
  11: [["N", "E"]],
  12: [["W", "E"]],
  13: [["S", "E"]],
  14: [["W", "S"]],
  15: [],
};

function interpFraction(level, v0, v1) {
  const denom = v1 - v0;
  return Math.abs(denom) < 1e-9 ? 0.5 : (level - v0) / denom;
}

// Marching squares: traces the `level` isoline of `field` across every 2x2
// block of cell centers, returning unjoined line segments in fractional
// grid coordinates (same convention as bilinearSample — integer coordinates
// at cell centers). Segments are deliberately not stitched into polylines;
// a rendered isobar doesn't need one, just a plausible line.
export function traceContours(field, nx, ny, level) {
  const segments = [];
  for (let j = 1; j < ny; j++) {
    for (let i = 1; i < nx; i++) {
      const a = field[index(nx, i, j)];
      const b = field[index(nx, i + 1, j)];
      const c = field[index(nx, i + 1, j + 1)];
      const d = field[index(nx, i, j + 1)];

      const caseIndex = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0);
      const edgePairs = CASE_EDGES[caseIndex];
      if (!edgePairs.length) continue;

      const points = {
        N: [i + interpFraction(level, a, b), j],
        S: [i + interpFraction(level, d, c), j + 1],
        W: [i, j + interpFraction(level, a, d)],
        E: [i + 1, j + interpFraction(level, b, c)],
      };

      for (const [e0, e1] of edgePairs) {
        const [x1, y1] = points[e0];
        const [x2, y2] = points[e1];
        segments.push({ x1, y1, x2, y2 });
      }
    }
  }
  return segments;
}
