# SLOP2950 — Weaponised Etiquette

This is a fictional-course content site (Astro + Content Collections), built
on a fixed platform documented in `README.md`. The rules below are the ones I
hold myself to when working in this repo.

## Content tone

The course studies public-etiquette violations analytically — case studies of
a norm, not literal second-person instructions ("do X to a stranger"). Keep
all content (lectures, sessions, assessments, the hero copy, policies) in that
descriptive/cataloguing voice. Never write content that reads as genuine
advice to cause real harm (deliberately spreading illness, endangering
someone, deceiving them about safety). The Live Practicum is the one
place the course asks students to act rather than observe, and it is scoped
narrowly (a supervised Drop-in Session, a consenting cohort) — see
`src/pages/policies/index.mdx` for the exact boundary. Any new content that
touches the Practicum should respect that boundary rather than widen it.

## Schema and date discipline

- `src/course-config.ts` is the single source of truth for course metadata —
  don't duplicate the code, dates, or title as a literal string elsewhere.
- Every `week`, `date`, or `due` field in `src/content/**` must fall between
  `courseMeta.startDate` and `courseMeta.endDate` (this is what
  `spec/data-integrity.test.ts` checks). Adding or moving content means
  checking the date is still in range, not just plausible.
- `assessments` with `marking.mode: weighted` must have criteria weights that
  sum to exactly 100 — Zod enforces this at build time, but check it by hand
  before running the build.
- Any `related:` reference must point at a real collection entry
  (`lectures/week-04`, `sessions/orientation`, etc.) — a stale reference after
  a rename or delete fails the build's dangling-ref check.

## Before considering a slice done

- `pnpm check:evidence` must pass — no `STARTER_CONTENT` markers left in
  `src/`, and the starter placeholder images must be replaced or deleted
  (not just renamed).
- `pnpm check` (typecheck + build + `spec/`) must be green.
- Load `pnpm dev` and actually look at the page a change touches before
  calling it done — a passing build doesn't confirm the content reads
  correctly or that a link resolves to the right place.
- "Look at the page" means actually reading the rendered output, not just
  confirming the dev server returns 200 — a duplicated "Week N:" title sat
  on all 12 lecture pages, undetected by every build/typecheck/test run,
  until a full-site screenshot pass actually looked at the `<h1>`. Schema
  and link checks don't substitute for this.
