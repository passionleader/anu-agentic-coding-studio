# Crit 5 — Retro Run & Gun

A static COMP4020 Crit 5 prototype: a 1990s-style side-scrolling run-and-gun
game. The player has 3 lives, moves with the arrow keys, attacks with the
spacebar (boomerang, upgradeable to a gun), and pushes through 3 stages, each
ending in a boss. Full design is in `Plan.md` — read it before proposing
features.

The deployed GitHub Pages site is the artefact that is assessed.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## Design motif

`Plan.md` is the design authority for this crit — read it before touching
scope, and update it first if a change would expand the core idea.

Named inspiration: SEGA's arcade *Wonder Boy* — its tropical/jungle push to
the right, fruit scattered along the path, and chunky, saturated 16-bit
silhouettes set the mood. Take the mood, not the IP: no copied character art,
logo, or box art from the original game — ship an original look that reads
the same way, the same discipline crit4 applied to being "inspired by Logic
Pro" without copying its branding.

Reach for free/open-licence sprites, tiles, and audio (BGM and SFX) wherever
one makes a scene noticeably better than a hand-rolled placeholder would —
this is a visual- and audio-rich week, not a minimalism exercise. Record every
sourced asset's origin and licence in `public/assets/CREDITS.md` next to the
files themselves, so the licence terms travel with the asset even when it's
CC0 and technically doesn't require attribution.

## Game rules

- Boomerang deals 1 damage/hit; monsters have 2 HP (two boomerang hits to
  kill). The gun pickup deals 2 damage (one-shot kill) and replaces the
  boomerang once collected.
- Fruit pickups (banana, strawberry, etc.) add score only — no effect on
  lives or health.
- 3 lives; touching a monster costs one life; 0 lives ends the run. The game
  must be losable.
- 3 stages, each with a boss at the end; beating stage 3's boss wins.
- No tutorial, modal, or instructions text anywhere — the opening screen
  alone must make the first move (walk right, shoot) obvious.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so the deployed head is the only place a broken one shows up.

## The checks

`pnpm check` runs them, and `pnpm check:evidence` is the extra gate before you
ship. CI runs the same plus links, secrets and the deploy.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## Working agreements

- Read `Plan.md` before proposing new features. If a change expands the core
  idea, explain the trade-off and update the plan before implementing it.
- Keep the site static and compatible with the existing Vite, TypeScript, and
  GitHub Pages setup unless a deliberate stack change is agreed first.
- Keep the rendered page as the source of truth: run the dev server and play
  the game in a browser at desktop and mobile sizes.
- When a check fails, read its output and identify the cause before changing
  code. Do not silence or weaken a check just to make it pass.
- Run `pnpm check` after meaningful implementation changes. Run
  `pnpm check:evidence` before shipping.
- Commit small, coherent changes as the work progresses. Never commit a known
  red state.
- Keep `PROCESS.md` current with real commit citations and write the exact
  reflection file required for Crit 5 at `reflections/crit-5.md`.
- Never place API keys, tokens, passwords, or other credentials in tracked
  files.
- At least one design change must come from actually playtesting the built
  game, not from reading the code — note which change and why in `PROCESS.md`.
- Every time a slice is worth looking at, run `pnpm dev` and leave it serving
  on localhost so it can be opened directly. The result is judged by playing
  it in a browser, not from a description of it — don't report a slice as
  done without having done this.
- Before calling a slice done, re-check it against the published crit-5 spec
  (losable; teaches itself with no instructions anywhere; a stranger reaches
  an ending inside five minutes; one rule under automated test; one
  playtest-driven change), not only against `Plan.md`.
- No restriction on code style beyond what `pnpm check` enforces. Prefer
  sourcing a free/open-licence asset over hand-rolling one when it makes the
  game more colourful — see "Design motif" above.
- Run `pnpm check` after every slice, not only at the end of a session, and
  commit and push each slice once it's green rather than batching many slices
  into one commit.
- After pushing a slice, add one or two lines to the "Working notes" section
  at the bottom of `PROCESS.md` saying what changed and why. This is raw
  material, not the deliverable — fold it into the polished, cited overview
  (and delete the working-notes section along with the template comment)
  once, before shipping.

## Before shipping

Confirm that the work is committed and pushed, the checks are green, the
reflection and process evidence are present, and the live GitHub Pages URL
loads with its assets and is playable at both desktop and mobile sizes.

## This file is yours

A starting point, not a rulebook: what you add to it is the harness, and the
harness is assessed. This file and the sensors you wire into `check` carry
across the course --- both come with you into next week's repo. The prototype
doesn't: source, and the tests answering this week's published spec, stay
behind. `spec/README.md` draws the line.
