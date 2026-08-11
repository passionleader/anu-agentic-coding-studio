// Pure so it's unit-testable without a DOM; Layout.astro wires this to the
// scroll listener it already has for the background-gradient drift.

const SHRINK_DISTANCE = 160;
const MIN_SCALE = 0.82;

export function brandScale(scrollY: number): number {
  const progress = Math.min(1, Math.max(0, scrollY / SHRINK_DISTANCE));
  return 1 - progress * (1 - MIN_SCALE);
}
