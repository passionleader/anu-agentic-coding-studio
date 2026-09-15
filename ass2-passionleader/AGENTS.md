# Agent harness

This site is reviewed with a small set of role-scoped Claude Code sessions
(rules defined locally in `.claude/agents/`, which is machine-local and
untracked — see `.gitignore` — so their exact prompts aren't in this repo,
only the structure and rules they follow, below).

**Mechanism:** these five roles run as independent Claude Code CLI sessions
on the same machine rather than as Agent-tool subagents — the Agent tool's
custom subagent types weren't usable for this in the runtime this was built
on. The supervisor session coordinates them by name over cross-session
messaging (list peers, send a message, get notified when one goes idle) and
relays the `teaching-a`/`teaching-b` exchange by hand rather than scripting it.

## Roles

| Agent | Job | Effort |
|---|---|---|
| `design-assets` | Visual identity, hero/card art, imagery consistency | medium |
| `ux` | Navigation/IA, `related:` cross-links, accessibility | medium |
| `qa` | Runs `pnpm check`/`pnpm check:evidence`; reports failures verbatim | medium |
| `teaching-a` | Proposes/revises lecture & assessment copy | medium |
| `teaching-b` | Critiques `teaching-a`'s drafts (redundancy, schema fit, tone drift) and counter-proposes | medium |

The human session acts as supervisor at `xhigh` effort: it triages what each
agent reports, decides what to apply, and relays drafts between `teaching-a`
and `teaching-b` by hand rather than letting them iterate unsupervised.

`qa`'s checks are text/build-level only — they never render a page, so they
can't catch a layout, logo, or duplicated-heading bug. The supervisor covers
that gap directly: loading the affected pages (headless-browser screenshots
where no interactive browser is available) and looking at them, the same way
`CLAUDE.md` already asks for on a single-page change — see the site-wide
lecture-title duplication bug this caught, cited in `PROCESS.md`.

## Rules every agent follows

- Tone stays analytical/cataloguing (see `CLAUDE.md`) — no literal
  second-person harmful advice, and the Week 11 Practicum's supervised/
  consenting-cohort scope is never widened.
- Schema constraints from `src/content.config.ts`: `week`/`date`/`due` inside
  `courseMeta`'s range, `related:` refs must resolve, weighted
  `marking.criteria` sums to exactly 100.
- Design/UX/teaching agents report findings or diffs to the supervisor —
  they don't push, merge, or edit `spec/`, `CLAUDE.md`, or the schema files.
- Work happens on short-lived branches reviewed via PR before landing on
  `main`; no agent merges its own work.

## Why this exists

`PROCESS.md`'s job is to narrate design decisions and which of them got
encoded as a `CLAUDE.md` rule or a `spec/` check. Splitting review into
scoped roles with an explicit rule set (above) makes those decisions
attributable — a reviewer can see which constraint caught which change,
rather than one undifferentiated pass.
