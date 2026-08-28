import type { Game } from "../game";
import { GRID_SIZE, UNIT_KINDS } from "../constants";
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

// Level changes only overall scale and core brightness — never the shape
// that tells kinds apart.
export function levelFactors(level: number): { size: number; k: number } {
  return { size: 1 + 0.22 * (level - 1), k: 1 + 0.35 * (level - 1) };
}

/** rapid (A): a tight cluster of three small nuclei orbiting a shared center. */
export function drawRapidBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
  scale: number,
  level: number,
): void {
  const { size, k } = levelFactors(level);
  const r = radius * 0.46 * size;
  const d = radius * 0.52 * size;
  for (let i = 0; i < 3; i++) {
    const a = seed + (i / 3) * Math.PI * 2;
    drawLeaf(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, k, scale);
  }
}

/** blocker (B): one plain body — the minions it fields are drawn separately. */
export function drawBlockerBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  k: number,
  scale: number,
): void {
  drawLeaf(ctx, cx, cy, radius, k, scale);
}

/** heavy (C): large and dense — the same body plus an inner ring for weight. */
export function drawHeavyBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  k: number,
  scale: number,
): void {
  drawLeaf(ctx, cx, cy, radius, k, scale);
  ctx.save();
  ctx.shadowColor = rgba(CYAN, 0.5);
  ctx.shadowBlur = 6 * scale;
  ctx.strokeStyle = rgba(CYAN, 0.55 * Math.min(1, k));
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** splash (D): a membrane wrapped around a small core, wide enough to read as one blast radius. */
export function drawSplashBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
  t: number,
  scale: number,
  k: number,
): void {
  drawMembrane(ctx, cx, cy, radius, seed, t, scale);
  drawLeaf(ctx, cx, cy, radius * 0.34, k, scale);
}

const MINION_ORBIT_RADIUS_CELLS = 0.34;
const MINION_ENGAGE_CLAMP_FACTOR = 0.85;
const MINION_DOT_RADIUS_BASELINE = 4;

function minionIdlePixel(
  ux: number,
  uy: number,
  seed: number,
  minionIndex: number,
  t: number,
  layout: Layout,
): [number, number] {
  const angle = seed + minionIndex * Math.PI + t * 0.9;
  return cellCenter(
    layout,
    ux + Math.cos(angle) * MINION_ORBIT_RADIUS_CELLS,
    uy + Math.sin(angle) * MINION_ORBIT_RADIUS_CELLS,
  );
}

function minionEngagedPixel(
  ux: number,
  uy: number,
  ex: number,
  ey: number,
  layout: Layout,
): [number, number] {
  const dx = ex - ux;
  const dy = ey - uy;
  const dist = Math.hypot(dx, dy);
  const range = UNIT_KINDS.blocker.rangeCells * MINION_ENGAGE_CLAMP_FACTOR;
  const clamped = Math.min(dist, range);
  const angle = Math.atan2(dy, dx);
  return cellCenter(layout, ux + Math.cos(angle) * clamped, uy + Math.sin(angle) * clamped);
}

function drawMinions(
  ctx: CanvasRenderingContext2D,
  game: Game,
  ux: number,
  uy: number,
  seed: number,
  minions: NonNullable<import("../game").Unit["minions"]>,
  t: number,
  scale: number,
  layout: Layout,
): void {
  minions.forEach((minion, i) => {
    if (minion.alive) {
      const target = minion.targetId !== null ? game.enemies.find((e) => e.id === minion.targetId) : undefined;
      const [mx, my] = target
        ? minionEngagedPixel(ux, uy, target.x, target.y, layout)
        : minionIdlePixel(ux, uy, seed, i, t, layout);
      const r = MINION_DOT_RADIUS_BASELINE * scale;
      ctx.save();
      ctx.shadowColor = rgba(CYAN_CORE, 0.75);
      ctx.shadowBlur = 6 * scale;
      ctx.fillStyle = rgba(CYAN_CORE, 0.9);
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      const [mx, my] = minionIdlePixel(ux, uy, seed, i, t, layout);
      const recoverFrac = 1 - minion.respawnTimer / UNIT_KINDS.blocker.minionRespawnSeconds!;
      ctx.save();
      ctx.strokeStyle = rgba(CYAN, 0.25 + 0.45 * Math.max(0, Math.min(1, recoverFrac)));
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.arc(mx, my, MINION_DOT_RADIUS_BASELINE * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });
}

/** Kinds are told apart purely by shape; level within a kind only changes scale and core brightness. */
export function drawUnits(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  const scale = scaleFor(layout);

  for (const [index, unit] of game.units) {
    const x = index % GRID_SIZE;
    const y = Math.floor(index / GRID_SIZE);
    const [cx, cy] = cellCenter(layout, x, y);
    const seed = hashAngle(index);
    const breathe = 1 + 0.03 * Math.sin(1.1 * t + seed);
    const { size, k } = levelFactors(unit.level);
    const radius = 15 * scale * breathe * size;

    if (unit.kind === "rapid") {
      drawRapidBody(ctx, cx, cy, radius, seed, scale, unit.level);
    } else if (unit.kind === "heavy") {
      drawHeavyBody(ctx, cx, cy, radius * 1.15, k, scale);
    } else if (unit.kind === "splash") {
      drawSplashBody(ctx, cx, cy, radius * 1.15, seed, t, scale, k);
    } else {
      drawBlockerBody(ctx, cx, cy, radius * 0.85, k, scale);
      if (unit.minions) drawMinions(ctx, game, x, y, seed, unit.minions, t, scale, layout);
    }
  }
}
