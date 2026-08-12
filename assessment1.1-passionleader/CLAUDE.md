# Thermal Convection & Airflow Simulator (COMP4020 Assignment 1)

An interactive explainer for thermal convection: place heat/cold sources, draw
wall obstacles, adjust temperatures and viscosity with sliders, and watch a
real incompressible fluid solver drive a thermal heatmap and tracer streaks in
real time. One idea, tightly scoped --- convection, not a general fluid
sandbox.

Under the hood this isn't a particle-force toy: `js/fluid-grid.js` is a real
grid-based semi-Lagrangian CFD solver ("Stable Fluids", Stam 1999) --- diffuse,
project (enforce incompressibility), advect --- driven by buoyancy under the
Boussinesq approximation. `physics.html` (linked from the header) explains the
math for a reader who wants it: the solver ordering, the buoyancy formula, why
the sim scales real air's viscosity/diffusivity by the same eddy-viscosity
multiplier rather than using their real (numerically-unresolvable-in-real-time)
values, and the Rayleigh number that predicts whether a given setup even
convects.

**Stack: pure vanilla JavaScript, HTML5 Canvas 2D, and Tailwind CSS via CDN.**
No framework, no runtime npm dependencies, no bundling the shipped app depends
on --- what ships is `index.html`, `physics.html`, and four plain ES module
files under `js/`. Vite is still present in this repo (see "The stack is
swappable" below), but only as the course's static-build/dev-server pipeline,
the same one every deliverable uses --- it is not a dependency of the app
itself, and nothing here requires it to run. Opening `index.html` directly in
a browser works.

The **deployed site is what gets marked** --- not this repo, and not "it works
on my machine". It's marked live in Chrome against the deployed URL at two
viewports --- 1920×1080 (desktop) and 390×844 (phone) --- and both count in
full, so make that artefact good at both and use the checks below to know
whether it is.

What you're building this week — the spec — is published on the course website,
and this repo's name tells you which deliverable it is. Run the course plugin's
**start** skill at the start of each week: it pulls the right spec from the
course API, carries your harness forward from last week, and helps you turn the
spec's checkable lines into tests of your own. Read the spec before you build,
and see `spec/README.md` for how the checks in this repo relate to it.

## Architecture

Four modules, one direction of dependency: `app.js` depends on both
`simulation.js` and `ui.js`; `ui.js` depends on `simulation.js`;
`simulation.js` depends on `fluid-grid.js`; `fluid-grid.js` depends on nothing.
Don't add an import that points the other way --- it's the thing that keeps
any one file replaceable without a rewrite of the others.

- **`js/fluid-grid.js`** --- the pure numerical kernels: `diffuse`, `project`,
  `advect`, `setBoundary`, `bilinearSample`, `resample`, all operating on flat
  typed arrays over a grid with a 1-cell ghost border. Knows nothing about
  sources, walls, or temperature --- just grid indices and numbers. This is
  the layer that would stay identical if the simulation were ever extended
  past thermal convection.
- **`js/simulation.js`** --- state and physics vocabulary built on top of
  `fluid-grid.js`: heat/cold `sources`, `walls`, `config` (the sliders'
  tunables), the grid itself, `step(dt)`, and the derived readouts
  (`rayleighNumber`, `flowRegime`, `temperatureToColor`). Everything here is in
  physical units --- meters, seconds, °C, m/s --- never CSS pixels, and never a
  DOM or Canvas API call. This is what makes the physics testable headlessly
  (`spec/*.test.ts`) without a browser.
- **`js/ui.js`** --- owns the `#controls` panel: renders its markup, binds its
  inputs, and translates them into calls against `simulation.js` (add a
  source, change the active tool, retune eddy viscosity). Never touches the
  canvas or calls `ctx.*` directly.
- **`js/app.js`** --- the entry point. Owns `#simulation-canvas`, the
  `requestAnimationFrame` loop with a fixed-timestep physics accumulator,
  resize handling, the cosmetic tracer streaks (advected by literally sampling
  the solver's own solved velocity field, carrying no physics of their own),
  and converting raw pointer events into meters (via `getBoundingClientRect`
  and the grid's physical domain size) before handing them to `ui.js`. No
  physics and no control markup live here --- if you're tempted to compute a
  velocity or build a `<label>` in this file, it belongs in one of the other
  two.
- **`index.html`** --- structure only: the canvas element, the empty
  `#controls` container `ui.js` fills in, the header nav (including the link
  to `physics.html`), and the Tailwind CDN `<script>` tag. Styling is Tailwind
  utility classes in the markup; reach for a `<style>` block only for
  something Tailwind's utilities genuinely can't express, and keep it inline
  and small rather than reintroducing a separate stylesheet.
- **`physics.html`** --- a static explainer page (no JS, no canvas) laying out
  the solver's math for a reader who wants the derivation behind what's on
  screen. Update it alongside `simulation.js` whenever a formula, constant, or
  threshold it describes changes --- a stale explainer is worse than none.

## Coding standards

- **ES modules, no bundler-dependent syntax.** `import`/`export` between the
  four `js/` files is fine (Vite serves them natively and the build step
  handles it), but don't reach for anything that only works because a bundler
  is present --- no dynamic `import()` for code-splitting, no npm package
  imports. If it wouldn't run from a plain `<script type="module">` off a
  static file server, it doesn't belong here.
- **No TypeScript in the app code.** `main.ts` was deleted along with the
  template's TypeScript setup --- `js/*.js` is the app, plain and untyped.
  `tsc --noEmit` still runs (see the checks below) but it only has `spec/*.ts`
  to check now; that's expected, not a gap to fill by adding types back.
- **Canvas conventions.** All drawing happens inside `render()` in `app.js`
  and the private `draw*` helpers it alone calls (`drawHeatmap`, `drawWall`,
  `drawGlowingSource`, `drawTracer`), once per frame, driven purely by
  `simulation.js` state --- no other code calls a `ctx.*` method. Coordinates
  passed into `simulation.js` are always **meters** (the solver's own physical
  units), never CSS pixels or raw `clientX`/`clientY` --- `app.js`'s
  `toMeters()` is the one place that conversion happens, right at the boundary
  where a pointer event turns into a `simulation.js` call.
- **Physical units stop at `app.js`.** `fluid-grid.js` and `simulation.js`
  only ever deal in meters, seconds, °C, and m/s; `app.js` is the only file
  that knows what a CSS pixel or a `devicePixelRatio` is. If you're computing
  a `scaleX`/`scaleY` or reading `getBoundingClientRect()` anywhere else,
  that's a sign it's drifted into the wrong module.
- **Tailwind utility classes over custom CSS.** Reach for a utility class
  first; a `<style>` block is the exception, not the default.
- **Name things after the simulation's own vocabulary** (`source`, `wall`,
  `tracer`, `temperature`, `grid`), not generic UI terms (`item`, `data`,
  `thing`) --- the domain should be legible from the code without
  cross-referencing the spec. `tracer` (cosmetic, drawn in `app.js`, carries no
  physics) and `source`/`wall`/`grid` (physical state in `simulation.js`) are
  deliberately different words for deliberately different things --- don't
  blur them into one term.

## Commit rules

- **Commit at the boundary of a working change**, not at the end of a session
  --- a source you can place and see rendered, a slider that visibly changes
  behavior, a wall that the flow now visibly bends around. Each commit should
  leave `pnpm check` green (see below); if you must commit mid-feature, say so
  in the message rather than leaving it implicit.
- **Prefix commits with the module they change** when it's not obvious from the
  message alone (`sim:`, `ui:`, `app:`), so the log itself documents the
  boundary the architecture above draws.
- **Cite commits from `PROCESS.md`** as you go, not retroactively at the end
  --- see "Your process is part of the mark" below.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- build,
  lint, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The links check, the evidence check, the secrets scan, and the
  deploy itself only run in CI; run `pnpm dlx linkinator ./dist --silent`
  locally against a fresh `pnpm build` for the links check without waiting for
  CI.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't.
- When a check fails, read its output before changing anything. Each check below
  names what it measures, and the failure message is the instruction: it tells
  you the file, the line, or the contract. Treat a red check as authoritative
  --- the page is wrong until the check is green, not until you decide it should
  be.
- Commit when the checks pass. Never commit a red state.

## The checks (your sensors)

CI runs these on every push once your repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy` --- not one status per sensor below --- and
within `check` the steps run in sequence (`pnpm check` chains typecheck, build,
lint, and the spec with `&&`), so an early failure like a broken build stops the
later sensors from running for that push; fix it and push again to see the rest.
While the repo is private (all week, until you ship) the CI jobs stay skipped
--- `pnpm check` is the same roster on your machine, and it's the faster loop
anyway. They aren't hoops. Each is a different way of finding out something true
about the site that you can't reliably see by looking at it.

They also carry a mark at a crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `tsc --noEmit` runs first in `pnpm check`, so a type error
  stops the roster before the build even starts. The types are extra
  backpressure: a red here is the compiler telling you a claim in the code is
  false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect. An asset that 404s on the deployed URL counts as broken even
  if it loads locally.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website, whatever the week's brief asks; the tests you write for the week's
  own spec run alongside it (any `spec/*.test.ts`). A failure names the contract
  you haven't met yet.
- **lint** --- `stylelint` for CSS, `oxlint` for JavaScript/TypeScript (it
  covers `js/*.js` as well as `spec/*.ts`). Flags code that's wrong, fragile,
  or non-idiomatic. Read the rule it names.
- **tests** --- any other tests you write, wherever you put them (co-located
  with your source is fine, not just `spec/`), must pass. Vitest picks up both
  this and the spec suite in one `vitest run`, the last step of `pnpm check`. A
  failing test is a claim about the site that's no longer true.
- **evidence** (`pnpm check:evidence`) --- checks your process evidence:
  `PROCESS.md`'s citations resolve to real commits, the current deliverable's
  exact reflection is in `reflections/` (worked out from this repo's name
  against the public course API), and your `CLAUDE.md` is present. Evidence
  gates the deploy --- `deploy` needs `check` to pass, so failing evidence
  blocks the deploy alongside everything else. See
  [Your process is part of the mark](#your-process-is-part-of-the-mark) below,
  and the course website's
  [assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
  for what counts as evidence.
- **links** --- internal links must resolve. A broken link is a dead end you
  didn't mean to ship.
- **secrets** --- the repo is scanned for committed credentials. Never put a
  key, token, or password in a tracked file. If one leaks, rotate it. A local
  pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) also
  blocks any commit containing something shaped like an API key --- by the time
  CI sees a key it's already pushed, so the hook is the sensor that matters.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors (`axe-core`, Lighthouse, or whatever you choose) is your work, and later
in the course the spec will ask you to show how you tested both. When you do,
read a green performance result honestly: it's a lab estimate from one run on a
CI machine, not proof the site is fast for real users.

## The stack is swappable

The template ships plain HTML/CSS/TypeScript on Vite; this repo has swapped
that for vanilla JS/Canvas/Tailwind CDN (see the top of this file and
"Architecture" above) and kept Vite only as the build/dev pipeline, not as an
app dependency. Every `.html` file in the repo is still a page: add pages, link
them, and the build picks them up with no config. Nothing in CI names a tool
--- the whole contract is:

- `pnpm build` emits the complete site into `dist/`
- the `package.json` scripts (`check`, `check:evidence`, `build`) keep working
- whatever lands in `dist/` still passes the invariants in `spec/`

Two things bite in a swap. The deployed site lives under a path
(`…github.io/<repo>/`), so configure your generator's base path --- this
template's Vite config uses relative asset URLs to sidestep that, but most
generators (Astro included) need `base` set explicitly, and getting it wrong
looks fine locally while every asset 404s on the live URL. And commit the
updated `pnpm-lock.yaml`: CI installs with `--frozen-lockfile`.

## Your process is part of the mark

The deployed page is only half of it. How you got there is marked too: your
commit history, your agent files, and the decisions visible across them. The
checks above can't see any of that, so a person reads it directly --- which
means building legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of your process; a single
  dump the night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what you built, the moments that mattered --- each pointing at a
  commit, a `CLAUDE.md` change, or a prompt and the commit it produced --- and
  where to look in the history. It points a marker at the evidence; it doesn't
  stand in for it, and claims the history doesn't back don't count. The
  `PROCESS.md` in this repo is a template showing the shape and the citation
  format (link text the commit hash or range, target the commit or compare URL);
  `pnpm check:evidence` verifies your citations resolve to real commits before
  you ship. Markers follow those citations and don't trawl the repo for evidence
  you didn't cite.
- **Write your reflection in `reflections/`** --- a short markdown file in this
  repo, named for the deliverable it answers, so the number in the filename is
  the number in this repo's name (`crit-1.md` in `comp4020-crit1-<you>`,
  `assignment-1.md` in `comp4020-ass1-<you>`); `reflections/README.md` has the
  full rule. `pnpm check:evidence` checks the exact current name against the
  course API, not merely the presence of any well-named file. It answers the two
  standing prompts: the breakthrough that moved the work forward, and what this
  work changed about the developer you want to be. It stays out of the deployed
  site. It's due at the cutoff, and if it isn't in the repo by then the week
  doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness you build to direct the agent,
  this `CLAUDE.md` and any `AGENTS.md`, is itself read as part of how you
  worked. Keep it honest and current (see below).

You don't need a name, a student number, or any identity file in the repo: we
know whose repo it is. Spend the effort on the work.

## This file is yours

This CLAUDE.md is a starting point, not a fixed rulebook. As you learn what your
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching you out, a fact about the stack the agent keeps getting wrong --- write
it down here. Growing this file is the work of harness engineering, and the gap
between this boilerplate and your own version is part of what your prototype
says about the developer you're becoming.
