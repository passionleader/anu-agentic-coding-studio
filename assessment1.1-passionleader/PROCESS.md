# Process overview

I built an interactive weather and atmosphere simulator that lets users explore
temperature, pressure, wind, clouds, and terrain through a layered Canvas
visualisation. It grew out of an earlier thermal-convection prototype that I
deliberately set aside once a better idea was working. My process was shaped
by one repeated question: did the simulation merely look plausible, or did its
behaviour make physical and interactive sense?

## The moments that mattered

**Architecture before implementation.** Before asking Claude to write anything,
I picked vanilla JavaScript, HTML5 Canvas, and Tailwind CSS over a framework,
and specified a three-module boundary (`simulation.js` -> `ui.js` -> `app.js`)
so the physics could be tested without a browser. Instead of trusting that the
boundary would hold once Claude started iterating, I had it write
`spec/simulation.test.ts` in the same commit as the physics engine itself,
asserting that a lone heat source produces two symmetric circulation cells
rather than one lopsided loop. That test passing headlessly — not the canvas
merely looking right — is what told me the module boundary was real, not just
documented
([`f0e7eeb`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-passionleader/commit/f0e7eeb),
[`e3a5220`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-passionleader/commit/e3a5220)).

**The convection prototype stopped being interesting.** After several rounds of
tuning — buoyancy, wall collisions, circulation pairing, a full particle-to-grid
CFD rewrite — heat rose and cold sank correctly, but the experience still felt
narrow: I could confirm the physics by watching the render, yet there wasn't
much left to explore. Rather than keep patching a concept I'd already
validated, I changed the problem: with `effort: max`, I asked Claude to build a
weather simulator with coupled temperature/pressure fields, Coriolis rotation,
wind trails, clouds, isobars, and terrain, plus a headless test for each new
claim (source behaviour, pressure extrema, hemisphere-dependent rotation,
numerical stability at a risky slider corner). I verified it the way I'd
verified the convection sim — reading the rendered flow at both viewports, not
just the diff — before treating it as more than a demo
([`6696eb9`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-passionleader/commit/6696eb95100c05fac66d910a86a9802fbd191981)).

**Rolling back an overreaching fix.** An ambient-temperature bug — the slider's
hot/cold direction was inverted — came back from a first fix having grown into
a bigger rewrite than the bug needed, a change I hadn't asked for. Rather than
layer another prompt on top of it, I rolled the change back and re-specified
the exact behaviour I wanted at each slider extreme (leftmost = -10°C blue
room, rightmost = 40°C red room). That respecification is what actually
surfaced the real remaining bug: airflow rose when it should have sunk. I
confirmed the corrected version by dragging the slider to both extremes and
checking the airflow direction matched, not by reading the new diff and
assuming it was fine
([`e7817be...2cff3bf`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-passionleader/compare/e7817be...2cff3bf)).

**Owning that this started outside the graded scope.** The commit that
introduced the weather simulator says, in its own message, that it was "kept
out of the graded convection simulator entirely" — at the time I was treating
it as a side experiment, not a submission candidate. Once it turned out to be
the stronger result, I didn't quietly rewrite that history: I decided
explicitly that it should become the actual deliverable, rewrote `CLAUDE.md` to
say so, tagged the old convection state as `convection-simulator` so it stays
reachable, and only fast-forwarded `main` onto the weather branch once
`pnpm check` and `pnpm check:evidence` were green on it
([`b237438...9a6cdfe`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-passionleader/compare/b237438...9a6cdfe)).
