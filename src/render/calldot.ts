// A pulsing dot above the core, live only during prep: click it to skip the
// rest of the wait and pocket resources for the seconds you gave up. Sits
// above the path-length readout so the two stack without overlapping.
import { CORE_X, CORE_Y, EARLY_CALL_RESOURCE_PER_SECOND } from "../constants";
import type { Game } from "../game";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { PATH_LEN_OFFSET_Y } from "./pathlen";
import { CYAN, CYAN_CORE, rgba } from "./palette";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';
export const CALL_DOT_OFFSET_Y = PATH_LEN_OFFSET_Y + 34;
const DOT_RADIUS = 6;
const BREATH_PERIOD = 1.4;
const HIT_RADIUS_MULTIPLIER = 1.5;

export function drawCallDot(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  if (!game.inPrep) return;

  const scale = scaleFor(layout);
  const [cx, cy] = cellCenter(layout, CORE_X, CORE_Y);
  const y = cy - CALL_DOT_OFFSET_Y * scale;

  const ph = (t % BREATH_PERIOD) / BREATH_PERIOD;
  const breathe = 0.5 + 0.5 * Math.sin(ph * Math.PI * 2);
  const radius = (DOT_RADIUS + 2 * breathe) * scale;

  ctx.save();
  ctx.shadowColor = rgba(CYAN, 0.7 + 0.3 * breathe);
  ctx.shadowBlur = 20 * scale;
  ctx.fillStyle = rgba(CYAN, 0.6 + 0.3 * breathe);
  ctx.beginPath();
  ctx.arc(cx, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const reward = Math.ceil(game.prepTimer) * EARLY_CALL_RESOURCE_PER_SECOND;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `${14 * scale}px ${FONT_STACK}`;
  ctx.fillStyle = rgba(CYAN_CORE, 0.85);
  ctx.fillText(String(reward), cx + 16 * scale, y);
}

export function callDotHitTest(game: Game, layout: Layout, px: number, py: number): boolean {
  if (!game.inPrep) return false;
  const scale = scaleFor(layout);
  const [cx, cy] = cellCenter(layout, CORE_X, CORE_Y);
  const y = cy - CALL_DOT_OFFSET_Y * scale;
  const hitRadius = DOT_RADIUS * HIT_RADIUS_MULTIPLIER * scale;
  return Math.hypot(px - cx, py - y) <= hitRadius;
}
