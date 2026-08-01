# Process overview

A reading-guide to how the work came together --- a map to your process, not an
essay about it. Markers read this file and follow its citations; they don't
trawl the repo for evidence you didn't point at, so if a moment mattered, cite
it.

This file is the shape; the course site's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
is the requirement, and each brief adds its own word count and moment count.

## What I built

**YooHoo!** --- a fake, static, 90s-Yahoo-style web portal, built with no
JavaScript per this week's spec. It has a homepage with search and a
directory, a News section with real (fake) articles, a Mail section with
login, inbox, compose, and sent mail, and a Clubs listing. The idea was to
mimic what a late-90s portal site actually felt like to use, not just its
look --- every link goes somewhere real, and the "fake" content is written
well enough to hold together as a plausible site rather than as placeholder
text.

## The moments that mattered

1. **Asking for a themed portal, not just "more than one page".** The spec
   requires more than one page reachable from home. The obvious move was two
   or three near-empty pages to satisfy that mechanically. Instead I asked
   Claude Code to build a full 90s Yahoo-style portal (I named it YooHoo!)
   with real navigation, search, and a directory, so the pages held together
   as one site with a reason to click between them. I knew it was right when
   `pnpm check`'s reachability-graph test passed and the homepage actually
   looked and behaved like a small portal, not a spec checklist, in a
   headless-Chrome screenshot at both required viewports.
   ([`a11874d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit1-passionleader/commit/a11874d))

2. **Fixing what "looked broken" --- dead links, an empty inbox, a Home
   button that did nothing.** I told Claude Code: *"in main page, 'home'
   button doesn't work... in news page, there are some news but there's no
   contents... 'mail' looks rubbish."* Rather than patching those one at a
   time with placeholder fixes, I asked for genuinely written fake news
   articles (7 of them) and a fake sent/inbox message history, so the site
   felt lived-in. Re-running the spec caught a page I'd only linked from a
   search form and not a real `<a href>` --- the reachability test flagged it
   immediately, which is how I knew the fix was actually complete rather than
   just visually plausible.
   ([`a11874d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit1-passionleader/commit/a11874d))

3. **Trying to make "Sent mail" really persist, and hitting the no-JS wall
   on purpose.** I asked for a login function and for sending mail to
   actually record itself on a Sent page. Rather than quietly faking that
   with something that looked like it worked, I checked whether it was even
   possible under this week's constraint --- it isn't: no JavaScript and no
   backend means there's no way to capture typed input and redisplay it on
   another static page. `spec/crit-1.test.ts` enforces zero `<script>` tags
   and no `.js` files, which is what made the constraint concrete instead of
   a guess. So the Sent page is an honestly-labelled static mockup instead of
   an illusion of a working feature.
   ([`7362f10`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit1-passionleader/commit/7362f10),
   [`a11874d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit1-passionleader/commit/a11874d))
