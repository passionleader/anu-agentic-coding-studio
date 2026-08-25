// The single source of truth for timing. Playback speed, the bass/drum
// rhythm patterns, and "play from the beginning" all derive their intervals
// from here, so a speed change moves every rhythmic part together instead of
// each caller keeping its own setTimeout value.
const BASE_MS_PER_CHORD = 900;
const MIN_SPEED = 0.5;
const MAX_SPEED = 2;

let speed = 1;

export function getSpeed(): number {
  return speed;
}

export function setSpeed(next: number): void {
  speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, next));
}

export function msPerChord(): number {
  return BASE_MS_PER_CHORD / speed;
}

// One chord slot is the session's beat, so BPM is just that pulse restated
// in the units a musician thinks in — the transport shows this, nothing else
// derives from it.
export function currentBpm(): number {
  return Math.round(60000 / msPerChord());
}
