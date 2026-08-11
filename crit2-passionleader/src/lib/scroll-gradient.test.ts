import { describe, expect, it } from "vitest";
import { computeScrollProgress, scrollGradientPosition } from "./scroll-gradient";

describe("computeScrollProgress", () => {
  it("is 0 at the top of the page", () => {
    expect(computeScrollProgress(0, 800, 3000)).toBe(0);
  });

  it("is 1 at the bottom of the page", () => {
    expect(computeScrollProgress(2200, 800, 3000)).toBe(1);
  });

  it("is a fraction partway down", () => {
    expect(computeScrollProgress(1100, 800, 3000)).toBeCloseTo(0.5);
  });

  it("clamps overscroll past the bottom", () => {
    expect(computeScrollProgress(5000, 800, 3000)).toBe(1);
  });

  it("is 0 when the page doesn't scroll at all", () => {
    expect(computeScrollProgress(0, 800, 400)).toBe(0);
  });
});

describe("scrollGradientPosition", () => {
  it("matches the static fallback in global.css at progress 0", () => {
    expect(scrollGradientPosition(0)).toEqual({ blob1: "15% 0%", blob2: "100% 20%" });
  });

  it("drifts both blobs by progress 1", () => {
    expect(scrollGradientPosition(1)).toEqual({ blob1: "35% 35%", blob2: "75% 65%" });
  });

  it("clamps out-of-range progress instead of overshooting", () => {
    expect(scrollGradientPosition(2)).toEqual(scrollGradientPosition(1));
    expect(scrollGradientPosition(-1)).toEqual(scrollGradientPosition(0));
  });
});
