// Twelve small hearts stacked down the left sidebar, one per core HP point —
// reuses the same drawHeartShape primitive the core's own big heart draws
// with, just small and cyan. A lost point flashes magenta for a beat before
// settling to its dim resting alpha, so a hit reads even if you looked away
// right as it landed.
import type { Game } from "../game";
import { CORE_MAX_HP } from "../constants";
import { drawHeartShape } from "./heart";
import { scaleFor, type Layout } from "./layout";
import { CYAN, MAGENTA, mix } from "./palette";

const HEART_RADIUS = 9;
const HEART_TOP_MARGIN = 20;
const HEART_SPACING = 20;
const LIVING_ALPHA = 0.85;
const LOST_ALPHA = 0.22;
const INJURY_FLASH_DURATION = 0.3;

interface Flash {
  index: number;
  startedAt: number;
}

let lastHp = CORE_MAX_HP;
let flashes: Flash[] = [];

function ingestHp(game: Game, t: number): void {
  if (game.coreHp < lastHp) {
    for (let i = game.coreHp; i < lastHp; i++) flashes.push({ index: i, startedAt: t });
  }
  lastHp = game.coreHp;
  flashes = flashes.filter((f) => t - f.startedAt < INJURY_FLASH_DURATION);
}

export function drawHearts(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  ingestHp(game, t);
  const scale = scaleFor(layout);
  const cx = layout.hudLeft / 2;

  for (let i = 0; i < CORE_MAX_HP; i++) {
    const cy = layout.offsetY + (HEART_TOP_MARGIN + i * HEART_SPACING) * scale;
    const alive = i < game.coreHp;
    const flash = flashes.find((f) => f.index === i);

    let color = CYAN;
    let alpha = alive ? LIVING_ALPHA : LOST_ALPHA;
    if (flash) {
      const p = 1 - (t - flash.startedAt) / INJURY_FLASH_DURATION;
      color = mix(CYAN, MAGENTA, p);
      alpha = LOST_ALPHA + (LIVING_ALPHA - LOST_ALPHA) * p;
    }

    drawHeartShape(ctx, cx, cy, HEART_RADIUS * scale, t, {
      fillColor: color,
      fillAlpha: alpha * 0.4,
      strokeColor: color,
      strokeAlpha: alpha,
      shadowBlur: 6 * scale,
    });
  }
}
