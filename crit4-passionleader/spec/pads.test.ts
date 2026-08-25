// @vitest-environment jsdom
//
// Drives ui.ts against a stub AudioEngine (jsdom has no Web Audio API) to
// test the actual contract: pressing a pad plays a chord, extends the
// progression, and reshuffles the suggestions — by mouse click or keyboard.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioEngine } from "../audio-engine.ts";
import { resetSessionState } from "../state.ts";
import { mountInstrument } from "../ui.ts";

let unmount: (() => void) | null = null;

function mount() {
  document.body.innerHTML = `
    <div class="app">
      <button id="clear-button" type="button">Clear</button>
      <button id="undo-button" type="button">Undo</button>
      <button id="delete-button" type="button">Delete</button>
      <button id="play-button" type="button">Play</button>
      <button id="stop-button" type="button">Stop</button>
      <input id="speed-slider" type="range" min="0.5" max="2" step="0.1" value="1" />
      <output id="speed-value" for="speed-slider"></output>
      <select id="instrument-select"></select>
      <select id="bass-pattern-select"></select>
      <select id="drum-pattern-select"></select>
      <div id="pad-grid"></div>
      <ol id="progression-list"></ol>
      <p id="status-line"></p>
      <p id="sr-announcer"></p>
    </div>
  `;
  const root = document.querySelector<HTMLElement>(".app");
  if (!root) {
    throw new Error("test root missing");
  }
  const engine = {
    playChord: vi.fn(),
    playSequence: vi.fn(() => vi.fn()),
    stopAll: vi.fn(),
    reset: vi.fn(),
    setInstrument: vi.fn(),
    setBassPattern: vi.fn(),
    setDrumPattern: vi.fn(),
  } as unknown as AudioEngine;
  unmount = mountInstrument(root, engine);
  return { engine, root };
}

describe("Chord Session pads", () => {
  beforeEach(() => {
    resetSessionState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    unmount?.();
    unmount = null;
    vi.useRealTimers();
  });

  it("shows exactly six chord pads as real, labelled buttons", () => {
    const { root } = mount();
    const pads = root.querySelectorAll<HTMLButtonElement>("#pad-grid button");
    expect(pads).toHaveLength(6);
    for (const pad of pads) {
      expect(pad.type).toBe("button");
      expect(pad.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("labels each pad with a confidence tier so no choice can feel wrong", () => {
    const { root } = mount();
    const pads = [...root.querySelectorAll<HTMLButtonElement>("#pad-grid button")];
    const tally = { safe: 0, colour: 0, surprise: 0 };
    for (const pad of pads) {
      const label = pad.getAttribute("aria-label") ?? "";
      const tier = (["safe", "colour", "surprise"] as const).find((t) => label.includes(`${t} next chord`));
      expect(tier).toBeTruthy();
      if (tier) tally[tier] += 1;
    }
    expect(tally).toEqual({ safe: 2, colour: 2, surprise: 2 });
  });

  it("plays a live chord and adds it to the progression on click", () => {
    const { root, engine } = mount();
    root.querySelector<HTMLButtonElement>("#pad-grid button")?.click();

    expect(engine.playChord).toHaveBeenCalledTimes(1);
    expect(root.querySelector("#progression-list .chip--latest")?.textContent).toBeTruthy();
    expect(root.querySelector("#status-line")?.textContent).toContain("1 chord played");
  });

  it("responds to the same pad through the keyboard", () => {
    const { root, engine } = mount();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));

    expect(engine.playChord).toHaveBeenCalledTimes(1);
    expect(root.querySelector("#status-line")?.textContent).toContain("1 chord played");
  });

  it("ignores keys outside the six visible pads", () => {
    const { engine } = mount();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "7" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "0" }));

    expect(engine.playChord).not.toHaveBeenCalled();
  });

  it("reshuffles the pad suggestions shortly after a chord plays", () => {
    const { root } = mount();
    const before = [...root.querySelectorAll<HTMLButtonElement>("#pad-grid button")].map((button) =>
      button.getAttribute("aria-label"),
    );

    root.querySelector<HTMLButtonElement>("#pad-grid button")?.click();
    vi.advanceTimersByTime(200);

    const after = [...root.querySelectorAll<HTMLButtonElement>("#pad-grid button")].map((button) =>
      button.getAttribute("aria-label"),
    );
    expect(after).toHaveLength(6);
    expect(after).not.toEqual(before);
  });

  it("clears the progression back to the starter prompt", () => {
    const { root, engine } = mount();
    root.querySelector<HTMLButtonElement>("#pad-grid button")?.click();
    vi.advanceTimersByTime(200);

    root.querySelector<HTMLButtonElement>("#clear-button")?.click();

    expect(root.querySelector("#progression-list .chip--hint")).toBeTruthy();
    expect(root.querySelector("#status-line")?.textContent).toContain("0 chords played");
    expect(engine.reset).toHaveBeenCalledTimes(1);
  });

  it("undoes the last chord addition", () => {
    const { root } = mount();
    const undoButton = root.querySelector<HTMLButtonElement>("#undo-button");
    expect(undoButton?.disabled).toBe(true);

    root.querySelector<HTMLButtonElement>("#pad-grid button")?.click();
    vi.advanceTimersByTime(200);
    expect(undoButton?.disabled).toBe(false);
    expect(root.querySelector("#status-line")?.textContent).toContain("1 chord played");

    undoButton?.click();
    expect(root.querySelector("#status-line")?.textContent).toContain("0 chords played");
    expect(undoButton?.disabled).toBe(true);
  });

  it("selects a progression chip and deletes just that one chord", () => {
    const { root } = mount();
    const deleteButton = root.querySelector<HTMLButtonElement>("#delete-button");
    expect(deleteButton?.disabled).toBe(true);

    root.querySelector<HTMLButtonElement>("#pad-grid button")?.click();
    vi.advanceTimersByTime(200);
    root.querySelector<HTMLButtonElement>("#pad-grid button")?.click();
    vi.advanceTimersByTime(200);
    expect(root.querySelector("#status-line")?.textContent).toContain("2 chords played");

    root.querySelector<HTMLButtonElement>("#progression-list .chip")?.click();
    expect(deleteButton?.disabled).toBe(false);
    // The click re-renders the whole chip list, so re-query rather than
    // reuse the pre-click node reference, which is now detached.
    const selectedChip = root.querySelector<HTMLButtonElement>("#progression-list .chip");
    expect(selectedChip?.getAttribute("aria-pressed")).toBe("true");

    deleteButton?.click();
    expect(root.querySelector("#status-line")?.textContent).toContain("1 chord played");
    expect(deleteButton?.disabled).toBe(true);
  });

  it("replays the progression from the start", () => {
    const { root, engine } = mount();
    const playButton = root.querySelector<HTMLButtonElement>("#play-button");
    expect(playButton?.disabled).toBe(true);

    root.querySelector<HTMLButtonElement>("#pad-grid button")?.click();
    vi.advanceTimersByTime(200);
    expect(playButton?.disabled).toBe(false);

    playButton?.click();
    expect(engine.playSequence).toHaveBeenCalledTimes(1);
  });

  it("stops all playback immediately, before or after Play has been pressed", () => {
    const { root, engine } = mount();
    const stopButton = root.querySelector<HTMLButtonElement>("#stop-button");

    stopButton?.click();
    expect(engine.stopAll).toHaveBeenCalledTimes(1);

    root.querySelector<HTMLButtonElement>("#pad-grid button")?.click();
    vi.advanceTimersByTime(200);
    root.querySelector<HTMLButtonElement>("#play-button")?.click();

    stopButton?.click();
    expect(engine.stopAll).toHaveBeenCalledTimes(2);
  });

  it("tells the audio engine when the instrument changes", () => {
    const { root, engine } = mount();
    const select = root.querySelector<HTMLSelectElement>("#instrument-select");
    expect(select?.options.length).toBeGreaterThanOrEqual(5);

    select!.value = "violin";
    select?.dispatchEvent(new Event("change"));
    expect(engine.setInstrument).toHaveBeenCalledWith("violin");
  });

  it("tells the audio engine when a bass or drum pattern is chosen", () => {
    const { root, engine } = mount();
    const bassSelect = root.querySelector<HTMLSelectElement>("#bass-pattern-select");
    const drumSelect = root.querySelector<HTMLSelectElement>("#drum-pattern-select");

    bassSelect!.value = "ta-ta-ta-ta";
    bassSelect?.dispatchEvent(new Event("change"));
    expect(engine.setBassPattern).toHaveBeenCalledWith("ta-ta-ta-ta");

    drumSelect!.value = "backbeat";
    drumSelect?.dispatchEvent(new Event("change"));
    expect(engine.setDrumPattern).toHaveBeenCalledWith("backbeat");
  });
});
