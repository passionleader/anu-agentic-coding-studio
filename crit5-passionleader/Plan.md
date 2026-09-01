# Crit 5 Plan — Retro Run & Gun

## Idea

A tiny 1990s-style side-scrolling shoot-'em-up. The player starts with 3
lives and pushes right through a level, shooting monsters that stand in the
way, collecting fruit for score, and facing a boss at the end of each stage.
The opening screen must make the first move (walk right, shoot) obvious with
no instructions — the classic arcade run-and-gun feel should teach itself.

## Smallest useful version

The player moves left/right (and possibly jumps) with the arrow keys and
attacks with the spacebar. On load, the player is already standing in a level
with a monster visibly ahead, inviting an immediate first shot. A monster
takes 2 hits to die; a hit despawns the monster and the player advances.
Walking into a monster costs a life; losing all 3 lives ends the run.

## Scope for this crit

- Side-scrolling movement (arrow keys) and a single attack button
  (spacebar), starting weapon: boomerang.
- Boomerang deals 1 damage per hit; monsters have 2 HP, so a monster needs
  two boomerang hits to die.
- A **gun pickup item**: once collected, spacebar fires the gun instead of
  the boomerang. The gun deals 2 damage, killing a monster in a single shot.
- Fruit pickups (banana, strawberry, etc.) add to the score on contact; they
  do not affect lives or health.
- 3 lives total; contact with a monster (or hazard) costs one life. Losing
  the last life ends the run (a losable game, per the crit's "must be
  losable" rule).
- 3 stages, each ending in a boss fight. Beating stage 3's boss is the win
  condition.
- Retro 1990s pixel-art look and feel; use free/open-licence sprite and sound
  assets where needed rather than drawing a full custom asset set from
  scratch.
- Static, client-side build only (no backend), deployable to GitHub Pages.

## Not in the first version

Multiple weapon slots beyond boomerang/gun, a weapon-switch key, mid-level
checkpoints/saves, a level editor, and networked or leaderboard features are
not required for the first playable version.

## Success check

A first-time player, with no instructions, can look at the opening screen,
immediately understand they should move right and shoot, and reach a win or
a loss (running out of lives) within about five minutes. One core rule (e.g.
"a monster with 2 HP dies after exactly two boomerang hits, or one gun hit")
has a focused automated test.

## English brief for Claude

> Build a small 1990s-style retro side-scrolling run-and-gun browser game.
> The player starts with 3 lives, moves with the arrow keys, and attacks with
> the spacebar. The starting weapon is a boomerang that deals 1 damage per
> hit; monsters have 2 HP, so they need two boomerang hits to die. A gun
> pickup item, once collected, replaces the boomerang as the spacebar attack
> and deals 2 damage, killing a monster in one shot. Fruit items (banana,
> strawberry, etc.) add to the score on pickup and have no effect on health
> or lives. There are 3 side-scrolling stages, each ending in a boss fight;
> defeating the stage-3 boss wins the game. Colliding with a monster costs a
> life, and losing all 3 lives ends the run — the game must be losable. Use a
> 1990s pixel-art retro visual style, sourcing free/open-licence sprite and
> sound assets where useful. The opening screen must make the first action
> (move right, shoot) obvious without any instructions, tutorial modal, or
> README explanation of controls.

## Design direction

Named inspiration: SEGA's arcade *Wonder Boy* — its tropical/jungle push to
the right, fruit scattered along the path, and chunky, saturated 16-bit
silhouettes set the mood for this prototype. Take the mood, not the IP: no
copied character art, logo, or box art from the original game — ship an
original look that reads the same way, the same discipline crit4 applied to
being "inspired by Logic Pro" without copying its branding.

Classic 16-bit-era arcade run-and-gun aesthetic: chunky pixel sprites, a
scrolling tiled background, a visible HUD (lives, score, current weapon), and
punchy, readable feedback for hits, pickups, and deaths (flash/shake on hit,
a clear pickup pop for fruit and the gun). Keep the screen legible at a
glance — monster, player, and projectiles should be instantly distinguishable
by silhouette and colour, not just by label.

Source free/open-licence sprites, tiles, and audio (BGM and SFX) rather than
drawing or synthesising a full custom asset set from scratch, wherever a
sourced asset makes a scene noticeably better than a placeholder would.
Record each asset's origin and licence in `public/assets/CREDITS.md`.

Revisited mid-crit: after a playtest-driven review, hand-authored originals
now supersede the entire sourced set — monster, background (sky/hills/ground/
plants/tree), player, and the gun (drawn directly in `main.ts`, no PNG) — the
author drew these with Python/Pillow and synthesised the SFX with Python's
stdlib `wave`. The player and tree each needed a second pass before the user
approved them: the player's first draft (a human figure) was rejected as too
rough, and its chibi-cat replacement was then found to render too large next
to the monster — not a design problem but a preview bug (the review page
compositing sprites at native PNG pixel size rather than the game's real
feet-anchored scaling); once caught, `main.ts`'s `PLAYER_SPRITE_HEIGHT` and
`BASE_MONSTER_SIZE` render constants were retuned to the size the user asked
for. The tree's first draft was rejected as too plain; its replacement (a
thicker curved trunk, fanned canopy, coconuts) was approved outright.
