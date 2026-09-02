# A game

The breakthrough wasn't a single fix; it was noticing that a clean sensor
battery and "nothing left to find" are different claims. Two-Tone's first
build passed `pnpm check`, axe-core, html-validate and Lighthouse within a
day, and it would have been easy to call that finished. It wasn't: over the
following two weeks, re-reading the brief's own sentences one clause at a
time against the live code --- not running another tool --- kept turning up
real bugs no automated check could see, because they were claims about
*behaviour under a specific interaction*, not structure or a score. A
`keydown` handler that restarted the round on any key, including the
browser's own auto-repeat, silently wiped the game-over screen before a
player who died mid-move ever saw it. A shared `dragging` boolean, fine for
a single mouse, leaked across an unrelated second touch. A resize handler
that only forgot to run cheap the closer I looked. Each fix opened a fresh
clause worth re-deriving in turn, because the fix was new code the brief
hadn't been checked against yet.

The swap-button placement bug --- found only by screenshotting the real
390x844 viewport, invisible from the code --- taught the same lesson from
the other direction: reading code proves it does what it says, not that
what it says is what a player needs.

What that changes about the developer I want to be: I now treat "the
checks are green" as the start of a different question, not the end of
one --- what has this build actually been tested *against*, and is there a
plain-language claim, in the brief or in my own code's comments, that
no tool has touched yet.
