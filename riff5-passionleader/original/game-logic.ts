// Pure game rules, kept free of the DOM/canvas so they're testable in
// isolation (spec/crit-5.test.ts) and reusable from main.ts's render loop.

export type Hue = "a" | "b";

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface Player extends Circle {
  hue: Hue;
}

export interface Obstacle extends Circle {
  hue: Hue;
}

export function circlesOverlap(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy < r * r;
}

// The one rule under test: touching a same-hue obstacle is safe (it matches
// the player's current colour and passes through); touching a different-hue
// obstacle ends the round. No overlap is always safe, regardless of hue.
export function isFatalCollision(player: Player, obstacle: Obstacle): boolean {
  return circlesOverlap(player, obstacle) && player.hue !== obstacle.hue;
}

export function otherHue(hue: Hue): Hue {
  return hue === "a" ? "b" : "a";
}

// Obstacles fall faster and spawn more often the longer a round runs, so the
// opening seconds are forgiving and the difficulty caps out fast enough that
// the five-minute mark is a sustained skill test, not a slow ramp.
export function fallSpeed(elapsedSeconds: number): number {
  return 160 + Math.min(elapsedSeconds * 8, 260);
}

export function spawnIntervalMs(elapsedSeconds: number): number {
  return Math.max(1100 - elapsedSeconds * 22, 380);
}
