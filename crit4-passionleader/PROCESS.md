# Process overview

## What I built

Chord Session is a browser instrument for improvising a chord progression:
press a pad, hear a live Web Audio chord, and get six new suggested next
chords built from real voice-leading and functional-harmony rules, then
optionally play the whole progression back with a synchronised bass line and
drum pattern.

## The moments that mattered

The idea started in Korean, as something closer to "a tiny Logic Pro in the
browser" than a chord-pad demo. I could picture the interaction — pads, a
transport bar, a groove — far more clearly than I could describe it in
English, and prompting straight from that picture produced vague, generic
requests like "make it feel musical," which isn't something an agent can act
on. So instead of prompting from the idea directly, I wrote it down as rough
notes first, then used Codex to turn those notes into a focused `Plan.md` and
a project-specific `CLAUDE.md` harness: explicit scope boundaries, an audio
contract (one shared `AudioContext`, live synthesis only, tempo kept in one
place), and a phased extension path. That translation step is what let Claude
start from constraints instead of a mood. Both files land in
[`b6dcb34`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-passionleader/commit/b6dcb34ebbd2ed5092418cc54bc7cc3e1f5a7e13),
alongside the first playable core: pads, a curated chord set, and next-chord
suggestions.

That harness's job was deliberately narrowing. `Plan.md`'s "not in the first
version" list — drums, editable rhythms, tempo, arpeggios, save slots — kept
the first commit small enough to actually finish and test, while
`CLAUDE.md`'s extension-path section argued for keeping chord data, audio
scheduling, and DOM rendering decoupled specifically so those cut features
could be added later without a rewrite. That bet paid off directly:
[`91437de`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-passionleader/commit/91437de399b76168f199c874edcb9280e6ee3a4e)
reopens exactly those deferred items once the core was solid, and
[`a3eb94f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-passionleader/commit/a3eb94f4946fbe39aea4b08e8e69fe4561a2848a)
builds them on the same audio engine and state modules from the first commit,
not new ones.

"Make it sound musical" stayed too vague to act on until I stopped saying it
and named what "musical" actually meant technically: chord choices ranked by
real functional-harmony scoring, and voices that lead smoothly between chords
instead of jumping registers —
[`9ed006d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-passionleader/commit/9ed006df3276ec614de30633550cc682ca961bf7).
The other half of "musical" I could only judge by ear and by eye. I kept the
dev server running and pressed pads myself rather than trusting a description
of what the code should do, and that habit is what caught two real mistakes
no test would have flagged. First, the original near-black interface simply
read as gloomy once it was actually on screen, which is what
[`91437de`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-passionleader/commit/91437de399b76168f199c874edcb9280e6ee3a4e)
pivots away from, moving to the vivid glass-panel design recorded in
`CLAUDE.md` and `Plan.md`. Second, the new Stop button was first styled
identically to the destructive, red "Clear" button; looking at the rendered
page made it obvious that pairing them implied Stop was as dangerous as
erasing the whole progression, when it is fully reversible — fixed in the same
[`a3eb94f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-passionleader/commit/a3eb94f4946fbe39aea4b08e8e69fe4561a2848a)
commit that added the button. Both corrections came from looking at the
actual interface, not from re-reading the code that produced it.
