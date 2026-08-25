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
 * The hard rule: you can only build on an empty cell, and only if doing so
 * still leaves at least one entrance with a path to the core. A placement
 * that would seal every entrance off is rejected.
 */
export function canPlaceUnit(grid: PathGrid, x: number, y: number): boolean {
  const index = cellIndex(grid, x, y);
  if (grid.cells[index] !== "empty") return false;
  const dist = distanceFromCore(grid, index);
  return grid.cells.some((kind, i) => kind === "entrance" && dist[i] !== -1);
}
