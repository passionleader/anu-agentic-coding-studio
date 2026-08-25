// Owns the controls chrome around the weather simulation: the tool selector,
// the tuning sliders, the layer toggles, the presets, the status bar readout,
// and the drawer/sidebar's own open/closed visibility. Reads and writes
// weather-simulation.js state in response to input; never touches the canvas
// or calls a `ctx.*` method -- weather-app.js owns rendering, and hands this
// module coordinates already converted to meters. Deliberately a fresh
// sibling of ui.js rather than an import from it (ui.js is off-limits) --
// same conventions, own copy.

import {
  addPressureSource,
  addThermalSource,
  applyPreset,
  clearSources,
  config,
  coriolisParameter,
  DEFAULT_PRESSURE_DELTA_HPA,
  DEFAULT_THERMAL_DELTA_C,
  eraseAt,
  PRESETS,
  pressureRange,
  reset,
  sourceAt,
} from "./weather-simulation.js";

export const TOOLS = [
  { id: "warm-zone", label: "Warm Zone" },
  { id: "cool-zone", label: "Cool Zone" },
  { id: "high-pressure", label: "High Pressure" },
  { id: "low-pressure", label: "Low Pressure" },
  { id: "erase", label: "Erase" },
];

// No "selected source" field here unlike ui.js's state -- this sim has no
// source-strength slider to live-edit a grabbed source with (see the plan's
// Controls spec: five global physics sliders, none of them per-source), so
// "grabbed" only ever means "don't place a duplicate here," never "now
// editing." All four layers default on so the map reads fully-dressed the
// first time it renders.
export const state = {
  tool: "warm-zone",
  playing: true,
  controlsOpen: true,
  layerClouds: true,
  layerWind: true,
  layerTemperature: true,
  layerIsobars: true,
};

// Order here is the order the buttons render in, independent of draw order
// (weather-app.js's render() draws clouds/wind in a different position,
// grouped by how translucent/crisp each layer reads rather than by this
// list). The "layerIsobars" key stays as-is even though its button now reads
// "Pressure" -- it still gates both the isobar lines and the H/L markers
// together, unchanged, so renaming the key too would be a rename with no
// behavioral point.
const LAYERS = [
  { key: "layerClouds", label: "Clouds" },
  { key: "layerWind", label: "Wind" },
  { key: "layerTemperature", label: "Temperature" },
  { key: "layerIsobars", label: "Pressure" },
];

// Classes toggled on #controls between its two states -- identical structure
// to ui.js's OPEN_CLASSES/CLOSED_CLASSES, just its own copy.
const OPEN_CLASSES = ["translate-y-0", "md:w-72", "md:border", "md:border-[#1e3a4a]", "md:opacity-100", "md:p-4"];
const CLOSED_CLASSES = ["translate-y-full", "md:w-0", "md:overflow-hidden", "md:border-0", "md:p-0", "md:opacity-0"];

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

// Wires the toggle button and backdrop (declared in weather.html, outside
// #controls) so the panel's own visibility is still fully owned here. Call
// once at startup, before `mountControls`.
export function mountControlsVisibility(panel, toggle, backdrop) {
  panelEl = panel;
  toggleEl = toggle;
  backdropEl = backdrop;

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

// Warm/cool keep the original's real thermal convention (red/sky). High/low
// pressure get their own violet/emerald pair rather than reusing blue/red --
// synoptic charts do draw H blue and L red, but that's a convention for map
// LABELS, and reusing it here for TOOL buttons would make two unrelated red
// buttons both mean "warm" and "low," which is worse than picking new colors.
function toolButtonClass(toolId, active) {
  const base = "flex min-h-11 items-center rounded px-3 py-2 text-left text-sm font-medium transition-colors";
  if (!active) return `${base} bg-[#152530] text-slate-200 hover:bg-[#1c3140]`;
  if (toolId === "warm-zone") return `${base} bg-red-600 text-white`;
  if (toolId === "cool-zone") return `${base} bg-sky-600 text-white`;
  if (toolId === "high-pressure") return `${base} bg-violet-600 text-white`;
  if (toolId === "low-pressure") return `${base} bg-emerald-600 text-white`;
  return `${base} bg-slate-600 text-white`; // erase
}

function layerButton(layer) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.layer = layer.key;
  button.setAttribute("aria-pressed", String(state[layer.key]));
  button.className = layerButtonClass(state[layer.key]);
  button.textContent = layer.label;
  return button;
}

function layerButtonClass(active) {
  const base = "flex min-h-11 items-center rounded px-3 py-2 text-left text-sm font-medium transition-colors";
  return active ? `${base} bg-cyan-600 text-white` : `${base} bg-[#152530] text-slate-200 hover:bg-[#1c3140]`;
}

function actionButtonClass() {
  return "flex min-h-11 items-center justify-center rounded bg-[#152530] px-3 py-1.5 text-sm font-medium hover:bg-[#1c3140]";
}

function slider({ id, label, min, max, step: stepSize = 1, value, unit = "" }) {
  return `
    <label class="flex flex-col gap-1 text-sm" for="${id}">
      <span class="flex justify-between text-slate-300">
        <span>${label}</span>
        <span id="${id}-value" class="font-mono text-slate-400">${value}${unit}</span>
      </span>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${stepSize}" value="${value}" class="accent-cyan-500" />
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

// Re-syncs every slider's readout after a preset click -- unlike ui.js
// (whose applyPreset only ever touches one slider-bound field),
// weather-simulation.js's applyPreset can touch latitude alone or all five,
// depending which preset ran, so syncing all five is the only reliably
// correct choice here rather than special-casing per preset id.
function syncAllSliderDisplays(panel) {
  syncSliderDisplay(panel, "latitude-deg", config.latitudeDeg);
  syncSliderDisplay(panel, "friction-multiplier", config.frictionMultiplier);
  syncSliderDisplay(panel, "thermal-pressure-coupling", config.thermalPressureCoupling);
  syncSliderDisplay(panel, "mixing", config.mixing);
  syncSliderDisplay(panel, "time-acceleration", config.timeAccelerationHoursPerSecond);
}

export function mountControls(panel) {
  const toolGroup = document.createElement("fieldset");
  toolGroup.className = "flex flex-col gap-2";
  toolGroup.innerHTML =
    '<legend class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Tool</legend>';
  const toolButtons = TOOLS.map(toolButton);
  toolButtons.forEach((button) => toolGroup.appendChild(button));

  const slidersSection = document.createElement("div");
  slidersSection.className = "flex flex-col gap-3 border-t border-[#1e3a4a] pt-4";
  slidersSection.innerHTML =
    '<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Tuning</p>' +
    slider({ id: "latitude-deg", label: "Latitude", min: -80, max: 80, step: 5, value: config.latitudeDeg, unit: "°" }) +
    slider({
      id: "friction-multiplier",
      label: "Friction",
      min: 0.2,
      max: 5,
      step: 0.1,
      value: config.frictionMultiplier,
      unit: "×",
    }) +
    slider({
      id: "thermal-pressure-coupling",
      label: "Thermal-Pressure Coupling",
      min: 0,
      max: 1,
      step: 0.05,
      value: config.thermalPressureCoupling,
      unit: "hPa/°C",
    }) +
    slider({ id: "mixing", label: "Mixing", min: 0.5, max: 10, step: 0.5, value: config.mixing, unit: "×" }) +
    slider({
      id: "time-acceleration",
      label: "Simulation Speed",
      min: 0.25,
      max: 12,
      step: 0.25,
      value: config.timeAccelerationHoursPerSecond,
      unit: "hr/s",
    });

  const layersSection = document.createElement("div");
  layersSection.className = "flex flex-col gap-2 border-t border-[#1e3a4a] pt-4";
  layersSection.innerHTML = '<p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Layers</p>';
  const layerButtons = LAYERS.map(layerButton);
  layerButtons.forEach((button) => layersSection.appendChild(button));

  const presetsSection = document.createElement("div");
  presetsSection.className = "flex flex-col gap-2 border-t border-[#1e3a4a] pt-4";
  presetsSection.innerHTML =
    '<p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Presets</p>';
  const presetButtons = PRESETS.map(presetButton);
  presetButtons.forEach((button) => presetsSection.appendChild(button));

  const actionsSection = document.createElement("div");
  actionsSection.className = "flex flex-col gap-2 border-t border-[#1e3a4a] pt-4";
  actionsSection.innerHTML = `
    <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Control</p>
    <button type="button" id="play-pause-button" aria-pressed="${state.playing}" class="${actionButtonClass()}">
      Pause
    </button>
    <button type="button" id="reset-button" class="${actionButtonClass()}">
      Reset Map
    </button>
    <button type="button" id="clear-sources-button" class="${actionButtonClass()}">
      Clear All Sources
    </button>
  `;

  // Anything that isn't sim tooling: the explainer page and a support link
  // (also injected as a floating widget by the BMC script in weather.html).
  // Same "Etc" group ui.js keeps at the bottom of its own panel, own copy.
  const etcSection = document.createElement("div");
  etcSection.className = "mt-auto flex flex-col gap-2 border-t border-[#1e3a4a] pt-4";
  etcSection.innerHTML = `
    <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Etc</p>
    <a href="./weather-physics.html" class="flex min-h-11 items-center justify-center rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500">
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

  panel.replaceChildren(toolGroup, slidersSection, layersSection, presetsSection, actionsSection, etcSection);

  toolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.tool = button.dataset.tool;
      toolButtons.forEach((other) => {
        const active = other === button;
        other.setAttribute("aria-pressed", String(active));
        other.className = toolButtonClass(other.dataset.tool, active);
      });
    });
  });

  layerButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.layer;
      state[key] = !state[key];
      button.setAttribute("aria-pressed", String(state[key]));
      button.className = layerButtonClass(state[key]);
    });
  });

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyPreset(button.dataset.preset);
      syncAllSliderDisplays(panel);
    });
  });

  bindSlider(panel, "latitude-deg", (value) => {
    config.latitudeDeg = value;
  });
  bindSlider(panel, "friction-multiplier", (value) => {
    config.frictionMultiplier = value;
  });
  bindSlider(panel, "thermal-pressure-coupling", (value) => {
    config.thermalPressureCoupling = value;
  });
  bindSlider(panel, "mixing", (value) => {
    config.mixing = value;
  });
  bindSlider(panel, "time-acceleration", (value) => {
    config.timeAccelerationHoursPerSecond = value;
  });

  const playPauseButton = panel.querySelector("#play-pause-button");
  playPauseButton.addEventListener("click", () => {
    state.playing = !state.playing;
    playPauseButton.textContent = state.playing ? "Pause" : "Play";
    playPauseButton.setAttribute("aria-pressed", String(state.playing));
  });

  panel.querySelector("#reset-button").addEventListener("click", () => {
    reset();
  });

  panel.querySelector("#clear-sources-button").addEventListener("click", () => {
    clearSources();
  });
}

// Updates a slider's thumb position and readout text to match a value set
// programmatically (by a preset) rather than by the user dragging it.
//
// The match/replace pattern needs a decimal-aware regex -- unlike ui.js's
// sliders, which are all integer-stepped, four of these five carry fractional
// steps (0.1/0.05/0.5/0.25), so a bare `/-?\d+/` would match only the digits
// before the decimal point (e.g. turning "0.45hPa/°C" into "0.450.45hPa/°C"
// instead of replacing the whole number).
const READOUT_NUMBER = /-?\d+(\.\d+)?/;

export function syncSliderDisplay(panel, id, value) {
  const input = panel.querySelector(`#${id}`);
  const readout = panel.querySelector(`#${id}-value`);
  input.value = String(value);
  readout.textContent = readout.textContent.replace(READOUT_NUMBER, String(value));
}

function bindSlider(panel, id, onChange) {
  const input = panel.querySelector(`#${id}`);
  const readout = panel.querySelector(`#${id}-value`);
  input.addEventListener("input", () => {
    const value = Number(input.value);
    readout.textContent = readout.textContent.replace(READOUT_NUMBER, String(value));
    onChange(value);
  });
}

// Dispatches a canvas point-interaction (already converted to meters by
// weather-app.js) to the currently selected tool.
//
// Returns true when the point landed on an *existing* source of either kind
// -- weather-app.js uses this to stop a drag from painting a trail of new
// sources once the gesture started by landing on one that's already there.
// Unlike ui.js's version there's nothing to select for live-editing (no
// per-source slider exists), so "grabbed" is purely a placement guard.
export function handleCanvasPointer(x, y) {
  if (state.tool === "warm-zone" || state.tool === "cool-zone") {
    if (sourceAt(x, y)) return true;
    const sign = state.tool === "warm-zone" ? 1 : -1;
    addThermalSource(x, y, sign * DEFAULT_THERMAL_DELTA_C);
    return false;
  }

  if (state.tool === "high-pressure" || state.tool === "low-pressure") {
    if (sourceAt(x, y)) return true;
    const sign = state.tool === "high-pressure" ? 1 : -1;
    addPressureSource(x, y, sign * DEFAULT_PRESSURE_DELTA_HPA);
    return false;
  }

  if (state.tool === "erase") {
    eraseAt(x, y);
    return false;
  }

  return false;
}

let fpsEl;
let minPressureEl;
let maxPressureEl;
let coriolisEl;

export function mountStatusBar(root) {
  fpsEl = root.querySelector("#fps-value");
  minPressureEl = root.querySelector("#min-pressure-value");
  maxPressureEl = root.querySelector("#max-pressure-value");
  coriolisEl = root.querySelector("#coriolis-value");
}

// Coriolis parameter is reported in the same x10^-4 /s units the status bar's
// own label promises (weather.html) -- real f at mid-latitudes is order
// 1e-4/s, so this doubles as a built-in correctness check against the
// textbook value while the sim is running.
const CORIOLIS_DISPLAY_SCALE = 1e-4;

export function updateStatus({ fps }) {
  fpsEl.textContent = String(Math.round(fps));

  const { min, max } = pressureRange();
  minPressureEl.textContent = min.toFixed(1);
  maxPressureEl.textContent = max.toFixed(1);
  coriolisEl.textContent = (coriolisParameter() / CORIOLIS_DISPLAY_SCALE).toFixed(2);
}
