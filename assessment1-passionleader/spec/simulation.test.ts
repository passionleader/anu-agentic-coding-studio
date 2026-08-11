import { beforeEach, describe, expect, it } from "vitest";
import * as simulation from "../js/simulation.js";

// `simulation.grid` is a live ES module binding that gets *reassigned*
// wholesale by resizeGrid() (a resize resamples into a brand new grid
// object rather than mutating the old one in place) — so tests read it via
// `simulation.grid` each time rather than destructuring `grid` into a local
// const once, which would freeze a reference to whatever grid existed at
// import time.

const { addSource, addWall, sourceAt, eraseAt, clearSources, reset, step, config, PHYSICAL_CONSTANTS, CELL_SIZE_M } =
  simulation;

const DT = 1 / 60;

beforeEach(() => {
  simulation.resizeGrid(40, 30);
  reset();
  config.ambientTemperature = 20;
  config.eddyViscosityMultiplier = 300;
});

describe("addBuoyancy (via step)", () => {
  it("accelerates a hotter-than-ambient cell upward (screen-space -y)", () => {
    const { grid } = simulation;
    const idx = grid.nx + 3; // an interior cell, row 1
    grid.t[idx] = config.ambientTemperature + 40;
    step(DT);
    expect(grid.v[idx]).toBeLessThan(0);
  });

  it("accelerates a colder-than-ambient cell downward (screen-space +y)", () => {
    const { grid } = simulation;
    const idx = grid.nx + 3;
    grid.t[idx] = config.ambientTemperature - 40;
    step(DT);
    expect(grid.v[idx]).toBeGreaterThan(0);
  });
});

describe("rayleighNumber", () => {
  it("matches the textbook formula Ra = g*beta*deltaT*L^3 / (nu*alpha) exactly", () => {
    const g = 9.81;
    const nu = 1.5e-5;
    const alpha = 2.2e-5;
    const ambientC = 20;
    const deltaT = 10;
    const length = 0.75;
    const beta = 1 / (ambientC + 273.15);
    const expected = (g * beta * deltaT * length ** 3) / (nu * alpha);

    expect(simulation.rayleighNumber(deltaT, length, { g, nu, alpha, ambientC })).toBeCloseTo(expected, 6);
  });

  it("defaults nu/alpha to real, unscaled air so a bare call answers 'if this were real air'", () => {
    const ra = simulation.rayleighNumber(10, 0.75);
    const expected = simulation.rayleighNumber(10, 0.75, {
      nu: PHYSICAL_CONSTANTS.kinematicViscosityAir,
      alpha: PHYSICAL_CONSTANTS.thermalDiffusivityAir,
    });
    expect(ra).toBeCloseTo(expected, 6);
    // Real air, room scale: deep turbulence, hundreds of millions.
    expect(ra).toBeGreaterThan(1e8);
  });
});

describe("prandtlNumber", () => {
  it("is approximately 0.71 for real air's own diffusivities", () => {
    const pr = simulation.prandtlNumber(
      PHYSICAL_CONSTANTS.kinematicViscosityAir,
      PHYSICAL_CONSTANTS.thermalDiffusivityAir,
    );
    expect(pr).toBeCloseTo(PHYSICAL_CONSTANTS.prandtlAir, 2);
  });

  it("stays the same real-air ratio for the solver's effective (eddy-scaled) diffusivities", () => {
    // The whole point of the dual-viscosity scheme: only the magnitude of
    // diffusion is boosted for stability, never the ratio between momentum
    // and thermal diffusion.
    const k = config.eddyViscosityMultiplier;
    const nuEff = PHYSICAL_CONSTANTS.kinematicViscosityAir * k;
    const alphaEff = PHYSICAL_CONSTANTS.thermalDiffusivityAir * k;
    expect(simulation.prandtlNumber(nuEff, alphaEff)).toBeCloseTo(PHYSICAL_CONSTANTS.prandtlAir, 2);
  });
});

describe("flowRegime", () => {
  it("labels below the critical Rayleigh number as conduction-dominated", () => {
    expect(simulation.flowRegime(0)).toBe("conduction-dominated");
    expect(simulation.flowRegime(1699)).toBe("conduction-dominated");
    expect(simulation.flowRegime(-1699)).toBe("conduction-dominated");
  });

  it("labels the mid range as steady convection cells", () => {
    expect(simulation.flowRegime(1700)).toBe("steady convection cells");
    expect(simulation.flowRegime(999_999)).toBe("steady convection cells");
  });

  it("labels the high range as turbulent convection", () => {
    expect(simulation.flowRegime(1_000_000)).toBe("turbulent convection");
    expect(simulation.flowRegime(1e9)).toBe("turbulent convection");
  });
});

describe("step: relaxation with no sources", () => {
  it("smooths a perturbed cell back toward ambient over time with no sources active", () => {
    const { grid } = simulation;
    const idx = (grid.ny >> 1) * (grid.nx + 2) + (grid.nx >> 1);
    grid.t[idx] = config.ambientTemperature + 50;

    const deviations: number[] = [];
    for (let i = 0; i < 10; i++) {
      step(DT);
      deviations.push(Math.abs(grid.t[idx] - config.ambientTemperature));
    }

    expect(deviations.at(-1)).toBeLessThan(deviations[0]);
  });
});

describe("step: incompressibility with an active source", () => {
  it("keeps velocity divergence small after a full step driven by a real source", () => {
    const { grid } = simulation;
    addSource(grid.nx * CELL_SIZE_M * 0.5, grid.ny * CELL_SIZE_M * 0.6, config.ambientTemperature + 30);
    for (let i = 0; i < 5; i++) step(DT);

    let maxDiv = 0;
    for (let j = 2; j < grid.ny; j++) {
      for (let i = 2; i < grid.nx; i++) {
        const idx = j * (grid.nx + 2) + i;
        const right = j * (grid.nx + 2) + (i + 1);
        const left = j * (grid.nx + 2) + (i - 1);
        const down = (j + 1) * (grid.nx + 2) + i;
        const up = (j - 1) * (grid.nx + 2) + i;
        if (grid.solid[idx]) continue;
        const d = Math.abs(0.5 * (grid.u[right] - grid.u[left] + grid.v[down] - grid.v[up]));
        maxDiv = Math.max(maxDiv, d);
      }
    }
    expect(maxDiv).toBeLessThan(5);
  });
});

describe("walls rasterize onto the grid", () => {
  it("marks cells along a wall segment solid, and cells away from it not solid", () => {
    const { grid } = simulation;
    const width = grid.nx * CELL_SIZE_M;
    // DOMAIN_HEIGHT_M is only the true domain height when ny === GRID_ROWS;
    // this test resizes to a smaller ny for speed, so derive height from the
    // grid actually in use rather than assuming the production constant.
    const height = grid.ny * CELL_SIZE_M;
    addWall(width * 0.5, height * 0.2, width * 0.5, height * 0.8);
    step(DT);

    const onWallI = Math.round(width * 0.5 / CELL_SIZE_M);
    const onWallJ = Math.round((height * 0.5) / CELL_SIZE_M);
    const onWallIdx = onWallJ * (grid.nx + 2) + onWallI;
    expect(grid.solid[onWallIdx]).toBe(1);

    const cornerIdx = 1 * (grid.nx + 2) + 1;
    expect(grid.solid[cornerIdx]).toBe(0);
  });
});

describe("source/wall CRUD in meters", () => {
  it("adds, finds, erases, and clears at meter-scale coordinates", () => {
    const source = addSource(0.1, 0.2, 45, 0.05);
    expect(source).toEqual({ x: 0.1, y: 0.2, temperature: 45, radius: 0.05 });
    expect(sourceAt(0.1, 0.2)).toBe(source);
    expect(sourceAt(0.5, 0.5)).toBeNull();

    addWall(0, 0, 0.3, 0.3);
    eraseAt(0.1, 0.2, 0.02);
    expect(sourceAt(0.1, 0.2)).toBeNull();
    expect(simulation.walls).toHaveLength(1);

    addSource(0.2, 0.2, 30);
    clearSources();
    expect(simulation.sources).toHaveLength(0);
    expect(simulation.walls).toHaveLength(1);

    reset();
    expect(simulation.walls).toHaveLength(0);
  });
});

describe("temperatureToColor", () => {
  const AMBIENT_MID = (simulation.AMBIENT_TEMPERATURE_MIN + simulation.AMBIENT_TEMPERATURE_MAX) / 2;

  it("is neutral white at an ambient-only room when ambient sits at the slider's midpoint", () => {
    expect(simulation.temperatureToColor(AMBIENT_MID, AMBIENT_MID)).toEqual([255, 255, 255]);
  });

  it("tints an ambient-only room blue at the slider's coldest setting and red at its hottest", () => {
    const coldRoom = simulation.temperatureToColor(simulation.AMBIENT_TEMPERATURE_MIN, simulation.AMBIENT_TEMPERATURE_MIN);
    expect(coldRoom).toEqual([56, 189, 248]);

    const hotRoom = simulation.temperatureToColor(simulation.AMBIENT_TEMPERATURE_MAX, simulation.AMBIENT_TEMPERATURE_MAX);
    expect(hotRoom).toEqual([255, 68, 68]);
  });

  it("still warms toward red above ambient and cools toward blue below it, regardless of the room's own base tint", () => {
    const hot = simulation.temperatureToColor(AMBIENT_MID + 35, AMBIENT_MID);
    expect(hot).toEqual([255, 68, 68]);

    const cold = simulation.temperatureToColor(AMBIENT_MID - 35, AMBIENT_MID);
    expect(cold).toEqual([56, 189, 248]);
  });

  it("clamps beyond +/- the color range instead of extrapolating", () => {
    expect(simulation.temperatureToColor(AMBIENT_MID + 1000, AMBIENT_MID)).toEqual(
      simulation.temperatureToColor(AMBIENT_MID + 35, AMBIENT_MID),
    );
    expect(simulation.temperatureToColor(AMBIENT_MID - 1000, AMBIENT_MID)).toEqual(
      simulation.temperatureToColor(AMBIENT_MID - 35, AMBIENT_MID),
    );
  });
});

describe("gridResolutionFor", () => {
  it("derives column count from aspect ratio and clamps to [GRID_COLS_MIN, GRID_COLS_MAX]", () => {
    expect(simulation.gridResolutionFor(16 / 9)).toEqual({ nx: simulation.GRID_COLS_MAX, ny: simulation.GRID_ROWS });
    expect(simulation.gridResolutionFor(0.1)).toEqual({ nx: simulation.GRID_COLS_MIN, ny: simulation.GRID_ROWS });
    expect(simulation.gridResolutionFor(10)).toEqual({ nx: simulation.GRID_COLS_MAX, ny: simulation.GRID_ROWS });
  });
});
