import { describe, expect, it } from "vitest";
import { advect, allocate, bilinearSample, diffuse, index, project, resample, setBoundary } from "../js/fluid-grid.js";

// fluid-grid.js is pure typed-array numerics, no DOM — testable headlessly
// against small synthetic grids, independent of anything simulation.js does
// with sources/walls/temperature.

function noSolid(nx: number, ny: number) {
  return new Uint8Array((nx + 2) * (ny + 2));
}

function sumInterior(nx: number, ny: number, field: Float32Array, solid: Uint8Array) {
  let total = 0;
  for (let j = 1; j <= ny; j++) {
    for (let i = 1; i <= nx; i++) {
      const idx = index(nx, i, j);
      if (!solid[idx]) total += field[idx];
    }
  }
  return total;
}

describe("diffuse: conservative and smoothing", () => {
  it("spreads a single hot cell into its neighbors while conserving the total", () => {
    const nx = 16;
    const ny = 16;
    const solid = noSolid(nx, ny);
    const field0 = allocate(nx, ny);
    field0[index(nx, 8, 8)] = 100;
    const field = allocate(nx, ny);
    field.set(field0);

    const before = sumInterior(nx, ny, field0, solid);
    diffuse(nx, ny, field, field0, 1, 0.1, 1, 20, solid, "scalar");
    const after = sumInterior(nx, ny, field, solid);

    expect(field[index(nx, 8, 8)]).toBeLessThan(100);
    expect(field[index(nx, 9, 8)]).toBeGreaterThan(0);
    expect(field[index(nx, 7, 8)]).toBeGreaterThan(0);
    expect(after).toBeCloseTo(before, 3);
  });
});

describe("project: enforces incompressibility", () => {
  // A sharp-edged field (e.g. a literal linear ramp across the whole domain)
  // excites the checkerboard mode that this classic collocated-grid scheme
  // (central-difference divergence and gradient sharing one stencil) cannot
  // see or remove — a well-known property of Stam's method, not a bug. A
  // smooth field, which is what buoyancy/sources actually produce, converges
  // cleanly.
  it("removes divergence from a smooth divergent (outward radial) field", () => {
    const nx = 20;
    const ny = 20;
    const solid = noSolid(nx, ny);
    const u = allocate(nx, ny);
    const v = allocate(nx, ny);
    const cx = nx / 2;
    const cy = ny / 2;
    for (let j = 1; j <= ny; j++) {
      for (let i = 1; i <= nx; i++) {
        const dx = i - cx;
        const dy = j - cy;
        const falloff = Math.exp(-(dx * dx + dy * dy) / (2 * 3 * 3));
        u[index(nx, i, j)] = dx * falloff * 0.3;
        v[index(nx, i, j)] = dy * falloff * 0.3;
      }
    }
    setBoundary(nx, ny, u, "x", solid);
    setBoundary(nx, ny, v, "y", solid);

    const p = allocate(nx, ny);
    const div = allocate(nx, ny);
    project(nx, ny, u, v, p, div, 1, 60, solid);

    let maxDiv = 0;
    for (let j = 2; j < ny; j++) {
      for (let i = 2; i < nx; i++) {
        const d = Math.abs(
          0.5 * (u[index(nx, i + 1, j)] - u[index(nx, i - 1, j)] + v[index(nx, i, j + 1)] - v[index(nx, i, j - 1)]),
        );
        maxDiv = Math.max(maxDiv, d);
      }
    }
    expect(maxDiv).toBeLessThan(0.05);
  });

  // A field built from a stream function (u = d(psi)/dy, v = -d(psi)/dx) is
  // divergence-free by construction. Using psi = sin(pi*(x-0.5)/nx) *
  // sin(pi*(y-0.5)/ny), which is exactly zero along all four walls, also
  // makes the field respect the solver's own no-penetration boundary
  // condition (u=0 at the left/right walls, v=0 at top/bottom) -- unlike a
  // raw solid-body rotation, which has nonzero normal velocity right at the
  // domain edge and so gets legitimately altered there by setBoundary before
  // projection ever runs.
  it("leaves an already-solenoidal, wall-respecting field unchanged", () => {
    const nx = 20;
    const ny = 20;
    const solid = noSolid(nx, ny);
    const u = allocate(nx, ny);
    const v = allocate(nx, ny);
    for (let j = 1; j <= ny; j++) {
      for (let i = 1; i <= nx; i++) {
        u[index(nx, i, j)] =
          Math.sin((Math.PI * (i - 0.5)) / nx) * (Math.PI / ny) * Math.cos((Math.PI * (j - 0.5)) / ny) * 10;
        v[index(nx, i, j)] =
          -(Math.PI / nx) * Math.cos((Math.PI * (i - 0.5)) / nx) * Math.sin((Math.PI * (j - 0.5)) / ny) * 10;
      }
    }
    setBoundary(nx, ny, u, "x", solid);
    setBoundary(nx, ny, v, "y", solid);
    const uBefore = u.slice();
    const vBefore = v.slice();

    const p = allocate(nx, ny);
    const div = allocate(nx, ny);
    project(nx, ny, u, v, p, div, 1, 60, solid);

    for (let j = 5; j <= 15; j++) {
      for (let i = 5; i <= 15; i++) {
        const idx = index(nx, i, j);
        expect(u[idx]).toBeCloseTo(uBefore[idx], 4);
        expect(v[idx]).toBeCloseTo(vBefore[idx], 4);
      }
    }
  });
});

describe("setBoundary: no-slip at solid cells", () => {
  it("zeroes velocity at cells marked solid", () => {
    const nx = 10;
    const ny = 10;
    const solid = noSolid(nx, ny);
    for (let i = 1; i <= nx; i++) solid[index(nx, i, 5)] = 1;

    const u = allocate(nx, ny);
    const v = allocate(nx, ny);
    u.fill(3);
    v.fill(3);

    setBoundary(nx, ny, u, "x", solid);
    setBoundary(nx, ny, v, "y", solid);

    for (let i = 1; i <= nx; i++) {
      expect(u[index(nx, i, 5)]).toBe(0);
      expect(v[index(nx, i, 5)]).toBe(0);
    }
  });
});

describe("advect", () => {
  it("leaves a field unchanged under zero velocity", () => {
    const nx = 12;
    const ny = 12;
    const solid = noSolid(nx, ny);
    const u = allocate(nx, ny);
    const v = allocate(nx, ny);
    const field0 = allocate(nx, ny);
    field0[index(nx, 6, 6)] = 42;
    const field = allocate(nx, ny);

    advect(nx, ny, field, field0, u, v, 0.1, 1, solid, "scalar");

    expect(field[index(nx, 6, 6)]).toBeCloseTo(42, 5);
  });

  it("translates a hot cell approximately by u*dt/h under uniform velocity", () => {
    const nx = 20;
    const ny = 20;
    const solid = noSolid(nx, ny);
    const u = allocate(nx, ny);
    const v = allocate(nx, ny);
    u.fill(2); // uniform rightward velocity
    const field0 = allocate(nx, ny);
    field0[index(nx, 10, 10)] = 100;
    const field = allocate(nx, ny);

    // dt=1, h=1 -> the cell's contents should have advected 2 cells to the right.
    advect(nx, ny, field, field0, u, v, 1, 1, solid, "scalar");

    expect(field[index(nx, 12, 10)]).toBeGreaterThan(field[index(nx, 10, 10)]);
    expect(field[index(nx, 12, 10)]).toBeGreaterThan(50);
  });
});

describe("bilinearSample", () => {
  it("returns the exact cell value at integer coordinates", () => {
    const nx = 8;
    const ny = 8;
    const field = allocate(nx, ny);
    field[index(nx, 4, 4)] = 7;
    expect(bilinearSample(nx, ny, field, 4, 4)).toBeCloseTo(7, 5);
  });

  it("interpolates halfway between two cells", () => {
    const nx = 8;
    const ny = 8;
    const field = allocate(nx, ny);
    field[index(nx, 4, 4)] = 0;
    field[index(nx, 5, 4)] = 10;
    expect(bilinearSample(nx, ny, field, 4.5, 4)).toBeCloseTo(5, 5);
  });
});

describe("resample", () => {
  it("preserves a uniform field across a resolution change", () => {
    const nx = 10;
    const ny = 10;
    const solid = noSolid(nx, ny);
    const field = allocate(nx, ny);
    for (let j = 1; j <= ny; j++) {
      for (let i = 1; i <= nx; i++) field[index(nx, i, j)] = 5;
    }
    // Real fields (grid.u/v/t) always have a boundary-correct ghost border by
    // the time a resize happens, since every diffuse/advect call ends with
    // setBoundary. Populate it here too, so resample -- which samples right up
    // to the domain edge -- doesn't blend against an unset (zero) ghost cell.
    setBoundary(nx, ny, field, "scalar", solid);

    const resized = resample(nx, ny, field, 16, 12);

    for (let j = 1; j <= 12; j++) {
      for (let i = 1; i <= 16; i++) {
        expect(resized[index(16, i, j)]).toBeCloseTo(5, 3);
      }
    }
  });

  it("approximately survives an upsample followed by a downsample back to the original size", () => {
    const nx = 10;
    const ny = 10;
    const field = allocate(nx, ny);
    field[index(nx, 5, 5)] = 100;

    const up = resample(nx, ny, field, 30, 30);
    const roundTrip = resample(30, 30, up, nx, ny);

    expect(roundTrip[index(nx, 5, 5)]).toBeGreaterThan(30);
  });
});
