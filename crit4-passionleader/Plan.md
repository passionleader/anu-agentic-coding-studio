# Crit 4 Plan — Chord Session

## Idea

`Chord Session` is a small browser instrument for improvising a chord
progression. It should feel like a focused mini-Logic: a stranger can open the
page, choose a chord, and immediately hear a musical response.

## Smallest useful version

The player activates a chord pad with a mouse, keyboard, or touch. The browser
generates a short piano-and-bass chord live, adds it to the current progression,
and updates a row of six possible next chords based on what has already been
played.

## Scope for this crit

- Use a small, curated chord set rather than building a complete chord database.
- Use one shared Web Audio API `AudioContext` and live-generated sounds.
- Make the first interaction obvious and handle the browser audio unlock safely.
- Keep the interface playable without instructions from the presenter.
- Make every chord choice valid; there is no score, failure state, or wrong move.

## Not in the first version

Drums, editable piano and bass rhythms, tempo and time-signature controls,
arpeggios, ten save slots, and a large external chord-combination database are
possible extensions, but they are not required for the first playable version.

## Extensions now in scope

Once the core instrument was playable, the idea expanded to a fuller session
tool, still built on the same state/audio separation above:

- Chord playback arpeggiates ("da-ra-ra-ra-ra") instead of striking all at
  once, and the player can switch the piano voice among piano, guitar,
  xylophone, marimba, and violin.
- A Logic-inspired top control bar adds undo, delete-selected-chord, play the
  progression from the start, a playback speed control, and clear — all
  reading and writing the same progression state and one shared tempo clock
  (`clock.ts`), not separate ad hoc timers.
- Bass and Drums sections offer a few named rhythm patterns (e.g.
  `ta-ta-ta-ta`, `ta--ta-ta--`) applied once per chord press rather than a
  free-running transport, keeping chord pads the primary interaction.
- The six starting chord pads are drawn randomly (but tonic/subdominant or
  dominant-balanced) from the curated set each session, rather than always
  showing the same six.

True tempo/time-signature editing, a full drum kit, and save slots remain out
of scope.

## Success check

A stranger should be able to open the page, understand what to press, and make
different-sounding live chord sessions using mouse, keyboard, or touch.

## English brief for Claude

> Build an instant-play browser instrument called **Chord Session**. The user
> should be able to choose a chord pad with a mouse, keyboard, or touch and
> immediately hear a live-generated piano-and-bass chord. Add the chosen chord
> to the current progression and show six possible next chords based on the
> progression so far. Start with a small curated chord set. Use one shared Web
> Audio API `AudioContext`, handle the browser's autoplay policy, and make the
> first action obvious to a stranger. There must be no score, failure state, or
> wrong way to play. Prioritise responsiveness, musical feel, and a polished
> dark music-workstation interface over extra features. Do not add drums, rhythm
> editing, tempo controls, arpeggios, or save slots until the core instrument is
> working and playable.

## Design direction

Use a vivid, energetic music-workstation mood inspired by tools such as Logic
Pro, while creating an original interface rather than copying its layout or
branding. The original near-black charcoal direction read as too dark and
gloomy in practice, so the palette moved to saturated colour on a deep (not
flat-black) background, with translucent, glass-like panels and buttons.

- Use a rich gradient background with layered, semi-transparent glass panels
  and vivid accent colours for chord categories.
- Create a clear hierarchy: compact top bar, progression/timeline area, main
  chord-pad area, and a small status/help area.
- Make chord pads feel like physical controls: generous hit areas, clear hover
  and focus states, a visible pressed state, and a short audio-reactive glow.
- Keep text labels concise and use monospace or tabular styling for chord names,
  BPM-like values, and progression information.
- Use thin borders, soft shadows, small corner radii, and restrained animation;
  avoid decorative gradients that compete with the instrument.
- Keep the first-use prompt prominent: tell the player exactly where to make
  the first sound, then let the interface recede while they play.
- Check the layout at both desktop and phone widths. The instrument must remain
  comfortable to play without tiny controls or horizontal scrolling.
