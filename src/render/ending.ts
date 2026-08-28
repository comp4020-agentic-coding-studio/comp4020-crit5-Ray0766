// Replaces the old flat win/loss tint. A win lets the core's own glow swallow
// the screen and settle into a calm heartbeat; a loss drains the heart's
// colour to magenta, sends its last ring out past the edges, then dims
// everything to a dead outline. Both hold for a few seconds before main.ts
// resets the run.
import { CORE_X, CORE_Y } from "../constants";
import type { Game, GameStatus } from "../game";
import { playEnding } from "../audio";
import { drawHeartShape } from "./heart";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { AMBER, AMBER_CORE, CYAN, CYAN_CORE, MAGENTA, MAGENTA_CORE, mix, rgba } from "./palette";
import { getHighScore } from "./score";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';
const WIN_EXPAND_DURATION = 1.2; // spec: glow covers the screen in 1.2s
const WIN_RETRACT_DURATION = 0.6;
const LOSS_COLOR_SHIFT_DURATION = 0.5;
const LOSS_RING_EXPAND_DURATION = 1;
const LOSS_DIM_DURATION = 0.8;
const RESTART_HOLD_SECONDS = 3; // spec: restart 3s after the ending finishes

const STAR_STAGGER = 0.15;
const STAR_ANIM_DURATION = 0.4;
const STAR_COUNT = 3;

/** coreHp is 1..CORE_MAX_HP (12) here — win is only reachable with hp >= 1. */
function starsEarned(coreHp: number): number {
  if (coreHp >= 12) return 3;
  if (coreHp >= 7) return 2;
  return 1;
}

function traceStar(ctx: CanvasRenderingContext2D, outerRadius: number): void {
  const innerRadius = outerRadius * 0.382;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  scale: number,
  cx: number,
  cy: number,
  earned: number,
  elapsed: number,
): void {
  const spacing = 46 * scale;
  const y = cy + 96 * scale;
  for (let i = 0; i < STAR_COUNT; i++) {
    const localElapsed = elapsed - WIN_EXPAND_DURATION - i * STAR_STAGGER;
    if (localElapsed < 0) continue;
    const p = easeOutCubic(Math.min(1, localElapsed / STAR_ANIM_DURATION));
    const rotation = (-40 * (1 - p) * Math.PI) / 180;
    const x = cx + (i - 1) * spacing;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(Math.max(0.001, p), Math.max(0.001, p));
    traceStar(ctx, 16 * scale);
    if (i < earned) {
      ctx.fillStyle = rgba(AMBER_CORE, 0.9);
      ctx.fill();
      ctx.strokeStyle = rgba(AMBER_CORE, 0.9);
    } else {
      ctx.strokeStyle = rgba(AMBER, 0.2);
    }
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

function drawFinalScore(
  ctx: CanvasRenderingContext2D,
  scale: number,
  cx: number,
  cy: number,
  score: number,
): void {
  const y = cy + 140 * scale;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${20 * scale}px ${FONT_STACK}`;
  ctx.fillStyle = rgba(CYAN_CORE, 0.9);
  ctx.fillText(String(score), cx, y);
  ctx.font = `${11 * scale}px ${FONT_STACK}`;
  ctx.fillStyle = rgba(CYAN_CORE, 0.45);
  ctx.fillText(String(getHighScore()), cx, y + 24 * scale);
  ctx.restore();
}

let lastStatus: GameStatus = "playing";
let statusSince = -Infinity;

function ingestStatus(game: Game, t: number): void {
  if (game.status === lastStatus) return;
  lastStatus = game.status;
  if (game.status !== "playing") {
    statusSince = t;
    playEnding();
  }
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function fullScreenRadius(width: number, height: number): number {
  return Math.hypot(width, height) * 0.75;
}

function drawWinEnding(
  ctx: CanvasRenderingContext2D,
  game: Game,
  layout: Layout,
  width: number,
  height: number,
  t: number,
  elapsed: number,
): void {
  const scale = scaleFor(layout);
  const [cx, cy] = cellCenter(layout, CORE_X, CORE_Y);
  const normalRadius = 160 * scale;
  const bigRadius = fullScreenRadius(width, height);

  let radius: number;
  let dimAlpha: number;
  if (elapsed < WIN_EXPAND_DURATION) {
    const p = easeOutCubic(elapsed / WIN_EXPAND_DURATION);
    radius = normalRadius + (bigRadius - normalRadius) * p;
    dimAlpha = 0.92 * p;
  } else {
    const p = Math.min(1, (elapsed - WIN_EXPAND_DURATION) / WIN_RETRACT_DURATION);
    radius = bigRadius + (normalRadius - bigRadius) * easeInOutCubic(p);
    dimAlpha = 0.92;
  }

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(0,0,0,${dimAlpha})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  glow.addColorStop(0, rgba(CYAN, 0.35));
  glow.addColorStop(0.5, rgba(CYAN, 0.12));
  glow.addColorStop(1, rgba(CYAN, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const ph = (t % 2.4) / 2.4;
  const beat = Math.exp(-(((ph - 0.12) / 0.06) ** 2));
  const s = 1 + 0.06 * beat;
  const bodyRadius = 40 * s * scale;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawHeartShape(ctx, cx, cy, bodyRadius, t, {
    fillColor: CYAN,
    fillAlpha: 0.25,
    strokeColor: CYAN,
    strokeAlpha: 0.55,
    shadowBlur: 26 * scale,
  });
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const coreAlpha = 0.7 + 0.3 * beat;
  ctx.shadowColor = rgba(CYAN_CORE, coreAlpha);
  ctx.shadowBlur = 20 * scale;
  ctx.fillStyle = rgba(CYAN_CORE, coreAlpha);
  ctx.beginPath();
  ctx.arc(cx, cy, 17 * s * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (elapsed >= WIN_EXPAND_DURATION) {
    drawStars(ctx, scale, cx, cy, starsEarned(game.coreHp), elapsed);
    drawFinalScore(ctx, scale, cx, cy, game.score);
  }
}

function drawLossEnding(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  width: number,
  height: number,
  t: number,
  elapsed: number,
): void {
  const scale = scaleFor(layout);
  const [cx, cy] = cellCenter(layout, CORE_X, CORE_Y);
  const colorProgress = Math.min(1, elapsed / LOSS_COLOR_SHIFT_DURATION);
  const bodyColor = mix(CYAN, MAGENTA, colorProgress);
  const coreColor = mix(CYAN_CORE, MAGENTA_CORE, colorProgress);

  const ringStart = LOSS_COLOR_SHIFT_DURATION;
  const dimStart = ringStart + LOSS_RING_EXPAND_DURATION;
  const dimP = Math.max(0, Math.min(1, (elapsed - dimStart) / LOSS_DIM_DURATION));

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const preDim = dimP > 0 ? 0.94 * dimP : 0.5 * colorProgress;
  ctx.fillStyle = `rgba(0,0,0,${preDim})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const bodyRadius = 40 * scale;

  if (dimP <= 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    drawHeartShape(ctx, cx, cy, bodyRadius, 0, {
      fillColor: bodyColor,
      fillAlpha: 0.22,
      strokeColor: bodyColor,
      strokeAlpha: 0.5,
      shadowBlur: 26 * scale,
    });
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = rgba(coreColor, 0.8);
    ctx.shadowBlur = 20 * scale;
    ctx.fillStyle = rgba(coreColor, 0.8);
    ctx.beginPath();
    ctx.arc(cx, cy, 17 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (elapsed >= ringStart && elapsed < dimStart) {
    const p = easeOutCubic((elapsed - ringStart) / LOSS_RING_EXPAND_DURATION);
    const bigRadius = fullScreenRadius(width, height);
    const ringRadius = 46 * scale + (bigRadius - 46 * scale) * p;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba(MAGENTA, 0.5 * (1 - p));
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (dimP > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    drawHeartShape(ctx, cx, cy, bodyRadius, 0, {
      fillColor: MAGENTA,
      fillAlpha: 0,
      strokeColor: MAGENTA,
      strokeAlpha: 0.22 * dimP,
      shadowBlur: 0,
      strokeOnly: true,
    });
    ctx.restore();
  }
}

export function drawEnding(
  ctx: CanvasRenderingContext2D,
  game: Game,
  layout: Layout,
  width: number,
  height: number,
  t: number,
): void {
  ingestStatus(game, t);
  if (game.status === "playing") return;
  const elapsed = t - statusSince;
  if (game.status === "won") drawWinEnding(ctx, game, layout, width, height, t, elapsed);
  else drawLossEnding(ctx, layout, width, height, t, elapsed);
}

/** True once the ending animation has finished and held for RESTART_HOLD_SECONDS. */
export function shouldAutoRestart(game: Game, t: number): boolean {
  if (game.status === "playing") return false;
  const animDuration =
    game.status === "won"
      ? WIN_EXPAND_DURATION + WIN_RETRACT_DURATION
      : LOSS_COLOR_SHIFT_DURATION + LOSS_RING_EXPAND_DURATION + LOSS_DIM_DURATION;
  return t - statusSince > animDuration + RESTART_HOLD_SECONDS;
}
