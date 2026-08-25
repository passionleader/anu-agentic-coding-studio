# Crit 4 — Chord Session

This repository contains a static COMP4020 Crit 4 prototype. The goal is to
turn the browser into a playable musical instrument: `Chord Session` lets a
player choose chord pads and improvise a progression through live-generated
piano and bass sounds.

The deployed GitHub Pages site is the artefact that is assessed. Keep the
implementation small, expressive, and easy for a stranger to understand.

## Current direction

- Follow `Plan.md` as the current scope boundary.
- The core interaction is: activate a chord pad, hear a live chord, append it
  to the progression, and offer six possible next chords.
- Start with a small curated chord set. Do not add a large database or advanced
  DAW features until the core instrument is already playable.
- Drums, rhythm editing, tempo, time signatures, arpeggios, and save slots are
  optional extensions, not part of the first implementation. Keep the first
  version structured so these features can be added later without replacing the
  chord-selection interaction.

## Extension path

When the core instrument is stable, extend it in small independent slices:

- Keep chord data, the current progression, and the player's settings separate
  from the DOM so future controls can use the same state.
- Keep sound scheduling behind a small audio layer. Chord playback should not
  be tightly coupled to button rendering, so drum patterns and arpeggios can
  use the same audio context later.
- Represent tempo as BPM and keep timing calculations in one place. Do not use
  scattered `setTimeout` values that would make tempo changes unreliable.
- Represent piano, bass, and future drum parts as separate pattern or voice
  data. This leaves room for editable rhythms such as one hit, syncopation, or
  four-on-the-floor without changing how a chord is selected.
- Add time signature and tempo controls only after a shared beat or step clock
  exists; all rhythmic parts should follow that clock.
- Treat save slots as serialised session data containing the progression,
  patterns, tempo, and settings. Do not save live `AudioNode` objects.
- Each extension must preserve live-generated sound, mouse/keyboard/touch
  playability, no-failure interaction, and a clear first-use experience.

Do not build these abstractions speculatively before the smallest instrument
works. Add them when the corresponding feature is chosen, with a focused
commit and a check or manual test that demonstrates the new behaviour.

## Audio and interaction rules

- Generate sound live with the Web Audio API; do not use prerecorded playback.
- Use one shared `AudioContext`, with oscillator or buffer sources routed
  through gain control as appropriate.
- Resume the audio context from a clear user gesture so the browser autoplay
  policy is respected.
- Support mouse, keyboard, and touch through the same meaningful interaction.
- Make the opening screen invite the first action without requiring a verbal
  explanation.
- Every chord choice should be valid. There is no score, fail state, or way to
  play the instrument incorrectly.
- Prioritise low latency, comfortable timing, smooth envelopes, and avoiding
  clicks over adding more sound types.

## Design guide

Use an original, vivid, energetic music-workstation interface inspired by the
clarity and professional feel of Logic Pro, but do not copy its branding,
icons, layout, or visual identity. An earlier near-black charcoal direction
read as too dark and gloomy in practice, so the palette moved to saturated
colour on a deep gradient background, with translucent, glass-like panels and
buttons — keep those readable (sufficient contrast, a visible surface even
before hover/focus) rather than merely decorative.

- Use a rich gradient background, layered glass (translucent, blurred) panels
  and buttons, thin borders, and vivid accent colours for chord categories.
- Organise the page into a compact top control bar (transport-style actions:
  undo, delete selection, play from start, speed, clear), progression/timeline
  area, main chord-pad area, bass/drum rhythm sections, and small status/help
  area.
- Make chord pads generous and tactile, with clear hover, keyboard-focus, and
  pressed states. A brief audio-reactive glow is useful feedback.
- Keep labels concise. Use a readable sans-serif for interface text and a
  monospace or tabular style for chord names and progression data.
- Prefer subtle shadows, small corner radii, and restrained motion. The visual
  design should support playing rather than compete with the sound.
- Make the first-use instruction prominent and tell the player exactly where to
  make the first sound.
- Test both desktop and phone layouts. Avoid tiny controls and horizontal
  scrolling.

## Working agreements

- Read `Plan.md` before proposing new features. If a change expands the core
  idea, explain the trade-off and update the plan before implementing it.
- Keep the site static and compatible with the existing Vite, TypeScript, and
  GitHub Pages setup unless a deliberate stack change is agreed first.
- Use semantic controls with visible focus states and usable touch targets.
- Keep the rendered page as the source of truth: run the dev server and inspect
  the result in a browser at desktop and mobile sizes.
- When a check fails, read its output and identify the cause before changing
  code. Do not silence or weaken a check just to make it pass.
- Run `pnpm check` after meaningful implementation changes. Run
  `pnpm check:evidence` before shipping.
- Commit small, coherent changes as the work progresses. Never commit a known
  red state.
- Keep `PROCESS.md` current with real commit citations and write the exact
  reflection file required for Crit 4 at `reflections/crit-4.md`.
- Never place API keys, tokens, passwords, or other credentials in tracked
  files.

## Before shipping

Confirm that the work is committed and pushed, the checks are green, the
reflection and process evidence are present, and the live GitHub Pages URL
loads with its assets. The final public site must work at both desktop and
mobile sizes.
