import { describe, expect, it } from "vitest";
import { brandScale } from "./scroll-scale";

describe("brandScale", () => {
  it("is 1 at the top of the page", () => {
    expect(brandScale(0)).toBe(1);
  });

  it("shrinks partway through the shrink distance", () => {
    expect(brandScale(80)).toBeCloseTo(0.91, 2);
  });

  it("reaches the minimum scale at the end of the shrink distance", () => {
    expect(brandScale(160)).toBeCloseTo(0.82, 2);
  });

  it("clamps past the shrink distance instead of continuing to shrink", () => {
    expect(brandScale(1000)).toBe(brandScale(160));
  });

  it("never scales below the minimum for negative scroll", () => {
    expect(brandScale(-50)).toBe(1);
  });
});
