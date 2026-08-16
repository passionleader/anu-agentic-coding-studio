# Assignment 1 Reflection

The breakthrough was realising that the convection simulator was not engaging
enough as an experience. I had spent time checking whether the flow was
physically convincing: whether heat rose, whether cold sank, whether a central
heat source produced circulation, and whether the direction of the flow made
sense. However, the result still felt too narrow. Instead of continuing to
ask Claude for small visual adjustments, I changed the concept and asked for a
weather and atmosphere simulator with temperature, pressure, wind, clouds, and
terrain. I increased Claude's effort setting to maximum and delegated the large
implementation after defining the behaviour I wanted. The resulting simulator
added coupled fields, Coriolis rotation, wind trails, pressure contours, and a
test suite for the important physical relationships.

This work changed how I want to be as a software developer. Giving an agent
more authority does not remove my responsibility: I still need to know what
the product should communicate, which behaviours are physically meaningful,
and which changes are outside the requested scope. Harnessing is also more
effective than repeating warnings in individual prompts — my first
`CLAUDE.md`, drafted with help from Gemini, gave Claude a useful set of
constraints from the start. Going forward I want to update that harness as the
product changes, use branches for risky experiments, and keep changes easy to
reverse — acting more like a manager who sets direction and acceptance
criteria than one who writes every line.

I also want to be honest about how this happened: the weather simulator
started as a side experiment I explicitly kept out of grading, and I only
later decided it was the stronger submission. I'd rather own that than let
the history blur.
