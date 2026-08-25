// A small curated chord vocabulary in C major, not a chord database. Each
// chord's root sits within a single octave band so pads never jump register.
export type ChordId = "I" | "ii" | "iii" | "IV" | "V" | "V7" | "vi" | "bVII";
export type ChordCategory = "tonic" | "subdominant" | "dominant" | "color";
export type ConfidenceTier = "safe" | "colour" | "surprise";

export interface ChordDef {
  readonly id: ChordId;
  readonly roman: string;
  readonly shortName: string;
  readonly fullName: string;
  readonly category: ChordCategory;
  readonly rootMidi: number;
  readonly intervals: readonly number[];
}

export interface RankedChord {
  readonly chord: ChordDef;
  readonly tier: ConfidenceTier;
}

const CHORD_LIST: readonly ChordDef[] = [
  { id: "I", roman: "I", shortName: "C", fullName: "C major", category: "tonic", rootMidi: 60, intervals: [0, 4, 7] },
  { id: "ii", roman: "ii", shortName: "Dm", fullName: "D minor", category: "subdominant", rootMidi: 62, intervals: [0, 3, 7] },
  { id: "iii", roman: "iii", shortName: "Em", fullName: "E minor", category: "color", rootMidi: 64, intervals: [0, 3, 7] },
  { id: "IV", roman: "IV", shortName: "F", fullName: "F major", category: "subdominant", rootMidi: 65, intervals: [0, 4, 7] },
  { id: "V", roman: "V", shortName: "G", fullName: "G major", category: "dominant", rootMidi: 67, intervals: [0, 4, 7] },
  { id: "V7", roman: "V7", shortName: "G7", fullName: "G dominant 7th", category: "dominant", rootMidi: 67, intervals: [0, 4, 7, 10] },
  { id: "vi", roman: "vi", shortName: "Am", fullName: "A minor", category: "tonic", rootMidi: 57, intervals: [0, 3, 7] },
  { id: "bVII", roman: "♭VII", shortName: "B♭", fullName: "B♭ major", category: "color", rootMidi: 58, intervals: [0, 4, 7] },
];

export const CHORDS: Readonly<Record<ChordId, ChordDef>> = Object.fromEntries(
  CHORD_LIST.map((chord) => [chord.id, chord]),
) as Record<ChordId, ChordDef>;

const ALL_IDS: readonly ChordId[] = CHORD_LIST.map((chord) => chord.id);
const PADS_SHOWN = 6;

// How central/common each chord is on its own, before any context. Mirrors
// which chords a beginner should meet first; iii and bVII stay low so they
// surface as occasional colour rather than every-time defaults.
const INTRINSIC_WEIGHT: Readonly<Record<ChordId, number>> = {
  I: 5,
  V: 5,
  IV: 4,
  vi: 4,
  ii: 3,
  V7: 3,
  iii: 1,
  bVII: 1,
};

// Tension-and-release bonus for moving from one functional category to
// another. Rows are the last-played chord's category, columns the
// candidate's. Resolving dominant tension back to a tonic scores highest;
// sitting still on the same category scores lowest.
const CATEGORY_BONUS: Readonly<Record<ChordCategory, Readonly<Record<ChordCategory, number>>>> = {
  tonic: { tonic: 0, subdominant: 2, dominant: 3, color: 1 },
  subdominant: { tonic: 3, subdominant: 0, dominant: 3, color: 1 },
  dominant: { tonic: 4, subdominant: 1, dominant: 0, color: 1 },
  color: { tonic: 2, subdominant: 2, dominant: 1, color: 0 },
};

// The jazz turnaround: after ii then V, resolving to I is strongly preferred.
const CADENCE_II_V_I: readonly [ChordId, ChordId, ChordId] = ["ii", "V", "I"];

// The pop loop, as a cycle rather than four hardcoded pairs: I-V-vi-IV-I...
// Whichever two chords were just played, if they're a consecutive pair
// anywhere in this cycle, the cycle's next chord gets a continuation bonus —
// this is what makes V follow I-V toward vi instead of only resolving to I.
const LOOP_I_V_VI_IV: readonly ChordId[] = ["I", "V", "vi", "IV"];

function pitchClass(chord: ChordDef, interval: number): number {
  return (((chord.rootMidi + interval) % 12) + 12) % 12;
}

function pitchClasses(chord: ChordDef): number[] {
  return chord.intervals.map((interval) => pitchClass(chord, interval));
}

function circularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 12 - diff);
}

// Total movement if every tone in `to` moves to its nearest tone in `from`.
// Lower means smoother voice leading (more shared or nearby tones).
function voiceLeadingCost(from: ChordDef, to: ChordDef): number {
  const fromPcs = pitchClasses(from);
  return pitchClasses(to).reduce(
    (total, pc) => total + Math.min(...fromPcs.map((fromPc) => circularDistance(fromPc, pc))),
    0,
  );
}

function cadenceBonus(progression: readonly ChordId[], candidate: ChordId): number {
  const [a, b] = progression.slice(-2);
  return a === CADENCE_II_V_I[0] && b === CADENCE_II_V_I[1] && candidate === CADENCE_II_V_I[2] ? 4 : 0;
}

function loopContinuationBonus(progression: readonly ChordId[], candidate: ChordId): number {
  const [a, b] = progression.slice(-2);
  if (a === undefined || b === undefined) {
    return 0;
  }
  const index = LOOP_I_V_VI_IV.indexOf(a);
  if (index === -1 || LOOP_I_V_VI_IV[(index + 1) % LOOP_I_V_VI_IV.length] !== b) {
    return 0;
  }
  const next = LOOP_I_V_VI_IV[(index + 2) % LOOP_I_V_VI_IV.length];
  return candidate === next ? 3 : 0;
}

// Discourages a chord that appeared recently, scaled by how recent — a soft
// nudge toward variety, not a ban, since deliberate repetition (a pedal
// chord, an oscillating I-V-I-V) is still musically valid.
function recencyPenalty(progression: readonly ChordId[], candidate: ChordId): number {
  const recent = progression.slice(-4);
  let penalty = 0;
  recent.forEach((id, index) => {
    if (id === candidate) {
      penalty += 5 - (recent.length - index);
    }
  });
  return penalty;
}

function scoreCandidate(progression: readonly ChordId[], candidateId: ChordId): number {
  const candidate = CHORDS[candidateId];
  const lastId = progression.length > 0 ? progression[progression.length - 1] : null;
  let score = INTRINSIC_WEIGHT[candidateId];
  if (lastId) {
    const last = CHORDS[lastId];
    score += CATEGORY_BONUS[last.category][candidate.category];
    score -= voiceLeadingCost(last, candidate) * 0.5;
  }
  score += cadenceBonus(progression, candidateId);
  score += loopContinuationBonus(progression, candidateId);
  score -= recencyPenalty(progression, candidateId) * 0.5;
  return score;
}

function tierForRank(index: number): ConfidenceTier {
  if (index < 2) return "safe";
  if (index < 4) return "colour";
  return "surprise";
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// A fresh session's starter set: six chords drawn at random each time rather
// than the same fixed set, but still guaranteed a tonic and a dominant-or-
// subdominant chord so "balanced" isn't left entirely to chance.
function randomStarterIds(): ChordId[] {
  const tonicIds = ALL_IDS.filter((id) => CHORDS[id].category === "tonic");
  const motionIds = ALL_IDS.filter((id) => CHORDS[id].category === "subdominant" || CHORDS[id].category === "dominant");
  const guaranteed = [shuffled(tonicIds)[0], shuffled(motionIds)[0]];
  const rest = shuffled(ALL_IDS.filter((id) => !guaranteed.includes(id))).slice(0, PADS_SHOWN - guaranteed.length);
  return shuffled([...guaranteed, ...rest]);
}

// Every candidate is a diatonic chord from the curated vocabulary above, so
// every recommendation is valid by construction — there is no invalid or
// out-of-key suggestion to filter out.
export function rankNextChords(progression: readonly ChordId[]): RankedChord[] {
  if (progression.length === 0) {
    const ids = randomStarterIds().sort((a, b) => INTRINSIC_WEIGHT[b] - INTRINSIC_WEIGHT[a]);
    return ids.map((id, index) => ({ chord: CHORDS[id], tier: tierForRank(index) }));
  }
  const lastId = progression[progression.length - 1];
  const pool = ALL_IDS.filter((id) => id !== lastId);
  const ranked = [...pool].sort((a, b) => scoreCandidate(progression, b) - scoreCandidate(progression, a));
  return ranked.slice(0, PADS_SHOWN).map((id, index) => ({ chord: CHORDS[id], tier: tierForRank(index) }));
}

const COMFORTABLE_LOW = 55; // G3
const COMFORTABLE_HIGH = 79; // G5

function nearestNoteWithPitchClass(pc: number, target: number): number {
  const below = target - (((target - pc) % 12 + 12) % 12);
  const above = below + 12;
  return Math.abs(target - below) <= Math.abs(above - target) ? below : above;
}

function keepInRange(note: number, low: number, high: number): number {
  let result = note;
  while (result < low) result += 12;
  while (result > high) result -= 12;
  return result;
}

// Chooses the actual MIDI notes for a chord's upper voices. With no previous
// voicing (the first chord, or right after Clear) it plays plain root
// position. Otherwise each tone snaps to the octave nearest the previous
// voicing's centre, so a new chord keeps shared tones in place and moves the
// rest by as little as possible — smooth voice leading without solving a
// full per-voice assignment problem. Every chord in the vocabulary keeps its
// own tones at least a whole tone apart (mod 12), so independently snapping
// each one this way can never land two tones a clashing semitone apart.
export function voiceChordTones(chord: ChordDef, previousVoicing: readonly number[] | null): number[] {
  if (!previousVoicing || previousVoicing.length === 0) {
    return chord.intervals.map((interval) => chord.rootMidi + interval);
  }
  const centroid = Math.round(previousVoicing.reduce((sum, note) => sum + note, 0) / previousVoicing.length);
  return chord.intervals.map((interval) => {
    const pc = pitchClass(chord, interval);
    return keepInRange(nearestNoteWithPitchClass(pc, centroid), COMFORTABLE_LOW, COMFORTABLE_HIGH);
  });
}

export function midiToFrequency(midiNote: number): number {
  return 440 * 2 ** ((midiNote - 69) / 12);
}
