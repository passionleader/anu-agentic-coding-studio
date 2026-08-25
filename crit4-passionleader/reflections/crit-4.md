# Crit 4 reflection

**What was the breakthrough that moved the work forward?**

The breakthrough was refusing to prompt straight from the mental image. I had
an ambitious picture in my head — a tiny Logic Pro in the browser — but it
started as a Korean idea, and translating that picture directly into an
English prompt kept producing vague results, because I was describing a
feeling, not a contract. Writing rough notes first, then using Codex to turn
them into a focused `Plan.md` and a project-specific `CLAUDE.md`, gave Claude
something to actually build against: a small, explicitly scoped playable
core, plus a named list of what was deliberately deferred. That constraint is
what let a first version exist at all, and what made the later additions
safe, since the harness had already planned where they would attach.

**What did this change about who I want to be as a developer?**

It sharpened how much of "musical" is not delegable. An agent can wire up a
dropdown or a Stop button on request, but whether a chord voicing actually
sounds smooth, or whether a Stop button *should* look as alarming as a
destructive Clear button, I only found by running the thing and listening or
looking, not by reading a diff. I also chose live Web Audio synthesis over
recorded samples, which keeps every sound genuinely generated in the browser
but leaves the instruments thinner than the real thing — a trade made on
purpose. This was harder than my earlier web work because there was no
reference screenshot or track to match against; every judgement was mine to
make. Next time, I want small automated tests for concrete behaviours —
transport timing, rhythm selection, stop behaviour, state changes — instead
of relying on visual review alone.
