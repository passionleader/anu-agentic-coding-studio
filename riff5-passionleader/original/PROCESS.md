# Process overview

## What I built

**Two-Tone**, a falling-circle dodge game with one rule: a circle the same
colour as you passes straight through, a circle the other colour ends the
round. You start with only a colour and a position; the game hands you an
easy dodge first, then keeps sending obstacles until dodging alone stops
working and matching colour is the only way through. Difficulty is time,
not text --- it never tells you the rule, it just keeps you alive until you
find it.

## The moments that mattered

1. **Choosing the mechanic to fit the no-tutorial constraint.** The brief
   rules out any how-to-play text, so the mechanic itself had to teach the
   rule by consequence rather than by instruction. A pure left/right dodge
   needs no explaining but has no depth; a colour-match-or-die rule has
   depth but risks being illegible without a caption. The fix was pacing,
   not text: the first obstacle always matches the player's colour by
   spawn odds being 50/50 and the opening obstacles being sparse, so an
   early death is either from not moving at all or from a same-colour hit
   passing through unremarked --- the *first* wrong-colour hit is the
   moment the rule teaches itself, and it always arrives inside the first
   few seconds, well within the "obvious in ten seconds" bar.
   [`68b5417`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/68b5417)
2. **Keeping the rule itself testable independent of the canvas.** Collision
   and colour-matching live in `game-logic.ts` as pure functions
   (`isFatalCollision`, `circlesOverlap`) with no DOM or canvas dependency,
   so `spec/crit-5.test.ts` asserts the one rule the spec asks for directly:
   same-hue overlap is safe, different-hue overlap ends the round, and no
   overlap is always safe regardless of colour. `main.ts` only wires that
   logic to rendering and input.
   [`2b7379d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/2b7379d)
3. **The swap-button placement bug, found by playing, not by reading code.**
   The colour-swap control was first drawn in the same bottom corner as the
   player, sized and positioned relative to the canvas. Reading the code
   gave no reason to doubt it. Screenshotting the actual 390×844 marking
   viewport did: a resize clamps the player's `x` into the new width, and on
   the narrower canvas that clamp pushed the player almost on top of the
   swap button, so the two circles you're meant to tell apart (`you`, `the
   button`) sat side by side. Moved the swap button to the top-right, clear
   of the player's whole row, so no resize can ever put them in the same
   spot. Re-verified at both marking viewports afterwards.
   [`6778aa5`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/6778aa5)

4. **The two hues weren't actually colourblind-safe, and I checked rather
   than assumed.** The entire mechanic is "tell these two colours apart," so
   I ran the launch pair (teal `#2dd4bf`, pink `#f472b6`) through the
   Machado (2009) colour-vision-deficiency simulation matrices rather than
   eyeballing them. Under deuteranopia the two collapse to near-identical
   greys — Euclidean RGB distance ~27, against ~222 for typical vision — so
   a deuteranopic player would have had no way to play at all, not just a
   harder time. Replaced them with sky blue `#38bdf8` / amber `#f59e0b`,
   which stays well separated under protanopia, deuteranopia and
   tritanopia alike and contrasts near-equally against the canvas
   background, so neither colour reads as fainter than the other.
   [`9cdfc89`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/9cdfc89)
5. **A scripted playtest, not just arithmetic, to check the difficulty
   ramp.** `fallSpeed`/`spawnIntervalMs` both cap out by ~33 seconds of
   elapsed time, meaning the round spends most of a five-minute session at
   flat maximum difficulty. Rather than treat that as a design smell from
   the formulas alone, I drove a real reactive bot (matching colour to the
   nearest oncoming obstacle, dodging when two threats conflict) through
   the live build via `agent-browser eval`, polling actual game state every
   55ms. It survived past the five-minute mark without ever hitting an
   unfair, un-survivable obstacle pattern — confirming the post-ramp
   difficulty is a sustained challenge rather than a wall, which the
   formulas alone couldn't show.
6. **A default browser behaviour, not a bug in this code, still needed a
   fix.** The canvas had no `-webkit-tap-highlight-color` override, so
   Android/WebKit paint their default translucent grey rectangle over the
   whole play area on every tap or drag start — nothing in this game's own
   logic causes it, but a full-bleed touch surface makes it more visible
   than most. Set it to `transparent`, confirmed via
   `getComputedStyle` before and after.
   [`8b9e859`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/8b9e859)
7. **Scoped, not skipped, the screen-reader question.** A fully blind
   player can hear how the round ended (`#announcer` reports the final
   score) but has no way to play the falling-circle mechanic itself, since
   there's no non-visual channel for obstacle position or colour. For a
   canvas arcade game this is a deliberate, named scope limit rather than
   something silently left unconsidered — matching most action games of
   this shape.
8. **A named sensor found something the earlier passes couldn't.** Ran
   Lighthouse on this repo for the first time and it scored `best-practices`
   0.96 for a real console error — the browser's own implicit
   `favicon.ico` probe, on every page load, since no favicon existed. Fixed
   with a small SVG favicon in the game's own sky-blue/amber pair; the score
   moved to 1.0 on re-run, not just assumed fixed. Checking the palette for
   that also turned up a second, unrelated gap: the colourblind-safety hue
   swap (moment 4) only ever touched `main.ts`, so the header nav link was
   still rendering in the retired pink. Moved it to the settled amber.
   [`48e382b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/48e382b)

9. **`pnpm audit` found real vulnerabilities in dev tooling; an in-range
   update cleared them without touching a pin's ceiling.** Seven findings
   (2 high, 5 moderate) in transitive deps of `jsdom`/`vite`'s toolchain
   (`undici`, `postcss`, `nanoid`). A plain `pnpm update` --- which only
   moves within the caret ranges already declared, no major bump --- took
   `vite` to 8.2.2 and `vitest` to 4.1.11 and cleared every finding.
   `pnpm check` stayed green after.
   [`ae3fa91`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/ae3fa91)

10. **A focus-loss handler covered `blur` but not the case that actually
    happens most often.** The keyboard-movement fix in the code already
    cleared held keys on `window.blur` so a tab-away didn't leave the
    player drifting on return, but `blur` only fires when the whole
    browser window loses OS focus — switching tabs *within* the same
    window hides the document without ever blurring the window.
    Confirmed live: dispatching a synthetic `visibilitychange` with
    `document.hidden` forced `true` left an arrow key stuck in the
    held-keys set under the old code, and cleared it once
    `visibilitychange` got the same handler as `blur`. The more common
    real-world case (Ctrl-Tab away mid-round) was the one path the
    original fix didn't actually cover.
    [`25d1bc3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/25d1bc3)

11. **A short-viewport scenario, not one of the two marking viewports, is
    where this one actually showed up.** The gameover branch of the keydown
    handler restarts the round before the function reaches its
    `event.preventDefault()` calls further down, so Space --- the browser's
    own page-scroll-down key --- still scrolled the page underneath the
    restart. Invisible at both marking viewports, where the page's total
    height never exceeds the viewport, so `agent-browser` at 1920×1080 or
    390×844 alone would never have caught it. Found by checking the page's
    actual layout height against a range of shorter effective viewports ---
    the real scenario is a phone with its address bar still on screen,
    which reduces the usable height below what `390×844` alone assumes ---
    and confirming live with a temporary debug hook (forced game-over,
    dispatched a real `Space` keydown, read `window.scrollY` before and
    after: 0 → 4 under the old code, 0 → 0 after moving the
    `preventDefault()` ahead of the early return). No console error, no
    failed test either --- a scroll isn't a JS error, so this only surfaces
    by actually watching the page move.
    [`b3b2b60`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/b3b2b60)
12. **The restart-on-any-key rule didn't account for a key the player was
    already holding.** Dying usually happens mid-dodge, with a movement key
    still physically down --- and a held key keeps sending `keydown` events
    (the browser's own auto-repeat, flagged `event.repeat: true`) for as
    long as it stays down. The gameover branch treated every `keydown` as a
    restart request, so that auto-repeat silently reset the round before the
    player had a moment to see the game-over screen or their score, without
    them doing anything they'd recognise as "pressing a key to restart."
    Confirmed live with a temporary debug hook: forcing gameover with
    ArrowLeft still held, then dispatching a synthetic `repeat: true`
    keydown for the same key, flipped state straight back to `"playing"`
    under the old code. Fixed by ignoring repeat keydowns in the gameover
    branch --- a release-and-repress of the same key, or any other fresh
    key, still restarts immediately.
    [`f43833d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/f43833d)

13. **The colour-swap toggle had the same auto-repeat gap as the gameover
    restart, in the other direction.** Moment 12 fixed the gameover branch
    treating every `keydown` as a restart; the same handler's Space-to-swap
    branch had never been checked against the identical failure mode ---
    toggling on every `keydown` rather than every fresh press. Confirmed
    live with a temporary debug hook: one real Space keydown flipped the
    player's hue once as expected, but three synthetic `repeat: true`
    keydowns for the same key --- exactly what the browser sends for as
    long as Space stays physically held past the OS auto-repeat threshold
    --- flipped it three more times, uncontrollably, with no further
    player action. A toggle bound to a key a player might reasonably hold
    (the same key used to move, in some games, or just a slightly long
    tap) needs the same repeat guard as a restart-on-keypress does. Fixed
    with the identical `if (event.repeat) return;` guard; verified the
    click/pointer path to the same swap button still toggles once per
    click, untouched by the change.
    [`1129a02`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/1129a02)

14. **A collision found by driving the drag through it, not by reading the
    handlers separately.** `pointerdown`'s gameover branch and `pointermove`'s
    drag branch had each been checked in isolation, but never against each
    other in the one sequence that connects them: a fatal collision arriving
    *while the pointer is still down*. `pointermove` never checked game
    state, only `dragging`, and nothing had ever set `dragging` back to
    `false` when the round ended out from under it --- there's no pointerup
    to clear it, since the player never lifted their finger. Confirmed live
    with a temporary debug hook: forced a collision mid-drag, then kept
    moving the pointer, and watched `playerX` keep tracking it (310 → 460 →
    610) while `state` stayed `"gameover"` --- the player circle visibly
    slid under the dimmed overlay after the round had supposedly ended.
    Fixed the same way the existing blur/visibilitychange handler already
    clears held input: `gameOver()` now sets `dragging = false` itself, so
    `pointermove`'s own `if (!dragging) return` guard takes over with no
    further change needed there.
    [`60ac9eb`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/60ac9eb)

15. **A fix scoped to one key turned out to be an instance of a wider gap.**
    An earlier moment suppressed Space's default page-scroll during a
    gameover restart. Re-reading that fix against the rest of the
    `keydown` handler rather than trusting it closed the whole bug class:
    ArrowUp and ArrowDown have no in-game effect at all, so nothing had
    ever called `preventDefault()` on them, in *any* state --- not just
    gameover. Confirmed live at a real short viewport (390×500, genuine
    overflow: `scrollHeight` 534 vs `innerHeight` 500) that pressing
    ArrowDown during ordinary play, with no collision or restart involved,
    scrolled the page 29px. Fixed by widening the same unconditional
    preventDefault check that already covered Space to include both arrow
    keys; verified ArrowLeft/ArrowRight movement and Space's hue-swap
    toggle still fire normally afterwards.
    [`79b43cc`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/79b43cc)

16. **The same generalisation gap recurred one commit later, for the same
    fix.** Moment 15 widened Space's scroll-suppression to cover ArrowUp and
    ArrowDown, reasoning about "browser scroll keys with no in-game use" as
    a class --- but stopped at the two arrow keys that motivated it, not the
    full class. Home, End, PageUp and PageDown are the same class: browser
    defaults that scroll the whole page, with nothing in the game reading
    any of them. Confirmed live at the same short viewport (390×500) with a
    canvas that already had real focus: each of the four moved
    `window.scrollY` during ordinary play, no collision or restart
    involved (End 0→25, PageDown 0→27, and Home/PageUp confirmed from a
    scrolled position, 30→4 and 30→7). Fixed by widening the same
    unconditional check to all eight keys; verified movement and the
    Space hue-toggle still fire normally, and the console stayed clean
    throughout.
    [`212b0b5`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/212b0b5)

17. **A shared `dragging` flag let one pointer end another's drag.** The
    drag logic used a single boolean set on `pointerdown` and cleared on
    `pointerup`/`pointercancel` --- fine for a mouse, but on a touchscreen
    an incidental second touch (a palm edge, a bracing finger) releasing
    off the canvas cleared that same flag regardless of which pointer it
    belonged to, silently stopping the first pointer's still-held drag
    from tracking any further movement. Confirmed live with a temporary
    debug hook and two independent synthetic pointer identities: pointer A
    dragged correctly, pointer B touched down and lifted elsewhere on the
    canvas, and pointer A's next move was then dropped even though it had
    never been released. Fixed by tracking the drag by `pointerId`
    (`draggingPointerId`) instead of a bare flag, so only the pointer that
    started the drag can move or end it --- verified the fix also lets a
    second pointer still tap the swap button mid-drag without disturbing
    the first pointer's drag, and the console stayed clean throughout.
    [`24abb55`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/24abb55)

18. **`touch-action: none` stops gestures, not iOS's own long-press
    callout.** The canvas already suppressed pan/zoom and the tap
    highlight, but nothing addressed Safari's separate long-press
    behaviour --- a context-menu/copy callout and a text-selection
    magnifier, triggered independently of `touch-action`. That matters
    specifically here because the drag mechanic *is* a sustained
    touch-hold on this exact element, so an uncontrolled callout is a real
    risk of interrupting play mid-drag on iOS, not a cosmetic nicety.
    Confirmed via MDN and current web search that `-webkit-touch-callout`
    is the correct, separate property for this (not `touch-action`), and
    that pairing it with `-webkit-user-select`/`user-select: none` is the
    documented fix shape. The actual callout/magnifier stays unverifiable
    in this sandbox --- no real iOS host to trigger it on, the same
    `xcrun simctl` gap that's blocked every touch-emulation check this
    project has hit --- so this is a pre-emptive fix grounded in
    documented platform behaviour, confirmed only by `getComputedStyle`
    showing `user-select: none` applied and scoped to `#game` alone, with
    the console staying clean.
    [`e9b35f8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/e9b35f8)

## Before you ship

Locally: `pnpm check` green (typecheck, build, 21 tests across the
invariants and `spec/crit-5.test.ts`), a real `pnpm preview` played through
at both marking viewports with the console clean, a fresh axe-core sweep
(`agent-browser a11y`) at zero violations, `html-validate` clean except the
template's own expected doctype/void-style non-issues, a live keyboard
tab-order walk (nav link → canvas, both with a visible default outline),
and a real play-through by eye (not just the scripted bot) confirming the
two hues, the swap button's dashed hint, and the game-over/restart cycle
all read clearly.

A 200%-zoom check (WCAG 1.4.10) surfaced something worth recording rather
than fixing: forcing zoom via `documentElement.style.zoom` desyncs the
canvas's pixel buffer from its rendered box (the buffer is only recomputed
on a `resize` event), squashing every circle into an ellipse. Investigated
before treating it as a bug: real desktop browser zoom resizes the layout
viewport and does fire `resize`, which the app already handles correctly
(confirmed round circles at both marking viewports under normal use);
real mobile pinch-zoom never resizes the layout viewport at all, so
`getBoundingClientRect()` wouldn't change either. Neither real zoom
mechanism can reach this state --- it's an artifact of the `style.zoom`
testing technique itself, not a defect a real visitor could hit.

Not yet done: the reflection, the final read-through against the published
spec, and shipping. This is a build-phase run, not the last one.
