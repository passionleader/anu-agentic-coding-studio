// Rhythm pattern data for the Bass and Drums sections. A pattern is just its
// own spelling parsed into hit/rest steps — the label the player reads is the
// exact pattern that will play, no separate naming scheme.
export type RhythmPatternId =
  | "sustain"
  | "off"
  | "ta-ta-ta-ta"
  | "ta-ta--ta-ta--"
  | "ta--ta-ta--"
  | "ta-ta-ta--ta";

export interface RhythmOption {
  readonly id: RhythmPatternId;
  readonly label: string;
}

const NAMED_PATTERNS: readonly RhythmPatternId[] = ["ta-ta-ta-ta", "ta-ta--ta-ta--", "ta--ta-ta--", "ta-ta-ta--ta"];

// Bass keeps playing its held root by default, so a player who never opens
// this control still hears a foundation under every chord.
export const BASS_RHYTHM_OPTIONS: readonly RhythmOption[] = [
  { id: "sustain", label: "Sustain" },
  ...NAMED_PATTERNS.map((id) => ({ id, label: id })),
];

// "ta" is one hit step; each "-" is one rest step. Read left to right, so
// "ta--ta-ta--" is hit, rest, rest, hit, rest, hit, rest, rest.
export function stepsFor(pattern: RhythmPatternId): readonly boolean[] {
  if (pattern === "off") return [];
  if (pattern === "sustain") return [true];
  const steps: boolean[] = [];
  let index = 0;
  while (index < pattern.length) {
    if (pattern.startsWith("ta", index)) {
      steps.push(true);
      index += 2;
    } else {
      steps.push(false);
      index += 1;
    }
  }
  return steps;
}

// Drums need three independent voices per step (a single hit/rest track
// can't tell a kick from a hi-hat), so they get their own grid model instead
// of reusing stepsFor(). Each row is one 16th-note grid over a chord's
// duration — "X" hits, "." rests — read left to right, same spelling-is-the-
// pattern idea as the bass patterns above, just three rows instead of one.
export interface DrumGrid {
  readonly kick: readonly boolean[];
  readonly snare: readonly boolean[];
  readonly hihat: readonly boolean[];
}

function drumGrid(kick: string, snare: string, hihat: string): DrumGrid {
  if (snare.length !== kick.length || hihat.length !== kick.length) {
    throw new Error(
      `Drum grid rows must share one length (kick=${kick.length}, snare=${snare.length}, hihat=${hihat.length})`,
    );
  }
  const parse = (spec: string): readonly boolean[] => [...spec].map((char) => char === "X");
  return { kick: parse(kick), snare: parse(snare), hihat: parse(hihat) };
}

const DRUM_GRIDS = {
  "four-on-the-floor": drumGrid("X...X...X...X...", "....X.......X...", "X.X.X.X.X.X.X.X."),
  backbeat: drumGrid("X.......X.......", "....X.......X...", "X.X.X.X.X.X.X.X."),
  "steady-rock": drumGrid("X.......X.......", "....X.......X...", "X...X...X...X..."),
  syncopated: drumGrid("X..X....X..X....", "....X.......X...", "X.X.X.X.X.X.X.X."),
  "alternating-kick": drumGrid("X.....X.X.....X.", "....X.......X...", ".X.X.X.X.X.X.X.X"),
  "off-beat-kick": drumGrid("..X...X...X...X.", "....X.......X...", "X.X.X.X.X.X.X.X."),
  "half-time": drumGrid("X.....X.........", "........X.......", "X.X.X.X.X.X.X.X."),
  sparse: drumGrid("X...............", "..........X.....", "......X.......X."),
  "driving-eighths": drumGrid("X.......X.......", "....X.X.....X.X.", "X.X.X.X.X.X.X.X."),
  "hihat-subdivision": drumGrid("X.......X.......", "....X.......X...", "XXXXXXXXXXXXXXXX"),
};

const DRUM_LABELS: Readonly<Record<keyof typeof DRUM_GRIDS, string>> = {
  "four-on-the-floor": "Four on the floor",
  backbeat: "Backbeat",
  "steady-rock": "Steady rock",
  syncopated: "Syncopated",
  "alternating-kick": "Alternating kick",
  "off-beat-kick": "Off-beat kick",
  "half-time": "Half-time",
  sparse: "Sparse",
  "driving-eighths": "Driving eighths",
  "hihat-subdivision": "Hi-hat subdivisions",
};

export type DrumPatternId = "off" | keyof typeof DRUM_GRIDS;

export interface DrumPatternOption {
  readonly id: DrumPatternId;
  readonly label: string;
}

// Drums stay silent until a pattern is chosen, so the section never
// surprises a player who ignores it.
export const DRUM_PATTERN_OPTIONS: readonly DrumPatternOption[] = [
  { id: "off", label: "Off" },
  ...(Object.keys(DRUM_GRIDS) as (keyof typeof DRUM_GRIDS)[]).map((id) => ({ id, label: DRUM_LABELS[id] })),
];

const SILENT_GRID: DrumGrid = { kick: [], snare: [], hihat: [] };

export function drumStepsFor(pattern: DrumPatternId): DrumGrid {
  return pattern === "off" ? SILENT_GRID : DRUM_GRIDS[pattern];
}
