# MEMORY

Durable self-knowledge, curated run by run; ephemeral state belongs in
`now.md`, not here.

## Environment

- `agent-browser` needs Chrome installed once per environment
  (`agent-browser install`) and, in this sandboxed container, the Chrome
  sandbox itself doesn't work — launches fail with "No usable sandbox!"
  unless `AGENT_BROWSER_ARGS="--no-sandbox"` is exported first. Command
  syntax is `agent-browser set viewport <w> <h>`, not `agent-browser
  viewport <w> <h>`. That `export` (like any env var) does not persist
  between separate Bash tool calls — only the working directory does —
  so it has to be set inline in the same command string as the
  `agent-browser` calls that need it, every time, not as a one-off prior
  command.
- `mise install` refuses to run against an untrusted `config.local.toml`
  the first time in a fresh environment — run `mise trust
  <path-to-config.local.toml>` once, then install proceeds normally.
- In this sandboxed container any pnpm command that triggers a deps
  reconciliation (`check`, `install`, `preview`, `dev`) can abort with
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` (it wants to confirm
  purging `node_modules` interactively and there's no TTY). Prefix with
  `CI=true` — `CI=true pnpm preview` — rather than investigating further.
- The installed `agent-browser` has grown two native commands beyond what
  earlier entries below assume: `agent-browser a11y [url] --json` runs
  axe-core directly (no more need for the CDN-injection dance described
  further down), and `agent-browser vitals [url] --json` reports Core Web
  Vitals (LCP/CLS/TTFB/FCP/INP) plus React hydration info. Confirmed
  working on assignment-1 (2026-08-14): `a11y` matched the earlier
  CDN-injected sweep's 0-violations result at both marking viewports, and
  `vitals` gave a genuinely new signal (CLS score) the manual
  `performance.getEntriesByType` snippet never captured. Prefer these
  native commands over the manual techniques logged below when starting a
  fresh a11y/perf pass; the manual entries stay as fallback in case a
  future environment lacks them. `inp` came back `null` even after a real
  keyboard-driven interaction sequence (`focus` + `press`) — plausibly the
  synthetic/CDP interaction path doesn't feed the INP buffer; not worth
  chasing further for a single-page static site.
- `agent-browser -p ios ...` (the touch-emulation provider) fails outright in
  this sandboxed container: `xcrun simctl` isn't present, since the iOS
  simulator needs an actual macOS/Xcode host. Confirmed directly
  (`agent-browser -p ios device list` → "No such file or directory"), not
  inferred — don't spend a future run's budget retrying touch-specific
  emulation here expecting a different result; it needs a different host
  entirely. Plain `agent-browser set device "<name>"` (e.g. `"iPhone 14"`,
  no `-p ios`) doesn't fill this gap either — confirmed on crit-4
  (2026-08-19): after setting the device, `navigator.maxTouchPoints` still
  read `0` and a `click` on a real touch-sized target went through the
  ordinary mouse pointerdown/up path, not a touch path. Device-mode viewport
  emulation changes screen size only, not `hasTouch`; genuine multi-touch
  (e.g. a two-finger chord on a touch instrument) stays untestable here by
  any means found so far — mouse- and keyboard-driven interaction are what
  this environment can actually verify. `agent-browser network` also still
  has no request-delay/throttle
  primitive (only `route --abort`/`--body`), confirmed again on assignment-1,
  so a true slow-connection test remains out of reach without extra tooling
  beyond the CLI.
- `agent-browser press <key> --hold <ms>` does not reliably sustain the key
  down for the requested duration in this sandboxed container — confirmed on
  crit-4 (2026-08-19): a background `press d --hold 2000` followed by a
  mid-hold `eval` reading `document.activeElement`/a DOM state flag always
  saw the released state, as if the hold hadn't happened, even though the
  same page's own `keydown`/`keyup` listeners were verified correct by other
  means. Don't trust `--hold` to prove or disprove a press-and-sustain
  interaction (a synth pad held for a chord, a game key held to move). The
  reliable way to test real sustain: `agent-browser eval
  "document.dispatchEvent(new KeyboardEvent('keydown', {key: 'x', bubbles:
  true}))"`, do whatever mid-hold check is needed, then dispatch the matching
  `keyup` the same way — this actually held the key logically down between
  the two `eval` calls when `--hold` did not.
- `pnpm dlx lighthouse <url> --preset=desktop --chrome-flags="--headless
  --no-sandbox"` needs `CHROME_PATH` set explicitly in this sandboxed
  container — lighthouse's own `chrome-launcher` can't find a system Chrome
  (there isn't one), and fails with "The CHROME_PATH environment variable
  must be set" otherwise. Point it at the Chrome `agent-browser install`
  already put down:
  `CHROME_PATH=$(find ~/.agent-browser/browsers -maxdepth 1 -name 'chrome-*'
  | sort -V | tail -1)/chrome`. Also run it from inside the target repo, not
  `/tmp` or elsewhere — `pnpm dlx` needs `mise`'s per-directory pnpm version
  resolution, which fails with "No version is set for shim: pnpm" outside a
  directory that has one configured.
- `agent-browser set viewport <w> <h>` does not persist across a later
  `agent-browser open` in the same session — confirmed on crit-5
  (2026-08-27): set to 1920×1080, confirmed via `getBoundingClientRect()`,
  then a second `open` (navigating to a freshly rebuilt page) silently
  reverted `window.innerWidth`/`innerHeight` to a smaller default
  (1280×577), which in turn made a coordinate computed against the
  1920-wide layout land outside the real canvas and `elementFromPoint`
  return `null` — a real misclick, not a flake. Re-issue `set viewport`
  after every `open`/reload that follows an earlier one in the same
  session, not just once at the start.
- `pgrep -af "<pattern>"` run inline in a Bash tool call can match its own
  invocation's command-line string, not just the target process — a
  literal `pgrep -af "vite preview"` matches the shell wrapper that's
  currently executing the string `"vite preview"` as part of its own
  `eval`, printing a false-positive "still running" line even after the
  real target process was actually killed. Confirmed on crit-5
  (2026-08-31) trying to verify a `pnpm preview` server had shut down.
  Check a listening port instead (`ss -ltnp | grep <port>`) when
  confirming a server process is actually down, not a process-name grep.
  The same asymmetry cuts the other way for actually stopping one: on the
  final crit-5 run (2026-08-31), `pkill -f "vite preview --port <p>"`
  silently failed to stop a `pnpm preview`-spawned server even though the
  process was genuinely still listening afterwards (`ss -ltnp` confirmed
  it) — plausibly because the real process's visible cmdline, once
  wrapped through `pnpm`'s script runner, doesn't textually contain the
  literal script-line string being matched. `ss -ltnp | grep <port>` to
  get the real pid, then `kill <pid>` directly, worked immediately. Don't
  trust a bare `pkill -f "<script line>"` to have stopped a pnpm-spawned
  dev/preview server; get the pid from the port instead.

## Working patterns that held up

- The doctrine's "no JS" constraint recurs whenever a crit spec bans
  scripting but the aesthetic being chased (marquees, blinking, live
  counters) traditionally used it. CSS alone reproduces these
  convincingly — `@keyframes` + `translateX` for scrolling banners,
  `repeating-linear-gradient` for hazard stripes, styled `<span>` digits
  for a fake counter — and it's worth reaching for that before any
  deprecated tag (`<marquee>`, `<blink>`) even when the brief's own
  examples suggest them: deprecated markup renders inconsistently and
  isn't a foundation worth building six pages on.
- A retro site "logo" wants visually to be a big heading at the top of
  every page, but the spec's own invariant checks (and most sane a11y
  practice) expect exactly one `<h1>` per page — the page's actual
  content heading. Demote the logo to a styled `<p>` (e.g.
  `class="wordmark"`) rather than dropping the invariant or the content
  heading. This will recur any week a "signature banner" look is wanted.
- The instruction to never guess/generate URLs not directly in service of
  programming help extends naturally to in-repo content decisions, not
  just chat replies: an old-web "links/webring" page that would normally
  hyperlink out to museums/archives instead named institutions as plain
  text and only hyperlinked back into the site's own pages. Treat this as
  the default whenever a crit's content genuinely wants outbound links —
  plain-text citation over a guessed/unverifiable href.
- Commit granularity: one commit per page/concern (CSS+home together,
  then one commit per subsequent page) reads far better in the process
  evidence than one dump, even when all pages are authored in one
  sitting. Keep doing this.
- Run `pnpm check` before committing, not after — every stylelint/vitest
  fix this run happened pre-commit, so the commit history shows a
  consistently green state rather than a fix-up trail. `PROCESS.md`
  should say so honestly (no fabricated red→green commit pairs) rather
  than manufacture a broken-then-fixed diff that didn't happen.
- The template's `spec/README.md` is explicit that turning the week's own
  published spec into tests is the agent's work, not the template's — the
  shipped `invariants.test.ts` only covers site-agnostic basics. Check
  every run whether a crit-specific `spec/<crit>.test.ts` exists yet for
  the checkable lines a test actually can assert (e.g. "no JavaScript",
  "pages reachable from home"); if it's missing, writing it is a genuine,
  well-scoped deepening task, not scope creep.
- Before trusting a stale `now.md` claim like "not yet pushed," run
  `git fetch` and compare against `origin/main` directly — a prior run's
  note can lag what actually happened (this repo's C1 work turned out
  already pushed despite the note saying otherwise).
- To run a real accessibility check without adding a permanent
  dependency: serve `dist/` locally, open a page with `agent-browser`,
  and `agent-browser eval` a snippet that appends a `<script src="https://
  cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js">` and awaits
  its `onload`, then a second `eval` calling `axe.run().then(r =>
  JSON.stringify(r.violations...))`. Network access from the browser
  works fine in this sandboxed environment. This is a one-off audit, not
  the same thing as wiring axe-core as a permanent CI sensor (the
  template's `CLAUDE.md` explicitly leaves that as separate, later work)
  — reach for the CDN-injection version first when the question is just
  "does this page currently pass," and only add a real devDependency +
  test if the week's spec asks for a standing sensor.
- `PROCESS.md`'s "moments that mattered" needs to be re-read against
  `git log` every run, not just extended when new work happens — a prior
  run added a genuinely good commit (`spec/crit-1.test.ts`) but never
  updated `PROCESS.md` to cite it, so the reading-guide silently fell
  behind the history it's supposed to map. Check for this drift
  specifically: does every notable commit since the last `PROCESS.md`
  edit have a citation, not just the newest one.
- The crit-1 repo has an in-repo `agent/` directory (`agent/doctrine.md`,
  `agent/MEMORY.md`, `agent/now.md`) that mirrors this external memory
  system, committed under messages like "memory: tick snapshot
  <timestamp>" with author `Baishi <baishi@comp4020.anu.edu.au>` — the
  same identity this session commits as. Don't mistake these for a prior
  run's own edits, and never touch `agent/` directly: the doctrine is
  explicit that `agent/` is harness-owned, and the most consistent read
  is that a wrapper around the `claude --print` invocation (not the model)
  writes these snapshots after a run finishes. Only ever write to the
  real `memory/now.md` and `memory/MEMORY.md` outside the repo.
- The CDN-injected axe-core sweep (see the entry above) is worth re-running
  whenever a repo's markup changes, not filed away as "already ran once for
  this crit": on crit-2, a run that found the repo otherwise fully finished
  still ran it fresh and it caught a real `region` violation the prior run's
  own build never had checked — a `.hero` block (the page's actual lede
  content: address, hours, phone) sitting between `</header>` and `<main>`
  on the home page only, unlike every other page where the equivalent
  content already opened inside `<main>`. A single-page structural
  inconsistency like this is exactly the kind of thing that's invisible to
  `pnpm check` (no invariant asserts landmark coverage) and easy to miss by
  eye since the page still renders and reads fine — the tool is what caught
  it, not a prose re-read.
- When a deepening pass turns up nothing to change (checks all green, a
  close CSS re-scrutiny and a full line-by-line prose reread of every
  page find no defects), that is a legitimate outcome, not a failure to
  find work — record what was checked and move on rather than inventing
  cosmetic changes (e.g. a favicon, or editing the template's generic
  `README.md`) just to have a diff. Manufactured busywork reads worse in
  the process evidence than an honest "verified, nothing needed" note.
- `pnpm outdated` / `pnpm audit` is a genuinely different deepening angle
  from the prose/CSS/a11y passes already tried, but for a static-HTML
  crit that's already finished, don't chase it reflexively: `pnpm audit`
  coming back clean is worth a quick check every so often, but every
  entry `pnpm outdated` lists for this template (oxlint, @types/jsdom,
  @types/node, jsdom, typescript) is a *major* version bump, not a patch
  — bumping build tooling this far from cutoff carries real risk
  (frozen-lockfile CI install, a major TS version's stricter checks) for
  zero benefit to the deployed static site. Evaluating it and choosing
  not to bump is the legitimate outcome here, same as the CSS/prose
  passes finding nothing — don't manufacture a dependency-bump commit
  just to have touched something.
  **Update (assignment-1, 2026-08-12):** don't stop at "every `pnpm
  outdated` entry is major, so there's nothing safe to do" — that was true
  of the *pinned* deps but not of what's reachable through them. `pnpm
  audit` on this repo found 9 real vulnerabilities (4 high, 5 moderate) in
  transitive dev-tooling deps (`undici` via `jsdom`; `postcss`/`nanoid`/
  `js-yaml`/`fast-uri` via `stylelint`'s toolchain), and a plain `pnpm
  update` — which only moves versions *within* the ranges `package.json`
  already declares, touching no pin — bumped just `oxlint` and `vite` and
  cleared every one of them, `pnpm check` still green after. The two
  checks answer different questions: `pnpm outdated` tells you what's safe
  to *pin higher* (often nothing, near cutoff); `pnpm audit` plus a plain
  `pnpm update` tells you what's already fixable *without* touching a pin
  at all. Always try the in-range update first when audit finds something
  — it's categorically lower-risk than a major bump and may well clear the
  finding outright, as it did here. Written up as a `CLAUDE.md`
  entry + a genuine third `PROCESS.md` moment on assignment-1, which
  otherwise had only two — worth remembering that the assignment's own
  spec (unlike a crit's) explicitly wants three or four moments, not
  fewer, so a legitimate new finding like this is worth writing up as a
  moment even on a build that already reads as "finished."
- A performance/console spot-check is another distinct, legitimate
  deepening angle (separate from the a11y pass already done): serve
  `dist/` with `CI=true pnpm preview --port <p>`, then per page
  `agent-browser open` + `agent-browser console` (empty output = no
  errors) + `agent-browser eval
  "JSON.stringify(performance.getEntriesByType('navigation'/'resource')...)"`
  for load timing and transfer sizes. For a plain-HTML/CSS crit this is
  fast (~50ms DOMContentLoaded, ~2KB per page) and found nothing to fix.
  One artefact worth knowing about but *not* worth chasing: the browser's
  automatic `/favicon.ico` probe 404s because no favicon exists and none
  is linked in any `<head>` — this doesn't fail any check and isn't a
  broken link the site declares, so per the "don't manufacture busywork"
  lesson above, leave it rather than adding a favicon just to clear it.
- `agent-browser` has no print-media emulation (`set media` only takes
  dark/light/reduced-motion) — for a reader/print-view style proof-read,
  use `agent-browser read <url> --outline` (heading hierarchy only, good
  for spotting a missing/duplicate `<h1>` or skipped levels) and plain
  `agent-browser read <url>` (stripped-down reader-mode text extraction)
  instead. One gotcha: that extraction renders named HTML entities
  without their trailing semicolon in its markdown conversion
  (`&rsquos`, `&mdash`) even when the source has them correctly
  (`&rsquo;`, `&mdash;`) — always grep the actual `.html` source before
  treating a missing-semicolon entity as a real bug, it's very likely
  just the read tool's cosmetic rendering.
- `agent-browser screenshot`'s second positional argument is the
  destination *path*, not a flag slot — the full-page flag is
  `--full`/`-f`, not `--full-page`. Passing `--full-page` doesn't error;
  it's silently parsed as the path, so the screenshot writes to a
  literally-named `--full-page` file in the current directory instead of
  where you intended. `git status` caught this as a stray untracked file
  before it could be committed. Check the flag name before scripting
  screenshot loops.
- Before treating a both-viewport visual screenshot pass as a fresh
  deepening angle, check whatever scratch directory earlier runs used
  (e.g. `/tmp/shots/`, if that path recurs) for timestamped files first —
  this repo's crit-1 already had matching desktop/mobile screenshots of
  all six pages from two prior runs (2026-07-29, 2026-07-30) sitting in
  `/tmp/shots/`, meaning a run that tries this "new" angle without
  checking is just repeating work, not deepening. `now.md` and
  `PROCESS.md` don't record every check that was run (only what changed
  the site), so `/tmp` scratch artefacts are sometimes the only trace of
  a prior angle already tried.
- `pnpm dlx html-validate dist/*.html` is a genuinely distinct one-off
  deepening angle from the a11y/performance/CSS/prose passes above, but
  its default preset's `doctype-style` and `void-style` rules assume an
  older HTML-authoring convention (uppercase `<!DOCTYPE html>`, no
  self-closing void elements) that is the *opposite* of this template's
  already-consistent modern style (lowercase doctype, self-closing
  `<meta/>`/`<br/>`/`<hr/>`, matching Vite's own output). Don't treat
  those two rule categories as defects to fix — "adopting" them would
  make the markup less internally consistent, not more correct. Do
  check whether any *other* rule category fired (duplicate IDs, missing
  alts, invalid nesting) — that would be a real finding; on this repo
  none did, which is itself useful confirmation of structural soundness.
  It's still worth re-running per repo, not treated as "already checked
  once": on crit-2 the same tool caught a real `tel-non-breaking` finding
  (a phone number that could line-wrap mid-digit-group) that crit-1 never
  had a phone number to trigger — fixed with `&nbsp;` between the digit
  groups. On assignment-1, only the same two expected non-issue categories
  fired again and nothing else — third repo running with this exact
  clean-except-doctype/void-style pattern, and likewise a clean axe-core
  sweep (0 violations) on assignment-1's single page. Both are cheap enough
  to run fresh per repo rather than trust as "probably still clean."

- Real keyboard interaction testing is a distinct deepening angle from
  axe-core's static audit: `CI=true pnpm preview`, `agent-browser open`,
  then repeated `agent-browser press Tab` + `eval
  "document.activeElement..."` to read tag/text/href/outline off each
  focused element in turn. Checks two things static analysis can't: tab
  order actually matches visual/logical order, and every focused element
  gets a *visible* focus indicator (grep `styles.css` for `outline:
  none` resets first — if there are none, the browser's default
  `outline: auto` covers anything a custom `:focus-visible` rule
  doesn't). On crit-1 this held cleanly at both viewports with no
  console errors — reach for it once static a11y/HTML-validation tools
  are exhausted and there's still deepen-phase budget left.
- Two deepening angles distinct from the tab-order walk already logged above:
  (1) **resize mid-interaction** — set the interaction to a non-trivial state,
  then `agent-browser set viewport` straight to the other marking size
  *without reloading*, and check state/layout survive (no console errors, a
  screenshot at the new size still looks right). This is exactly what the
  assignment-1 spec's artefact HD band names ("holds up under... a resize
  mid-interaction"), and it's a real live check, not inferable from reading
  CSS. (2) **actual keyboard actuation of the control**, not just tab order —
  focus the element and send the real keys that operate it (`ArrowRight`,
  `Home`, `End` for a range input) and confirm the on-screen state tracks
  exactly as a pointer drag would. Tab-order/outline-visibility checks (see
  above) only prove the control is *reachable*; this proves it's *usable*.
  On assignment-1 both passed cleanly with a native `<input type="range">` —
  worth noting as a finding in itself: using the native control instead of a
  custom widget bought real keyboard support for free, with nothing to test
  against regressing since the browser guarantees it.
- `agent-browser screenshot <selector> <path>` (a positional selector before
  the path, not a flag) crops the screenshot to one element — use this to put
  two states of the same visual element side by side (e.g. a slider-driven
  drawing at stroke count 10 vs 16) when a full-page screenshot buries the
  comparison in unrelated page chrome. This is how assignment-1's over-
  elaboration phase (visibly denser leg-ticks and a faint duplicate outline
  from 11 strokes to 16) was actually compared against the sweet-spot phase,
  rather than eyeballed from two separate full-page captures.
- A `prefers-reduced-motion` CSS guard is worth observing live, not just
  reading in source: `agent-browser eval
  "getComputedStyle(document.querySelector(selector)).animationName"`
  before and after `agent-browser set media reduced-motion` (then `set
  media no-preference` to reset). Code review alone can't catch a typo'd
  media query or a selector that doesn't actually match the animated
  element — this closed that gap on crit-1's marquee (`scroll-left` →
  `none` under the emulated preference, confirmed live rather than
  assumed from the CSS).

- `pnpm dlx linkinator ./dist --silent` against a fresh `pnpm build` is the
  local equivalent of the CI links sensor (named in this repo's `CLAUDE.md`)
  and is a genuinely distinct check from `spec/crit-1.test.ts`'s reachability
  assertions — it's an actual crawl of the built HTML/asset graph rather than
  a DOM-string assertion. On crit-1 it scanned all 7 built files/assets with
  zero broken links. One quirk: `--silent` combined with `&&`-chaining after
  a separately-redirected `pnpm build` produced a bare exit-1 with no visible
  output in this sandbox — dropping `--silent` (or running build and
  linkinator as separate commands) showed the real, clean crawl output. Don't
  read a silent-flag exit code as a real failure without re-running verbose.

- To find an organisation's real subpage URLs without guessing (a guessed
  `/contact` on crit-2's `megalo.org` 404'd, the real path was `/contact-us`),
  open the live site with `agent-browser` and `eval` a snippet enumerating
  every `<a>`'s `href` + text from the actual DOM
  (`Array.from(document.querySelectorAll('a')).map(a => a.href + ' | ' +
  a.textContent.trim())`), then read the real path off the result. This is
  mechanical discovery from the source, not a second guess.
- A verified real street address fed into OpenStreetMap's own
  `/search?query=<address>` endpoint (e.g.
  `https://www.openstreetmap.org/search?query=21+Wentworth+Avenue%2C+Kingston+ACT+2604`)
  is a legitimate wayfinding link, distinct from the "never guess a URL"
  constraint — it's built from data already verified against the real
  organisation's own site, through OSM's real, standard search route, not a
  fabricated destination.
- `stylelint`'s `no-descending-specificity` fires when a later-declared
  selector has lower specificity than an earlier one it doesn't share an
  ancestor with (e.g. `.tier ul` declared before `nav[aria-label="Primary"]
  ul`, or `.footer-social a` before `nav[aria-label="Primary"] a`). The fix
  that scales as a stylesheet grows is giving the offending rule its own
  unqualified class (`.tier-benefits` instead of `.tier ul`;
  `.footer-social { display: flex; gap: 1rem }` instead of a `> a { margin }`
  child selector) rather than reordering the file — reordering only survives
  until the next unrelated addition changes the interleaving again.
- The choice of whether to convert a crit to Astro (now the course default)
  is worth re-making per crit, not a standing policy either way: on crit-2,
  no tested `stack` conversion skill was present in that session's available
  skills, and the brief was six fixed informational pages with no
  interactivity — nothing Astro's content collections/componentisation would
  earn back against the real conversion risk (base path, the CI link-check
  patch) for a hand conversion. Re-evaluate this each time rather than
  assuming last run's answer still holds.

- When verifying a `transform`-based positional fix on an SVG element live
  (e.g. an intentional `translate(dx, dy)` offset to stop two strokes
  rendering on top of each other), don't check with `getBBox()` — by
  spec it returns the element's bounding box in its own user space
  *before* its own `transform` is applied, so two identically-shaped
  elements will report identical bboxes even when one is genuinely
  offset on screen. Use `getBoundingClientRect()` instead, which
  reflects the full rendered position. Learned on assignment-1 chasing
  what looked like a fix that "didn't apply" when it actually had.
- An SVG illustration authored by hand (coordinates typed in rather than
  traced/exported) can pass every code-level check and still read as the
  wrong subject entirely — assignment-1's first-pass ink shrimp looked
  like a caterpillar/twig, not a shrimp, with no bug in the code. The
  only way this surfaced was screenshotting the actual rendered output at
  several points along the interaction (`agent-browser screenshot` at a
  few slider values) and looking at it critically, then redesigning the
  path geometry around the subject's real structure (a shrimp's body
  genuinely C-curls; the first attempt was a shallow horizontal wave).
  Budget for this as a real design-iteration step whenever a crit/
  assignment involves hand-authored illustration, not just a one-off
  spot-check.
  **Correction (2026-08-10):** this entry had described that redesign as
  already done, but it was never actually committed — a later run's
  `git log` on this repo showed no such commit, and `strokes.ts` still
  had the original wave-shaped body when checked directly. Whatever run
  wrote the paragraph above apparently diagnosed and even drafted the fix
  in-session but the change didn't survive into git, so the *next* run
  hit the identical bug fresh and had to redo the whole diagnosis
  (fixed for real this time in
  [`168c2b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-baishi/commit/168c2b0)).
  The general lesson: a memory entry narrating a code-level fix is a claim
  about what happened in a past session, not a verified fact about the
  current repo — before trusting it (same caution as the stale-`now.md`
  entry above, but for `MEMORY.md` prose itself), check the actual file or
  `git log` for the commit it claims exists.

- A distinct deepening angle from the geometry/a11y/HTML-validation passes
  above: check the interaction's *actual live behaviour* against what the
  page's own prose claims about it, not just against the spec/tests. On
  assignment-1, the "idea" section said "nobody told you which stroke count
  was which as you dragged — that's the point," but the built page's visible
  `#phase-label` live region printed the exact verdict at every slider
  position — handing sighted visitors the judgement the essay claimed they
  had to make themselves. `spec/assignment-1.test.ts` only asserted the
  label sat inside an `aria-live` region, which stayed true whether or not
  it was visible, so no automated check caught this. Fixed by making the
  qualitative label screen-reader-only (`.sr-only`, clip-based not
  `display:none`, so it stays in the accessibility tree): sighted visitors
  now judge by eye alone, matching the copy; screen-reader users, who can't
  see the drawing, still get the announced verdict as their equivalent of
  looking. The general check — does what the interaction *does* match what
  the page *says* it does — is worth running on any prototype that narrates
  its own interaction, and it only surfaces by using the live build, not by
  reading the markup.
- Real keyboard interaction testing is worth re-running per repo, not just
  once for the template's stack: crit-2 hadn't had this specific check
  recorded before (only crit-1 had), so a run at 23h-to-cutoff did it fresh
  rather than assuming the crit-1 finding generalised. Tab order on
  `index.html` walked wordmark → six nav links → the hero's `tel:` link, in
  visual/logical order, with `outline:auto` (no custom `outline: none`
  reset in the stylesheet) on every stop. Confirms the same pattern holds
  site-to-site but isn't free to skip.
- Shipping (flipping a repo from private to public, enabling Pages, running
  the deploy workflow) is genuinely **harness-owned**, not something this
  agent does itself — confirmed directly, not just inferred from doctrine's
  prose: `gh auth status` in this sandboxed environment reports no logged-in
  host and no `GH_TOKEN`/`GITHUB_TOKEN` in `env`, so there is no credential
  available to run `gh repo edit --visibility public` even if it were the
  right call. This matches doctrine.md's own line ("you never receive its
  GitHub credential") exactly. A course plugin *does* ship a `ship` skill
  with this exact irreversible-flip protocol (cached under
  `~/.claude/plugins/cache/comp4020/comp4020/<version>/skills/ship/`), but it
  isn't in this session's available-skills list and, even if it were, the
  missing `gh` auth would block step 4 regardless. Don't spend a future run
  hunting for a way to invoke it or trying to `gh auth login` — the doctrine
  is explicit that publish/deploy/freeze happens automatically, on the
  harness's own clock, from the commit this agent pushes. This agent's job
  stops at "push the clean tree."

- `agent-browser network route` only supports `--abort` or a fixed
  `--body` — there is no request-delay/throttle primitive, so it cannot
  simulate a genuinely *slow* connection, only a broken one (abort). For
  the artefact criterion's "holds up under... a slow connection" HD line,
  the closest available proxy is aborting the JS/CSS request and checking
  the page still renders without crashing — useful, but log it explicitly
  as a proxy for the real thing, not the real thing, since a load that
  never arrives (abort) and one that arrives late (slow) can degrade
  differently (e.g. a slider whose native `value` still moves via keyboard/
  drag even with its `input` handler never wired up, silently, with no
  error and no visible sign to the visitor).
- Real pointer-drag testing (`agent-browser mouse move/down/move/up`, not
  synthetic `input` dispatch and distinct from the keyboard-actuation check
  already logged above) is worth doing once per interaction that's driven
  by mouse/touch: it caught, on assignment-1's stroke slider, that the
  redraw happens live mid-drag (a `#shrimp-canvas`-only screenshot taken
  with the mouse still down showed the SVG already at the dragged-to
  stroke count) rather than only on release — confirming the `input`
  event wiring, not just the final value, behaves as the copy promises.
- After a dependency bump that touches build tooling (e.g. the `oxlint`/
  `vite` update that cleared the `pnpm audit` findings), re-run the visual
  sensor even though `pnpm check` is green — a version bump to the bundler
  itself is exactly the kind of change a green `tsc`/`vitest`/lint run
  can't see the effect of on rendered output. On assignment-1, screenshotting
  `#shrimp-canvas` at strokes 0/3/5/8/10/13/16 post-bump showed the geometry
  unchanged (still the C-curl body, sweet-spot legs, over-elaborated
  duplicate outline at max) and the console stayed clean. A legitimate
  "verified, nothing to fix" outcome, not a wasted check — it's the only way
  to know a tooling bump didn't quietly change output.

- Judging "response to the brief" (a point-of-view/scope call, not a
  code-level check) has its own distinct technique from re-reading the copy
  in isolation: fetch one of the brief's own named exemplars (permitted —
  it's a URL the brief gave, not a guessed one) and compare structure/tone
  directly rather than judging against a remembered impression of the genre.
  On assignment-1, fetching Ciechanowski's Mechanical Watch intro and
  comparing its hook-then-explain shape against this page's own
  drag-the-slider-first → idea section → generalisation structure confirmed
  the response holds up against the HD band language ("pointed, surprising,
  one idea carried all the way") rather than just asserting it does. Worth
  reaching for whenever the deepening pass turns to content/scope judgement
  rather than technical checks — a live comparison beats an unaided reread.

- `scripts/check-evidence.ts` (the template's `pnpm check:evidence`) shares a
  single `failed` flag across unrelated checks, and gates each check's own
  success message behind `if (!failed)` at the very end — so a run where only
  the reflection is missing (expected, this far from cutoff) prints just that
  one failure line and looks like nothing else ran. It did: CLAUDE.md
  presence and every PROCESS.md commit-citation resolve silently (they only
  print on failure), so a single visible failure line doesn't mean the rest
  is unverified. Read the script directly rather than inferring from its
  console output alone if you need to know whether citations/CLAUDE.md are
  actually clean mid-week.

- A 200%-browser-zoom reflow check (WCAG 1.4.10) is a genuinely distinct
  technical angle from every emulation `agent-browser set media` offers
  (dark/light/reduced-motion only — no zoom or text-scale primitive exists
  natively): `agent-browser eval "document.documentElement.style.zoom = '2';
  document.documentElement.offsetHeight; ''"` after `open` applies a real
  Chromium zoom (confirmed via `getBoundingClientRect()` on a heading
  doubling in size, and `getComputedStyle(...).zoom` reporting `"2"`), then
  check `document.documentElement.scrollWidth` vs `clientWidth` for
  unwanted horizontal scroll and take a **non-`--full`** screenshot to see
  the zoomed state. Reset with `style.zoom = '1'` before closing. On
  assignment-1 this passed cleanly at both marking viewports — no
  horizontal scroll, text and nav reflow (the nav row wraps to two lines
  on mobile), the slider stays full-width and unclipped, no console
  errors — a real, previously-untried check, not a repeat of the
  resize-mid-interaction or reduced-motion entries above.
  **Tooling quirk found along the way:** `agent-browser screenshot <path>
  --full` (full-page mode) did *not* reflect the zoomed state at all in
  this environment — two `--full` captures taken right before and right
  after applying `style.zoom = '2'` came back pixel-identical (same
  1920×3349 full-page height, same apparent font size), even though
  `eval` in between confirmed the zoom had actually applied at the DOM
  level. A plain viewport-only `agent-browser screenshot <path>` (no
  `--full`) taken in the same zoomed state *did* show the zoom correctly.
  Not investigated further (likely `--full`'s stitching path re-renders
  outside the zoomed CDP surface), but worth knowing: don't trust `--full`
  to reflect a CSS-`zoom` state, always verify with a non-`--full` shot or
  an `eval` measurement alongside it.

- A full Lighthouse run (see the `CHROME_PATH` environment note above) is a
  genuinely distinct sensor from the whole a11y/HTML-validation/keyboard/
  CWV battery already logged above — it caught something none of them did.
  On assignment-1, a run at 69h-to-cutoff, after that whole battery had
  already been declared exhausted, scored `best-practices` at 0.96 because
  every page load logs a real console error for the browser's implicit
  `favicon.ico` 404 — the same 404 an earlier console spot-check had
  already noticed and *explicitly decided to leave alone* (recorded above:
  "doesn't fail any check... leave it rather than adding a favicon just to
  clear it"). That earlier call was reasonable given what existed to check
  it against at the time, but it was wrong once a real named sensor scored
  it: the doctrine's own first finishing criterion is literally "no console
  errors," so a real console error occurring on every page load is not
  actually a non-issue just because no `pnpm check` step asserts on it. Added
  a small ink-dot SVG favicon (colour-matched to the site's `--ink` custom
  property) linked via `<link rel="icon">`, confirmed by re-running
  Lighthouse (`best-practices` back to 1.0, `errors-in-console` 0 → 1) and by
  checking the real network request in the browser, not just trusting the
  score. Two things Lighthouse also flagged that are **not** worth chasing
  for a tiny static single-page site, matching the existing busywork-guard
  lesson: a missing `robots.txt`/`llms.txt` (the `seo`/`agentic-browsing`
  categories penalise this, but nothing in the assignment spec or rubric
  cares), and render-blocking-request/network-dependency-chain "insights"
  over the page's one small CSS + one small JS file — restructuring loading
  order for a 2KB stylesheet is optimising a score, not a real user
  experience. The general lesson: a prior "leave it, nothing checks it" call
  is only as good as the checks that existed when it was made — a genuinely
  new sensor can overturn it, and that reversal is itself legitimate
  deepening-pass material, not scope creep, when the thing it fixes is named
  directly in the doctrine's own finishing criteria.

- Circular elements sized with `clamp(min, Nvw, max)` inside a `flex` row
  (`justify-content: center`, no wrap) will render correctly at the viewport
  first checked and silently distort at the other one: when N pads' total
  width exceeds the container, flexbox's default `flex-shrink: 1` compresses
  each item's *width* to fit while an explicit `height` clamp is untouched,
  turning circles into ellipses. Caught on crit-4 (2026-08-19) only by
  screenshotting the actual 390×844 marking viewport, not by re-reading the
  CSS — the 1920×1080 screenshot looked perfect and gave no reason to
  suspect it. Fix is `flex-shrink: 0` on the item plus re-tuning the
  size/gap `clamp()`s so the row's minimum total width actually fits the
  narrowest marking viewport, rather than relying on flexbox to compress
  it. General lesson, same shape as the earlier a11y/zoom findings: a layout
  that only gets checked at one viewport is only verified at one viewport —
  always screenshot both marking sizes for anything using `vw`-based sizing
  in a `flex`/`grid` row, not just for animation/interaction checks.

- A `clamp(min, Nvw, max)` used to size elements inside a flex row that
  itself sits inside a width-capped ancestor (e.g. `main { max-width: 40rem
  }`) will saturate at its rem-based max regardless of how much room the
  actual row has, once the viewport is wide enough — because `vw` always
  reads off the full viewport, not the element's real container. On
  crit-4 (2026-08-19) this caused a genuinely confusing bug: fixing a
  200%-zoom mobile overflow by switching `flex-wrap` from `nowrap` to
  `wrap` was correct, but the row was *already* wrapping at plain desktop
  zoom with no zoom applied at all, because 8 pads at their `vw`-clamp max
  plus gaps (688px) never fit the 640px-capped row. This was missed on a
  first pass because a screenshot glance at "looks like one row" isn't
  verification — the fix is CSS container queries: `container-type:
  inline-size` on the row's own element, then size children with `cqw`
  instead of `vw` so they scale against the row's real rendered width, not
  the viewport. Verify by measuring `getBoundingClientRect()` and counting
  distinct row `top` positions across all four combinations (both marking
  viewports × normal/200% zoom), not by eyeballing a single screenshot —
  same shape as the earlier ellipse-pads and clamp()-in-flex-row lessons
  above, but for row count instead of aspect ratio. This will recur on any
  future crit with a `vw`-sized row inside a width-capped container.
- To verify Web Audio is actually producing sound (this agent can't hear,
  and DOM state like `.active` classes or a voice-count map only proves the
  app's own bookkeeping ran, not that anything audible happened): patch
  `AudioContext.prototype.createOscillator` and `AudioNode.prototype.connect`
  via `agent-browser eval`, splice a real `AnalyserNode` in front of
  `destination`, then read its time-domain/frequency data after a real
  interaction. Two traps: (1) the naive patch that calls the *patched*
  `connect` again for the analyser's own hookup to destination recurses —
  guard with a flag and call the original `connect` (saved before
  patching) directly for that one hookup; (2) a synthetic
  `document.dispatchEvent(new KeyboardEvent(...))` correctly triggers the
  app's own handlers (oscillator created, `.active` class set) but leaves
  `AudioContext.state` stuck `"suspended"` — Chrome's autoplay gate does
  not count a page-dispatched synthetic event as real user activation. Use
  genuine CDP-driven input instead (`agent-browser press`, `agent-browser
  mouse down`/`up`), which does resume the context to `"running"` and lets
  the analyser read a real, non-zero signal. Confirmed on crit-4
  (2026-08-19) including a two-note chord (two live oscillators, correctly
  mixed higher peak, clean drop to zero on release). This is a one-off
  verification technique to run per audio-producing crit, not a permanent
  test-suite addition.
- To read or drive a module-scoped object (an `AudioContext`, a state map)
  that `agent-browser eval` can't see because the app never puts it on
  `window`, patch the relevant global constructor *before* the page's own
  script runs: `eval` a wrapper that replaces `window.AudioContext` with a
  function that constructs the real one via the saved original, stashes the
  instance on `window.__ctxRef`, then `open` (or reload) the page — the
  patch has to land before the module's own top-level code executes, so
  redo the same `eval` again right after the fresh navigation too; one
  early `eval` before the first `open` doesn't survive a reload. Distinct
  from the createOscillator/connect-analyser-splice entry above (that one
  taps *audio signal*; this one taps a *specific instance reference* for
  direct method calls like `.suspend()`/`.state`). Used on crit-4
  (2026-08-20) to test whether Drift's `noteOn()` resume check generalises
  beyond the initial autoplay-gate suspend: captured the real
  `AudioContext`, resumed it with a genuine keypress, then called
  `.suspend()` directly on the captured instance to stand in for *any*
  browser-initiated suspend (not just the autoplay one), and confirmed a
  second real keypress resumed it again cleanly. Confirmed the existing
  `if (context.state === "suspended") void context.resume()` check in
  `noteOn()` is unconditional on suspend cause and needs no separate
  blur/focus-pair handler — a genuine "checked, nothing to fix" outcome,
  distinct from the blur/visibilitychange *voice*-release bug below (that
  one was a real gap; this one wasn't). Reach for this whenever a check
  needs to drive a specific Web API instance the app keeps private, not
  just observe whether *some* audio came out.
- A synthetic `dispatchEvent` press-cycle (used elsewhere in this log because
  `agent-browser press --hold` doesn't reliably sustain) is not equivalent to
  a real drag for anything driven by pointer *movement* across multiple
  elements — a glissando, a drag-to-paint control, anything keyed off
  `pointermove`/`elementFromPoint`. Genuine `agent-browser mouse move <x> <y>`
  / `mouse down` / `mouse move <x2> <y2>` (still held) / `mouse up` is needed
  to prove the transition logic itself (does leaving element A's bounds while
  still down correctly hand off to element B, with no double-fire or stuck
  state), not just that each endpoint responds in isolation. Confirmed on
  crit-4's pad-to-pad glissando: DOM state showed exactly one active pad
  throughout the drag, never both, never neither.
- Verifying "sound came out" (the analyser-splice technique two entries up)
  is a different, weaker claim than "the *right* pitch came out" — the first
  only proves *some* signal reached the destination, the second proves the
  content matches what the interaction should have produced. To check pitch,
  not just liveness, read `analyser.getFloatFrequencyData` and take the
  peak bin (`peakBinIndex * ctx.sampleRate / analyser.fftSize`), then compare
  against the expected note's frequency (within one bin's width, e.g.
  ±23Hz at `fftSize: 2048` and a 48kHz context). On crit-4 this confirmed the
  live output pitch actually tracked the pad under a real mouse drag, not
  just that oscillators existed. One trap: if the instrument has *any* decay
  tail (a release envelope, a feedback delay/echo), reading the analyser
  immediately after switching notes can still show the *outgoing* pitch
  dominant — that's the tail genuinely still sounding, not a bug in the new
  note. Re-read after the release envelope's own duration has elapsed (Drift's
  is 350ms; a longer delay/feedback network can keep the old pitch audible
  for noticeably longer than the dry envelope alone) before concluding a
  pitch transition failed to happen.
- A continuous parameter the copy claims controls timbre (Drift's "move up
  and down to brighten or darken the sound", a filter cutoff swept by
  pointer/arrow-key position) needs the same audio-domain proof as pitch,
  not just a DOM/CSS-variable check — reading `--brightness` or
  `masterFilter.frequency.value` only proves the app's own bookkeeping
  moved, the same gap the pitch-vs-liveness entry above already named for
  note-on. Confirmed live on crit-4: held a note with a genuine
  `mouse down` (real gesture, resumes the context), then swept brightness
  with real `agent-browser press ArrowDown`/`ArrowUp` while still held,
  reading the spliced analyser's `getByteFrequencyData` banded into
  low/mid/high frequency ranges after each sweep. High-band (4–6.5kHz)
  energy was genuinely zero at dark and mid brightness and only appeared
  once bright (2.8), with mid-band (1.5–3kHz) energy climbing
  monotonically dark→default→bright (7.5→8.5→14) — confirms the lowpass
  sweep is actually audible, not just a CSS custom property changing.
  Console stayed clean throughout. "Checked, confirmed correct" outcome,
  no code change. Worth doing on any future crit whose copy names a
  specific audible effect of a continuous control (not just a note
  on/off), since that's exactly the class of claim a DOM-only check can't
  verify.
- **"The sensor battery is exhausted" and "there's nothing left to find" are
  different claims — don't conflate them.** After six runs' worth of
  axe-core/html-validate/Lighthouse/CWV/keyboard/audio-domain checks on
  crit-4 (Drift) all came back clean, a seventh run re-read the brief's own
  interaction prose one clause at a time against the *current* code instead
  of reaching for another synthetic probe, and found a real bug none of
  those sensors could ever have caught: "playable with whatever is at hand"
  implies a Tab-focused pad activated by Enter/Space should sustain for as
  long as it's held, same as a pointer or a home-row key — but the code
  gave it a hardcoded 180ms blip via a `click`+`setTimeout` regardless of
  hold duration. No accessibility/HTML/performance tool asserts on "does
  holding a key sustain a note for the actual hold duration," because
  that's a claim about *timing behaviour under a specific interaction
  pattern*, not structure or a score. The general technique: when the usual
  sensor battery reads as exhausted, derive fresh checkable claims straight
  from the brief's own sentences (not the spec's checkable-invariant
  subset, the fuller prose) and test each one against the live code — a
  different search than running more automated tools, and it can still
  turn up something real even after the tools are genuinely dry.
  **This held a second time, not just once:** an eighth run re-applied the
  same clause-by-clause technique to the *previous* fix (the
  blur/visibilitychange stuck-note fix, itself found this same way) and
  found it only covered the whole page losing focus, never focus moving
  *within* the page — holding Space on a pad, then pressing Tab to the next
  pad without releasing, left the first pad droning forever, because a
  still-held key's eventual `keyup` targets whichever element currently has
  focus, not the one focused when the key went down. Fixed with a
  `focusout` listener (fires the instant a pad loses focus, for any
  reason). The pattern worth trusting going forward: **each fix to a
  press-and-hold interaction opens a fresh clause worth re-deriving**,
  because the fix itself is new code the brief's prose hasn't been checked
  against yet — this isn't a fixed list to exhaust once, it's a technique to
  reapply after every change to hold/sustain logic specifically.
- The brightness/filter-sweep audio-domain check logged above (the one that
  confirmed the vertical control is audible, not just a CSS variable) had
  only ever driven the sweep via `agent-browser press ArrowUp`/`ArrowDown`
  while a note was held with the mouse — never via the actual pointer-drag
  path (`pointermove` → `updateBrightnessFromClientY`) that the page's own
  copy names as the primary way to do it ("move up and down to brighten or
  darken the sound"). Those are two different code paths in `main.ts` and
  a bug in one wouldn't show up testing the other. Verified on crit-4
  (2026-08-23, 71h-to-cutoff) with a genuine `agent-browser mouse down` on
  a pad followed by real `mouse move` to the bottom then the top of the
  viewport (same x, so the note itself doesn't change pad): the spliced
  analyser read low-band-only energy with `--brightness` at 0.028 near the
  bottom, and real mid/high-band energy appearing (11.8/2.3) with
  `--brightness` at 0.954 near the top — confirmed audible, not just a
  bookkeeping variable. Release (`mouse up`) cleared the pad's `.active`
  class immediately, no stuck state. "Checked, confirmed correct," no code
  change. General lesson matching the arrow-key-vs-drag distinction
  elsewhere in this file: two input paths that both claim to drive the same
  parameter are two separate claims to verify, not one — confirming one
  doesn't cover the other.
- Applying the same clause-by-clause technique a third time to the
  `focusout` fix itself (does releasing on *any* focus-loss reason ever end a
  note the player didn't mean to end — e.g. a pointer chord stealing focus
  away from a keyboard-held pad) came back clean this time, not another bug.
  Confirmed live on crit-4: focused pad A via `.focus()`, dispatched a
  synthetic `keydown` for Space (sustaining `focus-a`), then drove a *real*
  `agent-browser mouse down`/`mouse up` on pad S — `document.activeElement`
  stayed `a` throughout, both pads' `.active` classes were true
  simultaneously (a genuine cross-modal chord), and releasing the keyboard
  note afterwards worked normally. The reason it doesn't break: the existing
  `pointerdown` listener already calls `event.preventDefault()` (originally
  added to stop scrolling/text-selection on drag), and that same
  `preventDefault()` also suppresses the browser's default click-to-focus
  behaviour for that pointer, so a pointer chord never steals DOM focus away
  from a keyboard-held pad in the first place. Worth recording as the reason
  a fix works, not just that it does — the next run doesn't have to
  re-diagnose *why* pointer input can't defocus a held pad if it ever
  revisits this. General lesson for the clause-re-derivation technique:
  every reapplication doesn't have to find a new bug — "checked this
  specific edge case, confirmed the existing code already handles it and
  here's the mechanism" is exactly as legitimate an outcome as a fix, and is
  cheaper to write down than to re-derive from scratch next time.
- The clause-re-derivation technique above works on the **code's own
  comments**, not just the brief's prose — a comment asserting *why* a line
  exists (e.g. "`preventDefault()` here stops X from also happening") is a
  testable claim exactly like a brief sentence is, and one this agent wrote
  itself is no more trustworthy unverified than one read from outside. To
  check a preventDefault-based double-activation guard live (does pressing
  Enter/Space on a focused button actually suppress the native synthetic
  click, or does it sneak through and double-fire a separate click handler),
  DOM/`.active`-class state can't tell the two cases apart — a doubled
  handler call is often idempotent at the DOM layer even when it created a
  second live audio node underneath. Patch the actual node-creation call
  instead: `agent-browser eval` to wrap `AudioContext.prototype
  .createOscillator` with a counter before the interaction, reset it, run
  one real `agent-browser press Enter` (or `Space`) on a focused element,
  then read the counter — 1 confirms the guard holds, 2 would confirm a real
  double-trigger. Confirmed clean on crit-4's Tab+Enter/Space fix
  (2026-08-23, 64h-to-cutoff): both keys produced exactly one oscillator,
  and a plain `.click()` with no keydown/keyup at all (the actual
  assistive-tech path the fallback handler exists for) also produced
  exactly one, confirming both branches are mutually exclusive in practice,
  not just in the comment's claim.
- **The `pointerPads` Map has real independent-multi-touch logic that no
  prior audio-domain check had ever exercised through its own code path.**
  Every earlier "multi-voice chord" check (headroom, glissando, brightness
  sweep) drove at most one genuine pointer at a time and layered any
  further voices via synthetic `keydown` — a different map (`voices` keyed
  by `key-x`/`focus-x`) than the one two real simultaneous touches would
  use (`pointer-x` keyed by `pointerId`). Confirmed live on crit-4
  (2026-08-23, 58h-to-cutoff) with genuinely independent synthetic
  `PointerEvent`s carrying `pointerType: 'touch'` and distinct
  `pointerId`s (real multi-touch hardware is still untestable here, per
  the iOS-provider entry above, but this is the first check to drive
  *this specific map* with more than one concurrent pointer identity,
  which is the part of the code the hardware gap actually leaves
  unverified): two simultaneous touch pointers on separate pads produced
  exactly one oscillator each; releasing one left the other's `.active`
  state and oscillator untouched; and sliding one touch pointer across to
  a third pad (a touch-typed glissando) released the pad it left,
  activated the new one, and left the second, steady touch pointer
  completely unaffected throughout — confirmed via a
  `createOscillator`-call counter (2 → 3, never spuriously higher) and a
  clean `agent-browser console`/`errors` read. "Checked, confirmed
  correct," no code change. General lesson matching the arrow-vs-drag and
  headroom entries above: a map keyed by an identity (here, `pointerId`)
  needs its *cardinality* tested, not just its single-entry behaviour —
  confirming one touch works says nothing about whether two touches stay
  independent until it's actually tried.

- **When the technical-sensor well and clause-by-clause re-derivation both run
  dry, re-read the stylesheet fresh against "a real device," not another
  synthetic-event probe.** On crit-4's thirteenth run (2026-08-24,
  47h-to-cutoff), five straight prior runs had found nothing new via either
  route. Re-reading `styles.css` with the question "what platform-default
  touch behaviour has never been checked" (not "what does the app's own
  code do wrong") found a real gap: `.pad` had no
  `-webkit-tap-highlight-color` override, so Android Chrome/WebKit paint
  their default semi-transparent gray-black rectangle over every tap —
  independent of `touch-action: none`, `user-select: none`, or
  `appearance: none`, none of which touch this property. Confirmed via web
  search this default is still current (not stale knowledge) before
  fixing. Couldn't verify the visual artifact directly — same
  `xcrun simctl`/`-p ios` gap logged above blocks any real touch-emulation
  screenshot in this sandbox — so this was a justified pre-emptive fix
  (real, well-documented default; zero cost since the pad already gives
  richer feedback via its own `.active` class), not a verified-then-fixed
  bug like the others in this file. Worth naming as its own category: some
  real defects in a touch-first crit are only reachable by asking "what do
  browsers do by default that this stylesheet hasn't overridden," not by
  running another tool or re-deriving another brief clause — CSS-property
  literacy as its own deepening lens, distinct from both.

- **`touch-action: none` is scoped like any other CSS property — set it on
  the actual drag/zoom surface, never on `body`/`html` as a blanket fix for
  scroll interference during a pointer drag.** MDN's own docs warn against
  applying it broadly: it disables *all* browser-handled panning and
  zooming on the element it's set on, including pinch-zoom, so a page-wide
  `touch-action: none` blocks low-vision touch users from zooming anything
  on the page, not just the interactive surface it was meant to protect.
  MDN names the correct scope directly — an element with its own custom
  drag/zoom behaviour, "a map or game surface" — which generalises to any
  future crit with a draggable canvas, slider, or multi-touch pad row.
  Confirmed via `getComputedStyle(el).touchAction` before/after scoping
  down from `body` to the specific interactive container; real touch
  pinch-zoom itself stays unverifiable in this sandbox (same
  `xcrun simctl` gap as the tap-highlight entry above), so this fix is
  grounded in MDN's documented behaviour, not a screenshot of the gesture.
  Found on crit-4 (2026-08-24, 40h-to-cutoff) by following up on the prior
  run's own flagged lead (pinch-zoom/user-scaling, in its "next action"
  note) rather than inventing a fresh angle — worth re-reading a prior
  run's stated next-action list before reaching for a brand new technique.

- **A third instance of the CSS-property-literacy lens (see the tap-highlight
  and touch-action entries above): `appearance: none; border: none` on a
  custom-styled control is a specific, real gap under `forced-colors: active`
  (Windows High Contrast mode), not just a theoretical one.** MDN documents
  this as "the classic button problem" — `background-image` (gradients
  included) and `box-shadow` are both forced to `none` in that mode, so any
  element relying on either for its visible shape/boundary, rather than a
  real `border`, effectively disappears. On crit-4's `.pad` (a round button
  whose entire circle came from a radial-gradient background plus a glow
  `box-shadow`, no border at all) this meant a pad would render as a bare
  letter with no boundary under high contrast — found on the fifteenth and
  final run (2026-08-24, 34h-to-cutoff) by extending the same "what does the
  platform do by default that this stylesheet hasn't overridden" question one
  step further than the tap-highlight/touch-action findings had gone. Fixed
  with `@media (forced-colors: active) { .pad { border: ...ButtonBorder } }`
  — MDN's own documented fix shape, using `ButtonBorder`/`Highlight` system
  colors rather than fixed colors so it stays correct across a user's chosen
  contrast theme. Same epistemic status as the other two: `agent-browser` has
  no forced-colors emulation, so this is grounded in documented platform
  behaviour, confirmed only by `getComputedStyle` showing the rule doesn't
  leak into ordinary mode, not a screenshot of the failure or the fix. Any
  future crit with a custom-styled interactive element (a button, a slider
  thumb, a custom checkbox) that gets its shape from `background`/`box-shadow`
  rather than a `border` should get this same check — grep the stylesheet for
  `appearance: none` combined with `border: none` as the specific pattern to
  look for.

- **A fourth instance of the CSS-property-literacy lens: `touch-action: none`
  only suppresses browser-handled pan/zoom gestures, not iOS Safari's
  separate long-press callout (context-menu/copy) and text-selection
  magnifier.** Confirmed via web search of MDN and current sources that
  `-webkit-touch-callout: none` is the distinct, correct property for the
  callout, and pairing it with `-webkit-user-select`/`user-select: none`
  (to also stop the magnifier) is the documented fix shape — the two
  properties address genuinely different platform behaviours and neither
  substitutes for the other. Found on crit-5 (2026-08-31, 40h-to-cutoff)
  applying the same "what does the platform do by default that this
  stylesheet hasn't overridden" question to `#game`, which already had
  `touch-action: none` and `-webkit-tap-highlight-color: transparent` but
  nothing for the callout. This one carries real stakes beyond cosmetics:
  the element in question is the exact surface a sustained touch-hold
  drags across, so an uncontrolled callout mid-drag would interrupt actual
  gameplay on iOS, not just look untidy. Same epistemic status as the
  other three: no real iOS host in this sandbox (the recurring
  `xcrun simctl` gap) to trigger the callout and confirm it's actually
  suppressed, so this is a pre-emptive, documentation-grounded fix,
  confirmed only by `getComputedStyle` showing `user-select: none` applied
  and scoped to the one element. Any future crit with a draggable/
  long-press-driven touch surface should get all four checks from this
  lens together — tap-highlight, touch-action scope, forced-colors
  border-loss, and now touch-callout/user-select — rather than stopping
  once the first one or two are found.

- **For a game/interaction whose canvas resolution is JS-driven off
  `getBoundingClientRect()` and only resynced on a `resize` event, the
  `documentElement.style.zoom` technique used elsewhere in this log for
  WCAG 1.4.10 reflow checks can produce a false positive, not a real bug.**
  On crit-5, forcing `style.zoom = '2'` squashed every canvas-drawn circle
  into an ellipse — the canvas's pixel buffer (set once at load/resize
  time) no longer matched its now-differently-proportioned rendered box.
  Traced before fixing anything: `style.zoom` doesn't fire a `resize`
  event and doesn't change `window.innerWidth` in this sandbox — confirmed
  directly (`window.__resizeFired` stayed 0, `innerWidth` unchanged across
  the zoom toggle). That matters because neither real zoom mechanism a
  visitor could actually use reaches this state: real desktop browser zoom
  (Ctrl-+/-) *does* resize the layout viewport and *does* fire `resize`
  (confirmed by that same app's `resize()` handler already producing
  correctly round circles at both marking viewports under ordinary,
  non-`style.zoom` use); real mobile pinch-zoom *never* resizes the layout
  viewport at all (confirmed via web search — pinch/pan only change the
  *visual* viewport, a distinct concept from the *layout* viewport that
  `getBoundingClientRect()` reads from, per the VisualViewport API's own
  raison d'être), so it can't desync the buffer either. `style.zoom` is
  useful for plain DOM/CSS reflow checks (confirmed clean on earlier,
  non-canvas crits) but is not a faithful proxy for *either* real zoom
  mechanism on an element whose size is cached in JS off
  `getBoundingClientRect()` — don't diagnose a canvas-squash finding under
  `style.zoom` as a shippable bug without first checking whether the app's
  own `resize` handler already covers real zoom's actual viewport-resize
  behaviour, the way this one did.

- **A third bug-finding technique, distinct from a fresh code read and from
  brief-clause re-derivation: re-read an already-shipped fix's own stated
  reasoning and check whether it generalised as far as it should have, not
  just as far as the bug report that motivated it.** On crit-5, a fix that
  suppressed Space's default page-scroll during a gameover restart was
  reasoned about specifically in terms of Space ("the browser's own
  page-scroll-down key"). That reasoning was correct but narrower than the
  actual defect class: ArrowUp/ArrowDown share the exact same property (a
  browser scroll default, no in-game use) but were never covered, and not
  just during gameover — during ordinary play too, since nothing in the
  handler ever reached a `preventDefault()` for either key in any state.
  Confirmed live the same way the original fix was: a real short viewport
  with genuine overflow, a real keypress, `window.scrollY` before/after.
  The general check: whenever a fix names the *specific* key/event/element
  that triggered the bug report, ask what *property* of that key/event/
  element actually caused the problem, then check every sibling that
  shares the same property, not just the one instance already fixed. This
  is a different search from re-reading the file fresh (which looks at
  what the code does) or re-deriving brief clauses (which looks at what
  the brief promises) — it looks at whether a past fix's own justification
  covers its full stated scope.

## Open threads for future runs

- `comp4020-crit5-baishi` (Two-Tone, a colour-match falling-circle dodge
  game) had its first build run on 2026-08-26, 167h-to-cutoff: went from the
  bare template straight to a playable, testable game in five commits
  (rule+test, initial build, a play-found swap-button fix, the card
  replacement, `PROCESS.md`), all pushed to `origin/main`
  (`7da8559`). `pnpm check` green (21 tests), a fresh axe-core sweep clean,
  `html-validate` clean except the expected doctype/void-style non-issues,
  and both marking viewports played through live against `pnpm preview`
  with a clean console. Deliberately used the harder "two mechanics that
  interact" shape the brief calls out (movement + colour-toggle) rather
  than a single-mechanic dodge. A second run the same day, 160h-to-cutoff,
  closed every angle that run's `now.md` had flagged and found two real
  bugs: the launch teal/pink hue pair collapsed to near-identical greys
  under deuteranopia (see the CVD-simulation-matrix entry below) — fixed
  to sky blue/amber, and re-applied to `public/card.png` too, which still
  showed the old palette after the in-game fix (`5d63433`) — and a missing
  `-webkit-tap-highlight-color` on the full-bleed canvas, the same class of
  finding as crit-4's `.pad` (`8b9e859`). A scripted reactive-bot playtest
  of the difficulty ramp (see below) came back clean, and the
  screen-reader-scope question was explicitly decided (not left
  unconsidered) and written into `PROCESS.md`, now at 7 cited moments. Not
  the last run — no reflection yet, correctly. See its `now.md` for what's
  still untried: Lighthouse (never run on this repo), a real human-timed
  five-minute play session (the scripted bot stands in for reflexes, not
  judgement of fairness), and a live keyboard tab-order walk.
  A third run, 2026-08-26, 154h-to-cutoff, worked that exact list: html-validate
  re-run came back clean (same expected non-issues); the keyboard tab-order
  walk came back clean (nav link → canvas, both with the default visible
  outline, keyboard controls wired on `window` so they work without ever
  tabbing to the canvas); and a real by-eye playtest (screenshots through a
  full round, not the scripted bot) confirmed the two hues, the swap
  button's dashed to-colour hint, and the game-over/restart cycle all read
  clearly — no new design bug, a legitimate "checked, confirmed correct"
  outcome since the spec's "found by playing" requirement was already
  satisfied on the first build run. Lighthouse, run for the first time,
  *did* find something: the same favicon.ico-404 console-error pattern
  crit-4 had already caught, `best-practices` 0.96 → fixed with an SVG
  favicon in the game's own palette, confirmed back to 1.0 on re-run. That
  same pass also caught a second, unrelated gap the palette swap had left
  behind: `styles.css`'s nav-link colour was never updated in the hue swap
  (only `main.ts` was touched), so the page chrome still carried the
  retired pink after the in-game colours moved to sky blue/amber — moved to
  the settled amber. [`48e382b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-baishi/commit/48e382b).
  `PROCESS.md` now at 8 cited moments, all commits pushed (`21c4d97`). Not
  the last run. See its `now.md` for what's left: a real human-judged
  five-minute session (can't be self-administered, an open thread for the
  studio crit itself), `pnpm audit`/`outdated`, a 200%-zoom reflow check,
  and a copy-vs-behaviour prose pass.
  A fourth run, 2026-08-27, 143h-to-cutoff, worked that exact list.
  `pnpm audit` found 7 real vulnerabilities in transitive dev-tooling deps;
  a plain in-range `pnpm update` (`vite`→8.2.2, `vitest`→4.1.11) cleared
  all of them, `pnpm check` staying green (`ae3fa91`). The 200%-zoom check
  found a canvas-squash effect but traced it to a testing-technique
  artifact rather than a real bug — see the new dedicated entry above
  (`style.zoom` doesn't fire `resize`/change `innerWidth`, so it can't
  faithfully stand in for either real desktop zoom or real mobile
  pinch-zoom on this canvas-driven layout) — no code change. The
  copy-vs-behaviour prose pass checked the meta description against
  `isFatalCollision` directly and found it accurate; nothing to fix.
  `PROCESS.md` now at 9 cited moments, pushed (`f1881aa`). Not the last
  run. See its `now.md` for what's left: the human-timed five-minute
  session (still open, still not self-administerable), a real
  pointer-drag test of drag-to-move specifically (only keyboard movement
  and the swap button's click have had genuine non-keyboard input so
  far), and a live `prefers-reduced-motion` check of the swap button's
  pulse animation (the branch exists in `draw()` but has never been
  observed live via `agent-browser set media reduced-motion`).
  A fifth run, 2026-08-27, 136h-to-cutoff, worked that exact list and both
  checks came back "checked, confirmed correct" — no code change, no
  commit. The pointer-drag test used a temporary `window.__debug` getter
  (reverted before finishing, matching the pattern already logged
  elsewhere in this file) to read `player.x`/`dragging`/`state` live:
  a genuine `agent-browser mouse down` + `mouse move` + `mouse up` drag
  tracked `player.x` to the exact dragged-to position at each step
  (110 → 510 in canvas-local px) and left it there (no snap-back) on
  release, confirming the pointer path works independently of the
  keyboard path already checked. The reduced-motion check sampled a single
  canvas pixel at the swap button's pulse-boundary radius
  (`ctx.getImageData`) repeatedly over ~1.5s: with the OS preference off,
  the sampled colour genuinely flickered between the dashed-stroke colour
  and the background as the pulse animated; after `agent-browser set media
  reduced-motion` + a fresh page load, the same sample stayed pinned to
  the background colour for the same span — confirming the `pulse =
  prefersReducedMotion ? 0 : ...` branch is actually inert under the
  preference, not just present in source. Also re-ran `pnpm audit` (still
  clean) and `pnpm outdated` (same four major-only entries, correctly left
  alone) as a quick re-check, no drift since the fourth run. No commits
  this run — nothing needed one. This is now the last self-administerable
  angle on the fourth run's flagged list; the studio-crit five-minute
  session remains the only open thread. Not the last run — no reflection
  yet, correctly.
  A sixth run, 2026-08-27, 130h-to-cutoff, re-read `main.ts`/`game-logic.ts`/
  `styles.css` fresh (per the prior run's own advice to prefer a fresh read
  over a fourth repeat of the exhausted battery) and tried one genuinely
  untried angle: a real window resize mid-round via
  `agent-browser set viewport`, distinct from the `style.zoom` reflow check
  a prior run had already found to be a testing-artifact false lead for this
  canvas. Found a real (low-impact) gap — `resize()` reclamps the player's x
  but never obstacles' — then found the obvious fix was worse than the bug
  and reverted it; see the new dedicated entry below for the full reasoning.
  No commits this run — the investigation itself, and the decision not to
  ship the fix, is the legitimate outcome. `pnpm check` still green (21
  tests), working tree clean, nothing new pushed. Not the last run. The
  human-timed five-minute session remains the only standing open thread; no
  new self-administerable angle is currently flagged.
  A seventh run, 2026-08-28, 119h-to-cutoff, re-read `main.ts` fresh again
  and applied a technique already logged for a *different* repo (Drift,
  crit-4's blur-vs-visibilitychange lesson, below) to this one for the
  first time — see the new cross-repo entry below for the general lesson.
  Found a real bug: the existing `blur` handler that clears held
  arrow-keys/drag state only covers the window losing OS focus, not a
  same-window tab switch (confirmed via web search: that hides the
  document, firing `visibilitychange`, without ever blurring the window —
  arguably the *more* common real path a player hits than an actual
  window blur). Reproduced live with a temporary `window.__debug` hook
  and a synthetic `document.hidden = true` + `visibilitychange` dispatch:
  a held arrow key stayed stuck under the old code, cleared once
  `visibilitychange` got the same `releaseHeldInput()` call as `blur`.
  Fixed and pushed (`25d1bc3`/`b386c26`), `pnpm check` still green (21
  tests), both marking viewports console-clean afterwards. Not the last
  run. The human-timed five-minute session remains the only standing open
  thread.
  An eighth run, 2026-08-28, 112h-to-cutoff, re-read the code fresh again
  and found a second real bug this same way: the `keydown` handler's
  `gameover` branch calls `resetGame()` and returns before the function
  reaches its own `event.preventDefault()` calls, so Space (the browser's
  default page-scroll-down key) still scrolls the page underneath a
  restart. Invisible at both marking viewports — the page's total height
  never exceeds either one — but real at shorter effective heights a
  phone's on-screen address bar produces, since the canvas is sized
  `min(70vh, 32rem)` and shrinks with actual viewport height (see the new
  `preventDefault`-ordering entry below for the general lesson and how it
  was confirmed live). Fixed and pushed (`b3b2b60`/`60317da`), `pnpm
  check` still green (21 tests). Not the last run. The human-timed
  five-minute session remains the only standing open thread.
  A ninth run, 2026-08-28, 106h-to-cutoff, re-read `main.ts` fresh a third
  time and found a third real bug in the same small area (focus/input
  handling around state transitions): the `gameover` branch's `keydown`
  handler restarted on *any* keydown, with no check for the browser's own
  key auto-repeat (`event.repeat`) — so a movement key still physically
  held at the moment of a fatal collision (the likely case, since dying
  usually happens mid-dodge) kept sending repeat keydowns that silently
  reset the round before the player ever saw the game-over screen, with
  no intentional keypress involved. See the new dedicated entry below for
  the mechanism and how it was confirmed live. Fixed and pushed
  (`f43833d`/`beadbe8`), `pnpm check` still green (21 tests), both
  marking viewports console-clean afterwards. Not the last run. The
  human-timed five-minute session remains the only standing open thread —
  three consecutive runs finding real bugs in the same corner of the file
  suggests that area specifically rewards another close read before a
  future run trusts it's exhausted.
  A tenth run, 2026-08-29, 95h-to-cutoff, re-read `main.ts` fresh a fourth
  time and found a fourth real bug in the exact same handler: the
  Space-to-swap-hue branch had the mirror-image gap of the ninth run's fix
  — it toggled the player's hue on *every* keydown, including auto-repeat,
  rather than once per fresh press, so holding Space past the OS repeat
  threshold flickered the hue uncontrollably (see the extended entry
  above for the mechanism and generalised lesson). Fixed with the
  identical `event.repeat` guard, verified the pointer/click path to the
  same swap control was unaffected, and pushed (`1129a02`/`3afc118`).
  `pnpm check` still green (21 tests), both marking viewports
  console-clean. Not the last run. The human-timed five-minute session
  remains the only standing open thread — four consecutive runs now
  finding real bugs in this same `keydown` handler; a future run should
  give it one more close read (specifically checking whether the
  movement-key branches, which only add/delete into a Set and are
  naturally idempotent under repeat, are actually as harmless as they
  look) before concluding the handler itself is finally exhausted.
  An eleventh run, 2026-08-29, 88h-to-cutoff, confirmed that specific
  check (movement-key repeat is genuinely harmless — `pressed.add`/`delete`
  is idempotent, verified by reading rather than needing a live test) and
  then found a fifth real bug, this time in a cross-handler interaction
  rather than the `keydown` handler alone: `pointermove`'s drag branch only
  checked its own `dragging` flag, and nothing cleared that flag when
  `gameOver()` fired mid-drag — there's no `pointerup` to catch it, since
  the player's finger/mouse never lifted. Confirmed live with a temporary
  `window.__debug` hook: forced a collision while a real `agent-browser`
  drag was still held down, then kept moving the pointer, and watched
  `playerX` keep tracking it (310 → 460 → 610) while `state` stayed
  `"gameover"` — the player circle visibly slid under the dimmed overlay
  after the round had supposedly ended. Fixed the same way the existing
  blur/visibilitychange handler already clears held input: `gameOver()`
  now sets `dragging = false` itself, so `pointermove`'s existing guard
  takes over with no change needed there. See the new cross-handler-state
  entry below for the generalised lesson. Fixed and pushed
  (`60ac9eb`/`dc9c11a`), `pnpm check` still green (21 tests), both marking
  viewports console-clean. Not the last run. The human-timed five-minute
  session remains the only standing open thread.
  A twelfth run, 2026-08-29, 82h-to-cutoff, re-ran the cheap `pnpm audit`/
  `outdated` pair (still clean, still the same four major-only entries) and
  then found a sixth real bug via a third distinct technique — not a fresh
  code read and not brief-clause re-derivation, but re-reading an
  *already-shipped fix's own reasoning* and asking whether it generalised
  as far as it should have (see the new dedicated entry below). The
  eighth run's Space-scroll fix (`b3b2b60`) was scoped to Space
  specifically; ArrowUp/ArrowDown, which have no in-game effect anywhere
  in `main.ts`, had never had `preventDefault()` called on them in any
  state. Confirmed live at a real short viewport (390×500, genuine
  overflow) that ArrowDown scrolled the page 29px during ordinary play,
  no collision or restart involved. Fixed by widening the same
  unconditional check to cover both arrow keys; verified movement and
  Space's toggle still fire normally. Fixed and pushed
  (`79b43cc`/`4b7577d`), `pnpm check` still green (21 tests), both marking
  viewports console-clean. Not the last run. The human-timed five-minute
  session remains the only standing open thread.
  A thirteenth run, 2026-08-29, 71h-to-cutoff, reapplied the twelfth run's
  own flagged next action (re-check whether the just-shipped fix
  generalised as far as it should have) to itself, one level deeper: the
  Space→ArrowUp/ArrowDown fix still only covered the two arrow keys that
  motivated it, not the full "browser scroll key with no in-game use"
  class — Home, End, PageUp and PageDown are the same class and had never
  had `preventDefault()` called on them either. Confirmed live at the same
  short viewport (390×500) with the canvas genuinely focused: each of the
  four moved `window.scrollY` during ordinary play (End 0→25, PageDown
  0→27, Home 30→4, PageUp 30→7 — the latter two tested from a
  pre-scrolled position since scrollY was already 0 going up). Fixed by
  widening the same unconditional check to all eight keys, verified
  movement/Space-toggle unaffected and console clean. Fixed and pushed
  (`212b0b5`/`ab34cbf`), `pnpm check` still green (21 tests). This is now
  the complete set of standard browser-default scroll keys — a future run
  shouldn't expect a fifth instance of this exact class in this repo, though
  the general "does a fix generalise as far as its own stated reasoning
  implies" technique is still worth trying on other already-shipped fixes
  in this handler. Not the last run. The human-timed five-minute session
  remains the only standing open thread.
  A fourteenth run, 2026-08-30, 64h-to-cutoff, tried that same technique
  against a handler other than the scroll-key vein (the run's own flagged
  candidates: the swap-button hit-test, the gameover-restart branch, the
  drag-clamp logic) and found a real bug in the third: `dragging` was a
  single shared boolean, correct for a mouse but wrong for touch — an
  incidental second touch releasing off the canvas cleared the same flag
  regardless of which pointer it belonged to, silently stopping the first
  pointer's still-held drag from tracking further movement. See the new
  dedicated entry below for the mechanism, the fix (`draggingPointerId`
  keyed by `event.pointerId`), and a testing-artifact caveat found along
  the way (`setPointerCapture` throws for a second synthetic pointerId
  while a first already holds capture — real hardware wouldn't hit this,
  but the underlying flag bug was confirmed independently of it). Fixed
  and pushed (`24abb55`/`b3d0d8e`), `pnpm check` still green (21 tests),
  both marking viewports console-clean, a chord tap on the swap button
  mid-drag by a second pointer verified unaffected. Not the last run. The
  human-timed five-minute session remains the only standing open thread —
  two untried candidates left from this run's own list: the
  gameover-restart-on-any-`pointerdown` branch, and whether
  `withinSwapButton`'s fixed-pixel hit radius holds at viewport extremes.
  A fifteenth run, 2026-08-30, 58h-to-cutoff, worked both candidates and
  closed each with no code change — see the new dedicated entry below for
  the restart one's mechanism and the reasoning for why it's not actually
  a distinct bug. The hit-test candidate reasoned out clean too: a fixed
  32px touch target is standard accessible practice regardless of
  viewport size, and all game coordinates already live consistently in
  CSS-pixel space with no DPR mismatch. Also cross-checked this repo's
  `styles.css` against three CSS-property-literacy lessons logged for
  crit-4 that had never explicitly been checked here —
  `-webkit-tap-highlight-color` (already fixed, `8b9e859`), `touch-action`
  scope (already correctly scoped to `#game`, never made crit-4's
  body-wide mistake), and `forced-colors: active` border-loss (doesn't
  apply — this repo's interactive surface is canvas-drawn pixels, not a
  DOM button styled via background/box-shadow) — all three clean. `pnpm
  check` still green (21 tests), no commits this run. Not the last run.
  The human-timed five-minute session remains the only standing open
  thread; no new self-administered angle is currently flagged.
  A sixteenth run, 2026-08-31, 47h-to-cutoff, re-read `main.ts`/
  `game-logic.ts`/`index.html` fresh and traced several more restart/drag
  edge cases (tap-to-restart not also grabbing a drag for the same
  pointer, multiple simultaneous fatal collisions in one frame,
  window-level keydown/keyup being unaffected by in-page Tab-focus moves)
  — each reasoned out as intentional or harmless, no new bug. Ran the
  cheap `pnpm audit`/`outdated` pair (still clean, same four expected
  major-only entries) and, for the first time in two runs, a real live
  browser pass (`pnpm preview` + `agent-browser` at both marking
  viewports): console clean at both, a fresh axe-core sweep at 0
  violations, a mobile screenshot confirming the sky-blue/amber pair and
  swap button still render correctly. No commits — nothing needed one.
  Not the last run. The human-timed five-minute session remains the only
  standing open thread; sixteen runs deep with no new bug in the last two
  is the expected steady state for a repo this thoroughly worked, not a
  sign something's being missed.
  A seventeenth run, 2026-08-31, 40h-to-cutoff, re-read the same three
  files plus `styles.css` fresh and found a genuinely new gap by applying
  the CSS-property-literacy lens already used on crit-4 one instance
  further than either repo had tried: `touch-action: none` on `#game`
  suppresses pan/zoom gestures but not iOS Safari's separate long-press
  callout and text-selection magnifier (see the new dedicated `MEMORY.md`
  entry above for the mechanism and why it's real stakes here, not just
  cosmetic — the drag mechanic is a sustained touch-hold on this exact
  element). Fixed with `-webkit-touch-callout: none` plus
  `-webkit-user-select`/`user-select: none`, verified scoped to `#game`
  only and `user-select: none` actually applied via `getComputedStyle`
  against a real `pnpm preview`, console clean, `pnpm check` green (21
  tests) before and after. Fixed and pushed (`e9b35f8`/`52cb922`),
  `PROCESS.md` now at 18 cited moments. Not the last run. The human-timed
  five-minute session remains the only standing open thread; a future run
  might try `prefers-contrast` beyond `forced-colors` as the next
  CSS-property-literacy variant, though this game's canvas-drawn
  interactive surface (not a DOM button/border-based control) may make
  that one inapplicable, same as `forced-colors` almost was.
  An eighteenth and final run, 2026-08-31, 34h-to-cutoff, ran the
  doctrine's finishing steps rather than another deepening pass: `pnpm
  check` green (21 tests) at the start, a fresh `pnpm preview` pass at
  both marking viewports (console clean, axe-core 0 violations,
  html-validate clean except the expected doctype/void-style non-issues,
  a mobile screenshot confirming the palette and swap button still render
  correctly), wrote `reflections/crit-5.md` (283 words, naming the
  clause-by-clause re-derivation technique itself as the run's
  breakthrough, since it's what kept finding real bugs across a
  dozen-plus runs after the sensor battery first read as exhausted, more
  than any single fix did), confirmed `pnpm check:evidence` fully clean
  (reflection + all 16 cited commits resolve), committed and pushed
  (`bc2c7bb`). This deliverable is now **fully shipped** — this was the
  last run for `comp4020-crit5-baishi`. The only thing left unresolved
  across the whole run history is the human-timed five-minute play
  session, which needs the studio crit itself, not a future run of this
  agent.
- **A live test finding a real, reproducible effect isn't automatically a
  bug — trace the effect back to whether it's actually new behaviour, or
  just an already-accepted mechanic surfacing at a moment that happens to
  make it look novel.** On crit-5, forcing gameover then dispatching two
  synthetic `PointerEvent`s in quick succession (pointer 1's restart tap,
  pointer 2's incidental touch elsewhere on the canvas — same technique as
  the fourteenth run's cross-pointer drag check, `window.__debug` plus
  independent synthetic pointer identities) reproduced a real effect:
  pointer 1's `pointerdown` resets the game (state flips to `"playing"`
  before pointer 1's own handler returns), then pointer 2's `pointerdown`,
  arriving after, is evaluated against that *new* state and grabs
  `draggingPointerId`, which on real hardware (masked in this sandbox by
  the already-logged `setPointerCapture` synthetic-pointer `NotFoundError`
  — confirmed via an explicit `window.onerror` listener that it's the same
  known artifact and not a new failure) would teleport the player to
  wherever the stray second touch landed. First read, this looks like a
  genuine restart-specific bug matching the shape of several already-fixed
  ones in this file (cross-pointer/cross-key state confusion around a
  transition). But tracing it one level further: touching *anywhere* on
  the canvas to instantly grab-and-teleport the player is this game's own
  deliberate, already-tested absolute-positioning touch design (confirmed
  by the pointer-drag entries logged elsewhere in this file) — it applies
  identically any time no pointer currently holds the drag slot, restart
  or not. The "restart" framing made the repro look novel only because a
  coincidental second touch is more likely to land near a deliberate
  restart tap than at a random moment in ordinary play; the underlying
  mechanism and its risk are identical either way. Singling out restart
  for special protection (e.g. a grace-period guard) would be an arbitrary
  fix for a symptom of standing, accepted design, not a distinct defect —
  concluded correctly as "checked, not a new bug," no code change. General
  lesson: when a live repro succeeds, the next question isn't "does this
  need fixing" but "is the mechanism this repro exercises unique to the
  scenario I just tried, or would the identical mechanism produce the same
  effect at any other moment the app already accepts" — only the former is
  a genuine, scoped defect worth a scoped fix.
- **A lesson logged for one repo can be a genuinely untried angle on a
  different repo — check `MEMORY.md`'s own single-repo findings against
  the current repo's code, not just against the exhausted battery already
  run on it.** Crit-4's Drift had already taught that a `blur`-only
  focus-loss handler misses same-window tab switches (`visibilitychange`
  fires, `blur` doesn't, confirmed via web search on crit-5's run — see
  the crit-5 seventh-run entry above). Crit-5's `main.ts` had its own
  `blur` handler for exactly the same reason (clearing held keys/drag
  state) but had never been checked against this specific gap across six
  prior runs, because every one of those runs was either running the
  general sensor battery or re-reading the brief/code fresh rather than
  cross-checking a different repo's already-logged lesson. Generalises:
  after "re-read the code fresh" and "re-run the sensor battery" are both
  exhausted for a repo, a third search worth trying is scanning this
  file's other single-repo entries for a technique or gap-class that
  matches something in the current repo's code but was never actually
  applied to it.
- **An early-return branch in an event handler has to repeat any
  `preventDefault()` the branches after it rely on, not just their own
  logic — a handler that suppresses a key's default action only in its
  "normal" branches leaves that default action live on whichever other
  branch returns early first.** On crit-5, `main.ts`'s `keydown` handler
  had a `gameover` branch (restart on any key) written before the
  movement/hue-swap branches (each with their own `preventDefault()` for
  the specific keys that need it), and the gameover branch returned
  before ever reaching them. Space is the browser's own page-scroll-down
  key, so restarting via Space after a loss let that default scroll
  through unsuppressed — invisible whenever the page fits inside the
  viewport (both this repo's marking viewports, confirmed via
  `document.documentElement.scrollHeight` vs `window.innerHeight`) but
  real the moment it doesn't (a `vh`-sized element shrinks with actual
  viewport height, and a real phone's on-screen address bar reduces that
  below what a fixed marking-viewport height alone assumes — confirmed by
  sweeping `agent-browser set viewport 390 <h>` down from 844 and finding
  real overflow appear at 600/500/400px). Confirmed the actual scroll
  live with a temporary `window.__debug` hook forcing game-over, a real
  `agent-browser press Space`, and reading `window.scrollY` before/after
  (0 → 4 broken, 0 → 0 fixed) — a scroll doesn't throw a console error or
  fail a test, so watching the page move was the only way to see it. Fix:
  hoist the specific `preventDefault()` a later branch needs to run
  *before* the early return, not the whole branch's other logic (the
  hue-swap side-effect still only happens in `"playing"`). General
  lesson, likely to recur in a future crit: whenever an event handler has
  an early-return branch guarding some but not all keys, check whether
  any of the *other* branches' `preventDefault()` calls needed to fire
  unconditionally to suppress a browser default the early-return branch
  would otherwise let through.
- **"Restart on any keydown" is a different claim from "restart on any
  keypress" — a `keydown` handler that doesn't check `event.repeat` reacts
  to the browser's own key auto-repeat, not just to a fresh press.** On
  crit-5, the `gameover` branch of `main.ts`'s `keydown` handler restarted
  the round on every `keydown` unconditionally. Dying usually happens
  mid-dodge, with a movement key still physically held — and a held key
  keeps sending `keydown` events (flagged `repeat: true`) for as long as
  it stays down, with no new player action at all. That auto-repeat was
  silently wiping the game-over screen and score before the player had a
  moment to see either, which is a real defect against the brief's own
  "play ends somewhere" requirement — the ending existed for a frame or
  two, then vanished on its own. Confirmed live with a temporary
  `window.__debug` hook: dispatched a real `keydown` (adds the key to the
  held-keys set), forced gameover, then dispatched a synthetic `keydown`
  for the *same* key with `repeat: true` — state flipped straight back to
  `"playing"`. Fixed with a one-line guard (`if (event.repeat) return;`)
  ahead of the restart call; verified a release-and-repress of the same
  key, or a fresh different key, still restarts immediately. General
  lesson for any "any key restarts / dismisses / advances" handler: check
  `event.repeat` specifically whenever the state being entered or exited
  is one a player is likely to already have a key held down for — a
  death mid-movement, a dismiss-on-keypress overlay shown while a key was
  already down for some other reason, anything where the *triggering*
  state change and the *held key* aren't independent events.
  **Extended (crit-5, tenth run, 2026-08-29):** the same gap recurred one
  keydown branch over, in a toggle rather than a state transition — the
  same handler's Space-to-swap-hue branch flipped the player's colour on
  every keydown, so holding Space past the OS auto-repeat threshold
  flickered the hue uncontrollably with no further player action. Fixed
  with the identical guard, verified the pointer/click path to the same
  control was unaffected. The general lesson widens past
  "restarts/dismisses/advances a *state*": any `keydown`-bound action
  that's meant to fire once per physical press — a toggle, a discrete
  step, a single shot — needs the same `event.repeat` check, not just
  handlers that gate a state transition. When auditing a `keydown`
  handler for this, check *every* branch's action against "would this
  still be correct if called N times for one held key," not just the
  branches that change game/UI state.
- **A palette swap is easy to apply incompletely — grep for every colour
  literal across the whole codebase, not just the file where the mechanic
  lives.** On crit-5, the colourblind-safety hue swap (teal/pink → sky
  blue/amber) landed cleanly in `main.ts` where the game logic is, but
  `styles.css`'s decorative nav-link colour was never touched and kept
  rendering the retired pink for two further runs before a Lighthouse pass
  incidentally surfaced it. Not an accessibility bug by itself (a lone link
  colour has nothing to be confused with), but a genuine consistency defect
  — the site's own chrome disagreed with the palette the game had just
  adopted. Whenever a future crit swaps a colour for accessibility or any
  other reason, grep the whole repo for the old hex literals (CSS, TS,
  SVG/PNG assets) before considering the swap done, not just the file the
  bug report named.
- **To check whether a game/interaction's colour pair is distinguishable
  under colour-vision deficiency, compute it — don't try to render or
  screenshot a simulation.** `agent-browser` has no CVD emulation
  (Chrome DevTools' own `Emulation.setEmulatedVisionDeficiency` isn't
  exposed through it, same gap as the missing zoom/print-media/touch
  primitives already logged above). Instead, apply the Machado, Oliveira &
  Fernandes (2009) simulation matrices directly to the two hex colours in
  Node: convert sRGB→linear, multiply by the published 3×3 matrix
  (verified against the `colour-science` Python library's own dataset via
  WebFetch before trusting the numbers — protanopia
  `[[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]]`,
  deuteranopia
  `[[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]]`,
  tritanopia
  `[[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]]`),
  convert back linear→sRGB, then compare Euclidean RGB distance against
  the un-simulated distance. On crit-5 this caught a real, otherwise
  invisible failure: teal `#2dd4bf`/pink `#f472b6` simulate to RGB distance
  ~27 under deuteranopia (vs ~222 normally) — a colourblind player
  literally couldn't tell them apart, in a game whose entire rule is
  telling them apart. Also check the replacement pair's contrast against
  the actual background colour (WCAG relative-luminance formula, same
  computation), not just its CVD separation — a pair that's well-separated
  under simulation but low-contrast against a dark canvas (a plain navy
  scored 1.64:1 against this game's `#171b2e`, versus teal's 9.15:1) would
  trade one accessibility problem for another. This generalises to any
  future crit/assignment whose mechanic or content depends on
  distinguishing colours by hue alone.
- **A temporary, uncommitted debug hook on `window` is the way to
  playtest a game whose real state (obstacle positions, elapsed time,
  score) lives in module scope with no DOM/CSS trace to read from
  outside.** Same shape as crit-4's `AudioContext`-capture technique, but
  for game state instead of an audio node: add a getter
  (`window.__debug = { get state() { return {...} } }`) right after the
  page's own setup code, rebuild, drive real input via `agent-browser`
  (dispatched `KeyboardEvent`s for swap/move, `PointerEvent`s for drag),
  and poll the getter with `eval` between actions. On crit-5 this let a
  scripted bot play a real ~5-minute session against the live build and
  prove the post-ramp difficulty doesn't become an unfair wall — something
  arithmetic on `fallSpeed`/`spawnIntervalMs` alone couldn't settle.
  Revert the hook before running `pnpm check`/committing; it's a
  verification tool, not a shipped feature.
- **A fix for a benign edge case can introduce a worse one — trace the fix's
  own new code path through the game's per-frame logic before committing it,
  not just whether it clears the symptom you set out to fix.** On crit-5, a
  real window resize mid-round (via `agent-browser set viewport` after
  `open`, using the `window.__debug` technique above to read module-scoped
  state — distinct from the `style.zoom` reflow check logged elsewhere,
  which a prior run had already found to be a testing-artifact false lead
  for this specific canvas) surfaced a real gap: `resize()` reclamps the
  player's x to the new, possibly-narrower canvas width but never touches
  in-flight obstacles, so one can end up positioned outside the new bounds —
  invisible and unreachable until it falls past the bottom and gets culled
  normally. This is fully benign: no crash, no leak, and no effect on the
  outcome, since an unreachable obstacle can neither kill the player nor be
  matched. The obvious fix (reclamp obstacles' x the same way, one line in
  `resize()`) built and looked correct at a glance — a live resize test even
  showed obstacles correctly repositioned within the new bounds. But tracing
  the timing carefully rather than trusting that one clean test run: `update()`
  runs unconditionally on the very next `requestAnimationFrame` tick after a
  resize, using whatever position `resize()` just set, so the clamp can
  teleport a previously-unreachable, different-hue obstacle onto the
  player's exact current position and end the round on the next frame —
  purely from a window resize the player took no action to cause. That is
  strictly worse than the bug it fixed: the original quirk can never affect
  the outcome, while the "fix" can produce a genuinely unfair, unreactable
  death, directly against this crit's own "a collision has to feel fair"
  ethos (echoing the doctrine's own line, "only playing can tell you whether
  the collision feels fair"). Reverted rather than shipped; no commit. The
  general lesson: for any fix to a rare/benign edge case in something with a
  per-frame update loop, ask what the fix's own new code path can produce in
  combination with the *next* tick of that loop, not just whether it now
  passes the specific scenario you were testing — "the live test passed"
  and "the fix is actually an improvement" are different claims, and the
  gap between them only shows up by reasoning through frame-by-frame
  ordering, not by re-running the same test again.
- crit-1 and crit-2 are both fully finished and pushed (reflections written,
  all checks green, doctrine finishing steps done — crit-2 also had a
  deepening pass find and fix two real issues, see `now.md`). Both repos have
  stayed private throughout (confirmed again 2026-08-11: `api.github.com`
  still 404s on `comp4020-crit2-baishi`), so the live Pages URL has never
  been checked — per the harness-owned-shipping entry just above, this isn't
  something a run needs to *do* anything about, just something worth a
  read-only check once a repo is public.
- `comp4020-ass1-baishi` (slider-based ink-shrimp explainer) is now **fully
  shipped**, done at 21h-to-cutoff (2026-08-16, ~15:00): wrote
  `reflections/assignment-1.md` (285 words, both standing prompts, the
  shrimp-geometry moment as the named breakthrough since it's the most
  demo-able for the week 4 retro this same entry doubles as), re-verified
  `pnpm check` green and both marking viewports console-clean against a
  local `pnpm preview`, confirmed `pnpm check:evidence` fully clean
  (reflection + all 5 `PROCESS.md` citations resolve), committed
  (`7d9a8c8`) and pushed to `origin/main`. Repo still 404s on
  `api.github.com` and its Pages URL as of this push — expected, shipping
  (visibility flip + Pages enable) is harness-owned, not something this
  agent has credentials for. Nothing left for this deliverable except a
  read-only live-URL check once the repo goes public.
- Writing `PROCESS.md` incrementally during a build/deepen run (not only in
  the inside-24h finishing steps) worked well twice now — crit-2's two
  deepening fixes and assignment-1's shrimp-geometry fix were both written
  up while fresh rather than reconstructed at cutoff. Keep doing this: it's
  consistent with the doctrine's finishing-step requirement, just done
  early, and a stale template left untouched until the last day is a worse
  failure mode than an early draft that gets extended later.
  **Extended (crit-5, 2026-08-26):** this now holds from the very first
  build run, not just deepen runs — crit-5's `PROCESS.md` was written with
  three genuine cited moments on the same run the game was first built,
  before any deepening pass existed to defer it to. Nothing about the
  moments-format needs the repo to be further along first; a first-run
  build already has real decisions worth citing (a design call, a testable
  rule, a bug found by playing).
- Every deliverable's template ships `public/card.png` as a literal
  dashed-border "Replace this card" placeholder image, and nothing in
  `pnpm check` or CI catches an unreplaced one (the invariants only check
  the `og:image` meta tag's *presence*, per `spec/README.md` — a path that
  resolves to the placeholder still passes). Replace it as an early
  build-phase task on every new deliverable, not something deferred to
  finishing steps: on crit-5, a quick `agent-browser`-rendered 1200×630 card
  (dark background, the game's own two hues, one-line pitch) done during the
  first build run took a couple of minutes and closed the gap immediately,
  rather than leaving a giveaway placeholder live on a link preview for
  however many runs the repo stays in build/deepen phase.
- Pushing to `origin/main` is not just a final-run step — every crit-4 run
  logged above pushed after its own commits, mid-week, not only at cutoff,
  and crit-5's first build run (2026-08-26) followed the same pattern
  deliberately: the doctrine's own framing ("commits and `memory/` are the
  only continuity" between runs) implies a future run's starting state is
  whatever's on `origin/main`, not necessarily this run's local working
  tree. Local-only commits are one dropped/fresh checkout away from being
  invisible to the next run. Push at the end of every run that has commits
  worth keeping, not just the one the prompt names "last."
- A "no tutorial, teaches itself" constraint (crit-5's game brief; may recur
  for the final project) is satisfiable by pacing rather than by any visible
  affordance text: design the opening state so the *first* consequence of
  each new rule is cheap and unambiguous (crit-5's first obstacle is sparse
  and 50/50 on colour, so an early hit is either an obviously-avoidable miss
  or a same-colour pass-through that reads as "that was fine"), then let
  necessity teach the harder rule once the easy strategy (dodge everything)
  stops being sufficient. This generalises past this one game: any
  self-teaching interaction can be checked by asking "what does a first-time
  player's very first mistake actually cost them, and does its consequence
  alone explain the rule."
- A game/interaction whose entire rule rests on distinguishing two colours
  (crit-5's same-hue-safe/different-hue-fatal mechanic) has a colourblind-
  accessibility failure mode no generic a11y sweep (axe-core, html-validate)
  will ever catch, because the "content" is drawn canvas pixels with no
  text alternative to check — a colourblind player may be structurally
  unable to tell the two hues apart, i.e. unable to play at all, not just
  inconvenienced. Not yet checked on crit-5 (see its `now.md`); the general
  technique for a future run: verify the chosen hue pair against a
  colour-vision-deficiency simulation (e.g. a protanopia/deuteranopia
  filter) before trusting "two visually distinct colours" as accessible on
  eye alone, and prefer pairs separated in lightness/shape as well as hue
  if the mechanic allows it.
- `comp4020-crit4-baishi` (Drift, the eight-pad pentatonic instrument) had a
  full deepening pass on 2026-08-19, 160h-to-cutoff: closed the audio-liveness,
  audit-battery, and card.png threads the prior run's `now.md` had opened (see
  `now.md` for detail), and found + fixed a real self-introduced desktop
  layout regression along the way (see the `vw`-vs-container-width entry
  above). All 8 commits pushed to `origin/main` (`b2de0d1`). A later run on
  2026-08-20, 136h-to-cutoff, found and fixed a genuinely new bug in the same
  repo (see the blur/visibilitychange entry below) — pushed at `b48a2d4`. A
  third run the same day, 130h-to-cutoff, closed the specific lens that
  fix's own `now.md` had flagged as the next thing to try (does the
  `AudioContext` itself ever need a resume-on-focus handler distinct from
  the voice-release one) plus a previously-untried live keyboard-brightness
  check — both came back "checked, nothing to fix" (see the
  constructor-capture entry above), no commits. A fourth run, 2026-08-21,
  119h-to-cutoff, tried the real-mouse-drag-glissando and analyser-based
  pitch-correctness angles (see the two entries just above) — also came
  back "checked, confirmed correct," no commits. A fifth run the same day,
  112h-to-cutoff, found one genuinely untried angle left (audio-domain
  proof of the vertical brightness/filter sweep, see the entry just above)
  and it too came back "checked, confirmed correct," no commits. A sixth run
  the same day, 106h-to-cutoff, found one more genuinely untried angle (full
  8-voice chord headroom/clipping, see the entry just above) — also
  "checked, confirmed correct," no commits. The technical audit battery for
  this repo is now exhausted across six runs and two full days without a
  single further finding — a future run should treat "I can't think of an
  untried technical check" as the expected state here, not a reason to
  invent one. Only open thread left: pad-count/range untested against a
  real naive player — needs the studio crit itself, not another
  self-administered probe. Not the last run — no reflection yet, correctly.
  A seventh run, 2026-08-22, 95h-to-cutoff, found a real bug anyway — not via
  another sensor, but by re-reading the brief's own interaction clauses one
  at a time against the current code (see the brief-clause-re-derivation
  entry below): Tab+Enter/Space activation only ever gave a fixed 180ms blip
  regardless of hold duration, unlike every other input path's real sustain.
  Fixed and pushed (`bbd50d6`/`bd3ff2a`). The exhausted-sensor-battery
  framing above was correct for *sensors* but doesn't mean "nothing left to
  find" — a different search method found something real. An eighth run the
  same day, 88h-to-cutoff, reapplied the identical technique to the
  blur/visibilitychange fix itself (moment 5) and found it only covered the
  whole page losing focus, not focus moving within the page: holding Space
  on a pad then tabbing to the next one without releasing left the first pad
  droning forever, since the eventual `keyup` targets wherever focus
  currently is, not the pad focused at keydown. Fixed with a `focusout`
  listener, pushed (`3bbf17a`/`99b75db`). Two real bugs found this way in a
  row — see the updated brief-clause-re-derivation entry above for the
  generalised lesson. A ninth run, same day, 82h-to-cutoff, applied the
  identical technique a third time to that `focusout` fix itself (the
  specific edge case its own `now.md` had flagged: does releasing on *any*
  focus-loss reason ever end a note early during a cross-modal chord) and
  this time came back clean — see the entry above for the mechanism
  (pointerdown's existing `preventDefault()` already stops pointer input
  from stealing focus off a keyboard-held pad). No code change, no commit.
  A tenth run, 2026-08-23, 71h-to-cutoff, tried one more genuinely untried
  angle — real pointer-drag audio-domain proof of the brightness sweep, as
  opposed to the keyboard-arrow version already checked (see the entry
  above) — also came back "checked, confirmed correct," no commits. An
  eleventh run, same day, 64h-to-cutoff, re-read `main.ts`'s own comments
  clause-by-clause (not the brief this time — the code's own claims) and
  found one never live-tested: the Tab+Enter/Space fix's comment claims
  `event.preventDefault()` on `keydown` stops the button's native
  click-activation from also firing the separate assistive-tech `click`
  fallback (a different voiceId, `click-x` vs `focus-x`, so a real
  double-fire would layer two live oscillators, not no-op). See the
  oscillator-count-patch entry below for the check and result — also came
  back "checked, confirmed correct," no commits. A twelfth run, 2026-08-23,
  58h-to-cutoff, found one more genuinely untried angle: real independent
  multi-touch through the `pointerPads` Map itself, not the mouse+keyboard
  stand-in every prior chord/headroom check had used (see the
  pointerPads-cardinality entry above) — also came back "checked, confirmed
  correct," no commits. A thirteenth run, 2026-08-24, 47h-to-cutoff, found a
  new real gap by reading the stylesheet fresh against real-device touch
  defaults rather than another synthetic probe: `.pad` had no
  `-webkit-tap-highlight-color` override (see the entry above). Fixed
  pre-emptively — the visual artifact itself is unverifiable in this
  sandbox — and pushed (`1eef57a`/`1a62142`). A fourteenth run, 2026-08-24,
  40h-to-cutoff, followed up on that run's own flagged next-action
  (pinch-zoom/user-scaling) and found another real gap in the same vein:
  `body` had a blanket `touch-action: none` blocking pinch-zoom
  page-wide, not just on the pad row it was meant to protect (see the
  touch-action-scoping entry above). Scoped to `.instrument`, verified via
  `getComputedStyle` and a live mouse-drag re-check, pushed
  (`000b512`/`778efcb`). Not the last run. A fifteenth run, 2026-08-24,
  34h-to-cutoff, was the final run: extended the same CSS-property-literacy
  lens the prior two runs had found live in (the `now.md` handoff had
  flagged `forced-colors`/`prefers-contrast` as untried variants) and found
  one more real, unverifiable-in-sandbox gap of the same shape —
  `.pad` is `appearance: none; border: none`, getting its whole visible
  circle from a `background` gradient and `box-shadow`, both forced to
  `none` under Windows High Contrast (`forced-colors: active`), so a pad
  would render as a bare letter with no boundary. Fixed with a
  `@media (forced-colors: active)` rule borrowing MDN's own documented
  fix shape (a `ButtonBorder`/`Highlight` border), confirmed scoped
  correctly via `getComputedStyle` reporting the ordinary-mode border
  unchanged (`806c2da`). Then ran the full finishing routine: local
  `pnpm check`/`check:evidence` green, both marking viewports
  screenshotted and console-clean against a real `pnpm preview`,
  `PROCESS.md` extended to a 10th cited moment (`06d6bc5`), wrote
  `reflections/crit-4.md` (289 words, both standing prompts, naming the
  clause-by-clause re-derivation technique as the breakthrough since it's
  what kept finding real bugs after the automated sensor battery had gone
  dry six-plus runs running), committed and pushed (`fe72eca`). This
  deliverable is now **fully shipped** — this was the last run for
  `comp4020-crit4-baishi`.
- **A sustained-note instrument (anything with press-and-hold voices) needs a
  blur/visibilitychange check, not just a press-then-release check.** On
  crit-4's Drift, every prior interaction test had driven a full
  keydown→keyup or pointerdown→pointerup cycle on a page that stayed focused
  the whole time — so nothing had ever exercised the ordinary real-world case
  of alt-tabbing away while still holding a key or pointer down. Confirmed
  live: dispatch a real `keydown`/`mousedown`, then `window.dispatchEvent(new
  Event('blur'))` (or flip `document.hidden` and dispatch
  `visibilitychange`) with *no* matching release, and check whether the
  pad/voice state ever clears. On Drift it didn't — `keyup`/`pointerup` only
  fire on a page that's still focused, so a backgrounded tab has no way to
  ever hear the release, and the note drones forever. This is a real,
  accidentally-triggerable bug against "no fail state," not a theoretical
  edge case, and none of axe-core/html-validate/Lighthouse/a keyboard
  tab-order walk would ever catch it — it's specific to hold-to-sustain
  interaction models. Fix: a `releaseAllVoices()` wired to both `blur` and
  `visibilitychange`, releasing every tracked voice through the instrument's
  normal release envelope. Worth checking on any future crit/assignment
  built around press-and-hold (a synth pad, a held button, a drag-to-sustain
  control) — the same gap will exist wherever release depends on an event
  that only fires while the page stays focused.
- **A boolean/mutable flag set by one event and only ever cleared by that
  same event's natural counterpart will leak whenever something *else*
  ends the interaction first.** This is the same shape as the
  blur/visibilitychange lesson above (a `keyup`/`pointerup`-only release
  misses a backgrounded tab), but it generalises past focus loss to any
  forced state transition. On crit-5, `dragging` was set `true` on
  `pointerdown` and only ever set `false` on `pointerup`/`pointercancel`
  — nothing accounted for the *game* ending the interaction instead (a
  fatal collision arriving while the pointer was still physically down,
  which has no matching pointerup to clear it). `pointermove` kept
  applying the drag to the player position under the game-over overlay
  because it only checked its own flag, never the broader state machine.
  Confirmed live with a temporary debug hook: forced the collision
  mid-drag, then kept moving the pointer, and watched the tracked position
  keep changing while the game state stayed "over." Fixed by having the
  state-transition function (`gameOver()`) clear the flag itself, the same
  pattern the existing `releaseHeldInput()` already used for focus loss —
  once one place resets it, every consumer's existing guard on that flag
  takes over for free. General check for a future crit: for every mutable
  flag an input handler sets on its own "start" event, find every *other*
  way the interaction it represents can end (not just that handler's own
  natural end event) and confirm each one clears the flag too — a review
  technique distinct from re-reading handlers in isolation, since the bug
  only exists in the combination of two handlers that each look correct
  alone.
- **The same "shared mutable flag" shape recurs one dimension over: a flag
  that's fine when only one instance of its triggering event can ever be
  active at once (true for a mouse — exactly one pointer) breaks the
  moment a second concurrent instance becomes possible (true for touch —
  multiple simultaneous pointers).** On crit-5, `dragging` (before the
  gameOver-clearing fix logged above) was a plain boolean: any
  `pointerdown` set it true, any `pointerup`/`pointercancel` set it false,
  with no record of *which* pointer was actually dragging. This is
  identical in kind to crit-4's `pointerPads` Map lesson (a map keyed by
  an identity needs its cardinality tested, not just single-entry
  behaviour) but here the bug was a scalar with no identity at all rather
  than a map misused. Confirmed live with a temporary `window.__debug`
  hook and two independent synthetic `PointerEvent` identities: pointer A
  dragged normally, pointer B (an incidental second touch elsewhere on
  the canvas — a palm edge, a bracing finger) went down and immediately
  up, and pointer A's next move was silently dropped even though A was
  never released — B's unrelated release had cleared the shared flag.
  Fixed by replacing the boolean with `draggingPointerId: number | null`
  and checking `event.pointerId === draggingPointerId` at every
  read/write site. **Testing wrinkle worth recording separately:**
  `canvas.setPointerCapture()` throws `NotFoundError` for a second
  synthetic pointerId dispatched while a first synthetic pointer already
  holds capture, even though a lone synthetic pointerId dispatched by
  itself captures fine — this is a limitation of simulating multi-touch
  via `dispatchEvent` (same family as the already-logged `-p ios`/
  `xcrun simctl` gap: only genuine hardware creates fully independent
  active-pointer sessions), not evidence the app's code path is wrong.
  Don't let that exception alone read as "the app throws" — isolate
  whether the *bug being tested* (here, a flag transition) still
  reproduces via the parts of the sequence that don't depend on capture
  succeeding (B's `pointerdown`+`pointerup` alone, independent of whether
  its `setPointerCapture` call threw, was enough to prove the flag leak).
  General check for any future crit with a canvas/DOM element that could
  ever receive two pointers at once (a drag surface, a multi-touch
  instrument, a two-finger gesture): grep for a bare boolean tracking
  "is something being dragged/pressed/held" and ask whether it would
  survive a *second*, unrelated pointer's full down-then-up cycle
  happening in the middle of the first one's gesture.
- **Multi-voice headroom is a distinct claim from single/two-voice liveness
  and needs its own audio-domain check.** Every earlier analyser-splice check
  on Drift (liveness, chord mixing, glissando pitch tracking, filter-sweep
  audibility) used at most a two-note chord — none had ever driven the
  instrument to its actual maximum simultaneous-voice count. On a sixth run
  (2026-08-21, 106h-to-cutoff), held a real `mouse down` on pad 1 (genuine
  gesture, resumes the context) then layered in the other seven pads via
  synthetic `keydown` (safe once the context is already running — the
  autoplay-gate caveat only applies to the *resuming* gesture, not
  subsequent voices added after resume) to build the full 8-note chord Drift
  can ever produce, and read `getFloatTimeDomainData` off the spliced
  analyser: peak 0.85 with zero samples at the ≥0.999 clipping threshold —
  the `DynamicsCompressor` in the signal chain (`main.ts`'s `ensureAudio`)
  keeps real headroom even at maximum simultaneous load, confirmed by
  measurement rather than assumed from the node existing. Also confirmed the
  release side of the same scenario: releasing all 8 (real `mouse up` +
  synthetic `keyup` ×7) dropped every pad's `.active` class immediately, and
  the analyser read a genuinely decaying signal — 0.13 peak ~0.6s after
  release (the 0.28s-delay/0.32-feedback echo tail still audible, expected)
  falling to ~3.5e-17 (silence) by ~2s — no stuck voice, no leaked
  oscillator continuing to render after every key was up. Console stayed
  clean throughout. "Checked, confirmed correct," no code change. The
  general lesson: for any instrument whose voices share a bus with limited
  headroom (a compressor, a fixed-gain mixer), the audio-liveness technique
  above only proves *a* signal exists — proving the design's actual ceiling
  case (every voice at once) doesn't clip needs the same technique deliberately
  pushed to that ceiling, not just to two voices for convenience.
