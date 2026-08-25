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
