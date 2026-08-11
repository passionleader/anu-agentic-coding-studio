// Owns the controls chrome around the simulation: the tool selector, the
// tuning sliders, the action buttons, the status bar readout, and the
// drawer/sidebar's own open/closed visibility. Reads and writes
// simulation.js state in response to input; never touches the canvas or
// calls a `ctx.*` method — app.js owns rendering, and hands this module
// coordinates already converted to meters.

import {
  addSource,
  AMBIENT_TEMPERATURE_MAX,
  AMBIENT_TEMPERATURE_MIN,
  applyPreset,
  CELL_SIZE_M,
  clearSources,
  config,
  eraseAt,
  flowRegime,
  grid,
  PRESETS,
  rayleighNumber,
  reset,
  sourceAt,
  sources,
} from "./simulation.js";

export const TOOLS = [
  { id: "heat", label: "Heat Source" },
  { id: "cold", label: "Cold Source" },
  { id: "wall", label: "Wall Obstacle" },
  { id: "erase", label: "Erase" },
];

export const state = {
  tool: "heat",
  temperatureDelta: 25, // source temperature offset from ambient, °C — sign comes from the heat/cold tool
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

function slider({ id, label, min, max, step: stepSize = 1, value, unit = "" }) {
  return `
    <label class="flex flex-col gap-1 text-sm" for="${id}">
      <span class="flex justify-between text-slate-300">
        <span>${label}</span>
        <span id="${id}-value" class="font-mono text-slate-400">${value}${unit}</span>
      </span>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${stepSize}" value="${value}" class="accent-orange-600" />
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

export function mountControls(panel) {
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
    slider({
      id: "source-temperature",
      label: "Source Power (Δ from ambient)",
      min: 5,
      max: 60,
      value: state.temperatureDelta,
      unit: "°C",
    }) +
    slider({
      id: "ambient-temperature",
      label: "Ambient Temperature",
      min: AMBIENT_TEMPERATURE_MIN,
      max: AMBIENT_TEMPERATURE_MAX,
      value: config.ambientTemperature,
      unit: "°C",
    }) +
    slider({
      id: "eddy-viscosity",
      label: "Eddy Viscosity ×",
      min: 50,
      max: 800,
      step: 10,
      value: config.eddyViscosityMultiplier,
    }) +
    slider({ id: "tracer-count", label: "Tracer Count", min: 0, max: 1000, step: 25, value: config.tracerCount });

  const presetsSection = document.createElement("div");
  presetsSection.className = "flex flex-col gap-2 border-t border-[#3a2a20] pt-4";
  presetsSection.innerHTML =
    '<p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Presets</p>';
  const presetButtons = PRESETS.map(presetButton);
  presetButtons.forEach((button) => presetsSection.appendChild(button));

  const actionsSection = document.createElement("div");
  actionsSection.className = "flex flex-col gap-2 border-t border-[#3a2a20] pt-4";
  actionsSection.innerHTML = `
    <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Control</p>
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

  // Anything that isn't sim tooling: the explainer page and a support link
  // (also injected as a floating widget by the BMC script in index.html).
  // Kept in its own bottom-of-panel group, visually distinct from the
  // Control actions above it so it doesn't read as another sim action.
  const etcSection = document.createElement("div");
  etcSection.className = "mt-auto flex flex-col gap-2 border-t border-[#3a2a20] pt-4";
  etcSection.innerHTML = `
    <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Etc</p>
    <a href="./physics.html" class="flex min-h-11 items-center justify-center rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500">
      How this works
    </a>
    <a href="https://buymeacoffee.com/sskim" target="_blank" rel="noopener" id="buy-me-a-coffee-button" class="flex min-h-11 items-center justify-center gap-2 rounded bg-yellow-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-yellow-400">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" y1="2" x2="6" y2="4" />
        <line x1="10" y1="2" x2="10" y2="4" />
        <line x1="14" y1="2" x2="14" y2="4" />
      </svg>
      Buy Me a Coffee
    </a>
  `;

  panel.replaceChildren(toolGroup, slidersSection, presetsSection, actionsSection, etcSection);

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
      applyPreset(button.dataset.preset);
      syncSliderDisplay(panel, "eddy-viscosity", config.eddyViscosityMultiplier);
    });
  });

  bindSlider(panel, "source-temperature", (value) => {
    state.temperatureDelta = value;
    // Live-editing: if a source is currently selected, the slider adjusts
    // its actual temperature immediately rather than only affecting sources
    // placed from now on.
    if (state.selectedSource) {
      state.selectedSource.temperature = config.ambientTemperature + state.selectedSourceSign * value;
    }
  });
  bindSlider(panel, "ambient-temperature", (value) => {
    config.ambientTemperature = value;
  });
  bindSlider(panel, "eddy-viscosity", (value) => {
    config.eddyViscosityMultiplier = value;
  });
  bindSlider(panel, "tracer-count", (value) => {
    config.tracerCount = value;
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
// programmatically (by a preset) rather than by the user dragging it.
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

// Dispatches a canvas point-interaction (already converted to meters by
// app.js) to the currently selected tool. Wall drawing needs drag state, so
// app.js handles that gesture itself and calls `addWall` directly rather
// than going through here.
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
      state.selectedSourceSign = existing.temperature >= config.ambientTemperature ? 1 : -1;
      return true;
    }
    state.selectedSource = addSource(x, y, config.ambientTemperature + sign * state.temperatureDelta);
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
let tracerCountEl;
let rayleighEl;
let flowRegimeEl;

export function mountStatusBar(root) {
  fpsEl = root.querySelector("#fps-value");
  tracerCountEl = root.querySelector("#tracer-count-value");
  rayleighEl = root.querySelector("#rayleigh-value");
  flowRegimeEl = root.querySelector("#flow-regime-value");
}

// The Rayleigh number driving the readout uses the domain's own height as
// its length scale and the hottest/coldest source's deviation from ambient
// as its deltaT — with real, unscaled air properties (rayleighNumber's
// defaults), so this answers "would this actually convect if it were real
// air", independent of the coarse grid's own numerically-stabilized
// diffusion. Falls back to the source-temperature slider's value when no
// source has been placed yet, so the readout is never just "--".
function currentRayleighNumber() {
  const deltaT = sources.length
    ? Math.max(...sources.map((source) => Math.abs(source.temperature - config.ambientTemperature)))
    : state.temperatureDelta;
  const lengthM = grid.ny * CELL_SIZE_M;
  return rayleighNumber(deltaT, lengthM);
}

export function updateStatus({ fps, tracerCount }) {
  fpsEl.textContent = String(Math.round(fps));
  tracerCountEl.textContent = String(tracerCount);

  const ra = currentRayleighNumber();
  rayleighEl.textContent = ra.toExponential(1);
  flowRegimeEl.textContent = flowRegime(ra);
}
