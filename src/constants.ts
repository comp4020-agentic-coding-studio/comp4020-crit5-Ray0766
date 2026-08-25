export const GRID_SIZE = 15;
export const CORE_X = 7;
export const CORE_Y = 7;

// Three vessels converge on the core, entering from three different edges.
export const ENTRANCES: ReadonlyArray<readonly [number, number]> = [
  [7, 0],
  [0, 7],
  [14, 7],
];

export const CORE_MAX_HP = 20;
export const START_RESOURCE = 30;
export const PLACE_COST = 10;
export const MERGE_COST = 8;
export const RESOURCE_ORB_VALUE = 4;
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
}

export function waveConfig(waveNumber: number): WaveConfig {
  // waveNumber is 1-indexed.
  return {
    count: 4 + waveNumber * 2,
    hp: 3 + Math.floor(waveNumber * 0.8),
    speedCellsPerSecond: 1.3 + waveNumber * 0.05,
  };
}

export const CORE_CONTACT_DAMAGE = 1;
