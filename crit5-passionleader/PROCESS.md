# Process overview

A reading-guide to how the work came together --- a map to your process, not an
essay about it. Markers read this file and follow its citations; they don't
trawl the repo for evidence you didn't point at, so if a moment mattered, cite
it.

This file is the shape; the course site's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
is the requirement, and its
[word counts](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#word-counts)
cover every deliverable.

## What I built

A small SEGA *Wonder Boy*-inspired run-and-gun prototype: a chibi cat with 3
lives pushes right through 3 stages of 5 maps each, fighting slimes with a
boomerang (upgraded to a one-shot-kill gun), collecting fruit for score, and
facing a boss at the end of every stage --- no tutorial anywhere, so the
opening screen has to teach the controls itself. Two Claude Code sessions split the work, one directing/reviewing/QA-ing and
one implementing, coordinating via `ListAgents`/`SendMessage`. Every sprite,
background, the gun, and every sound (SFX and BGM) ended up hand-authored
(Python/Pillow, Python's `wave` module, Logic Pro) rather than sourced,
reversing `Plan.md`'s source-first motif.

## The moments that mattered

- **One playtest turned a flat demo into an actual game.** The only note
  that mattered on the first playable build was "there's only one map and it
  doesn't scroll." Rather than patch that alone, I treated the whole
  playtest as one rework:
  [`13967e7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/13967e7)
  rebuilt the world as a scrolling camera over 5 maps/stage with a boss on
  each stage's last map, monster HP scaling 2 → 3 → 4 across the three
  stages (boss HP fixed at 10x monster HP, so 20/30/40), a visible
  score/lives HUD, jump/gap obstacles, per-stage background tinting, and a
  fix for the gun always firing right regardless of facing direction
  ([`fe13de7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/fe13de7)
  added an in-world control pictogram,
  [`b53464f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/b53464f)
  the touch d-pad). Playing the fix caught a bug no code-reading would have:
  standing next to a stationary monster drained all 3 lives in a couple of
  frames, since nothing gated repeat contact damage --- fixed with
  invulnerability frames, confirmed by `pnpm check` (20 → 21 tests).

- **A second playtest, and a mistake reversed rather than papered over.**
  Once the loop was playable end to end,
  [`23eba26`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/23eba26)
  landed a pause/mute button pair revealing resume/reset on pause, a
  jump-dodge for monster attacks, the gun pickup moved to stage 2's second
  map instead of its first, a heart pickup on stage 3's first map, a
  2-shots/second weapon cap, and a BGM swap to a track I'd composed myself.
  A follow-up playtest
  ([`7e1b3cf`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/7e1b3cf))
  found jump only dodged projectiles, not a monster's own body --- the same
  `grounded` gate was missing from the body-contact check, confirmed with a
  debug hook: 35 airborne frames over a monster cost no lives, then one was
  lost on the exact landing frame. The BGM swap then needed a harder
  correction: on a second listen, the "original" track was close enough to
  an existing song to be a real plagiarism risk. Renaming was rejected for
  [`9431355`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/9431355),
  a genuinely new composition, with `CREDITS.md` corrected to match.

- **Reversing the CC0-asset motif through a review loop, not a drive-by
  request.** `Plan.md` called for sourcing free assets, not drawing a full
  set from scratch. Partway through I asked whether hand-authoring
  everything would look better, and ran it as a reviewed change: every
  replacement was drafted in a scratch directory, then shown on a review
  page at the game's true scale so each asset could be approved or rejected
  individually. The player and background tree were rejected twice each ---
  the player first for looking like a rough human figure, then, redrawn as a
  chibi cat, for looking oversized next to the monster. The second
  complaint traced to a bug in my own review tooling: the preview
  composited sprites at native PNG pixel size instead of the game's real
  feet-anchored scaling, overstating the mismatch by roughly 2.4x. Fixing
  the preview, then retuning `PLAYER_SPRITE_HEIGHT`/`BASE_MONSTER_SIZE` to
  the scale actually asked for, is what separated a real design fix from
  chasing a measurement artifact.
  [`3c1882b...af63561`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/compare/3c1882b...af63561),
  `pnpm check` green throughout, verified live via the dev server.

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that a
reflection entry the marker reads is in `reflections/`, and that your
`CLAUDE.md` is there --- before a marker ever opens the file. It checks that
your map is traceable, not that it is good: the marker judges whether your
small, deliberately chosen set of moments shows real judgement and reflection. A
green check is not a substitute for that curation.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.

## Working notes (raw, kept for reference)

Superseded by the curated overview above --- this is the unedited, one-or-two-
lines-per-slice log written right after each push over the course of the
week, kept here rather than deleted so the day-to-day rhythm is still visible.

- [`c768321`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/c768321):
  named Wonder Boy as the visual/mechanical motif in `CLAUDE.md`/`Plan.md`
  (mood, not the IP --- no copied character art/logos), and wrote in the
  per-slice rhythm this session runs on: dev server up for every result,
  re-check against the published crit-5 spec each time, commit+push per
  slice, a running note here instead of writing `PROCESS.md` once at the end.
- [`dc389e9`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/dc389e9):
  sourced CC0 sprites (player, slime), a jungle background/ground tile, one
  BGM loop and four SFX from OpenGameArt, trimmed/resized to keep the payload
  small (~1.1 MB total), credited in `public/assets/CREDITS.md`. Not wired
  into the game yet --- two sessions are splitting this crit (a second,
  lower-effort session building the minimal playable loop in
  `main.ts`/`game-rules.ts`; this session sourcing assets, keeping the
  harness current, and integrating/verifying against the rubric before each
  push).
- [`bf1bcee`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/bf1bcee):
  the delegated session's minimal playable loop --- `game-rules.ts` matching
  `spec/crit-5.test.ts`'s exact signatures, and a canvas loop (move, fire,
  monster HP, life loss, game over) with placeholder rectangles standing in
  for art. `pnpm check` green (20 tests) before I picked the branch back up.
- [`2a5b312`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/2a5b312):
  replaced every placeholder rectangle with the sourced sprites/background
  from `dc389e9` --- animated player (idle/run/hurt) and slime frames,
  layered jungle/ground/tree/plant art, bgm + four SFX (bgm starts on first
  keypress to respect autoplay policy). Added hit-flash, a brief shake and
  hurt-frame feedback on taking damage, and a small pickup pop label, per
  `Plan.md`'s "punchy, readable feedback" note. `game-rules.ts` untouched;
  `pnpm check` still green. Still owed at this point: an actual
  playtest-driven change, plus stages 2/3 and their bosses.
- **Playtest-driven change** (the required one): the user played `2a5b312` at
  `localhost:5173` and reported nine issues, the headline one being "there's
  only one flat map, and it doesn't scroll." That single observation drove
  [`13967e7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/13967e7):
  a camera/world-scrolling rewrite with 5 maps per stage, a boss on the last
  map of each stage (hp = 10x that stage's regular monster hp), per-stage
  difficulty scaling (monster hp 2/3/4, ranged attacks and bigger sprites
  from stage 2 on, gun delayed to stage 2), jump + block/gap obstacles, a
  fix for the score/lives text being unreadable against the sky, a
  "STAGE N" intro banner, per-stage colour tint for background variety, and
  a fix for projectiles always firing right regardless of which way the
  player was facing. Playtesting also surfaced a bug no code-reading would
  have caught: standing next to a stationary monster to shoot it drained
  all 3 lives in a couple of frames, since nothing gated repeat contact
  damage --- added invulnerability frames after any hit. `pnpm check` green
  (21 tests, +1 for boss-hp scaling).
- [`b53464f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/b53464f):
  added on-screen touch controls (`touch-controls.ts`, a hidden
  `#touch-controls` button row) per the user's request that a touch device
  get a virtual keyboard; only revealed when `isTouchDevice()` is true, so
  keyboard play is unaffected. `pnpm check` green (21 tests).
- [`fe13de7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/fe13de7):
  added an in-world key-guide pictogram (arrow keycaps + a space bar, icons
  only, no text) drawn on stage 1's first map until the first input or a 4s
  timeout, per the user's request to show the controls as an in-game drawing
  rather than an instructions screen. `pnpm check` green (21 tests).
- **Second playtest round** (another actually-played-it feedback pass):
  [`23eba26`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/23eba26):
  pause (⏸)/mute (🔊) icon buttons top-right, revealing resume/reset when
  paused (reset also escapes a GAME OVER screen, previously only possible by
  reloading); monster projectiles now only connect while grounded, so a
  jump dodges them; the stage-2 gun pickup moved from its first map to its
  second; a heart pickup on stage 3's first map restores one life (capped
  at 3); fire rate capped at 2 shots/sec for both weapons; swapped the CC0
  placeholder BGM loop for an original track the user supplied
  (`Seongs_adventure.mp3`). Verified live with a headless-browser pass
  through the pause/resume/mute state machine and temporary (removed before
  commit) debug hooks confirming the gun/heart pickups land on the intended
  map indices and that `grounded` toggles correctly on jump. `pnpm check`
  green (21 tests).
- [`ea19272`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/ea19272):
  swapped the header's "Home" link for a contact `mailto:` link, widened the
  playable area on desktop via a `min-width: 900px` media query (CSS max-width
  only --- canvas render resolution untouched, so `image-rendering: pixelated`
  keeps the upscale crisp), and made the touch-control buttons wider
  left-to-right for easier thumb targets. Delegated to the medium session as
  a narrow, decoupled UI slice (`index.html`/`styles.css` only, no engine
  files) while this session handled the BGM issue below in parallel;
  confirmed by diffing the commit against the delegated spec, an independent
  `pnpm check` (21 tests), and a headless-browser pass measuring the actual
  rendered bounding boxes at a 1400x900 desktop viewport and a 390x844 touch
  viewport, plus screenshots at both sizes. Touch controls' mobile-only
  visibility (`isTouchDevice()`) was already correct and needed no change.
- [`9431355`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/9431355):
  swapped the BGM track a second time after the author disclosed the
  supposedly "original" track credited in `23eba26` was actually an ear-copy
  of an existing song --- a real plagiarism risk for a publicly-assessed
  deliverable, not just a filename problem, so renaming alone (the author's
  first instinct) was rejected in favour of sourcing a genuinely original
  replacement. Copied the author's newly-composed track in, updated the
  `bgm` audio src, and corrected `CREDITS.md` to describe both the fix and
  why it was needed, rather than leaving the earlier (now-inaccurate)
  "original track" claim in place. Chose not to rewrite git history to
  scrub the old file from past commits, since this is a shared repo other
  sessions are actively working against and the risk was in the file's
  content, not its filename --- the forward fix (delete + replace + correct
  the record) fully addresses it going forward. `pnpm check` green
  (21 tests).
- [`7e1b3cf`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/7e1b3cf):
  another playtest-driven fix --- the user reported still taking damage from
  jumping over a monster. `23eba26`'s jump-dodge only gated the
  monster-*projectile* collision on `player.grounded`; the separate
  monster-*body* contact check had no such gate, so touching a monster's x
  range always hurt regardless of jump state. Added the same `grounded` gate
  there. Verified with a temporary (removed before commit) debug hook driving
  frame-by-frame state from a headless browser: lives stayed unchanged across
  35 airborne frames directly over a monster, then dropped exactly on the
  frame the player landed while still overlapping it. `pnpm check` green
  (21 tests).
- [`3c1882b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/3c1882b):
  the author asked whether the remaining CC0 assets should be hand-authored
  instead --- reversing `Plan.md`'s source-first default. Drafted replacements
  for player/monster/background/gun/SFX in a scratch dir first (delegating
  SFX synthesis to the peer session), built a review page compositing all of
  them at true in-game scale, and had the author approve/reject per asset
  before wiring anything in. Approved: slime, background (sky/hills/ground/
  plants), the gun (redrawn as vector shapes in `main.ts`, no PNG) and its
  bullet, and all four SFX. Rejected: the player sprite ("looks bad" ---
  wants a 2-heads-tall chibi design, human or not) and `bg/tree.png` ("too
  flimsy-looking"). Only the approved half was wired in and credited; player
  and tree stayed CC0-sourced pending a second attempt. `pnpm check` green
  (21 tests); verified live via the dev server, not just the review page.
- [`af63561`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/af63561):
  the character/tree redo `3c1882b` owed. Player became a 2-heads-tall chibi
  cat (not human, per the author's explicit "a cat is fine too"); the tree
  got a thicker curved trunk and a fanned canopy. The cat then hit a second
  round of feedback --- "too big, monster too small" --- which traced back to
  a bug in my own review tooling, not the art: the review page composited
  sprites at native PNG pixel size rather than the game's real
  feet-anchored scaling (`drawSpriteFeetAt`), overstating the player/monster
  size gap by ~2.4x. Fixed the preview, then retuned the actual render
  constants (`PLAYER_SPRITE_HEIGHT`, `BASE_MONSTER_SIZE`) to the scale the
  author asked for, checking first that a bigger monster hitbox doesn't
  overlap adjacent monsters/obstacles (`stages.ts`'s spacing) or break
  jump-dodge (gated purely on `player.grounded`, not vertical overlap, so
  unaffected). Every sprite/bg/gun/SFX asset is now hand-authored; the
  original sourced CC0 set is gone. `pnpm check` green (21 tests); verified
  live via the dev server at each sizing step, not just the review page.
- [`78556d3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/78556d3):
  a permanent `assets.html` gallery page, requested once the ad-hoc review
  pages had done their job --- every player/slime animation, background
  layer, the code-drawn gun/projectiles, and all audio, shown at the exact
  size/scale the game actually uses (reused `drawSpriteFeetAt`'s math and
  the live vector-drawing code verbatim, not redrawn from memory, so this
  page can't drift from what's on screen the way the earlier review pages
  did). Linked from a new "View assets!" button next to the header email
  link; `vite.config.ts` picked the new root `.html` file up as a build
  entry with no config change, as documented. Added the missing og:image
  block the page-invariants test expects on every page. `pnpm check` green
  (29 tests); verified live via the dev server, including that all five
  audio files actually load with correct durations, not just that
  `<audio>` tags render.
- [`e1b87ed...37a6649`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/compare/e1b87ed...37a6649):
  post-ship polish --- header restructured to an H1 + plain email text + a
  real "View assets!" button (not a styled link), Press Start 2P/IBM Plex
  Sans pulled in to match the asset-review page's type, background shifted
  to a green-tinted black, the touch d-pad gated to phone-sized viewports
  (not just touch-capable ones), the reset button now appears automatically
  on game over/full clear instead of requiring a manual pause first, and a
  factual correction to the BGM reflection (the session player performed the
  parts; the chords and instrument choices were still hand-picked).
