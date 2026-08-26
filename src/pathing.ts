// Grid pathfinding for the immune system board. The core is the BFS source:
// every walkable cell gets a distance-to-core, and a pathogen just always
// steps to whichever open neighbour has a smaller one. Recomputing this after
// every placement is what makes pathogens "walk around" placed cells.

export type CellKind = "empty" | "entrance" | "core" | "blocked";

export interface PathGrid {
  width: number;
  height: number;
  cells: CellKind[];
}

export function cellIndex(grid: PathGrid, x: number, y: number): number {
  return y * grid.width + x;
}

export function cellXY(grid: PathGrid, index: number): [number, number] {
  return [index % grid.width, Math.floor(index / grid.width)];
}

function neighborIndices(grid: PathGrid, index: number): number[] {
  const { width, height } = grid;
  const x = index % width;
  const y = Math.floor(index / width);
  const result: number[] = [];
  if (x > 0) result.push(index - 1);
  if (x < width - 1) result.push(index + 1);
  if (y > 0) result.push(index - width);
  if (y < height - 1) result.push(index + width);
  return result;
}

/**
 * Distance, in steps, from the nearest core cell to every cell — treating
 * `extraBlocked` (if given) as blocked in addition to the grid's own
 * "blocked" cells. -1 means unreachable.
 */
export function distanceFromCore(grid: PathGrid, extraBlocked?: number): Int32Array {
  const { cells } = grid;
  const dist = new Int32Array(cells.length).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === "core" && i !== extraBlocked) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    for (const next of neighborIndices(grid, current)) {
      if (next === extraBlocked) continue;
      if (dist[next] !== -1) continue;
      if (cells[next] === "blocked") continue;
      dist[next] = dist[current] + 1;
      queue.push(next);
    }
  }
  return dist;
}

/**
 * True if at least one entrance still has a path to the core, treating
 * `extraBlocked` (if given) as blocked too. This is the actual guard behind
 * the hard rule — placement checks it against a candidate cell, and a swap
 * checks it against the board as it would sit afterwards.
 */
export function hasOpenPath(grid: PathGrid, extraBlocked?: number): boolean {
  const dist = distanceFromCore(grid, extraBlocked);
  return grid.cells.some((kind, i) => kind === "entrance" && dist[i] !== -1);
}

/**
 * The hard rule: you can only build on an empty cell, and only if doing so
 * still leaves at least one entrance with a path to the core. A placement
 * that would seal every entrance off is rejected.
 */
export function canPlaceUnit(grid: PathGrid, x: number, y: number): boolean {
  const index = cellIndex(grid, x, y);
  if (grid.cells[index] !== "empty") return false;
  return hasOpenPath(grid, index);
}

/**
 * Walk an entrance's actual route to the core by always stepping to the
 * neighbour with a smaller distanceField value — the same greedy rule
 * `Game.pickNextTarget` uses to move a pathogen, just traced all at once
 * instead of one step per frame. Used by render/vessels.ts so a vessel's
 * drawn channel is the real BFS shortest path rather than a fixed curve.
 * Returns null if this entrance currently has no path to the core at all.
 */
export function tracePathFromEntrance(
  grid: PathGrid,
  distanceField: Int32Array,
  ex: number,
  ey: number,
): Array<[number, number]> | null {
  const startIndex = cellIndex(grid, ex, ey);
  if (distanceField[startIndex] === -1) return null;

  const path: Array<[number, number]> = [[ex, ey]];
  let x = ex;
  let y = ey;
  let guard = grid.width * grid.height;

  while (distanceField[cellIndex(grid, x, y)] > 0 && guard-- > 0) {
    const currentDist = distanceField[cellIndex(grid, x, y)];
    const candidates: Array<[number, number]> = [
      [x, y - 1],
      [x, y + 1],
      [x - 1, y],
      [x + 1, y],
    ];
    let moved = false;
    for (const [nx, ny] of candidates) {
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      const d = distanceField[cellIndex(grid, nx, ny)];
      if (d !== -1 && d < currentDist) {
        x = nx;
        y = ny;
        path.push([x, y]);
        moved = true;
        break;
      }
    }
    if (!moved) break; // stranded pocket, shouldn't happen for a reachable start
  }
  return path;
}
