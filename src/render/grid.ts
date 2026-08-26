import type { Game } from "../game";
import { GRID_SIZE } from "../constants";
import { canPlaceUnit } from "../pathing";
import { tracePlaceableSquare } from "./geometry";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { GRID_LINE, MAGENTA, rgba } from "./palette";
import { trackPointer } from "./pointer";

const PROXIMITY_RADIUS_BASELINE = 130;
const TICK_ARM_BASELINE = 4;

function drawTicks(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  pointer: { px: number; py: number },
  radius: number,
  armLength: number,
): void {
  ctx.strokeStyle = rgba(GRID_LINE, 1);
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= GRID_SIZE; gx++) {
    const x = layout.offsetX + gx * layout.cellSize;
    for (let gy = 0; gy <= GRID_SIZE; gy++) {
      const y = layout.offsetY + gy * layout.cellSize;
      const dist = Math.hypot(x - pointer.px, y - pointer.py);
      if (dist >= radius) continue;
      const alpha = Math.pow(1 - dist / radius, 2) * 0.4;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(x - armLength, y);
      ctx.lineTo(x + armLength, y);
      ctx.moveTo(x, y - armLength);
      ctx.lineTo(x, y + armLength);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export function drawGrid(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  const scale = scaleFor(layout);
  const radius = PROXIMITY_RADIUS_BASELINE * scale;
  const pointer = trackPointer(ctx.canvas);

  if (pointer) {
    drawTicks(ctx, layout, pointer, radius, TICK_ARM_BASELINE * scale);
  }

  const halfSize = layout.cellSize / 2 - 6 * scale;
  const cornerRadius = 4 * scale;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (game.grid.cells[y * GRID_SIZE + x] !== "empty") continue;

      const [cx, cy] = cellCenter(layout, x, y);
      const idleAlpha = 0.045 + 0.018 * Math.sin(1.5 * t + x * 0.05 + y * 0.03);
      let alpha = idleAlpha;
      if (pointer) {
        const dist = Math.hypot(cx - pointer.px, cy - pointer.py);
        if (dist < radius) {
          const proximityAlpha = Math.pow(1 - dist / radius, 1.5) * 0.5;
          alpha = Math.max(idleAlpha, proximityAlpha);
        }
      }

      tracePlaceableSquare(ctx, cx, cy, halfSize, cornerRadius);
      if (canPlaceUnit(game.grid, x, y)) {
        ctx.fillStyle = rgba(GRID_LINE, alpha);
        ctx.fill();
      } else {
        ctx.strokeStyle = rgba(MAGENTA, Math.max(alpha, 0.16));
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();
      }
    }
  }
}
