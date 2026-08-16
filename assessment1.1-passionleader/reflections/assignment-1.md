# Assignment 1 Reflection

The breakthrough was realising the convection simulator was not engaging
enough as an experience. I had checked whether the flow was physically
convincing: whether heat rose, cold sank, and a central source produced
correct circulation. However, the result felt too narrow — a room, not a
world. What pulled me toward weather was mimicking real forecast
maps I use, like MSN Weather's wind-flow view over Canberra — pressure,
temperature, and moving air shown together, a richer version of what I was
already simulating. Instead of asking Claude for small
visual adjustments, I changed the concept and asked for a weather and
atmosphere simulator with temperature, pressure, wind, clouds, and terrain. I
raised Claude's effort to maximum and delegated implementation after
defining the behaviour I wanted. The resulting simulator added coupled
fields, Coriolis rotation, wind trails, pressure contours, and a test suite
for the physical relationships that mattered.

This work changed how I want to be as a software developer. Giving an agent
more authority does not remove my responsibility to know what the product
should communicate, which behaviours are physically meaningful, and which
changes are outside scope. Harnessing is also more effective than repeating
warnings in individual prompts — my first `CLAUDE.md`, drafted with help
from Gemini, gave Claude a useful set of constraints from the start. Going
forward I want to keep updating that harness, use branches for risky
experiments, and keep changes reversible — acting more like a manager who
sets direction than one who writes every line.

I also want to be honest about how this happened: the weather simulator
started as a side experiment I explicitly kept out of grading, and I only
later decided it was the stronger submission. I'd rather own that than let
the history blur.
