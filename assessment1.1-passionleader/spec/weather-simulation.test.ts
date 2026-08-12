import { beforeEach, describe, expect, it } from "vitest";
import * as weatherSimulation from "../js/weather-simulation.js";

// `weatherSimulation.grid` is a live ES module binding reassigned wholesale
// by resizeGrid() (a resize resamples into a brand new grid object rather
// than mutating the old one in place) -- so tests read it via
// `weatherSimulation.grid` each time rather than destructuring `grid` into a
// local const once, which would freeze a reference to whatever grid existed
// at import time.

const {
  addThermalSource,
  addPressureSource,
  sourceAt,
  eraseAt,
  clearSources,
  reset,
  step,
  config,
  GRID_ROWS,
  CELL_SIZE_M,
  DOMAIN_HEIGHT_M,
} = weatherSimulation;

const DT = 1 / 60;

beforeEach(() => {
  // Only nx is resized for test speed -- ny must stay GRID_ROWS, since
  // DOMAIN_HEIGHT_M/CELL_SIZE_M (and therefore latitudeOf/ambientTemperature)
  // are fixed constants derived from GRID_ROWS, not from the live grid's own
  // ny the way the original convection sim's DOMAIN_HEIGHT_M effectively is.
  weatherSimulation.resizeGrid(40, GRID_ROWS);
  reset();
  config.latitudeDeg = 45;
  config.frictionMultiplier = 1;
  config.thermalPressureCoupling = 0.45;
  config.mixing = 3;
  config.timeAccelerationHoursPerSecond = 2;
});

describe("addThermalSource (via step)", () => {
  it("raises temperature at a warm zone over time", () => {
    const { grid } = weatherSimulation;
    const x = grid.nx * CELL_SIZE_M * 0.5;
    const y = DOMAIN_HEIGHT_M * 0.5;
    const before = weatherSimulation.sampleTemperature(x, y);

    addThermalSource(x, y, 15);
    for (let i = 0; i < 20; i++) step(DT);

    expect(weatherSimulation.sampleTemperature(x, y)).toBeGreaterThan(before);
  });
});

describe("addPressureSource (via step)", () => {
  it("lowers pressure at a low-pressure zone over time", () => {
    const { grid } = weatherSimulation;
    const x = grid.nx * CELL_SIZE_M * 0.5;
    const y = DOMAIN_HEIGHT_M * 0.5;
    const before = weatherSimulation.samplePressure(x, y);

    addPressureSource(x, y, -18);
    for (let i = 0; i < 20; i++) step(DT);

    expect(weatherSimulation.samplePressure(x, y)).toBeLessThan(before);
  });

  it("is findable as a pressure minimum once the field has relaxed toward it", () => {
    const { grid } = weatherSimulation;
    const x = grid.nx * CELL_SIZE_M * 0.5;
    const y = DOMAIN_HEIGHT_M * 0.5;
    addPressureSource(x, y, -18);
    for (let i = 0; i < 10; i++) step(DT);

    const { minima } = weatherSimulation.findPressureExtrema(3);
    expect(minima.length).toBeGreaterThan(0);

    const targetI = Math.round(x / CELL_SIZE_M);
    const targetJ = Math.round(y / CELL_SIZE_M);
    const nearest = minima.reduce((best: { i: number; j: number }, m: { i: number; j: number }) =>
      Math.hypot(m.i - targetI, m.j - targetJ) < Math.hypot(best.i - targetI, best.j - targetJ) ? m : best,
    );
    expect(Math.hypot(nearest.i - targetI, nearest.j - targetJ)).toBeLessThan(5);
  });
});

describe("Coriolis+friction stability at the riskiest slider corner", () => {
  it("never lets grid-wide wind speed exceed its initial value under low friction, high latitude, and high time-acceleration", () => {
    // This is the exact corner the plan's own stability analysis flagged:
    // weak friction (small k) + high latitude (large f) + high time
    // acceleration (large dtSim) is where a naive (non-trapezoidal) Coriolis
    // integrator blows up, since forward-Euler's stability bound
    // dt <= 2k/(k^2+f^2) collapses hardest exactly here. thermalPressureCoupling
    // is zeroed so Pdiag -- and therefore P itself, which starts uniform and
    // has nothing to pull it off-uniform -- stays exactly flat all run, which
    // isolates the Coriolis+friction integrator from any pressure-gradient
    // forcing so this test measures only the momentum integrator's own
    // stability, not the (separately-tested) pressure-driven wind response.
    config.thermalPressureCoupling = 0;
    config.latitudeDeg = 80;
    config.frictionMultiplier = 0.2;
    config.timeAccelerationHoursPerSecond = 12;

    const { grid } = weatherSimulation;
    const idx = (grid.ny >> 1) * (grid.nx + 2) + (grid.nx >> 1);
    grid.u[idx] = 50;
    grid.v[idx] = 0;

    function maxSpeed() {
      let max = 0;
      for (let j = 1; j <= grid.ny; j++) {
        for (let i = 1; i <= grid.nx; i++) {
          const k = j * (grid.nx + 2) + i;
          max = Math.max(max, Math.hypot(grid.u[k], grid.v[k]));
        }
      }
      return max;
    }

    const initialMax = maxSpeed();
    for (let i = 0; i < 40; i++) {
      step(DT);
      const current = maxSpeed();
      expect(Number.isFinite(current)).toBe(true);
      expect(current).toBeLessThanOrEqual(initialMax + 1e-6);
    }
  });
});

describe("step: temperature relaxation with no sources", () => {
  it("relaxes a perturbed cell back toward its local ambient temperature over time", () => {
    const { grid } = weatherSimulation;
    const idx = (grid.ny >> 1) * (grid.nx + 2) + (grid.nx >> 1);
    const y = DOMAIN_HEIGHT_M * 0.5;
    const ambient = weatherSimulation.ambientTemperature(y);
    grid.t[idx] = ambient + 50;

    const deviations: number[] = [];
    for (let i = 0; i < 20; i++) {
      step(DT);
      deviations.push(Math.abs(grid.t[idx] - weatherSimulation.ambientTemperature(y)));
    }

    expect(deviations.at(-1)).toBeLessThan(deviations[0]);
  });
});

describe("ambientTemperature and latitudeOf", () => {
  it("peaks at the configured latitude's row and falls off symmetrically away from it", () => {
    config.latitudeDeg = 0;
    const centerY = DOMAIN_HEIGHT_M / 2;
    expect(weatherSimulation.latitudeOf(centerY)).toBeCloseTo(0, 5);
    expect(weatherSimulation.ambientTemperature(centerY)).toBeCloseTo(30, 5);

    const north = weatherSimulation.ambientTemperature(centerY - DOMAIN_HEIGHT_M * 0.25);
    const south = weatherSimulation.ambientTemperature(centerY + DOMAIN_HEIGHT_M * 0.25);
    expect(north).toBeCloseTo(south, 5);
    expect(north).toBeLessThan(30);
  });
});

describe("coriolisParameter", () => {
  it("vanishes at the equator and flips sign across hemispheres", () => {
    expect(weatherSimulation.coriolisParameter(0)).toBeCloseTo(0, 10);
    expect(weatherSimulation.coriolisParameter(45)).toBeGreaterThan(0);
    expect(weatherSimulation.coriolisParameter(-45)).toBeLessThan(0);
  });

  it("matches the textbook f = 2*Omega*sin(latitude) at real Earth's rotation rate", () => {
    const omega = 7.2921e-5;
    const expected = 2 * omega * Math.sin((45 * Math.PI) / 180);
    expect(weatherSimulation.coriolisParameter(45)).toBeCloseTo(expected, 10);
  });
});

describe("geostrophic rotation sense (the plan's key regression check)", () => {
  // coriolisParameter() itself follows the textbook x-east/y-NORTH convention
  // (positive in the NH), but this grid's v points y-SOUTH like every other
  // field here -- so the momentum step negates f right where it feeds the
  // Coriolis+friction integrator (see the comment on `f` in
  // applyPressureForceCoriolisFriction). That negation is easy to reintroduce
  // backwards in a future edit with nothing else here to catch it: the
  // stability test above is deliberately sign-agnostic (it only bounds
  // |velocity|), and the textbook-formula test above only checks
  // coriolisParameter() in isolation, never its integration into step(). This
  // test instead checks the thing a real forecaster would recognise: a low
  // circles counterclockwise in the NH and clockwise in the SH.
  it("circles counterclockwise around a low in the Northern Hemisphere, and flips to clockwise in the Southern Hemisphere", () => {
    const { grid } = weatherSimulation;
    const cx = grid.nx * CELL_SIZE_M * 0.5;
    const cy = DOMAIN_HEIGHT_M * 0.5;
    const radii = [4 * CELL_SIZE_M, 6 * CELL_SIZE_M];
    const angles = [0, 45, 90, 135, 180, 225, 270, 315].map((d) => (d * Math.PI) / 180);

    // dx*vy - dy*vx < 0 at a point sampled around the source is a
    // counterclockwise tangential velocity in this grid's y-DOWN convention
    // (real NH cyclonic); > 0 is clockwise (real SH cyclonic). Derived from
    // and cross-checked against the same sign convention as latitudeOf.
    function averageCross(latitudeDeg: number): number {
      reset();
      config.latitudeDeg = latitudeDeg;
      config.frictionMultiplier = 1;
      config.thermalPressureCoupling = 0.45;
      config.timeAccelerationHoursPerSecond = 12;
      addPressureSource(cx, cy, -18);
      for (let i = 0; i < 80; i++) step(1 / 30);

      let total = 0;
      let count = 0;
      for (const radius of radii) {
        for (const angle of angles) {
          const dx = radius * Math.cos(angle);
          const dy = radius * Math.sin(angle);
          const { vx, vy } = weatherSimulation.sampleVelocity(cx + dx, cy + dy);
          total += dx * vy - dy * vx;
          count++;
        }
      }
      return total / count;
    }

    expect(averageCross(45)).toBeLessThan(0);
    expect(averageCross(-45)).toBeGreaterThan(0);
  });
});

describe("thermal/pressure source CRUD in meters", () => {
  it("adds, finds, erases, and clears at meter-scale coordinates", () => {
    const thermalSource = addThermalSource(100_000, 200_000, 15);
    expect(thermalSource.temperatureDeltaC).toBe(15);
    expect(thermalSource.targetTemperatureC).toBeCloseTo(weatherSimulation.ambientTemperature(200_000) + 15, 5);
    expect(sourceAt(100_000, 200_000)).toBe(thermalSource);
    expect(sourceAt(900_000, 900_000)).toBeNull();

    const pressureSource = addPressureSource(300_000, 300_000, -18);
    expect(sourceAt(300_000, 300_000)).toBe(pressureSource);

    eraseAt(100_000, 200_000, 50_000);
    expect(sourceAt(100_000, 200_000)).toBeNull();
    expect(weatherSimulation.pressureSources).toHaveLength(1);

    addThermalSource(400_000, 400_000, -15);
    clearSources();
    expect(weatherSimulation.thermalSources).toHaveLength(0);
    expect(weatherSimulation.pressureSources).toHaveLength(0);
  });
});

describe("weatherTemperatureToColor", () => {
  it("is neutral white at the fixed 0°C reference", () => {
    expect(weatherSimulation.weatherTemperatureToColor(0)).toEqual([255, 255, 255]);
  });

  it("warms toward red above the reference and cools toward blue below it", () => {
    expect(weatherSimulation.weatherTemperatureToColor(40)).toEqual([255, 68, 68]);
    expect(weatherSimulation.weatherTemperatureToColor(-40)).toEqual([56, 189, 248]);
  });

  it("clamps beyond +/- the color range instead of extrapolating", () => {
    expect(weatherSimulation.weatherTemperatureToColor(1000)).toEqual(weatherSimulation.weatherTemperatureToColor(40));
    expect(weatherSimulation.weatherTemperatureToColor(-1000)).toEqual(
      weatherSimulation.weatherTemperatureToColor(-40),
    );
  });
});

describe("gridResolutionFor", () => {
  it("derives column count from aspect ratio and clamps to [GRID_COLS_MIN, GRID_COLS_MAX]", () => {
    expect(weatherSimulation.gridResolutionFor(16 / 9)).toEqual({
      nx: weatherSimulation.GRID_COLS_MAX,
      ny: weatherSimulation.GRID_ROWS,
    });
    expect(weatherSimulation.gridResolutionFor(0.1)).toEqual({
      nx: weatherSimulation.GRID_COLS_MIN,
      ny: weatherSimulation.GRID_ROWS,
    });
  });
});
