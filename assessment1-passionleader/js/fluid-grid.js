// Low-level numerical kernels for a semi-Lagrangian incompressible fluid
// solver ("Stable Fluids", Stam 1999): diffusion, pressure projection,
// advection, and boundary handling on a 2D grid stored as flat typed arrays.
//
// This file knows nothing about sources, walls, temperature, or any of
// simulation.js's vocabulary — just grid indices and numbers. `nx`/`ny`
// everywhere below mean INTERIOR cell counts; every field is allocated at
// (nx+2)x(ny+2), with a 1-cell ghost border all around (interior indices run
// 1..nx / 1..ny). `setBoundary` is what fills that ghost border each call —
// nothing else reads or writes it directly.

export function index(nx, i, j) {
  return j * (nx + 2) + i;
}

export function allocate(nx, ny) {
  return new Float32Array((nx + 2) * (ny + 2));
}

// Fills the ghost border and zeroes any interior cell marked solid.
// mode 'x': horizontal velocity component — negated across the left/right
//   (sealed) edge so nothing penetrates it, copied across top/bottom so flow
//   can still slide along them.
// mode 'y': vertical velocity component — mirror of 'x'.
// mode 'scalar': temperature/pressure — copied across every edge
//   (zero-gradient/Neumann: no flux through the sealed boundary).
// A solid interior cell always gets its own field value zeroed for 'x'/'y'
// (no-slip); 'scalar' fields are left alone at solid cells, since diffuse/
// advect already exclude solid neighbors from their stencils.
export function setBoundary(nx, ny, field, mode, solid) {
  for (let i = 1; i <= nx; i++) {
    if (mode === "x") {
      field[index(nx, i, 0)] = field[index(nx, i, 1)];
      field[index(nx, i, ny + 1)] = field[index(nx, i, ny)];
    } else if (mode === "y") {
      field[index(nx, i, 0)] = -field[index(nx, i, 1)];
      field[index(nx, i, ny + 1)] = -field[index(nx, i, ny)];
    } else {
      field[index(nx, i, 0)] = field[index(nx, i, 1)];
      field[index(nx, i, ny + 1)] = field[index(nx, i, ny)];
    }
  }

  for (let j = 1; j <= ny; j++) {
    if (mode === "y") {
      field[index(nx, 0, j)] = field[index(nx, 1, j)];
      field[index(nx, nx + 1, j)] = field[index(nx, nx, j)];
    } else if (mode === "x") {
      field[index(nx, 0, j)] = -field[index(nx, 1, j)];
      field[index(nx, nx + 1, j)] = -field[index(nx, nx, j)];
    } else {
      field[index(nx, 0, j)] = field[index(nx, 1, j)];
      field[index(nx, nx + 1, j)] = field[index(nx, nx, j)];
    }
  }

  // Corners: average of their two edge neighbors, same as Stam's reference.
  field[index(nx, 0, 0)] = 0.5 * (field[index(nx, 1, 0)] + field[index(nx, 0, 1)]);
  field[index(nx, 0, ny + 1)] = 0.5 * (field[index(nx, 1, ny + 1)] + field[index(nx, 0, ny)]);
  field[index(nx, nx + 1, 0)] = 0.5 * (field[index(nx, nx, 0)] + field[index(nx, nx + 1, 1)]);
  field[index(nx, nx + 1, ny + 1)] = 0.5 * (field[index(nx, nx, ny + 1)] + field[index(nx, nx + 1, ny)]);

  if (mode === "x" || mode === "y") {
    for (let j = 1; j <= ny; j++) {
      for (let i = 1; i <= nx; i++) {
        const idx = index(nx, i, j);
        if (solid[idx]) field[idx] = 0;
      }
    }
  }
}

// Implicit (Jacobi) diffusion: solves (I - a*Laplacian) field = field0 for
// `field`, where a = diffusionRate * dt / h^2. Solid cells are excluded from
// both the neighbor sum and its count (a wall cell doesn't diffuse, and isn't
// diffused into) — the "no flux through a wall" behavior comes out of this
// exclusion for free, without a special case elsewhere.
export function diffuse(nx, ny, field, field0, diffusionRate, dt, h, iterations, solid, mode) {
  const a = (diffusionRate * dt) / (h * h);
  const stride = nx + 2;

  for (let iter = 0; iter < iterations; iter++) {
    for (let j = 1; j <= ny; j++) {
      let idx = j * stride + 1;
      for (let i = 1; i <= nx; i++, idx++) {
        if (solid[idx]) continue;

        // Inlined neighbor lookup (no array literal, no index() calls) — this
        // loop runs O(nx*ny*iterations) times per physics step, so avoiding a
        // per-cell allocation here is the difference between real-time and not.
        let sum = 0;
        let count = 0;
        if (!solid[idx - 1]) {
          sum += field[idx - 1];
          count++;
        }
        if (!solid[idx + 1]) {
          sum += field[idx + 1];
          count++;
        }
        if (!solid[idx - stride]) {
          sum += field[idx - stride];
          count++;
        }
        if (!solid[idx + stride]) {
          sum += field[idx + stride];
          count++;
        }

        field[idx] = (field0[idx] + a * sum) / (1 + a * count);
      }
    }
    setBoundary(nx, ny, field, mode, solid);
  }
}

// Enforces incompressibility (div(u) = 0): computes divergence, solves the
// pressure Poisson equation via Jacobi iteration, then subtracts the
// pressure gradient from the velocity field. Velocity components adjacent to
// a solid cell are already zero (setBoundary above), so a wall naturally
// reads as a zero-flux face in the divergence calculation with no extra
// branching there.
export function project(nx, ny, u, v, p, div, h, iterations, solid) {
  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      p[idx] = 0;
      if (solid[idx]) {
        div[idx] = 0;
        continue;
      }
      div[idx] =
        -0.5 * h * (u[index(nx, i + 1, j)] - u[index(nx, i - 1, j)] + v[index(nx, i, j + 1)] - v[index(nx, i, j - 1)]);
    }
  }
  setBoundary(nx, ny, div, "scalar", solid);
  setBoundary(nx, ny, p, "scalar", solid);

  const stride = nx + 2;
  for (let iter = 0; iter < iterations; iter++) {
    for (let j = 1; j <= ny; j++) {
      let idx = j * stride + 1;
      for (let i = 1; i <= nx; i++, idx++) {
        if (solid[idx]) continue;

        let sum = 0;
        let count = 0;
        if (!solid[idx - 1]) {
          sum += p[idx - 1];
          count++;
        }
        if (!solid[idx + 1]) {
          sum += p[idx + 1];
          count++;
        }
        if (!solid[idx - stride]) {
          sum += p[idx - stride];
          count++;
        }
        if (!solid[idx + stride]) {
          sum += p[idx + stride];
          count++;
        }

        p[idx] = count === 0 ? 0 : (div[idx] + sum) / count;
      }
    }
    setBoundary(nx, ny, p, "scalar", solid);
  }

  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      if (solid[idx]) continue;
      u[idx] -= (0.5 * (p[index(nx, i + 1, j)] - p[index(nx, i - 1, j)])) / h;
      v[idx] -= (0.5 * (p[index(nx, i, j + 1)] - p[index(nx, i, j - 1)])) / h;
    }
  }
  setBoundary(nx, ny, u, "x", solid);
  setBoundary(nx, ny, v, "y", solid);
}

// Bilinear sample of `field` at fractional grid coordinates (x, y), where
// integer coordinates line up with cell centers (including ghost cells at
// 0 and nx+1/ny+1) — shared by advect() and simulation.js's sampleVelocity so
// there is exactly one interpolation implementation in the codebase.
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

// Semi-Lagrangian advection: for every non-solid interior cell, trace
// backward through (u, v) by dt to find where its contents came from, and
// bilinear-sample field0 there. Unconditionally stable regardless of dt or
// velocity magnitude, unlike an explicit forward scheme — the classic
// property that makes Stable Fluids usable interactively.
export function advect(nx, ny, field, field0, u, v, dt, h, solid, mode) {
  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      if (solid[idx]) continue;

      const x = i - (u[idx] * dt) / h;
      const y = j - (v[idx] * dt) / h;
      field[idx] = bilinearSample(nx, ny, field0, x, y);
    }
  }
  setBoundary(nx, ny, field, mode, solid);
}

// Bilinear-resizes the interior region of `field` (an (nx+2)x(ny+2) array)
// to a new interior size (newNx, newNy), used to carry velocity/temperature
// state across a resolution change (canvas resize) instead of discarding it.
export function resample(nx, ny, field, newNx, newNy) {
  const out = allocate(newNx, newNy);
  for (let j = 1; j <= newNy; j++) {
    // Map the new interior cell center back onto the old grid's coordinate
    // space (both measured in "fraction of interior span").
    const srcY = ((j - 0.5) / newNy) * ny + 0.5;
    for (let i = 1; i <= newNx; i++) {
      const srcX = ((i - 0.5) / newNx) * nx + 0.5;
      out[index(newNx, i, j)] = bilinearSample(nx, ny, field, srcX, srcY);
    }
  }
  return out;
}
