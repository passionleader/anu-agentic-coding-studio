// Renders the pad grid, progression strip, transport bar, and status line,
// and wires mouse/touch (native button activation) and keyboard (digit keys
// 1-6) to the same handler. Talks to state.ts and audio-engine.ts but neither
// of those talks back to the DOM.
import { type AudioEngine, type InstrumentId, INSTRUMENTS } from "./audio-engine.ts";
import { CHORDS, type ChordDef, type ConfidenceTier, type RankedChord } from "./chords.ts";
import { currentBpm, getSpeed, msPerChord, setSpeed } from "./clock.ts";
import { BASS_RHYTHM_OPTIONS, DRUM_PATTERN_OPTIONS, type DrumPatternId, type RhythmPatternId } from "./rhythm.ts";
import {
  canUndo,
  clearProgression,
  deleteSelectedChord,
  getCandidates,
  getProgression,
  getSelectedIndex,
  playChordById,
  selectChordAt,
  undo,
} from "./state.ts";

// The pad grid refreshes slightly after the press so the glow is visible on
// the pad the player actually touched, instead of vanishing under their
// finger the instant the suggestions change.
const GRID_REFRESH_DELAY_MS = 180;

const TIER_ORDER: readonly ConfidenceTier[] = ["safe", "colour", "surprise"];

interface Elements {
  padGrid: HTMLElement;
  progressionList: HTMLOListElement;
  statusLine: HTMLElement;
  clearButton: HTMLButtonElement;
  announcer: HTMLElement;
  undoButton: HTMLButtonElement;
  deleteButton: HTMLButtonElement;
  playButton: HTMLButtonElement;
  stopButton: HTMLButtonElement;
  speedSlider: HTMLInputElement;
  speedValue: HTMLOutputElement;
  instrumentSelect: HTMLSelectElement;
  bassPatternSelect: HTMLSelectElement;
  drumPatternSelect: HTMLSelectElement;
}

function requireElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return el;
}

function fillSelect(select: HTMLSelectElement, options: readonly { id: string; label: string }[], selected: string): void {
  select.replaceChildren(
    ...options.map((option) => {
      const el = document.createElement("option");
      el.value = option.id;
      el.textContent = option.label;
      return el;
    }),
  );
  select.value = selected;
}

// Returns an unmount function — unused by main.ts (the page never unmounts
// this), but it keeps repeated mounts in tests from leaking window listeners
// into each other.
export function mountInstrument(root: HTMLElement, engine: AudioEngine): () => void {
  const elements: Elements = {
    padGrid: requireElement(root, "#pad-grid"),
    progressionList: requireElement(root, "#progression-list"),
    statusLine: requireElement(root, "#status-line"),
    clearButton: requireElement(root, "#clear-button"),
    announcer: requireElement(root, "#sr-announcer"),
    undoButton: requireElement(root, "#undo-button"),
    deleteButton: requireElement(root, "#delete-button"),
    playButton: requireElement(root, "#play-button"),
    stopButton: requireElement(root, "#stop-button"),
    speedSlider: requireElement(root, "#speed-slider"),
    speedValue: requireElement(root, "#speed-value"),
    instrumentSelect: requireElement(root, "#instrument-select"),
    bassPatternSelect: requireElement(root, "#bass-pattern-select"),
    drumPatternSelect: requireElement(root, "#drum-pattern-select"),
  };

  let pendingPadRefresh: number | null = null;
  let pendingStopReset: number | null = null;
  let cancelSequence: (() => void) | null = null;

  // Clears the Play button's "currently playing" glow and its own reset
  // timer, so Stop, Clear, and a fresh Play press never leave a stale pulse.
  function stopPlaybackVisuals(): void {
    elements.playButton.classList.remove("glass-button--playing");
    if (pendingStopReset !== null) {
      window.clearTimeout(pendingStopReset);
      pendingStopReset = null;
    }
  }

  function buildPadButton(ranked: RankedChord, index: number, total: number): HTMLButtonElement {
    const { chord, tier } = ranked;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pad";
    button.dataset.category = chord.category;
    button.setAttribute(
      "aria-label",
      `Play ${chord.fullName} — ${tier} next chord, ${index + 1} of ${total}, keyboard shortcut ${index + 1}`,
    );

    const key = document.createElement("span");
    key.className = "pad__key";
    key.textContent = String(index + 1);

    const name = document.createElement("span");
    name.className = "pad__name";
    name.textContent = chord.shortName;

    const meta = document.createElement("span");
    meta.className = "pad__meta";

    const roman = document.createElement("span");
    roman.className = "pad__roman";
    roman.textContent = chord.roman;

    const tierBadge = document.createElement("span");
    tierBadge.className = `pad__tier pad__tier--${tier}`;
    tierBadge.textContent = tier;

    meta.append(roman, tierBadge);
    button.append(key, name, meta);
    button.addEventListener("click", () => handlePlay(chord, button));
    return button;
  }

  function renderPads(): void {
    const candidates = getCandidates();
    elements.padGrid.replaceChildren(
      ...candidates.map((ranked, index) => buildPadButton(ranked, index, candidates.length)),
    );
  }

  function buildProgressionChip(chord: ChordDef, index: number, isLatest: boolean, isSelected: boolean): HTMLLIElement {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = ["chip", isLatest ? "chip--latest" : "", isSelected ? "chip--selected" : ""]
      .filter(Boolean)
      .join(" ");
    button.textContent = chord.shortName;
    button.setAttribute("aria-pressed", String(isSelected));
    button.setAttribute(
      "aria-label",
      `${chord.fullName}, position ${index + 1} of the progression${isSelected ? ", selected" : ""}`,
    );
    button.addEventListener("click", () => {
      selectChordAt(getSelectedIndex() === index ? null : index);
      renderProgressionAndStatus();
      updateTransportButtons();
    });
    item.appendChild(button);
    return item;
  }

  function renderProgressionAndStatus(): void {
    const progression = getProgression();
    if (progression.length === 0) {
      const hint = document.createElement("li");
      hint.className = "chip chip--hint";
      hint.textContent = "Press a chord below to begin.";
      elements.progressionList.replaceChildren(hint);
    } else {
      const selected = getSelectedIndex();
      elements.progressionList.replaceChildren(
        ...progression.map((id, index) =>
          buildProgressionChip(CHORDS[id], index, index === progression.length - 1, index === selected),
        ),
      );
      // jsdom (used by spec/pads.test.ts) doesn't implement scrollIntoView.
      elements.progressionList.lastElementChild?.scrollIntoView?.({ block: "nearest" });
    }
    const played = progression.length === 1 ? "1 chord played" : `${progression.length} chords played`;
    elements.statusLine.textContent = `Key of C major · ${played} · press 1–6, click, or tap a pad`;
  }

  function updateTransportButtons(): void {
    elements.undoButton.disabled = !canUndo();
    elements.deleteButton.disabled = getSelectedIndex() === null;
    elements.playButton.disabled = getProgression().length === 0;
  }

  function announce(chord: ChordDef): void {
    const byTier = new Map<ConfidenceTier, string[]>();
    for (const ranked of getCandidates()) {
      const names = byTier.get(ranked.tier) ?? [];
      names.push(ranked.chord.shortName);
      byTier.set(ranked.tier, names);
    }
    const groups = TIER_ORDER.filter((tier) => byTier.has(tier)).map(
      (tier) => `${tier}: ${(byTier.get(tier) ?? []).join(", ")}`,
    );
    elements.announcer.textContent = `Played ${chord.fullName}. Next chords — ${groups.join("; ")}.`;
  }

  function handlePlay(chord: ChordDef, sourceButton: HTMLButtonElement | null): void {
    engine.playChord(chord);
    playChordById(chord.id);
    renderProgressionAndStatus();
    updateTransportButtons();
    announce(chord);

    sourceButton?.classList.add("pad--playing");

    if (pendingPadRefresh !== null) {
      window.clearTimeout(pendingPadRefresh);
    }
    pendingPadRefresh = window.setTimeout(() => {
      renderPads();
      pendingPadRefresh = null;
    }, GRID_REFRESH_DELAY_MS);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const index = Number(event.key) - 1;
    if (!Number.isInteger(index) || index < 0 || index > 5) {
      return;
    }
    const button = elements.padGrid.children.item(index);
    const ranked = getCandidates()[index];
    if (!(button instanceof HTMLButtonElement) || !ranked) {
      return;
    }
    handlePlay(ranked.chord, button);
  }

  elements.clearButton.addEventListener("click", () => {
    cancelSequence?.();
    cancelSequence = null;
    engine.stopAll();
    stopPlaybackVisuals();
    clearProgression();
    engine.reset();
    renderProgressionAndStatus();
    renderPads();
    updateTransportButtons();
    elements.announcer.textContent = "Progression cleared.";
  });

  elements.undoButton.addEventListener("click", () => {
    if (!undo()) {
      return;
    }
    renderProgressionAndStatus();
    renderPads();
    updateTransportButtons();
    elements.announcer.textContent = "Undid the last change.";
  });

  elements.deleteButton.addEventListener("click", () => {
    const removedIndex = getSelectedIndex();
    if (removedIndex === null) {
      return;
    }
    const removed = CHORDS[getProgression()[removedIndex] as keyof typeof CHORDS];
    if (!deleteSelectedChord()) {
      return;
    }
    renderProgressionAndStatus();
    renderPads();
    updateTransportButtons();
    elements.announcer.textContent = `Deleted ${removed.fullName} from the progression.`;
  });

  elements.playButton.addEventListener("click", () => {
    cancelSequence?.();
    stopPlaybackVisuals();
    const chords = getProgression().map((id) => CHORDS[id]);
    if (chords.length === 0) {
      return;
    }
    cancelSequence = engine.playSequence(chords);
    elements.playButton.classList.add("glass-button--playing");
    pendingStopReset = window.setTimeout(() => {
      elements.playButton.classList.remove("glass-button--playing");
      pendingStopReset = null;
    }, chords.length * msPerChord());
    elements.announcer.textContent = `Playing the progression from the start, ${chords.length} chord${chords.length === 1 ? "" : "s"}.`;
  });

  elements.stopButton.addEventListener("click", () => {
    cancelSequence?.();
    cancelSequence = null;
    engine.stopAll();
    stopPlaybackVisuals();
    elements.announcer.textContent = "Stopped.";
  });

  function updateSpeedDisplay(): void {
    elements.speedValue.textContent = `${getSpeed().toFixed(1)}× · ${currentBpm()} BPM`;
  }

  elements.speedSlider.addEventListener("input", () => {
    setSpeed(Number(elements.speedSlider.value));
    updateSpeedDisplay();
  });

  fillSelect(elements.instrumentSelect, INSTRUMENTS, "piano");
  elements.instrumentSelect.addEventListener("change", () => {
    engine.setInstrument(elements.instrumentSelect.value as InstrumentId);
  });
  engine.setInstrument("piano");

  fillSelect(elements.bassPatternSelect, BASS_RHYTHM_OPTIONS, "sustain");
  elements.bassPatternSelect.addEventListener("change", () => {
    engine.setBassPattern(elements.bassPatternSelect.value as RhythmPatternId);
  });

  fillSelect(elements.drumPatternSelect, DRUM_PATTERN_OPTIONS, "off");
  elements.drumPatternSelect.addEventListener("change", () => {
    engine.setDrumPattern(elements.drumPatternSelect.value as DrumPatternId);
  });

  window.addEventListener("keydown", handleKeydown);

  renderPads();
  renderProgressionAndStatus();
  updateTransportButtons();
  updateSpeedDisplay();

  return () => {
    window.removeEventListener("keydown", handleKeydown);
    cancelSequence?.();
    if (pendingStopReset !== null) {
      window.clearTimeout(pendingStopReset);
    }
  };
}
