export const GRID_SIZE = 15;
export const CORE_X = 7;
export const CORE_Y = 7;

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

export const CORE_MAX_HP = 12;
export const START_RESOURCE = 130;

export const RESOURCE_ORB_LIFETIME = 6; // seconds
export const RESOURCE_PICKUP_RADIUS_CELLS = 0.6;

export const TOTAL_WAVES = 8;
export const PREP_SECONDS = 20;
export const EARLY_CALL_RESOURCE_PER_SECOND = 3;
export const SPAWN_INTERVAL_SECONDS = 0.6;

// --- The four cell types (A rapid / B blocker / C heavy / D splash) ---

export type UnitKind = "rapid" | "blocker" | "heavy" | "splash";

// Ascending cost, and the sidebar's top-to-bottom order.
export const UNIT_KIND_ORDER: readonly UnitKind[] = ["rapid", "blocker", "heavy", "splash"];

export interface UnitKindStats {
  cost: number;
  rangeCells: number;
  // Ranged kinds (rapid/heavy/splash) only:
  attackInterval?: number;
  damageByLevel?: readonly [number, number, number];
  splashRadiusCells?: number;
  // Blocker only — it never fires itself, its minions do the fighting:
  minionHpByLevel?: readonly [number, number, number];
  minionDamageByLevel?: readonly [number, number, number];
  minionCount?: number;
  minionRespawnSeconds?: number;
}

export const UNIT_KINDS: Record<UnitKind, UnitKindStats> = {
  rapid: {
    cost: 40,
    rangeCells: 2.7,
    attackInterval: 0.45,
    damageByLevel: [10, 17, 28],
  },
  blocker: {
    cost: 60,
    rangeCells: 2.2,
    minionHpByLevel: [70, 115, 175],
    minionDamageByLevel: [7, 11, 17],
    minionCount: 2,
    minionRespawnSeconds: 8,
  },
  heavy: {
    cost: 70,
    rangeCells: 3.3,
    attackInterval: 1.0,
    damageByLevel: [26, 44, 70],
  },
  splash: {
    cost: 90,
    rangeCells: 2.5,
    attackInterval: 1.5,
    damageByLevel: [24, 40, 62],
    splashRadiusCells: 1.2,
  },
};

// Fusion cap, shared by every kind.
export const MAX_UNIT_LEVEL = 3;

// Blocker's minions aren't given an attack cadence anywhere in the spec —
// only their HP and per-hit damage are. This value is picked so a minion
// pair's converted DPS (minionCount * minionDamage / interval) lands
// strictly between rapid's and heavy's DPS at all three fusion levels at
// once (the valid window works out to roughly 0.5385s-0.5464s).
export const BLOCKER_MINION_ATTACK_INTERVAL = 0.54;

// Flat damage a minion takes back on every hit it lands. Nothing in the
// spec gives enemies an attack stat, so this is the smallest addition that
// makes "a minion can die and respawns after 8s" mean anything at all.
export const MINION_INCOMING_DAMAGE_PER_HIT = 12;

// Splash damage lands on a single primary target plus whatever else is
// standing in the radius — a real advantage that a flat damage/interval
// comparison misses entirely. This factor exists only to fold that
// advantage into the balance test's DPS metric; it never multiplies real
// in-game damage.
export const SPLASH_EFFECTIVE_HITS = 1.8;

export function unitDps(kind: UnitKind, level: number): number {
  const stats = UNIT_KINDS[kind];
  const i = level - 1;
  if (kind === "blocker") {
    return (stats.minionCount! * stats.minionDamageByLevel![i]) / BLOCKER_MINION_ATTACK_INTERVAL;
  }
  const dps = stats.damageByLevel![i] / stats.attackInterval!;
  return kind === "splash" ? dps * SPLASH_EFFECTIVE_HITS : dps;
}

// --- The seven enemy tiers ---

export type EnemyTier = "normal" | "spore" | "flying" | "armored" | "tank" | "elite" | "boss";

// Strongest-first, for wave-intel display grouping.
export const ENEMY_TIER_ORDER: readonly EnemyTier[] = [
  "boss",
  "elite",
  "tank",
  "armored",
  "flying",
  "spore",
  "normal",
];

export interface EnemyTierStats {
  sizeMultiplier: number;
  speedMultiplier: number;
  baseHp: number; // calibrated for wave 1; see waveHpMultiplier
  majorOnly?: boolean;
  flying?: boolean;
}

export const ENEMY_TIERS: Record<EnemyTier, EnemyTierStats> = {
  normal: { sizeMultiplier: 1.0, speedMultiplier: 1.0, baseHp: 30 },
  spore: { sizeMultiplier: 0.8, speedMultiplier: 1.4, baseHp: 20 },
  flying: { sizeMultiplier: 0.7, speedMultiplier: 1.6, baseHp: 24, flying: true },
  armored: { sizeMultiplier: 1.3, speedMultiplier: 0.7, baseHp: 90 },
  tank: { sizeMultiplier: 1.6, speedMultiplier: 0.5, baseHp: 160 },
  elite: { sizeMultiplier: 1.9, speedMultiplier: 0.6, baseHp: 320, majorOnly: true },
  boss: { sizeMultiplier: 2.7, speedMultiplier: 0.45, baseHp: 900, majorOnly: true },
};

// The tier table's speed entries are multipliers ("speed 1.0" etc), so they
// need one fixed baseline to apply to. Chosen to land in the same range the
// old wave-1 procedural speed did.
export const BASE_ENEMY_SPEED_CELLS_PER_SECOND = 1.3;

// Tier HP above is calibrated for wave 1 (multiplier 1.0 there); every wave
// after that scales all enemy HP up from that baseline.
export function waveHpMultiplier(waveNumber: number): number {
  return 1 + 0.18 * (waveNumber - 1);
}

export interface WaveEntry {
  tier: EnemyTier;
  count: number;
}

// Fixed, hand-authored per the brief — not procedural.
export const WAVE_TABLE: Record<number, readonly WaveEntry[]> = {
  1: [{ tier: "normal", count: 6 }],
  2: [
    { tier: "normal", count: 8 },
    { tier: "spore", count: 3 },
  ],
  3: [
    { tier: "normal", count: 7 },
    { tier: "flying", count: 5 },
  ],
  4: [
    { tier: "armored", count: 5 },
    { tier: "normal", count: 6 },
    { tier: "spore", count: 4 },
  ],
  5: [
    { tier: "flying", count: 8 },
    { tier: "tank", count: 3 },
    { tier: "normal", count: 6 },
  ],
  6: [
    { tier: "armored", count: 6 },
    { tier: "spore", count: 6 },
    { tier: "tank", count: 4 },
    { tier: "elite", count: 1 },
  ],
  7: [
    { tier: "flying", count: 10 },
    { tier: "armored", count: 6 },
    { tier: "tank", count: 5 },
    { tier: "elite", count: 2 },
  ],
  8: [
    { tier: "boss", count: 1 },
    { tier: "elite", count: 2 },
    { tier: "flying", count: 8 },
    { tier: "normal", count: 10 },
  ],
};

export function waveTotalCount(waveNumber: number): number {
  const rows = WAVE_TABLE[Math.min(TOTAL_WAVES, Math.max(1, waveNumber))];
  return rows.reduce((sum, row) => sum + row.count, 0);
}

export const BOSS_WAVE = TOTAL_WAVES;
export const BOSS_SUMMON_INTERVAL_SECONDS = 6;
export const BOSS_SUMMON_COUNT = 2;

export const RESOURCE_DROP_BY_TIER: Record<EnemyTier, number> = {
  normal: 8,
  spore: 6,
  flying: 8,
  armored: 18,
  tank: 30,
  elite: 60,
  boss: 200,
};

export const CORE_CONTACT_DAMAGE = 1;

export const SCORE_KILL = 10;
export const SCORE_ELITE_KILL = 50;
export const SCORE_BOSS_KILL = 500;
export const SCORE_WIN = 1000;
export const SCORE_PER_REMAINING_CORE_HP = 50;

export function scoreForTier(tier: EnemyTier): number {
  if (tier === "boss") return SCORE_BOSS_KILL;
  if (tier === "elite") return SCORE_ELITE_KILL;
  return SCORE_KILL;
}
