# Weather & Atmosphere Simulator (COMP4020 Assignment 1)

This repository's final deliverable is the **Weather & Atmosphere Simulator**,
not the earlier thermal-convection prototype. The primary page is
`weather.html`; `weather-physics.html` explains the equations and implementation
choices. The experience lets a user explore a coupled atmosphere by placing
warm/cool zones and high/low-pressure systems, changing latitude and physical
parameters, and toggling temperature, pressure, cloud, and wind layers.

The project is an interactive explainer, not a production weather forecast. It
should be physically motivated, numerically stable, visually legible, and
honest about which features are simulated and which are visualisations. When a
request is ambiguous, preserve those priorities and make the smallest change
that satisfies the request.

## Stack and entry points

- Use vanilla JavaScript ES modules, HTML5 Canvas 2D, and Tailwind CSS via CDN.
- Do not add a framework, runtime npm dependency, bundler-only import, or
  TypeScript to the shipped application. Vite is only the course's static
  build/dev pipeline.
- `weather.html` owns document structure, the canvas, the responsive controls
  container, the status bar, and external widget/script markup.
- `js/weather-app.js` is the browser entry point. It owns canvas resizing,
  pointer-to-meter conversion, the animation loop, and all drawing: terrain,
  graticule, temperature heatmap, clouds, isobars, pressure extrema, sources,
  and wind trails.
- `js/weather-ui.js` owns the controls panel, tool/layer state, sliders,
  presets, actions, status-bar readouts, and mobile drawer behaviour. It may
  call the simulation module but must not implement numerical physics or draw
  directly to a Canvas context.
- `js/weather-simulation.js` owns physical state and domain vocabulary:
  temperature and pressure fields, velocity, thermal/pressure sources,
  latitude, ambient temperature, Coriolis parameter, terrain coupling,
  presets, and simulation stepping. It must not import the DOM or Canvas APIs.
- `js/atmosphere-grid.js` contains reusable numerical kernels: indexing,
  allocation, boundary handling, diffusion, relaxation, advection, bilinear
  sampling, resampling, local extrema, and contour tracing. It must remain
  independent of UI and rendering.

The dependency direction is:

```text
weather-app.js -> weather-ui.js -> weather-simulation.js -> atmosphere-grid.js
weather-app.js -----------------> weather-simulation.js
```

Do not introduce a reverse import. Keep rendering decisions in
`weather-app.js` and physical decisions in `weather-simulation.js`.

## Physical and visual contracts

- Simulation coordinates are metres. CSS pixels, device-pixel ratio, and
  `getBoundingClientRect()` belong only in `weather-app.js`.
- The simulation domain is a fixed 2,000 km vertical atmosphere represented by
  `GRID_ROWS` rows and an aspect-ratio-dependent column count. Use
  `gridResolutionFor()` and preserve its min/max resolution bounds.
- Temperature is expressed in °C, pressure in hPa, velocity in m/s, latitude
  in degrees, and time in seconds internally. Do not silently mix display
  units into numerical state.
- Ambient temperature follows the latitude model. The Coriolis parameter must
  use the textbook `f = 2 * Omega * sin(latitude)` with the real Earth rotation
  rate, change sign between hemispheres, and vanish at the equator.
- Pressure differences drive wind; wind advects temperature and pressure.
  Terrain affects land/sea friction and temperature relaxation. Keep the
  update order documented in `weather-physics.html` whenever it changes.
- Clouds are a visual interpretation of the pressure field, not an independent
  cloud-physics solver. Wind particles are cosmetic tracers: they sample the
  solved velocity field and carry no independent physics.
- Isobars must be traced from the live pressure field, and H/L markers must be
  derived from local pressure extrema. Do not hard-code decorative weather
  symbols that contradict the simulation.
- User sources are placed in metres and must remain discoverable, erasable, and
  clearable. Keep source markers small enough not to hide the field.
- The controls must work at both marked viewports, 1920x1080 and 390x844.
  Preserve touch targets of at least 44px and prevent drawing gestures from
  scrolling the page.
- Keep external widgets and links intentional. The physics link must resolve,
  and the Buy Me a Coffee widget must not be duplicated by another button.

## Harness and validation

The harness is part of the deliverable. Keep this file honest when the weather
model or module boundaries change. Do not revive the old convection-specific
vocabulary merely because it exists in earlier commits.

Before accepting a change:

1. Read the failing check or user-reported behaviour before editing.
2. Run the relevant headless tests in `spec/weather-simulation.test.ts` for
  sources, relaxation, pressure extrema, stability, Coriolis direction,
  colours, and grid resolution.
3. Run `pnpm check`, which performs typecheck, build, lint, and all Vitest tests.
4. Run `pnpm check:evidence` before shipping. It verifies `PROCESS.md` commit
  citations, this file, and `reflections/assignment-1.md`.
5. Inspect the rendered page in a browser at desktop and mobile sizes. The
  rendered result is the ground truth; do not accept a change because the
  source code merely looks reasonable.

Commit at the boundary of a working change. Use focused messages such as
`weather:`, `grid:`, `ui:`, `app:`, or `docs:`. If an experiment changes the
concept or numerical model, use a branch or make a clearly reversible commit.
Never hide a rollback or a change in scope. Cite meaningful commits from
`PROCESS.md` as the work progresses.
