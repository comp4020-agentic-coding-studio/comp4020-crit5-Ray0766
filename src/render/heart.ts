import type { Game } from "../game";
import { CORE_MAX_HP, CORE_X, CORE_Y } from "../constants";
import { catmullRomSegments, type Point } from "./geometry";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { CYAN, CYAN_CORE, MAGENTA, MAGENTA_CORE, mix, rgba } from "./palette";

/** Anchor points for one closed loop around an anatomical outline, in local
 *  unit space (origin at the heart's centre, +y down): apex down and to the
 *  left, an atrial bulge on each side of the top, and an aortic-arch stub
 *  poking out past the right bulge. Catmull-Rom turns these eight points into
 *  a smooth single closed path — see catmullRomSegments. */
const HEART_ANCHORS: Point[] = [
  { x: -0.35, y: 1.05 }, // apex, lower-left
  { x: -1.0, y: 0.15 }, // left flank
  { x: -0.72, y: -0.68 }, // left atrium bulge
  { x: -0.05, y: -0.42 }, // cleft between the two bulges
  { x: 0.55, y: -0.78 }, // right atrium bulge
  { x: 0.95, y: -1.15 }, // aortic arch stub, upper-right
  { x: 0.68, y: -0.42 }, // stub folds back in
  { x: 0.5, y: 0.55 }, // right flank back down to the apex
];

/** Dual-Gaussian beat: a sharp systole bump followed by a softer second one. */
function beatIntensity(ph: number): number {
  return Math.exp(-(((ph - 0.12) / 0.05) ** 2)) + 0.55 * Math.exp(-(((ph - 0.3) / 0.07) ** 2));
}

/** Trace the heart outline into the current path, scaled by `radius` and
 *  centred at (cx, cy). The same low-frequency wobble the old circular body
 *  had is kept, applied per anchor instead of per angle. Shared with
 *  render/ending.ts so the win/loss screens beat the same shape. */
export function heartBodyPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  t: number,
): void {
  const n = HEART_ANCHORS.length;
  const points = HEART_ANCHORS.map((p, i) => {
    const a = (i / n) * Math.PI * 2;
    const perturb = 1 + 0.05 * Math.sin(3 * a + 0.35 * t) + 0.035 * Math.sin(5 * a - 0.22 * t);
    return { x: cx + p.x * radius * perturb, y: cy + p.y * radius * perturb };
  });
  const segments = catmullRomSegments(points, true);
  ctx.beginPath();
  ctx.moveTo(segments[0][0].x, segments[0][0].y);
  for (const [, c1, c2, end] of segments) {
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
  }
  ctx.closePath();
}

export function drawHeart(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  const scale = scaleFor(layout);
  const [cx, cy] = cellCenter(layout, CORE_X, CORE_Y);
  const hpRatio = Math.max(0, Math.min(1, game.coreHp / CORE_MAX_HP));
  const injury = 1 - hpRatio;
  const bodyColor = mix(CYAN, MAGENTA, injury);
  const coreColor = mix(CYAN_CORE, MAGENTA_CORE, injury);

  // Near death the heart races: period drops from a calm 2.8s to a frantic 1.4s.
  const period = 1.4 + 1.4 * hpRatio;
  const ph = (t % period) / period;
  const b = beatIntensity(ph);
  const s = 1 + 0.07 * b;
  const gk = 0.55 + 0.5 * b;
  const ringPeakAlpha = 0.3 + 0.2 * injury;

  const glowRadius = (120 * s + 40) * scale;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
  glow.addColorStop(0, rgba(bodyColor, 0.3 * gk));
  glow.addColorStop(0.5, rgba(bodyColor, 0.1 * gk));
  glow.addColorStop(1, rgba(bodyColor, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  const bodyRadius = 40 * s * scale;
  ctx.save();
  ctx.shadowColor = rgba(bodyColor, 0.5);
  ctx.shadowBlur = 26 * scale;
  ctx.fillStyle = rgba(bodyColor, 0.22);
  ctx.strokeStyle = rgba(bodyColor, 0.5);
  ctx.lineWidth = 1.5 * scale;
  heartBodyPath(ctx, cx, cy, bodyRadius, t);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  const coreAlpha = 0.75 + 0.25 * b;
  ctx.shadowColor = rgba(coreColor, coreAlpha);
  ctx.shadowBlur = 20 * scale;
  ctx.fillStyle = rgba(coreColor, coreAlpha);
  ctx.beginPath();
  ctx.arc(cx, cy, 17 * s * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const ringRadius = (46 + (196 - 46) * ph) * scale;
  ctx.strokeStyle = rgba(bodyColor, ringPeakAlpha * (1 - ph) * (1 - ph));
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
}
