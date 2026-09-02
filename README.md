# ANU Agentic Coding Studio — passionleader

Personal archive of static-site prototypes built for COMP4020 (Agentic Coding
Studio) at ANU. Each `crit*-passionleader/`/`assessment*-passionleader/`
directory is a full copy of that week's course repo, subtree-merged in with
its original commit history intact. All of them are deployed live from this
repo via a single GitHub Actions workflow (`.github/workflows/pages.yml`).
> This project is supported and processed by ANU School of Computing, COMP4020 course.
> ClaudeCode is used for this project.

## Crit 1 — the forgotten web

Topic: recreate a piece of the pre-modern web. [`crit1-passionleader/`](crit1-passionleader)
is **YooHoo!**, a fake, static, 90s-Yahoo-style web portal built with no
JavaScript at all — a homepage with search and a directory, a News section,
a Mail section (login, inbox, compose, sent), and a Clubs listing.

**Live:** https://passionleader.github.io/anu-agentic-coding-studio/crit1-passionleader/

## Crit 2 — unsolicited redesign

Topic: redesign a real, existing website nobody asked you to touch.
[`crit2-passionleader/`](crit2-passionleader) is an unsolicited redesign of
[7-zip.org](https://www.7-zip.org/) built with Astro — a home page with an
OS-aware download CTA, a download page organised by platform, an FAQ with
native accordions, and the rest of the original site's pages, restyled while
keeping 7-Zip's own visual identity.

**Live:** https://passionleader.github.io/anu-agentic-coding-studio/crit2-passionleader/

## Assessment 1 — thermal convection & airflow simulator

Topic: an interactive explainer for thermal convection. [assessment1-passionleader/](https://github.com/passionleader/anu-agentic-coding-studio/blob/main/assessment1-passionleader) is a vanilla JavaScript, HTML5 Canvas 2D, and Tailwind CSS simulator backed by a grid-based semi-Lagrangian CFD solver using the Boussinesq approximation. Users can place heat and cold sources, draw wall obstacles, adjust source power, ambient temperature, and eddy viscosity, and observe the resulting velocity field through tracer streaks and a thermal heatmap. The project also includes preset scenes, fullscreen mode, and a linked `physics.html` page explaining the solver and its mathematical assumptions.

Development note: This was my initial direction for the assignment. After evaluating the prototype, I decided that the convection concept felt too narrow, which led me to develop the separate weather and atmosphere simulator in `assessment1.1-passionleader/`.

**Live:** https://passionleader.github.io/anu-agentic-coding-studio/assessment1-passionleader/

## Assessment 1.1 — weather & atmosphere simulator

Topic: an interactive explainer for atmospheric weather systems. [assessment1.1-passionleader/](https://github.com/passionleader/anu-agentic-coding-studio/blob/main/assessment1.1-passionleader) is a separate weather simulation project that couples temperature and atmospheric pressure fields with Coriolis rotation. Users can place warm and cool zones, add high- and low-pressure systems, adjust latitude, friction, and thermal-pressure coupling, and explore the resulting temperature field, pressure contours, clouds, terrain, and wind streamlines. The simulator includes a procedural coastline, H/L pressure markers, animated wind trails, responsive controls, and a linked `weather-physics.html` page explaining the numerical model and physical assumptions.

Development note: This project grew out of the initial convection simulator. After deciding that the first concept was not engaging enough, I changed direction and explored a broader weather and atmosphere simulation instead.

**Live:** https://passionleader.github.io/anu-agentic-coding-studio/assessment1.1-passionleader/weather.html

## Crit 4 — an instrument

Topic: build a playable instrument in the browser.
[`crit4-passionleader/`](crit4-passionleader) is **Chord Session**, a live
Web Audio chord instrument — press a chord pad to hear it, get six
next-chord suggestions ranked by real voice-leading and functional-harmony
rules, then play the whole progression back with a synchronised bass line
and drum pattern, all mouse/keyboard/touch playable.

**Live:** https://passionleader.github.io/anu-agentic-coding-studio/crit4-passionleader/

## Crit 5 — a game

Topic: build a tiny browser game with one obvious mechanic and no tutorial.
[`crit5-passionleader/`](crit5-passionleader) is **Retro Run & Gun**, a SEGA
*Wonder Boy*-inspired side-scrolling run-and-gun: a chibi cat with 3 lives
pushes right through 3 stages of 5 maps each, fighting slimes with a
boomerang (upgraded to a one-shot-kill gun on pickup), collecting fruit for
score, and facing a boss at the end of every stage. Every sprite, background
layer, weapon, sound effect, and the BGM is hand-authored for this project
(Python/Pillow, Python's `wave` module, and **Logic Pro** for the music).

**Live:** https://passionleader.github.io/anu-agentic-coding-studio/crit5-passionleader/

## Riff 5 — take someone else's prototype somewhere it hasn't been

Topic: COMP4020's "riff" exercise — the course hands each pod member an
untouched copy of a teammate's shipped crit-5 game and half an hour to push
it somewhere its own author wouldn't have risked in graded work. Our pod's
starting point was a two-hue falling-circle dodge game: a player circle
switches between two hues, same-hue obstacles pass through safely, and a
mismatched hue ends the run.

[`riff5-passionleader/original/`](riff5-passionleader/original) is that
starting point, mirrored with full history and left completely unmodified —
**the base game here is exactly the source ANU's COMP4020 course provisioned
for the riff exercise, with nothing changed.**
[`riff5-passionleader/modified/`](riff5-passionleader/modified) is what the
pod agreed to build on top of it after discussing what direction to take it:
falling banana/poop pickups themed as a monkey catching fruit, a heart-based
lives system with a heart-icon HUD, a rare high-value bonus ball, hand-picked
BGM/SFX, and a Twemoji sprite reskin — implemented and committed by me as the
pod's representative.

**Live (original):** https://passionleader.github.io/anu-agentic-coding-studio/riff5-passionleader/original/
**Live (modified):** https://passionleader.github.io/anu-agentic-coding-studio/riff5-passionleader/modified/
