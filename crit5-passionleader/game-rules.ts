// Pure game-logic rules, kept free of DOM/canvas code so they stay testable
// in isolation (see spec/crit-5.test.ts) and reusable once the real render
// loop (main.ts) lands.

export type Weapon = "boomerang" | "gun";

export const MONSTER_MAX_HP = 2;
export const STARTING_LIVES = 3;

const DAMAGE: Record<Weapon, number> = {
  boomerang: 1,
  gun: 2,
};

export function applyHit(hp: number, weapon: Weapon): number {
  return hp - DAMAGE[weapon];
}

export function isMonsterDead(hp: number): boolean {
  return hp <= 0;
}

export function loseLife(lives: number): number {
  return lives - 1;
}

export function isGameOver(lives: number): boolean {
  return lives <= 0;
}

export const BOSS_HP_MULTIPLIER = 10;

export function bossHp(stageMonsterHp: number): number {
  return stageMonsterHp * BOSS_HP_MULTIPLIER;
}
