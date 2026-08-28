// Bottom of the left sidebar, below the hearts cluster: three right-pointing
// arrows you click to cycle 1x/2x/3x on game.timeScale. Purely graphical, no
// text anywhere, same "hit-test lives beside its draw function" convention
// as selectorHitTest/callDotHitTest.
import { GRID_SIZE } from "../constants";
import type { Game } from "../game";
import { scaleFor, type Layout } from "./layout";
import { CYAN, rgba } from "./palette";

const ARROW_WIDTH = 11;
const ARROW_HEIGHT = 16;
const ARROW_GAP = 5;
const BOTTOM_MARGIN = 40;
const HIT_RADIUS_BASELINE = 44;
const UNLIT_ALPHA = 0.18;
const BREATH_PERIOD = 1.2;
const BREATH_AMPLITUDE = 0.08;
const PUNCH_DURATION = 0.15;
const PUNCH_SCALE = 1.3;

export function speedControlAnchor(layout: Layout): { cx: number; cy: number } {
  const scale = scaleFor(layout);
  const cx = layout.hudLeft / 2;
  const cy = layout.offsetY + layout.cellSize * GRID_SIZE - BOTTOM_MARGIN * scale;
  return { cx, cy };
}

export function speedControlHitTest(layout: Layout, px: number, py: number): boolean {
  const { cx, cy } = speedControlAnchor(layout);
  const scale = scaleFor(layout);
  const radius = Math.max(HIT_RADIUS_BASELINE, HIT_RADIUS_BASELINE * scale);
  return Math.hypot(px - cx, py - cy) <= radius;
}

// Tracks timeScale changes so a click punches the whole group once, the same
// module-level-state idiom score.ts's scoreFlashAt uses.
let lastTimeScale = 1;
let punchAt = -Infinity;

function ingestTimeScale(game: Game, t: number): void {
  if (game.timeScale !== lastTimeScale) {
    lastTimeScale = game.timeScale;
    punchAt = t;
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, w: number, h: number, lit: boolean, scale: number): void {
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(-w / 2, h / 2);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  if (lit) {
    ctx.save();
    ctx.shadowColor = rgba(CYAN, 0.8);
    ctx.shadowBlur = 8 * scale;
    ctx.fillStyle = rgba(CYAN, 0.92);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = rgba(CYAN, UNLIT_ALPHA);
    ctx.fill();
  }
}

export function drawSpeedControl(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  ingestTimeScale(game, t);
  const scale = scaleFor(layout);
  const { cx, cy } = speedControlAnchor(layout);

  const punchProgress = Math.min(1, (t - punchAt) / PUNCH_DURATION);
  const punchScale = punchProgress < 1 ? 1 + (PUNCH_SCALE - 1) * (1 - punchProgress) : 1;

  const breathPhase = ((t % BREATH_PERIOD) / BREATH_PERIOD) * Math.PI * 2;
  const breathe = 1 + BREATH_AMPLITUDE * Math.sin(breathPhase);

  const w = ARROW_WIDTH * scale;
  const h = ARROW_HEIGHT * scale;
  const gap = ARROW_GAP * scale;
  const totalWidth = 3 * w + 2 * gap;
  const startX = -totalWidth / 2 + w / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(punchScale, punchScale);
  for (let i = 0; i < 3; i++) {
    const lit = i < game.timeScale;
    ctx.save();
    ctx.translate(startX + i * (w + gap), 0);
    if (lit) ctx.scale(breathe, breathe);
    drawArrow(ctx, w, h, lit, scale);
    ctx.restore();
  }
  ctx.restore();
}
