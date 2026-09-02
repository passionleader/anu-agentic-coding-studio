import { describe, expect, it } from "vitest";
import { isFatalCollision, type Obstacle, type Player } from "../game-logic.ts";

// The one rule the brief asks to be under a focused automated test: a
// collision ends the round only when the player and obstacle are different
// colours. Same colour is a safe pass-through; no overlap is always safe.
describe("isFatalCollision", () => {
  const player: Player = { x: 100, y: 100, radius: 20, hue: "a" };

  it("ends the round on an overlap with a different-hue obstacle", () => {
    const obstacle: Obstacle = { x: 105, y: 100, radius: 20, hue: "b" };
    expect(isFatalCollision(player, obstacle)).toBe(true);
  });

  it("is safe on an overlap with a same-hue obstacle", () => {
    const obstacle: Obstacle = { x: 105, y: 100, radius: 20, hue: "a" };
    expect(isFatalCollision(player, obstacle)).toBe(false);
  });

  it("is safe with no overlap, even when the hue differs", () => {
    const obstacle: Obstacle = { x: 500, y: 500, radius: 20, hue: "b" };
    expect(isFatalCollision(player, obstacle)).toBe(false);
  });

  it("is safe with no overlap and a matching hue", () => {
    const obstacle: Obstacle = { x: 500, y: 500, radius: 20, hue: "a" };
    expect(isFatalCollision(player, obstacle)).toBe(false);
  });
});
