import type { Game } from "../game";
import { GRID_SIZE } from "../constants";
import { hashAngle } from "./geometry";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { CYAN, CYAN_CORE, rgba } from "./palette";

/** The one shape every immune-cell level is built from: a soft glow, a ring, a bright nucleus. */
export function drawLeaf(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  k: number,
  scale: number,
): void {
  const outer = r * 1.8;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer);
  gradient.addColorStop(0, rgba(CYAN, 0.3 * k));
  gradient.addColorStop(0.6, rgba(CYAN, 0.14 * k));
  gradient.addColorStop(1, rgba(CYAN, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = rgba(CYAN, 0.65 * k);
  ctx.shadowBlur = 11 * scale;
  ctx.strokeStyle = rgba(CYAN, 0.65 * k);
  ctx.lineWidth = 1.4 * scale;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  const coreAlpha = Math.min(1, 0.95 * k);
  ctx.shadowColor = rgba(CYAN_CORE, coreAlpha);
  ctx.shadowBlur = 12 * scale * (0.7 + 0.6 * k);
  ctx.fillStyle = rgba(CYAN_CORE, coreAlpha);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawMembrane(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  seed: number,
  t: number,
  scale: number,
): void {
  const segments = 22;
  ctx.save();
  ctx.shadowColor = rgba(CYAN, 0.55);
  ctx.shadowBlur = 20 * scale;
  ctx.fillStyle = rgba(CYAN, 0.16);
  ctx.strokeStyle = rgba(CYAN, 0.55);
  ctx.lineWidth = 1.3 * scale;
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const perturb = 1 + 0.07 * Math.sin(3 * a + seed) + 0.05 * Math.sin(5 * a - 0.5 * t + seed);
    const rr = r * perturb;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Levels are told apart purely by shape: one leaf, a splitting pair, or a membrane with five inside it. */
export function drawUnits(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  const scale = scaleFor(layout);

  for (const [index, unit] of game.units) {
    const x = index % GRID_SIZE;
    const y = Math.floor(index / GRID_SIZE);
    const [cx, cy] = cellCenter(layout, x, y);
    const seed = hashAngle(index);
    const breathe = 1 + 0.03 * Math.sin(1.1 * t + seed);

    if (unit.level === 1) {
      drawLeaf(ctx, cx, cy, 15 * scale * breathe, 1, scale);
    } else if (unit.level === 2) {
      const r = 12 * scale * breathe;
      const centerDist = (7.5 + 1.6 * Math.sin(0.6 * t + seed)) * scale;
      const dx = Math.cos(seed) * (centerDist / 2);
      const dy = Math.sin(seed) * (centerDist / 2);
      drawLeaf(ctx, cx + dx, cy + dy, r, 1, scale);
      drawLeaf(ctx, cx - dx, cy - dy, r, 1, scale);
    } else {
      drawMembrane(ctx, cx, cy, 21 * scale, seed, t, scale);
      const innerLeafCount = 5;
      const orbitRadius = 9 * scale;
      for (let i = 0; i < innerLeafCount; i++) {
        const a = (i / innerLeafCount) * Math.PI * 2 + seed;
        const lx = cx + Math.cos(a) * orbitRadius;
        const ly = cy + Math.sin(a) * orbitRadius;
        drawLeaf(ctx, lx, ly, 6.5 * scale * breathe, 1.3, scale);
      }
    }
  }
}
