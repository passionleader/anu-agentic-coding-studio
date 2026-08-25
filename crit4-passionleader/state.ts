// Progression state, kept apart from the DOM so future controls (tempo,
// save slots) can read and write it without touching rendering code.
import { type ChordId, type RankedChord, rankNextChords } from "./chords.ts";

const HISTORY_LIMIT = 50;

let progression: ChordId[] = [];
let candidates: RankedChord[] = rankNextChords(progression);
let history: ChordId[][] = [];
let selectedIndex: number | null = null;

function snapshotBeforeChange(): void {
  history = [...history, progression].slice(-HISTORY_LIMIT);
}

function applyProgression(next: ChordId[]): void {
  progression = next;
  candidates = rankNextChords(progression);
  selectedIndex = null;
}

export function getProgression(): readonly ChordId[] {
  return progression;
}

export function getCandidates(): readonly RankedChord[] {
  return candidates;
}

export function getSelectedIndex(): number | null {
  return selectedIndex;
}

export function canUndo(): boolean {
  return history.length > 0;
}

export function playChordById(id: ChordId): void {
  snapshotBeforeChange();
  applyProgression([...progression, id]);
}

export function clearProgression(): void {
  if (progression.length === 0) return;
  snapshotBeforeChange();
  applyProgression([]);
}

export function selectChordAt(index: number | null): void {
  selectedIndex = index !== null && index >= 0 && index < progression.length ? index : null;
}

// Removes the selected chord in place. Later chords keep their own recorded
// order; only the deleted one disappears.
export function deleteSelectedChord(): boolean {
  if (selectedIndex === null) return false;
  snapshotBeforeChange();
  applyProgression(progression.filter((_, index) => index !== selectedIndex));
  return true;
}

export function undo(): boolean {
  if (history.length === 0) return false;
  const previous = history[history.length - 1] as ChordId[];
  history = history.slice(0, -1);
  progression = previous;
  candidates = rankNextChords(progression);
  selectedIndex = null;
  return true;
}

// clearProgression() deliberately keeps history (so Clear itself stays
// undoable), so it can't isolate test cases from each other — this module is
// a singleton reused across a whole test file. Tests use this instead.
export function resetSessionState(): void {
  progression = [];
  candidates = rankNextChords(progression);
  history = [];
  selectedIndex = null;
}
