import type { Game } from "../game";
import { CORE_MAX_HP, CORE_X, CORE_Y } from "../constants";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { CYAN, CYAN_CORE, MAGENTA, MAGENTA_CORE, mix, rgba } from "./palette";

const BODY_SEGMENTS = 26;

/** Dual-Gaussian beat: a sharp systole bump followed by a softer second one. */
function beatIntensity(ph: number): number {
  return Math.exp(-(((ph - 0.12) / 0.05) ** 2)) + 0.55 * Math.exp(-(((ph - 0.3) / 0.07) ** 2));
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
  ctx.beginPath();
  for (let i = 0; i <= BODY_SEGMENTS; i++) {
    const a = (i / BODY_SEGMENTS) * Math.PI * 2;
    const perturb = 1 + 0.05 * Math.sin(3 * a + 0.35 * t) + 0.035 * Math.sin(5 * a - 0.22 * t);
    const rr = bodyRadius * perturb;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = rgba(bodyColor, 0.35);
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.arc(cx - 6 * scale, cy + 2 * scale, 20 * s * scale, 0.6, 2.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 7 * scale, cy - 4 * scale, 14 * s * scale, 2.8, 5.2);
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
