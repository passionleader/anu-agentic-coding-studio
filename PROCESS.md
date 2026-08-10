# Process overview

A reading-guide to how the work came together — a map to your process, not an
essay about it.

## What I built

An unsolicited redesign of [7-zip.org](https://www.7-zip.org/) on Astro: a
dark, high-contrast "developer tool" look with one unambiguous download CTA on
the home page, a feature grid replacing the original's wall of unstructured
text, a download page organised by platform instead of one long
version-by-version table, and an FAQ page using native `<details>/<summary>`
accordions so it stays fully static — no JS needed for a common, real
open-source project whose current site badly undersells it.

## The moments that mattered

1. **Hardcoded download links I couldn't verify.** The home page's first draft
   linked straight to guessed filenames
   (`7z2602-x64.exe`) for the primary CTA. That contradicts the whole point of
   an unsolicited redesign staying genuinely functional rather than a dead-end
   mockup — a filename I made up is exactly the kind of thing that goes stale
   or was never right. I checked it against the real download page with curl,
   confirmed the guess wasn't verifiable, and pointed the CTA at
   `https://www.7-zip.org/download.html` instead — a real URL I could confirm
   returns 200
   ([`fafe0e1`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/fafe0e1)).
2. **A base-path bug that only showed up by reading the built HTML.** Astro's
   `import.meta.env.BASE_URL` doesn't guarantee a trailing slash, so every
   internal link built as `` `${BASE}download/` `` silently concatenated wrong
   (`…passionleaderdownload/`) once the GitHub Pages subpath was configured.
   It looked fine in the source and only broke in `dist/index.html`'s actual
   `href` attributes — I caught it by grepping the built output before and
   after, not by trusting the code. Fixed by normalising `BASE` once in
   `src/consts.ts` rather than at every call site
   ([`60a8b6a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/60a8b6a)).
3. **Stylelint's `no-descending-specificity` forced a real restructure, not a
   suppression.** The first pass at `global.css` had `.card ul` after
   `nav[aria-label="Primary"] ul`, and `.card p` after `details p` — both
   flagged. Rather than disabling the rule, I read what it was actually
   telling me (declaration order should follow specificity order) and moved
   the `details`/`summary` and `.card` blocks earlier in the file so the
   cascade matches the rule's assumption
   ([`60a8b6a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit2-passionleader/commit/60a8b6a)).

None of these needed a new `CLAUDE.md` rule — the harness carried forward from
crit 1 had nothing custom to begin with, and this week's corrections were
caught and fixed within the session rather than needing a standing rule for
next time. If a similar base-path or specificity issue shows up again next
week, that's the point at which it'd earn one.
