import {
  CORE_CONTACT_DAMAGE,
  CORE_MAX_HP,
  CORE_X,
  CORE_Y,
  ENTRANCES,
  GRID_SIZE,
  MAX_UNIT_LEVEL,
  PLACE_COST_BASE,
  PLACE_COST_GROWTH_ADD,
  PLACE_COST_GROWTH_MULT,
  RESOURCE_ORB_LIFETIME,
  RESOURCE_PICKUP_RADIUS_CELLS,
  SPAWN_INTERVAL_SECONDS,
  START_RESOURCE,
  TOTAL_WAVES,
  UNIT_LEVELS,
  WAVE_GAP_SECONDS,
  resourceOrbValue,
  waveConfig,
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

export interface Unit {
  level: number; // 1..MAX_UNIT_LEVEL
  cooldown: number;
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
  boss?: boolean;
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
  placeCost = PLACE_COST_BASE;
  coreHp = CORE_MAX_HP;
  status: GameStatus = "playing";

  waveNumber = 0; // 0 = before the first wave
  waveSpawnedCount = 0;
  spawnTimer = 0;
  gapTimer = WAVE_GAP_SECONDS;

  private nextEnemyId = 1;
  private nextOrbId = 1;

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

  /** Attempt to place a fresh level-1 unit on an empty cell. Cost climbs
   *  after every successful placement; a click with nothing to spend just
   *  pings "place-denied" instead of placing. */
  tryPlaceUnit(x: number, y: number): boolean {
    if (this.status !== "playing") return false;
    if (!canPlaceUnit(this.grid, x, y)) return false;
    if (this.resource < this.placeCost) {
      this.pushFx("place-denied", x, y);
      return false;
    }
    const index = cellIndex(this.grid, x, y);
    this.units.set(index, { level: 1, cooldown: 0 });
    this.resource -= this.placeCost;
    this.placeCost = Math.round(this.placeCost * PLACE_COST_GROWTH_MULT + PLACE_COST_GROWTH_ADD);
    this.rebuildGrid();
    this.pushFx("place", x, y);
    return true;
  }

  /** Drag a placed unit onto another placed unit. Same level: they fuse, the
   *  source is consumed and its cell stays blocked for good. Different
   *  levels: they just swap places instead, for free — unless the swap would
   *  leave every entrance sealed off, in which case it's reverted. */
  tryMergeUnit(fromIndex: number, toIndex: number): boolean {
    if (this.status !== "playing") return false;
    if (fromIndex === toIndex) return false;
    const source = this.units.get(fromIndex);
    const target = this.units.get(toIndex);
    if (!source || !target) return false;

    if (source.level === target.level) {
      if (target.level >= MAX_UNIT_LEVEL) return false;
      this.units.delete(fromIndex);
      this.scars.add(fromIndex);
      target.level += 1;
      target.cooldown = 0;
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
    this.placeCost = PLACE_COST_BASE;
    this.coreHp = CORE_MAX_HP;
    this.status = "playing";
    this.waveNumber = 0;
    this.waveSpawnedCount = 0;
    this.spawnTimer = 0;
    this.gapTimer = WAVE_GAP_SECONDS;
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
      this.waveSpawnedCount >= waveConfig(TOTAL_WAVES).count &&
      this.enemies.length === 0
    )
      return;

    const config = waveConfig(Math.max(1, this.waveNumber));
    const waveInProgress = this.waveNumber >= 1 && this.waveSpawnedCount < config.count;

    if (waveInProgress) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy(config);
        this.waveSpawnedCount += 1;
        this.spawnTimer = SPAWN_INTERVAL_SECONDS;
      }
      return;
    }

    const waveFullyCleared =
      this.waveNumber >= 1 && this.waveSpawnedCount >= config.count && this.enemies.length === 0;
    const beforeFirstWave = this.waveNumber === 0;

    if (beforeFirstWave || waveFullyCleared) {
      this.gapTimer -= dt;
      if (this.gapTimer <= 0 && this.waveNumber < TOTAL_WAVES) {
        this.waveNumber += 1;
        this.waveSpawnedCount = 0;
        this.spawnTimer = 0;
        this.gapTimer = WAVE_GAP_SECONDS;
      }
    }
  }

  private spawnEnemy(config: ReturnType<typeof waveConfig>): void {
    const [ex, ey] = ENTRANCES[Math.floor(Math.random() * ENTRANCES.length)];
    this.enemies.push({
      id: this.nextEnemyId++,
      x: ex,
      y: ey,
      targetX: ex,
      targetY: ey,
      hp: config.hp,
      maxHp: config.hp,
      speed: config.speedCellsPerSecond,
      boss: config.boss,
    });
    if (config.boss) this.pushFx("boss-spawn", ex, ey);
  }

  private updateEnemies(dt: number): void {
    const survivors: Enemy[] = [];
    for (const enemy of this.enemies) {
      this.stepEnemy(enemy, dt);
      if (enemy.hp <= 0) {
        this.orbs.push({
          id: this.nextOrbId++,
          x: enemy.x,
          y: enemy.y,
          value: resourceOrbValue(this.waveNumber),
          age: 0,
        });
        this.pushFx(enemy.boss ? "boss-kill" : "kill", enemy.x, enemy.y);
        continue;
      }
      if (Math.round(enemy.x) === CORE_X && Math.round(enemy.y) === CORE_Y) {
        this.pushFx("core-hit", CORE_X, CORE_Y);
        if (enemy.boss) {
          // The boss reaching the core is an instant loss, not a scratch.
          this.coreHp = 0;
        } else {
          this.coreHp = Math.max(0, this.coreHp - CORE_CONTACT_DAMAGE);
        }
        continue;
      }
      survivors.push(enemy);
    }
    this.enemies = survivors;
  }

  private stepEnemy(enemy: Enemy, dt: number): void {
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
      unit.cooldown -= dt;
      if (unit.cooldown > 0) continue;

      const [ux, uy] = [index % GRID_SIZE, Math.floor(index / GRID_SIZE)];
      const stats = UNIT_LEVELS[unit.level - 1];
      let target: Enemy | undefined;
      let bestDist = stats.rangeCells;
      for (const enemy of this.enemies) {
        const dist = Math.hypot(enemy.x - ux, enemy.y - uy);
        if (dist <= bestDist) {
          bestDist = dist;
          target = enemy;
        }
      }
      if (!target) continue;

      target.hp -= stats.damage;
      unit.cooldown = stats.attackInterval;
      this.flashes.push({
        fromX: ux,
        fromY: uy,
        toX: target.x,
        toY: target.y,
        targetId: target.id,
        ttl: ATTACK_FLASH_TTL,
      });
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
    if (this.waveNumber >= TOTAL_WAVES && this.waveSpawnedCount >= waveConfig(TOTAL_WAVES).count) {
      if (this.enemies.length === 0) this.status = "won";
    }
  }
}
