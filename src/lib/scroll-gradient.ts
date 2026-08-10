// Pure so the drift math is unit-testable without a DOM/scroll environment;
// Layout.astro wires this to an actual scroll listener.

export function computeScrollProgress(scrollY: number, viewportHeight: number, scrollHeight: number): number {
  const max = scrollHeight - viewportHeight;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, scrollY / max));
}

interface BlobPositions {
  blob1: string;
  blob2: string;
}

// Two gradient "blobs" drift toward each other as you scroll down the page —
// subtle, not attention-grabbing, and clamped so it never overshoots.
export function scrollGradientPosition(progress: number): BlobPositions {
  const p = Math.min(1, Math.max(0, progress));
  const x1 = 15 + p * 20;
  const y1 = 0 + p * 35;
  const x2 = 100 - p * 25;
  const y2 = 20 + p * 45;
  return {
    blob1: `${x1}% ${y1}%`,
    blob2: `${x2}% ${y2}%`,
  };
}
