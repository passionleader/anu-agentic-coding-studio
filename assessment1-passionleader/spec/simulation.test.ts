import { describe, expect, it } from "vitest";
import { addSource, addWall, buildCirculationPairs, reset } from "../js/simulation.js";

// simulation.js touches no DOM/Canvas API, so its physics is testable
// headlessly — no browser, no JSDOM, just the module's own state.
describe("buildCirculationPairs: a lone source drives two symmetric cells, not one lopsided loop", () => {
  const bounds = { width: 100, height: 100 };

  it("pairs a lone hot source against BOTH ceiling corners of the open canvas (no walls at all)", () => {
    reset();
    addSource(50, 90, 100, 20);

    const pairs = buildCirculationPairs(bounds);

    expect(pairs).toHaveLength(2);
    const coldPoints = pairs
      .map((pair: any) => [pair.coldX, pair.coldY])
      .sort((a: number[], b: number[]) => a[0] - b[0]);
    expect(coldPoints).toEqual([
      [0, 0],
      [100, 0],
    ]);
    // Both cells share the same source as their rising side.
    for (const pair of pairs) {
      expect(pair.hotX).toBeCloseTo(50);
      expect(pair.hotY).toBeCloseTo(90);
    }
  });

  it("still falls back to the full canvas's ceiling corners for an open flue (walls with a bounding box but no sealed side)", () => {
    reset();
    // Two parallel walls open at both ends, like the thermal-chimney preset's
    // flue — has a bounding box, but nothing seals its top or bottom.
    addWall(40, 10, 40, 90);
    addWall(60, 10, 60, 90);
    addSource(50, 85, 100, 20);

    const pairs = buildCirculationPairs(bounds);

    expect(pairs).toHaveLength(2);
    const coldPoints = pairs
      .map((pair: any) => [pair.coldX, pair.coldY])
      .sort((a: number[], b: number[]) => a[0] - b[0]);
    expect(coldPoints).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it("pairs a lone cold source against BOTH floor corners of its sealed sub-room, not the larger canvas around it", () => {
    reset();
    addWall(20, 20, 80, 20);
    addWall(80, 20, 80, 80);
    addWall(80, 80, 20, 80);
    addWall(20, 80, 20, 20);
    addSource(60, 30, -90, 20);

    const pairs = buildCirculationPairs({ width: 200, height: 200 });

    expect(pairs).toHaveLength(2);
    const hotPoints = pairs
      .map((pair: any) => [pair.hotX, pair.hotY])
      .sort((a: number[], b: number[]) => a[0] - b[0]);
    expect(hotPoints).toEqual([
      [20, 80],
      [80, 80],
    ]);
    for (const pair of pairs) {
      expect(pair.coldX).toBeCloseTo(60);
      expect(pair.coldY).toBeCloseTo(30);
    }
  });

  it("still pairs every real hot/cold combination once, with no extra virtual pairing on top of it", () => {
    reset();
    addSource(10, 10, 90, 20);
    addSource(90, 90, -90, 20);

    expect(buildCirculationPairs(bounds)).toHaveLength(1);
  });
});
