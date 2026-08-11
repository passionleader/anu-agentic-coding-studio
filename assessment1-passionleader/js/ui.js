// Owns the controls chrome around the simulation: the tool selector, the
// tuning sliders, the action buttons, the status bar readout, and the
// drawer/sidebar's own open/closed visibility. Reads and writes
// simulation.js state in response to input; never touches the canvas or
// calls a `ctx.*` method — app.js owns rendering.

import { addSource, applyPreset, clearSources, config, eraseAt, PRESETS, reset, sourceAt, sources } from "./simulation.js";

export const TOOLS = [
  { id: "heat", label: "Heat Source" },
  { id: "cold", label: "Cold Source" },
  { id: "wall", label: "Wall Obstacle" },
  { id: "erase", label: "Erase" },
];

export const state = {
  tool: "heat",
  temperature: 20, // source temperature intensity magnitude, 0..30 — sign comes from the heat/cold tool
  playing: true,
  controlsOpen: true,
  selectedSource: null, // the source the temperature slider edits live, if any
  selectedSourceSign: 1, // +1 for a heat-tool source, -1 for cold — restores sign when the slider writes back
};

// Classes toggled on #controls between its two states. Everything else on
// the element is static (see index.html): the mobile drawer transform and
// the desktop width/opacity collapse are the only parts that change.
const OPEN_CLASSES = [
  "translate-y-0",
  "md:w-72",
  "md:border",
  "md:border-[#3a2a20]",
  "md:opacity-100",
  "md:p-4",
];
const CLOSED_CLASSES = [
  "translate-y-full",
  "md:w-0",
  "md:overflow-hidden",
  "md:border-0",
  "md:p-0",
  "md:opacity-0",
];

let panelEl;
let toggleEl;
let backdropEl;

function applyControlsOpen(open) {
  state.controlsOpen = open;
  panelEl.classList.remove(...(open ? CLOSED_CLASSES : OPEN_CLASSES));
  panelEl.classList.add(...(open ? OPEN_CLASSES : CLOSED_CLASSES));
  backdropEl.classList.toggle("hidden", !open);
  toggleEl.setAttribute("aria-expanded", String(open));
}

// Wires the toggle button and backdrop (declared in index.html, outside
// #controls, for layout/z-index reasons) so the panel's own visibility is
// still fully owned here. Call once at startup, before `mountControls`.
export function mountControlsVisibility(panel, toggle, backdrop) {
  panelEl = panel;
  toggleEl = toggle;
  backdropEl = backdrop;

  // Sidebar open by default on desktop, drawer closed by default on mobile
  // — a startup default, not a live media-query binding, so resizing the
  // window mid-session never yanks an open drawer shut on the user.
  const startsOpen = window.matchMedia("(min-width: 768px)").matches;
  applyControlsOpen(startsOpen);

  toggle.addEventListener("click", () => applyControlsOpen(!state.controlsOpen));
  backdrop.addEventListener("click", () => applyControlsOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.controlsOpen) applyControlsOpen(false);
  });
}

function toolButton(tool) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.tool = tool.id;
  button.setAttribute("aria-pressed", String(tool.id === state.tool));
  button.className = toolButtonClass(tool.id, tool.id === state.tool);
  button.textContent = tool.label;
  return button;
}

// min-h-11 (44px) meets the minimum touch-target size on mobile; flex+items-center
// keeps short labels vertically centered rather than top-aligned once the box
// is taller than its text. Heat and cold get their own active color (red /
// blue) so the tool in use reads at a glance; wall and erase stay neutral.
function toolButtonClass(toolId, active) {
  const base = "flex min-h-11 items-center rounded px-3 py-2 text-left text-sm font-medium transition-colors";
  if (!active) return `${base} bg-[#241a15] text-slate-200 hover:bg-[#2f2119]`;
  if (toolId === "heat") return `${base} bg-red-600 text-white`;
  if (toolId === "cold") return `${base} bg-sky-600 text-white`;
  return `${base} bg-slate-600 text-white`;
}

function actionButtonClass() {
  return "flex min-h-11 items-center justify-center rounded bg-[#241a15] px-3 py-1.5 text-sm font-medium hover:bg-[#2f2119]";
}

function slider({ id, label, min, max, value, unit = "" }) {
  return `
    <label class="flex flex-col gap-1 text-sm" for="${id}">
      <span class="flex justify-between text-slate-300">
        <span>${label}</span>
        <span id="${id}-value" class="font-mono text-slate-400">${value}${unit}</span>
      </span>
      <input type="range" id="${id}" min="${min}" max="${max}" value="${value}" class="accent-sky-600" />
    </label>
  `;
}

function presetButton(preset) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.preset = preset.id;
  button.className = actionButtonClass();
  button.textContent = preset.label;
  return button;
}

// `getBounds` is called lazily (only when a preset button is clicked), not
// stored eagerly — the canvas's real size isn't known until app.js has laid
// it out, and presets are placed proportional to that size (see
// applyPreset in simulation.js).
export function mountControls(panel, getBounds) {
  const toolGroup = document.createElement("fieldset");
  toolGroup.className = "flex flex-col gap-2";
  toolGroup.innerHTML =
    '<legend class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Tool</legend>';
  const toolButtons = TOOLS.map(toolButton);
  toolButtons.forEach((button) => toolGroup.appendChild(button));

  const slidersSection = document.createElement("div");
  slidersSection.className = "flex flex-col gap-3 border-t border-[#3a2a20] pt-4";
  slidersSection.innerHTML =
    '<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Tuning</p>' +
    slider({ id: "temperature", label: "Source Temperature Intensity", min: 0, max: 30, value: state.temperature }) +
    slider({ id: "room-temperature", label: "Room Temperature", min: -60, max: 60, value: config.roomTemperature }) +
    slider({ id: "particle-count", label: "Particle Count", min: 0, max: 1000, value: config.particleCount }) +
    slider({ id: "viscosity", label: "Air Resistance / Viscosity", min: 0, max: 100, value: config.viscosity });

  const presetsSection = document.createElement("div");
  presetsSection.className = "flex flex-col gap-2 border-t border-[#3a2a20] pt-4";
  presetsSection.innerHTML =
    '<p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Presets</p>';
  const presetButtons = PRESETS.map(presetButton);
  presetButtons.forEach((button) => presetsSection.appendChild(button));

  const actionsSection = document.createElement("div");
  actionsSection.className = "mt-auto flex flex-col gap-2 border-t border-[#3a2a20] pt-4";
  actionsSection.innerHTML = `
    <button type="button" id="play-pause-button" aria-pressed="${state.playing}" class="${actionButtonClass()}">
      Pause
    </button>
    <button type="button" id="reset-button" class="${actionButtonClass()}">
      Reset Canvas
    </button>
    <button type="button" id="clear-sources-button" class="${actionButtonClass()}">
      Clear All Sources
    </button>
  `;

  panel.replaceChildren(toolGroup, slidersSection, presetsSection, actionsSection);

  toolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.tool = button.dataset.tool;
      // Selection is scoped to "currently pointing at a source with the
      // heat/cold tool" — switching tools always starts that fresh.
      state.selectedSource = null;
      toolButtons.forEach((other) => {
        const active = other === button;
        other.setAttribute("aria-pressed", String(active));
        other.className = toolButtonClass(other.dataset.tool, active);
      });
    });
  });

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSource = null;
      applyPreset(button.dataset.preset, getBounds());
      syncSliderDisplay(panel, "particle-count", config.particleCount);
      syncSliderDisplay(panel, "viscosity", config.viscosity);
      syncSliderDisplay(panel, "room-temperature", config.roomTemperature);
    });
  });

  bindSlider(panel, "temperature", (value) => {
    state.temperature = value;
    // Live-editing: if a source is currently selected, the slider adjusts
    // its actual temperature immediately rather than only affecting sources
    // placed from now on.
    if (state.selectedSource) {
      state.selectedSource.temperature = state.selectedSourceSign * value;
    }
  });
  bindSlider(panel, "room-temperature", (value) => {
    config.roomTemperature = value;
  });
  bindSlider(panel, "particle-count", (value) => {
    config.particleCount = value;
  });
  bindSlider(panel, "viscosity", (value) => {
    config.viscosity = value;
  });

  const playPauseButton = panel.querySelector("#play-pause-button");
  playPauseButton.addEventListener("click", () => {
    state.playing = !state.playing;
    playPauseButton.textContent = state.playing ? "Pause" : "Play";
    playPauseButton.setAttribute("aria-pressed", String(state.playing));
  });

  panel.querySelector("#reset-button").addEventListener("click", () => {
    reset();
    state.selectedSource = null;
  });

  panel.querySelector("#clear-sources-button").addEventListener("click", () => {
    clearSources();
    state.selectedSource = null;
  });
}

// Updates a slider's thumb position and readout text to match a value set
// programmatically (by a preset, or by app.js's resize-driven particle-count
// rescaling) rather than by the user dragging it.
export function syncSliderDisplay(panel, id, value) {
  const input = panel.querySelector(`#${id}`);
  const readout = panel.querySelector(`#${id}-value`);
  input.value = String(value);
  readout.textContent = readout.textContent.replace(/-?\d+/, String(value));
}

function bindSlider(panel, id, onChange) {
  const input = panel.querySelector(`#${id}`);
  const readout = panel.querySelector(`#${id}-value`);
  input.addEventListener("input", () => {
    const value = Number(input.value);
    readout.textContent = readout.textContent.replace(/-?\d+/, String(value));
    onChange(value);
  });
}

// Dispatches a canvas point-interaction to the currently selected tool.
// Wall drawing needs drag state, so app.js handles that gesture itself and
// calls `addWall` directly rather than going through here.
//
// Returns true when the point landed on an *existing* source (it was
// selected for live editing rather than a new one being created) — app.js
// uses this to stop a drag from also painting a trail of new sources once
// the gesture started by grabbing one to edit.
export function handleCanvasPointer(x, y) {
  if (state.tool === "heat" || state.tool === "cold") {
    const sign = state.tool === "heat" ? 1 : -1;
    const existing = sourceAt(x, y);
    if (existing) {
      state.selectedSource = existing;
      state.selectedSourceSign = existing.temperature >= 0 ? 1 : -1;
      return true;
    }
    state.selectedSource = addSource(x, y, sign * state.temperature);
    state.selectedSourceSign = sign;
    return false;
  }

  if (state.tool === "erase") {
    eraseAt(x, y);
    if (state.selectedSource && !sources.includes(state.selectedSource)) {
      state.selectedSource = null;
    }
  }

  return false;
}

let fpsEl;
let particleCountEl;

export function mountStatusBar(root) {
  fpsEl = root.querySelector("#fps-value");
  particleCountEl = root.querySelector("#particle-count-value");
}

export function updateStatus({ fps, particleCount }) {
  fpsEl.textContent = String(Math.round(fps));
  particleCountEl.textContent = String(particleCount);
}
