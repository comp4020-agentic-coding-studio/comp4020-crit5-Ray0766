import { GRID_SIZE } from "./constants";
import { unlockAudio } from "./audio";
import type { Game } from "./game";
import { cellIndex } from "./pathing";
import { computeLayout, type Layout } from "./render";
import { getSelectedLevel, selectorHitTest, setSelectedLevel } from "./render/selector";

const DRAG_THRESHOLD_PX = 8;

interface PointerSession {
  pointerId: number;
  startPx: number;
  startPy: number;
  startCellX: number;
  startCellY: number;
  dragging: boolean;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
}

export function attachInput(canvas: HTMLCanvasElement, game: Game): void {
  let session: PointerSession | null = null;

  function toCanvasPixel(clientX: number, clientY: number): { px: number; py: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      px: ((clientX - rect.left) / rect.width) * canvas.width,
      py: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function toGridCoords(px: number, py: number, layout: Layout): { gx: number; gy: number } {
    return {
      gx: (px - layout.offsetX) / layout.cellSize,
      gy: (py - layout.offsetY) / layout.cellSize,
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    unlockAudio();
    if (session) return;
    const { px, py } = toCanvasPixel(event.clientX, event.clientY);
    const layout = computeLayout(canvas.width, canvas.height);
    const sidebarLevel = selectorHitTest(layout, px, py);
    if (sidebarLevel !== -1) {
      setSelectedLevel(sidebarLevel);
      return;
    }
    const { gx, gy } = toGridCoords(px, py, layout);
    session = {
      pointerId: event.pointerId,
      startPx: px,
      startPy: py,
      startCellX: Math.floor(gx),
      startCellY: Math.floor(gy),
      dragging: false,
    };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!session || event.pointerId !== session.pointerId) return;
    const { px, py } = toCanvasPixel(event.clientX, event.clientY);
    if (!session.dragging) {
      const moved = Math.hypot(px - session.startPx, py - session.startPy);
      if (moved > DRAG_THRESHOLD_PX) session.dragging = true;
    }
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!session || event.pointerId !== session.pointerId) return;
    const { px, py } = toCanvasPixel(event.clientX, event.clientY);
    const layout = computeLayout(canvas.width, canvas.height);
    const { gx, gy } = toGridCoords(px, py, layout);
    const endCellX = Math.floor(gx);
    const endCellY = Math.floor(gy);

    if (session.dragging) {
      const startsInBounds = inBounds(session.startCellX, session.startCellY);
      const endsInBounds = inBounds(endCellX, endCellY);
      const moved = session.startCellX !== endCellX || session.startCellY !== endCellY;
      if (startsInBounds && endsInBounds && moved) {
        const fromIndex = cellIndex(game.grid, session.startCellX, session.startCellY);
        const toIndex = cellIndex(game.grid, endCellX, endCellY);
        game.tryMergeUnit(fromIndex, toIndex);
      }
    } else if (!game.tryCollectResource(gx, gy) && inBounds(endCellX, endCellY)) {
      game.tryPlaceUnit(endCellX, endCellY, getSelectedLevel());
    }

    canvas.releasePointerCapture(session.pointerId);
    session = null;
  });

  canvas.addEventListener("pointercancel", () => {
    session = null;
  });
}
