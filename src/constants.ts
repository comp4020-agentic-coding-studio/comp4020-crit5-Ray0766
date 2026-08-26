export const GRID_SIZE = 15;
export const CORE_X = 7;
export const CORE_Y = 7;

// The three original vessels — top/left/right edge midpoints — carry the
// heavier traffic: elite pathogens, and the only ones the wave-8 boss can
// come through. Four thinner minor vessels near the corners carry ordinary
// pathogens. Both sets are entrances on the pathing grid; nothing about BFS
// cares which tier a given entrance is, only render/vessels.ts and the spawn
// picker in game.ts do.
export const MAJOR_ENTRANCES: ReadonlyArray<readonly [number, number]> = [
  [7, 0],
  [0, 7],
  [14, 7],
];

export const MINOR_ENTRANCES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [14, 1],
  [1, 14],
  [13, 14],
];

export const ENTRANCES: ReadonlyArray<readonly [number, number]> = [
  ...MAJOR_ENTRANCES,
  ...MINOR_ENTRANCES,
];

export type EntranceTier = "major" | "minor";

export function entranceTier(x: number, y: number): EntranceTier {
  const isMajor = MAJOR_ENTRANCES.some(([ex, ey]) => ex === x && ey === y);
  return isMajor ? "major" : "minor";
}

export const MAJOR_VESSEL_WIDTH_CELLS = 1.6;
export const MINOR_VESSEL_WIDTH_CELLS = 0.7;

export const ELITE_HP_MULTIPLIER = 2.2;
export const ELITE_RADIUS_MULTIPLIER = 1.4;

export const CORE_MAX_HP = 20;
export const START_RESOURCE = 120;

// Flat price per unit level, however it's reached. Merging (and the position
// swap below) stays free on top of that, so building level 2/3 up through
// merges is cheaper than buying the tier outright — 2x level-1 is 50 against
// a direct 70, 4x level-1 is 100 against a direct 140 — without either path
// being useless.
export const PLACE_COST_BY_LEVEL: readonly number[] = [25, 70, 140];

export const RESOURCE_ORB_VALUE_BASE = 8;
export const RESOURCE_ORB_VALUE_PER_WAVE = 2;
export function resourceOrbValue(waveNumber: number): number {
  return RESOURCE_ORB_VALUE_BASE + Math.max(0, waveNumber) * RESOURCE_ORB_VALUE_PER_WAVE;
}

export const RESOURCE_ORB_LIFETIME = 6; // seconds
export const RESOURCE_PICKUP_RADIUS_CELLS = 0.6;

export const TOTAL_WAVES = 8;
export const WAVE_GAP_SECONDS = 2.5;
export const SPAWN_INTERVAL_SECONDS = 0.7;

export interface UnitStats {
  rangeCells: number;
  damage: number;
  attackInterval: number; // seconds between shots
}

export const UNIT_LEVELS: readonly UnitStats[] = [
  { rangeCells: 2.5, damage: 1, attackInterval: 0.8 },
  { rangeCells: 3, damage: 2, attackInterval: 0.6 },
  { rangeCells: 3.5, damage: 4, attackInterval: 0.45 },
];
export const MAX_UNIT_LEVEL = UNIT_LEVELS.length; // 3

export interface WaveConfig {
  count: number;
  hp: number;
  speedCellsPerSecond: number;
  boss?: boolean;
}

export const BOSS_WAVE = TOTAL_WAVES;
export const BOSS_HP_MULTIPLIER = 14;
export const BOSS_SPEED_MULTIPLIER = 0.5;
export const BOSS_RADIUS_MULTIPLIER = 2.7;

export function waveConfig(waveNumber: number): WaveConfig {
  // waveNumber is 1-indexed.
  const hp = 3 + Math.floor(waveNumber * 0.8);
  const speedCellsPerSecond = 1.3 + waveNumber * 0.05;
  if (waveNumber === BOSS_WAVE) {
    return {
      count: 1,
      hp: Math.round(hp * BOSS_HP_MULTIPLIER),
      speedCellsPerSecond: speedCellsPerSecond * BOSS_SPEED_MULTIPLIER,
      boss: true,
    };
  }
  return { count: 6 + waveNumber * 3, hp, speedCellsPerSecond };
}

export const CORE_CONTACT_DAMAGE = 1;

export const SCORE_KILL = 10;
export const SCORE_BOSS_KILL = 500;
export const SCORE_WIN = 1000;
export const SCORE_PER_REMAINING_CORE_HP = 50;
