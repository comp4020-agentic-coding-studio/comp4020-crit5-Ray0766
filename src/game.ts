import {
  BASE_ENEMY_SPEED_CELLS_PER_SECOND,
  BLOCKER_MINION_ATTACK_INTERVAL,
  BOSS_SUMMON_COUNT,
  BOSS_SUMMON_INTERVAL_SECONDS,
  CORE_CONTACT_DAMAGE,
  CORE_MAX_HP,
  CORE_X,
  CORE_Y,
  EARLY_CALL_RESOURCE_PER_SECOND,
  ENEMY_TIERS,
  ENTRANCES,
  GRID_SIZE,
  MAJOR_ENTRANCES,
  MAX_UNIT_LEVEL,
  MINION_INCOMING_DAMAGE_PER_HIT,
  PREP_SECONDS,
  RESOURCE_DROP_BY_TIER,
  RESOURCE_ORB_LIFETIME,
  RESOURCE_PICKUP_RADIUS_CELLS,
  SCORE_PER_REMAINING_CORE_HP,
  SCORE_WIN,
  SPAWN_INTERVAL_SECONDS,
  START_RESOURCE,
  TOTAL_WAVES,
  UNIT_KINDS,
  WAVE_TABLE,
  scoreForTier,
  waveHpMultiplier,
  waveTotalCount,
  type EnemyTier,
  type UnitKind,
} from "./constants";
import {
  canPlaceUnit,
  cellIndex,
  cellXY,
  distanceFromCore,
  hasOpenPath,
  type CellKind,
  type PathGrid,
} from "./pathing";

export interface Minion {
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number; // counts down while dead; meaningless while alive
  targetId: number | null;
  cooldown: number;
}

export interface Unit {
  kind: UnitKind;
  level: number; // 1..MAX_UNIT_LEVEL
  cooldown: number;
  minions?: Minion[]; // only set for kind === "blocker"
}

export interface Enemy {
  id: number;
  x: number; // grid-fractional coordinates
  y: number;
  targetX: number;
  targetY: number;
  hp: number;
  maxHp: number;
  speed: number; // cells per second
  tier: EnemyTier;
  flying?: boolean; // true = ignores the grid entirely, flies straight to the core
  summonCooldown?: number; // boss only
}

// A whole wave's entrance/tier assignments, rolled up front so wave intel
// can show the truth instead of a statistical guess.
export interface SpawnPlan {
  ex: number;
  ey: number;
  tier: EnemyTier;
}

export interface ResourceOrb {
  id: number;
  x: number;
  y: number;
  value: number;
  age: number;
}

export const ATTACK_FLASH_TTL = 0.1;

export interface AttackFlash {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  targetId: number;
  ttl: number;
}

// Short-lived pings for things that happened this instant — a swap that
// landed, a kill, a click with nothing to spend. render/ code watches this
// array the same way it already watches `flashes`, to decide what to burst,
// shake or play a sound for.
export type FxKind =
  | "place"
  | "place-denied"
  | "merge"
  | "swap"
  | "kill"
  | "boss-kill"
  | "core-hit"
  | "boss-spawn";

export interface FxEvent {
  kind: FxKind;
  x: number;
  y: number;
  ttl: number;
}

export type GameStatus = "playing" | "won" | "lost";

function buildBaseCells(): CellKind[] {
  const cells: CellKind[] = new Array(GRID_SIZE * GRID_SIZE).fill("empty");
  for (const [ex, ey] of ENTRANCES) cells[ey * GRID_SIZE + ex] = "entrance";
  cells[CORE_Y * GRID_SIZE + CORE_X] = "core";
  return cells;
}

export class Game {
  readonly baseCells = buildBaseCells();
  grid: PathGrid = { width: GRID_SIZE, height: GRID_SIZE, cells: this.baseCells.slice() };
  distanceField: Int32Array = distanceFromCore(this.grid);

  units = new Map<number, Unit>();
  scars = new Set<number>();
  enemies: Enemy[] = [];
  orbs: ResourceOrb[] = [];
  flashes: AttackFlash[] = [];
  fx: FxEvent[] = [];

  resource = START_RESOURCE;
  coreHp = CORE_MAX_HP;
  status: GameStatus = "playing";
  score = 0;

  waveNumber = 0; // 0 = before the first wave
  waveSpawnedCount = 0;
  spawnTimer = 0;
  prepTimer = PREP_SECONDS;
  upcomingPlan: SpawnPlan[] = [];

  private nextEnemyId = 1;
  private nextOrbId = 1;
  private planWaveNumber = 0;
  private rand: () => number = Math.random;

  private rebuildGrid(): void {
    const cells = this.baseCells.slice();
    for (const index of this.units.keys()) cells[index] = "blocked";
    for (const index of this.scars) cells[index] = "blocked";
    this.grid = { width: GRID_SIZE, height: GRID_SIZE, cells };
    this.distanceField = distanceFromCore(this.grid);
  }

  private pushFx(kind: FxKind, x: number, y: number): void {
    this.fx.push({ kind, x, y, ttl: 0.15 });
  }

  /** Attempt to place a fresh unit of the given kind on an empty cell, at
   *  level 1 — level 2/3 only ever come from fusion. Price is flat per kind;
   *  a click with nothing to spend just pings "place-denied" instead of
   *  placing. Goes through the same blockade check regardless of kind, so
   *  the priciest cell can't seal off the core any more than the cheapest
   *  one could. */
  tryPlaceUnit(x: number, y: number, kind: UnitKind): boolean {
    if (this.status !== "playing") return false;
    if (!canPlaceUnit(this.grid, x, y)) return false;
    const stats = UNIT_KINDS[kind];
    if (this.resource < stats.cost) {
      this.pushFx("place-denied", x, y);
      return false;
    }
    const index = cellIndex(this.grid, x, y);
    const unit: Unit = { kind, level: 1, cooldown: 0 };
    if (kind === "blocker") {
      const maxHp = stats.minionHpByLevel![0];
      unit.minions = Array.from({ length: stats.minionCount! }, () => ({
        hp: maxHp,
        maxHp,
        alive: true,
        respawnTimer: 0,
        targetId: null,
        cooldown: 0,
      }));
    }
    this.units.set(index, unit);
    this.resource -= stats.cost;
    this.rebuildGrid();
    this.pushFx("place", x, y);
    return true;
  }

  /** Drag a placed unit onto another placed unit. Same kind and same level:
   *  they fuse, the source is consumed and its cell stays blocked for good.
   *  Anything else — different kind, or same kind but different level — just
   *  swaps places instead, for free, unless the swap would leave every
   *  entrance sealed off, in which case it's reverted. */
  tryMergeUnit(fromIndex: number, toIndex: number): boolean {
    if (this.status !== "playing") return false;
    if (fromIndex === toIndex) return false;
    const source = this.units.get(fromIndex);
    const target = this.units.get(toIndex);
    if (!source || !target) return false;

    if (source.kind === target.kind && source.level === target.level) {
      if (target.level >= MAX_UNIT_LEVEL) return false;
      this.units.delete(fromIndex);
      this.scars.add(fromIndex);
      target.level += 1;
      target.cooldown = 0;
      if (target.kind === "blocker" && target.minions) {
        const maxHp = UNIT_KINDS.blocker.minionHpByLevel![target.level - 1];
        for (const minion of target.minions) {
          minion.maxHp = maxHp;
          minion.hp = maxHp;
          minion.alive = true;
          minion.respawnTimer = 0;
        }
      }
      this.rebuildGrid();
      const [tx, ty] = cellXY(this.grid, toIndex);
      this.pushFx("merge", tx, ty);
      return true;
    }

    this.units.set(fromIndex, target);
    this.units.set(toIndex, source);
    this.rebuildGrid();
    if (!hasOpenPath(this.grid)) {
      this.units.set(fromIndex, source);
      this.units.set(toIndex, target);
      this.rebuildGrid();
      return false;
    }
    const [fromX, fromY] = cellXY(this.grid, fromIndex);
    const [toX, toY] = cellXY(this.grid, toIndex);
    this.pushFx("swap", fromX, fromY);
    this.pushFx("swap", toX, toY);
    return true;
  }

  /** Collect the nearest resource orb within pickup range, if any. */
  tryCollectResource(x: number, y: number): boolean {
    let bestIndex = -1;
    let bestDist = RESOURCE_PICKUP_RADIUS_CELLS;
    for (let i = 0; i < this.orbs.length; i++) {
      const orb = this.orbs[i];
      const dist = Math.hypot(orb.x - x, orb.y - y);
      if (dist <= bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
    if (bestIndex === -1) return false;
    this.resource += this.orbs[bestIndex].value;
    this.orbs.splice(bestIndex, 1);
    return true;
  }

  unitAt(x: number, y: number): Unit | undefined {
    return this.units.get(cellIndex(this.grid, x, y));
  }

  /** Debug-only: makes entrance-choice reproducible, for repeatable screenshots.
   *  Only ever called from main.ts, and only when the URL asks for it. */
  setSeed(seed: number): void {
    let a = seed | 0;
    this.rand = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Debug-only: skip straight to a given wave so the wave-8 boss can be
   *  reached for a screenshot without sitting through the first seven.
   *  Only ever called from main.ts, and only when the URL asks for it. */
  debugJumpToWave(waveNumber: number): void {
    const target = Math.max(1, Math.min(TOTAL_WAVES, Math.floor(waveNumber)));
    this.waveNumber = target;
    this.waveSpawnedCount = 0;
    this.spawnTimer = 0;
    this.prepTimer = PREP_SECONDS;
    this.enemies = [];
    this.resource += 400; // enough to throw a few units down before it arrives
  }

  /** Start a fresh run in place, so anything holding onto this Game instance
   *  (input listeners, the frame loop) doesn't need to be re-wired. */
  reset(): void {
    this.grid = { width: GRID_SIZE, height: GRID_SIZE, cells: this.baseCells.slice() };
    this.distanceField = distanceFromCore(this.grid);
    this.units.clear();
    this.scars.clear();
    this.enemies = [];
    this.orbs = [];
    this.flashes = [];
    this.fx = [];
    this.resource = START_RESOURCE;
    this.coreHp = CORE_MAX_HP;
    this.status = "playing";
    this.score = 0;
    this.waveNumber = 0;
    this.waveSpawnedCount = 0;
    this.spawnTimer = 0;
    this.prepTimer = PREP_SECONDS;
  }

  update(dt: number): void {
    if (this.status !== "playing") return;

    this.updateWaveSpawner(dt);
    this.updateEnemies(dt);
    this.updateUnits(dt);
    this.updateOrbs(dt);
    this.updateFlashes(dt);
    this.updateFx(dt);
    this.checkEndConditions();
  }

  private updateWaveSpawner(dt: number): void {
    if (
      this.waveNumber >= TOTAL_WAVES &&
      this.waveSpawnedCount >= waveTotalCount(TOTAL_WAVES) &&
      this.enemies.length === 0
    )
      return;

    const total = waveTotalCount(Math.max(1, this.waveNumber));
    const waveInProgress = this.waveNumber >= 1 && this.waveSpawnedCount < total;
    this.ensurePlanFor(waveInProgress ? this.waveNumber : this.waveNumber + 1);

    if (waveInProgress) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.waveSpawnedCount += 1;
        this.spawnTimer = SPAWN_INTERVAL_SECONDS;
      }
      return;
    }

    if (this.inPrep) {
      this.prepTimer -= dt;
      if (this.prepTimer <= 0) this.startNextWave();
    }
  }

  private startNextWave(): void {
    this.waveNumber += 1;
    this.waveSpawnedCount = 0;
    this.spawnTimer = 0;
    this.prepTimer = PREP_SECONDS;
  }

  /** Regenerates `upcomingPlan` only when it's stale for the requested wave
   *  — a cheap no-op on the common per-tick call. debugJumpToWave/reset need
   *  no special casing: the next tick notices the mismatch and regenerates. */
  private ensurePlanFor(waveNumber: number): void {
    if (this.planWaveNumber === waveNumber) return;
    this.planWaveNumber = waveNumber;
    this.upcomingPlan = this.generateWavePlan(waveNumber);
  }

  /** Builds one wave's spawn order from the fixed WAVE_TABLE. Each tier
   *  group is spread across the wave proportionally — item i of an n-count
   *  group lands at fraction (i+0.5)/n — then every group is merged by that
   *  fraction, so types interleave instead of spawning in same-tier clumps. */
  private generateWavePlan(waveNumber: number): SpawnPlan[] {
    const rows = WAVE_TABLE[Math.min(TOTAL_WAVES, Math.max(1, waveNumber))];
    const slots: Array<{ frac: number; tier: EnemyTier }> = [];
    for (const row of rows) {
      for (let i = 0; i < row.count; i++) {
        slots.push({ frac: (i + 0.5) / row.count, tier: row.tier });
      }
    }
    slots.sort((a, b) => a.frac - b.frac);
    return slots.map(({ tier }) => {
      const pool = ENEMY_TIERS[tier].majorOnly ? MAJOR_ENTRANCES : ENTRANCES;
      const [ex, ey] = pool[Math.floor(this.rand() * pool.length)];
      return { ex, ey, tier };
    });
  }

  /** True between waves — before the first one, or once the current one is
   *  fully spawned and cleared — the window callWaveEarly can act in. */
  get inPrep(): boolean {
    if (this.status !== "playing" || this.waveNumber >= TOTAL_WAVES) return false;
    const total = waveTotalCount(Math.max(1, this.waveNumber));
    const waveInProgress = this.waveNumber >= 1 && this.waveSpawnedCount < total;
    if (waveInProgress) return false;
    const waveFullyCleared =
      this.waveNumber >= 1 && this.waveSpawnedCount >= total && this.enemies.length === 0;
    const beforeFirstWave = this.waveNumber === 0;
    return beforeFirstWave || waveFullyCleared;
  }

  /** Cash in the rest of the prep window early: resources scaled by the
   *  seconds skipped, and the next wave starts immediately. */
  callWaveEarly(): boolean {
    if (!this.inPrep) return false;
    this.resource += Math.ceil(this.prepTimer) * EARLY_CALL_RESOURCE_PER_SECOND;
    this.startNextWave();
    return true;
  }

  private spawnEnemy(): void {
    const { ex, ey, tier } = this.upcomingPlan[this.waveSpawnedCount];
    const tierStats = ENEMY_TIERS[tier];
    const hp = Math.round(tierStats.baseHp * waveHpMultiplier(this.waveNumber));
    const speed = BASE_ENEMY_SPEED_CELLS_PER_SECOND * tierStats.speedMultiplier;
    const enemy: Enemy = {
      id: this.nextEnemyId++,
      x: ex,
      y: ey,
      targetX: ex,
      targetY: ey,
      hp,
      maxHp: hp,
      speed,
      tier,
      flying: tierStats.flying === true,
    };
    if (tier === "boss") {
      enemy.summonCooldown = BOSS_SUMMON_INTERVAL_SECONDS;
      this.pushFx("boss-spawn", ex, ey);
    }
    this.enemies.push(enemy);
  }

  private updateEnemies(dt: number): void {
    const survivors: Enemy[] = [];
    const summoned: Enemy[] = [];

    for (const enemy of this.enemies) {
      this.stepEnemy(enemy, dt);

      if (enemy.summonCooldown !== undefined) {
        enemy.summonCooldown -= dt;
        if (enemy.summonCooldown <= 0) {
          enemy.summonCooldown = BOSS_SUMMON_INTERVAL_SECONDS;
          const normalStats = ENEMY_TIERS.normal;
          const summonHp = Math.round(normalStats.baseHp * waveHpMultiplier(this.waveNumber));
          const sx = Math.round(enemy.x);
          const sy = Math.round(enemy.y);
          for (let i = 0; i < BOSS_SUMMON_COUNT; i++) {
            summoned.push({
              id: this.nextEnemyId++,
              x: sx,
              y: sy,
              targetX: sx,
              targetY: sy,
              hp: summonHp,
              maxHp: summonHp,
              speed: BASE_ENEMY_SPEED_CELLS_PER_SECOND * normalStats.speedMultiplier,
              tier: "normal",
            });
          }
        }
      }

      if (enemy.hp <= 0) {
        this.orbs.push({
          id: this.nextOrbId++,
          x: enemy.x,
          y: enemy.y,
          value: RESOURCE_DROP_BY_TIER[enemy.tier],
          age: 0,
        });
        this.score += scoreForTier(enemy.tier);
        this.pushFx(enemy.tier === "boss" ? "boss-kill" : "kill", enemy.x, enemy.y);
        continue;
      }
      if (Math.round(enemy.x) === CORE_X && Math.round(enemy.y) === CORE_Y) {
        this.pushFx("core-hit", CORE_X, CORE_Y);
        if (enemy.tier === "boss") {
          // The boss reaching the core is an instant loss, not a scratch.
          this.coreHp = 0;
        } else {
          this.coreHp = Math.max(0, this.coreHp - CORE_CONTACT_DAMAGE);
        }
        continue;
      }
      survivors.push(enemy);
    }
    this.enemies = survivors.concat(summoned);
  }

  private stepEnemy(enemy: Enemy, dt: number): void {
    // Flying enemies ignore the grid, blockades and BFS entirely — they fly
    // straight at the core.
    if (enemy.flying) {
      const dx = CORE_X - enemy.x;
      const dy = CORE_Y - enemy.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.02) {
        enemy.x = CORE_X;
        enemy.y = CORE_Y;
        return;
      }
      const step = enemy.speed * dt;
      if (step >= dist) {
        enemy.x = CORE_X;
        enemy.y = CORE_Y;
      } else {
        enemy.x += (dx / dist) * step;
        enemy.y += (dy / dist) * step;
      }
      return;
    }

    const dx = enemy.targetX - enemy.x;
    const dy = enemy.targetY - enemy.y;
    const distToTarget = Math.hypot(dx, dy);

    if (distToTarget < 0.02) {
      enemy.x = enemy.targetX;
      enemy.y = enemy.targetY;
      this.pickNextTarget(enemy);
      return;
    }

    const step = enemy.speed * dt;
    if (step >= distToTarget) {
      enemy.x = enemy.targetX;
      enemy.y = enemy.targetY;
    } else {
      enemy.x += (dx / distToTarget) * step;
      enemy.y += (dy / distToTarget) * step;
    }
  }

  private pickNextTarget(enemy: Enemy): void {
    const cx = Math.round(enemy.x);
    const cy = Math.round(enemy.y);
    const currentDist = this.distanceField[cellIndex(this.grid, cx, cy)];
    if (currentDist <= 0) return; // already at the core

    const candidates: Array<[number, number]> = [
      [cx, cy - 1],
      [cx, cy + 1],
      [cx - 1, cy],
      [cx + 1, cy],
    ];
    for (const [nx, ny] of candidates) {
      if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
      const kind = this.grid.cells[cellIndex(this.grid, nx, ny)];
      if (kind === "blocked") continue;
      const d = this.distanceField[cellIndex(this.grid, nx, ny)];
      if (d !== -1 && d < currentDist) {
        enemy.targetX = nx;
        enemy.targetY = ny;
        return;
      }
    }
    // No improving neighbour (a stranded pocket) — hold position.
  }

  private updateUnits(dt: number): void {
    for (const [index, unit] of this.units) {
      const ux = index % GRID_SIZE;
      const uy = Math.floor(index / GRID_SIZE);
      if (unit.kind === "blocker") {
        this.updateBlocker(unit, ux, uy, dt);
      } else {
        this.updateRangedUnit(unit, ux, uy, dt);
      }
    }
  }

  private updateRangedUnit(unit: Unit, ux: number, uy: number, dt: number): void {
    unit.cooldown -= dt;
    if (unit.cooldown > 0) return;

    const stats = UNIT_KINDS[unit.kind];
    const damage = stats.damageByLevel![unit.level - 1];
    let target: Enemy | undefined;
    let bestDist = stats.rangeCells;
    for (const enemy of this.enemies) {
      const dist = Math.hypot(enemy.x - ux, enemy.y - uy);
      if (dist <= bestDist) {
        bestDist = dist;
        target = enemy;
      }
    }
    if (!target) return;

    target.hp -= damage;
    unit.cooldown = stats.attackInterval!;
    this.flashes.push({
      fromX: ux,
      fromY: uy,
      toX: target.x,
      toY: target.y,
      targetId: target.id,
      ttl: ATTACK_FLASH_TTL,
    });

    if (unit.kind === "splash") {
      const radius = stats.splashRadiusCells!;
      for (const enemy of this.enemies) {
        if (enemy.id === target.id) continue;
        if (Math.hypot(enemy.x - target.x, enemy.y - target.y) <= radius) enemy.hp -= damage;
      }
    }
  }

  /** Blocker never fires itself — each of its two minions independently
   *  acquires, melees and can be killed by whatever's in range, respawning
   *  after a cooldown. Minions never store a pixel position; render/ derives
   *  where to draw them from this combat state alone. */
  private updateBlocker(unit: Unit, ux: number, uy: number, dt: number): void {
    const stats = UNIT_KINDS.blocker;
    const range = stats.rangeCells;
    const minions = unit.minions;
    if (!minions) return;

    const claimed = new Set<number>();
    for (const minion of minions) {
      if (minion.alive && minion.targetId !== null) claimed.add(minion.targetId);
    }

    for (const minion of minions) {
      if (!minion.alive) {
        minion.respawnTimer -= dt;
        if (minion.respawnTimer <= 0) {
          minion.alive = true;
          minion.hp = minion.maxHp;
          minion.targetId = null;
          minion.cooldown = 0;
        }
        continue;
      }

      let target =
        minion.targetId !== null ? this.enemies.find((e) => e.id === minion.targetId) : undefined;
      if (target && Math.hypot(target.x - ux, target.y - uy) > range) target = undefined;

      if (!target) {
        minion.targetId = null;
        let bestDist = range;
        for (const enemy of this.enemies) {
          if (claimed.has(enemy.id)) continue;
          const dist = Math.hypot(enemy.x - ux, enemy.y - uy);
          if (dist <= bestDist) {
            bestDist = dist;
            target = enemy;
          }
        }
        if (target) {
          minion.targetId = target.id;
          claimed.add(target.id);
        }
      }
      if (!target) continue;

      minion.cooldown -= dt;
      if (minion.cooldown > 0) continue;
      minion.cooldown = BLOCKER_MINION_ATTACK_INTERVAL;

      target.hp -= stats.minionDamageByLevel![unit.level - 1];
      minion.hp -= MINION_INCOMING_DAMAGE_PER_HIT;
      if (minion.hp <= 0) {
        minion.alive = false;
        minion.respawnTimer = stats.minionRespawnSeconds!;
        minion.targetId = null;
      }
    }
  }

  private updateOrbs(dt: number): void {
    const alive: ResourceOrb[] = [];
    for (const orb of this.orbs) {
      orb.age += dt;
      if (orb.age < RESOURCE_ORB_LIFETIME) alive.push(orb);
    }
    this.orbs = alive;
  }

  private updateFlashes(dt: number): void {
    const alive: AttackFlash[] = [];
    for (const flash of this.flashes) {
      flash.ttl -= dt;
      if (flash.ttl > 0) alive.push(flash);
    }
    this.flashes = alive;
  }

  private updateFx(dt: number): void {
    const alive: FxEvent[] = [];
    for (const event of this.fx) {
      event.ttl -= dt;
      if (event.ttl > 0) alive.push(event);
    }
    this.fx = alive;
  }

  private checkEndConditions(): void {
    if (this.coreHp <= 0) {
      this.status = "lost";
      return;
    }
    if (this.waveNumber >= TOTAL_WAVES && this.waveSpawnedCount >= waveTotalCount(TOTAL_WAVES)) {
      if (this.enemies.length === 0 && this.status === "playing") {
        this.status = "won";
        this.score += SCORE_WIN + SCORE_PER_REMAINING_CORE_HP * this.coreHp;
      }
    }
  }
}
