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

A small SEGA *Wonder Boy*-inspired side-scrolling run-and-gun browser
prototype: a chibi cat with 3 lives pushes right through 3 stages of 5 maps
each, fighting slimes with a boomerang (upgraded to a one-shot-kill gun on
pickup), collecting fruit for score, and facing a boss at the end of every
stage --- no tutorial anywhere, so the opening screen has to teach the
controls by itself. I sketched the idea and rules in `Plan.md`/`CLAUDE.md`,
then iterated against what Claude Code actually built rather than against the
plan alone --- most of the real design decisions below only showed up once I
played the current build myself. Two Claude Code sessions split the work
throughout (one directing/reviewing/QA-ing, one implementing and drafting
assets), coordinating directly via `ListAgents`/`SendMessage`. Every sprite,
background layer, the gun, and every sound effect and the BGM ended up
hand-authored for this project (Python/Pillow, Python's `wave` module, and
Logic Pro for the music) rather than sourced, once the sourced CC0 set stopped
matching what I actually wanted --- a reversal of `Plan.md`'s original design
motif, made deliberately and recorded there.

## The moments that mattered

- **One playtest, nine problems, one design pass.**
  [`2a5b312`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/2a5b312)
  shipped a single flat, non-scrolling map with the placeholder rectangles
  replaced by sourced sprites. Playing it myself surfaced far more than a bug
  list:

  > There's only one map and it doesn't scroll --- there should be about 5
  > maps per stage, a boss on each stage's last map (boss HP = 10x that
  > stage's regular monster HP, so 20 in stage 1), and difficulty should rise
  > per stage. The score isn't shown on screen. Mobile needs an on-screen
  > d-pad. Nothing tells a first-time player what to do --- show "Stage 1" for
  > a second at the start and again on every stage change. Draw the
  > arrow-key/space-bar controls into stage 1's first map instead of an
  > instructions screen. There's no jumping and no obstacles --- add some.
  > The gun still fires forward even after I've turned around. And every
  > stage looks the same --- vary the background per stage.

  Rather than patch each line as its own one-off fix, I treated it as a
  single rework:
  [`13967e7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/13967e7)
  rebuilt the world as a scrolling camera over 5 maps/stage with a boss on
  each stage's last map, per-stage difficulty and colour tinting, jump/gap
  obstacles, a fix for the always-fires-right bug, and a fix for the
  unreadable score/lives text, plus a "STAGE N" banner
  ([`fe13de7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/fe13de7)
  added the in-world control pictogram and
  [`b53464f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/b53464f)
  the touch d-pad, split out as their own slices). Playtesting the fix then
  caught a bug no amount of code-reading would have: standing next to a
  stationary monster drained all 3 lives in a couple of frames, because
  nothing gated repeat contact damage. I added invulnerability frames and
  confirmed it with `pnpm check` (21 tests, up from 20).

- **A second playtest, once the loop was actually playable end to end.**

  > Add a pause button and a mute button, top-right. Pausing should reveal
  > reset and resume buttons. Let a jump dodge monster attacks. Put the gun
  > on stage 2's second map, not its first. Add a heart item on stage 3's
  > first map that refills a life. Cap the boomerang/gun at two shots per
  > second.

  and, separately, on originality: *"swap in the BGM I actually composed."*
  All of it landed in
  [`23eba26`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/23eba26),
  verified with a headless-browser pass driving the pause/resume/mute state
  machine end to end rather than trusting that the buttons merely existed. A
  follow-up playtest
  ([`7e1b3cf`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/7e1b3cf))
  found the jump-dodge only worked against projectiles, not a monster's own
  body --- the same `grounded` gate was missing from the body-contact check,
  confirmed with a debug hook showing 35 airborne frames over a monster
  costing no lives, then one lost on the exact landing frame.

  The "original" BGM wired in by `23eba26` then needed a harder correction:
  once I looked at it honestly, it was close enough to an existing song to be
  a real plagiarism risk for a publicly graded deliverable, not just a
  filename problem. Renaming it was rejected in favour of
  [`9431355`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/commit/9431355),
  which replaced it with a genuinely original composition and corrected
  `CREDITS.md`'s account of what happened, rather than quietly rewriting
  history.

- **Reversing the CC0-asset design motif.** `Plan.md` originally called for
  sourcing free/open assets over drawing a full set from scratch. Partway
  through I asked whether hand-authoring everything instead would look
  better, and pursued it as a real, reviewed design change rather than a
  drive-by request: every replacement was drafted in a scratch directory
  first, then shown on a review page so each asset (player, monster,
  background, gun, SFX) could be approved or rejected individually before
  anything shipped. The player sprite and the background tree were rejected
  twice, not once --- first for being a rough human figure, then, after being
  redrawn as a chibi cat, for looking oversized next to the monster. That
  second complaint traced back to a bug in my own review tooling, not the
  art: the review page composited sprites at native PNG pixel size instead of
  the game's real feet-anchored scaling, overstating the size mismatch by
  roughly 2.4x. Fixing the preview first, then retuning
  `PLAYER_SPRITE_HEIGHT`/`BASE_MONSTER_SIZE` to the scale actually being
  asked for, is the difference between a real design change and chasing a
  measurement artifact --- treating them the same would have shipped the
  wrong fix.
  [`3c1882b...af63561`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-passionleader/compare/3c1882b...af63561),
  `pnpm check` green throughout (21 tests), verified live via the dev server
  at every step, not just on the review page.

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that a
reflection entry the marker reads is in `reflections/`, and that your
`CLAUDE.md` is there --- before a marker ever opens the file. It checks that
your map is traceable, not that it is good: the marker judges whether your
small, deliberately chosen set of moments shows real judgement and reflection. A
green check is not a substitute for that curation.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that a
reflection entry the marker reads is in `reflections/`, and that your
`CLAUDE.md` is there --- before a marker ever opens the file. It checks that
your map is traceable, not that it is good: the marker judges whether your
small, deliberately chosen set of moments shows real judgement and reflection. A
green check is not a substitute for that curation.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.

