// Level content: 3 stages, MAPS_PER_STAGE maps each, the last map of a stage
// always a boss. Kept separate from main.ts so the render/update loop isn't
// buried under content data — this file only builds specs, it doesn't touch
// the DOM or canvas.
import { bossHp, MONSTER_MAX_HP } from "./game-rules.ts";

export interface StageDef {
  monsterHp: number;
  monsterScale: number;
  monsterAttacks: boolean;
  bgTint: string | null;
  gunOnThisStage: boolean;
}

export const MAPS_PER_STAGE = 5;
export const MAP_WIDTH = 1600;

export const STAGES: StageDef[] = [
  { monsterHp: MONSTER_MAX_HP, monsterScale: 1, monsterAttacks: false, bgTint: null, gunOnThisStage: false },
  { monsterHp: 3, monsterScale: 1.25, monsterAttacks: true, bgTint: "rgba(255,140,40,0.16)", gunOnThisStage: true },
  { monsterHp: 4, monsterScale: 1.5, monsterAttacks: true, bgTint: "rgba(20,20,70,0.42)", gunOnThisStage: false },
];

export interface MonsterSpec {
  x: number;
  hp: number;
  isBoss: boolean;
}

export interface PickupSpec {
  x: number;
  kind: "fruit" | "gun" | "heart";
  fruitEmoji: string;
}

export interface ObstacleSpec {
  x: number;
  width: number;
  kind: "block" | "gap";
}

export interface MapSpec {
  width: number;
  isBossMap: boolean;
  monsters: MonsterSpec[];
  pickups: PickupSpec[];
  obstacles: ObstacleSpec[];
}

const FRUIT_EMOJI = ["🍓", "🍌", "🍎"];

function spacedX(index: number, count: number, width: number, startFrac: number, endFrac: number): number {
  if (count <= 1) return width * startFrac;
  const t = index / (count - 1);
  return width * (startFrac + (endFrac - startFrac) * t);
}

export function buildMap(stageIndex: number, mapIndex: number): MapSpec {
  const stage = STAGES[stageIndex];
  const isBossMap = mapIndex === MAPS_PER_STAGE - 1;
  const width = MAP_WIDTH;

  if (isBossMap) {
    return {
      width,
      isBossMap,
      monsters: [{ x: width - 220, hp: bossHp(stage.monsterHp), isBoss: true }],
      pickups: [],
      obstacles: [],
    };
  }

  const monsterCount = 2 + mapIndex;
  const monsters: MonsterSpec[] = Array.from({ length: monsterCount }, (_, i) => ({
    x: spacedX(i, monsterCount, width, 0.35, 0.92),
    hp: stage.monsterHp,
    isBoss: false,
  }));

  const obstacleCount = mapIndex;
  const obstacles: ObstacleSpec[] = Array.from({ length: obstacleCount }, (_, i) => ({
    x: spacedX(i, obstacleCount, width, 0.48, 0.82),
    width: 46,
    kind: i % 2 === 0 ? "gap" : "block",
  }));

  const pickups: PickupSpec[] = [
    { x: width * 0.18, kind: "fruit", fruitEmoji: FRUIT_EMOJI[mapIndex % FRUIT_EMOJI.length] },
    { x: width * 0.65, kind: "fruit", fruitEmoji: FRUIT_EMOJI[(mapIndex + 1) % FRUIT_EMOJI.length] },
  ];
  if (stage.gunOnThisStage && mapIndex === 1) {
    pickups.push({ x: width * 0.42, kind: "gun", fruitEmoji: "" });
  }
  if (stageIndex === 2 && mapIndex === 0) {
    pickups.push({ x: width * 0.55, kind: "heart", fruitEmoji: "" });
  }

  return { width, isBossMap, monsters, pickups, obstacles };
}
