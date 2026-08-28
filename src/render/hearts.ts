// Twelve small hearts in a 2-row x 6-col cluster below the score readout —
// reuses the same drawHeartShape primitive the core's own big heart draws
// with, just small and cyan. Losing HP flashes the whole cluster magenta for
// a beat before it settles back, so a hit reads even if you looked away
// right as it landed.
import type { Game } from "../game";
import { CORE_MAX_HP, GRID_SIZE } from "../constants";
import { drawHeartShape } from "./heart";
import { scaleFor, type Layout } from "./layout";
import { CYAN, MAGENTA, mix } from "./palette";

// 1.8x the pre-round-7 radius, per spec — a single column of tiny hearts
// hugging the left edge read as an unrecognizable smear at the old size.
const HEART_RADIUS = 16.2;
const COLS = 6;
const COL_SPACING = 15;
const ROW_SPACING = 34;
const GAP_BELOW_SCORE = 46;
const LIVING_ALPHA = 0.85;
const LOST_ALPHA = 0.22;
const INJURY_FLASH_DURATION = 0.3;

let lastHp = CORE_MAX_HP;
let rowFlashAt = -Infinity;

function ingestHp(game: Game, t: number): void {
  if (game.coreHp < lastHp) rowFlashAt = t;
  lastHp = game.coreHp;
}

export function drawHearts(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  ingestHp(game, t);
  const scale = scaleFor(layout);
  const cx = layout.hudLeft / 2;
  const boardCenterY = layout.offsetY + (layout.cellSize * GRID_SIZE) / 2;
  const gridTop = boardCenterY + GAP_BELOW_SCORE * scale;
  const startX = cx - ((COL_SPACING * (COLS - 1)) / 2) * scale;

  const flashP = Math.max(0, 1 - (t - rowFlashAt) / INJURY_FLASH_DURATION);
  const color = flashP > 0 ? mix(CYAN, MAGENTA, flashP) : CYAN;

  for (let i = 0; i < CORE_MAX_HP; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const hx = startX + col * COL_SPACING * scale;
    const hy = gridTop + row * ROW_SPACING * scale;
    const alive = i < game.coreHp;
    const alpha = alive ? LIVING_ALPHA : LOST_ALPHA;

    drawHeartShape(ctx, hx, hy, HEART_RADIUS * scale, t, {
      fillColor: color,
      fillAlpha: alpha * 0.4,
      strokeColor: color,
      strokeAlpha: alpha,
      shadowBlur: 10.8 * scale,
    });
  }
}
