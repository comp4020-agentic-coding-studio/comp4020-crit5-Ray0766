import { GRID_SIZE } from "../constants";

// Every absolute pixel value in the art spec was written against a
// 840x540 canvas with a 42px cell. BASELINE_CELL lets every drawing helper
// convert "the spec says 15px" into "15px at that basis, scaled to however
// big a cell actually is on this screen."
export const BASELINE_CELL = 42;

export interface Layout {
  cellSize: number;
  offsetX: number;
  offsetY: number;
  hudTop: number;
  hudBottom: number;
  hudLeft: number;
  hudRight: number;
}

// Width of the left (score) and right (cell selector) strips, in cells.
const SIDEBAR_CELLS = 2;

export function computeLayout(width: number, height: number): Layout {
  const hudTop = Math.max(12, height * 0.02);
  const hudBottom = Math.max(10, height * 0.015);
  const usableHeight = Math.max(1, height - hudTop - hudBottom);
  const cellSize = Math.min(width / (GRID_SIZE + SIDEBAR_CELLS * 2), usableHeight / GRID_SIZE);
  const hudLeft = cellSize * SIDEBAR_CELLS;
  const hudRight = cellSize * SIDEBAR_CELLS;
  const offsetX = hudLeft + (width - hudLeft - hudRight - cellSize * GRID_SIZE) / 2;
  const offsetY = hudTop + (usableHeight - cellSize * GRID_SIZE) / 2;
  return { cellSize, offsetX, offsetY, hudTop, hudBottom, hudLeft, hudRight };
}

export function scaleFor(layout: Layout): number {
  return layout.cellSize / BASELINE_CELL;
}

export function cellTopLeft(layout: Layout, x: number, y: number): [number, number] {
  return [layout.offsetX + x * layout.cellSize, layout.offsetY + y * layout.cellSize];
}

export function cellCenter(layout: Layout, x: number, y: number): [number, number] {
  return [
    layout.offsetX + (x + 0.5) * layout.cellSize,
    layout.offsetY + (y + 0.5) * layout.cellSize,
  ];
}
