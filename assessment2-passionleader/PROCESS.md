# Process overview

Written by you, for a reader: how you got from the brief to the harness and
agentic workflow behind this submission. Markers read this file and follow its
citations; they don't trawl the repo for evidence you didn't point at.

This file is the shape; the course site's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
is the requirement, and its
[word counts](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#word-counts)
cover every deliverable.

## What I built

SLOP2950 "Weaponised Etiquette" is a fictional twelve-week course that treats
public-etiquette violations as an academic discipline: watch a norm, isolate
the deliberate act that breaks it, describe precisely what happens next. The
topic follows a premise about what a good course is: satirise something no
real degree teaches while staying genuinely useful — manners are learned,
vary by culture, and where the line sits is subjective, yet no class
covers it. I
wanted the voice to read as a straight-faced, over-evaluated university
course rather than a literal list of "how to annoy people," so tone was a
first-class constraint from the first commit
([`aa41a59`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/aa41a59377219e7087f4392ff5280415a3ba58d0),
[`85b99c2`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/85b99c27535a50c807cf9e05375df1cdb8bdf829)).

## What a good course looks like

A good course commits to one throughline instead of listing topics — the
reason every week studies the same isolate-the-act method rather than a
grab-bag of "manners" trivia. I encoded that as a `CLAUDE.md` rule
(analytical, cataloguing voice, no second-person instructions;
[`63fdb0a`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/63fdb0a5b9e44fa6bf2f0c5363fe898f769ed21c))
and as a machine check, `spec/course-promises.test.ts`, verifying promises a
syllabus makes that a build can't — weights summing to 100, every teacher
resolving, every lecture's `slides` pointing at a real deck
([`eb77930`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/eb779306d72ff0dc3c7f67d5fc0f42d270d048b4)).
What I left uncoded on purpose: forcing every week into a physical-space
label — littering and queueing are commons behaviours with no fixed venue,
and a field would have manufactured a fake distinction
([`851fff2`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/851fff2f6a2f2996070d50860360d5429a4c6748)).

## The breakthrough: a harness that has to look, not just pass

The real turning point was a harness rule, not a feature: role-scoped agents
modelled on a small team — design-assets, ux, qa, teaching-a, teaching-b —
with `qa` told specifically to open the rendered page with headless Chrome
and read it, not just trust `pnpm check`
([`6eb0523`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/6eb0523ad87a3e18e15d2389581510bd08822e70),
[`63fdb0a`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/63fdb0a5b9e44fa6bf2f0c5363fe898f769ed21c)).
That caught a duplicated "Week N:" title that had shipped to all twelve
lecture pages, invisible to every typecheck/build/test run, until a
screenshot pass looked at the `<h1>`
([`0208664`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/0208664131d233404f3a491e5bd930b1cc28e60e)).

What the harness didn't save was time: coordinating five roles through
revision rounds ran mostly sequentially, for more tokens than one continuing
session doing the same change. What worked afterward was narrower: build one
sample end-to-end, show it to me, let me pick a direction, then roll the
rest out in that style — the Week 3 elevator slide went first
([`df8a346`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/df8a346ae8ab7e18247fddd9104c0dc88141ef44),
[`1b36245`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/1b36245bc3eb59211334e64afc9fa971dbaa78d9),
[`e13cc1c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/e13cc1c75e027505fea6aa8d8f5f2923d6427aca)).
The same discipline shaped content: tutorial "record your reaction" prompts
are grounded in how people actually describe these moments, not an invented
scenario
([`557f3a5`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/557f3a53f1b5a5b1f3a42c1e35245f89ead17359)).

## Design and imagery

Slide layout follows two ANU courses I've sat in — Computer Architecture and
HCI — rather than a style designed from scratch; it happened to converge on
the Agentic Coding Studio site's own look, unprompted
([`85feec7`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/85feec7ec4544717bbc9fa4463394b9e0872f4c0)).
Deck imagery moved from generated vector art to real, attributed stock
photography once vector art stopped carrying a convincing before/after beat
([`df8a346`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/df8a346ae8ab7e18247fddd9104c0dc88141ef44)–[`e13cc1c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/e13cc1c75e027505fea6aa8d8f5f2923d6427aca)).

## Calibrating exaggeration: naming the violation

The first pass at all nine Bad/Good manner slides was accurate but flat —
a cough described as "somewhat inconsiderate" reads as a note, not a
satire. What moved it was one instruction: stop describing the behaviour
and name it, the way an over-evaluated field names things — Exhibitionist
Viral Projection, Unsolicited Ambient Broadcast, each pattern attributed to
a fictional Slop University lab that treats cataloguing rude behaviour as
a serious research programme
([`c6a6e4c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/c6a6e4c7f5bbae5ec9801e7ca4a33dd5be56b91b)).
The same treatment carried into lecture pages — week 4 earns a full,
straight-faced "Learning Objectives" section that ends on "None will stop
shushing." — and into teaching-team bios, kept to text only, no photo
changes: Emeka Osei's "Pile-Up Coefficient" needed the same deadpan
overclaiming as the slides it's drawn from
([`ffa9056`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/ffa905637e137c155eecdb148e99f226f4cccd3c)).
A puppeteer-core screenshot pass, added this round specifically so the
harness could compare rendered pages against the previously-deployed site
rather than trust `pnpm check` alone
([`dc2b602`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/dc2b602adfbfe9c3818782c36e30af7034539a1e)),
caught two real bugs along the way: slide images with no size constraint
overflowing onto the surrounding text, and a photo credit that CommonMark
was silently folding into the same paragraph as its image and clipping —
both fixed in the deck theme, not the content
([`fd44dc8`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/fd44dc84292dd10798aca608223877516e8497c4)).

## Reflection

**What was the breakthrough that moved the work forward?** Not a tool, a
constraint: forcing `qa` to look at the rendered screenshot instead of the
check output is what caught the duplicated-title bug that no automated pass
would have flagged
([`0208664`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/0208664131d233404f3a491e5bd930b1cc28e60e)).

**What did this change about who I want to be as a developer?** I started
this wanting to hand a whole course off to a "team" and check in at the end.
I came out of it wanting to run that team the way a PM would: deciding per
task whether the work needs five roles debating it, or one continuing
session showing me drafts to react to — and the same judgment call applies
to content, not just process: whether a "manner" example is actually
believable is still mine to make, not the model's.

**Exaggeration doesn't generate itself.** The first pass at every Bad/Good
pair was accurate, not funny — competent case studies, not satire. Getting
to the coined-term, deadpan-academic version
([`c6a6e4c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/c6a6e4c7f5bbae5ec9801e7ca4a33dd5be56b91b),
[`ffa9056`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-passionleader/commit/ffa905637e137c155eecdb148e99f226f4cccd3c))
took an explicit instruction to push toward exaggeration and mock-academic
framing — left to its own judgment, the model reached for restraint over
the extremity satire actually needs. That was a small disappointment: I'd
expected exaggeration to be something the model would supply on its own,
and instead it needed to be named and demanded, the same way the tone rule
itself did earlier. The payoff is that the result now sits closer to the
brief's own target than the first pass did — content dense enough to look
demanding while teaching nothing that couldn't be said in one sentence —
which is, fittingly, exactly the kind of course Slop University would
open.
