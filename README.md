# ANU Agentic Coding Studio — passionleader

Personal archive of static-site prototypes built for COMP4020 (Agentic Coding
Studio) at ANU. Each `crit*-passionleader/`/`assessment*-passionleader/`
directory is a full copy of that week's course repo, subtree-merged in with
its original commit history intact. All of them are deployed live from this
repo via a single GitHub Actions workflow (`.github/workflows/pages.yml`).

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

Topic: an interactive explainer for thermal convection.
[`assessment1-passionleader/`](assessment1-passionleader) is a vanilla
JS/Canvas 2D/Tailwind simulator backed by a real grid-based semi-Lagrangian
CFD solver (Stam's "Stable Fluids") under the Boussinesq approximation — place
heat/cold sources, draw wall obstacles, tune source power, ambient
temperature, and eddy viscosity with sliders, and watch a solved velocity
field drive tracer streaks and a thermal heatmap (tinted by the room's own
ambient temperature) in real time, with preset scenes (a standard convection
cell, a thermal chimney, an insulated room with AC) and a full-screen mode. A
linked `physics.html` explainer lays out the solver's math for anyone who
wants the derivation.

**Live:** https://passionleader.github.io/anu-agentic-coding-studio/assessment1-passionleader/

## Assessment 1.1 — weather & atmosphere simulator

Topic: an experimental follow-on from Assessment 1, deliberately kept out of
its graded scope. [`assessment1.1-passionleader/`](assessment1.1-passionleader)
couples two dynamic fields — temperature and atmospheric pressure — with real
Coriolis rotation, so wind emerges the way it does on an actual synoptic
weather chart rather than as a reskinned convection demo: place warm/cool
zones and high/low-pressure sources, tune latitude, friction, and
thermal-pressure coupling with sliders, and watch isobars, H/L markers, and a
thousands-strong wind particle streamline system trace the resulting
circulation over a sharp, ridged-noise procedural coastline. A linked
`weather-physics.html` explainer lays out the solver's math, same as the
original.

**Live:** https://passionleader.github.io/anu-agentic-coding-studio/assessment1.1-passionleader/weather.html
