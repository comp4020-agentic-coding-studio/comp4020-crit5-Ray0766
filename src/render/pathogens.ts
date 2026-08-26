import type { Game } from "../game";
import { mulberry32 } from "./geometry";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { MAGENTA, MAGENTA_CORE, rgba } from "./palette";

const VERTEX_COUNT = 15;
const BODY_RADIUS_BASELINE = 13;
const SWAY_BASELINE = 1.5;

interface PathogenLook {
  baseCoeffs: number[];
  phases: number[];
  isSpike: boolean[];
  hasFlagellum: boolean[];
}

const cache = new Map<number, PathogenLook>();

function lookFor(id: number): PathogenLook {
  const existing = cache.get(id);
  if (existing) return existing;
  const rand = mulberry32(id * 7919 + 3);
  const baseCoeffs: number[] = [];
  const phases: number[] = [];
  const isSpike: boolean[] = [];
  const hasFlagellum: boolean[] = [];
  for (let i = 0; i < VERTEX_COUNT; i++) {
    baseCoeffs.push(0.7 + rand() * 0.6);
    phases.push(rand() * Math.PI * 2);
    isSpike.push(rand() < 0.22);
    hasFlagellum.push(rand() < 0.35);
  }
  const look: PathogenLook = { baseCoeffs, phases, isSpike, hasFlagellum };
  cache.set(id, look);
  return look;
}

/** Drop cached jitter for enemies no longer alive, so this doesn't grow forever across a run. */
export function prunePathogenCache(game: Game): void {
  const alive = new Set(game.enemies.map((enemy) => enemy.id));
  for (const id of cache.keys()) {
    if (!alive.has(id)) cache.delete(id);
  }
}

export function drawPathogens(
  ctx: CanvasRenderingContext2D,
  game: Game,
  layout: Layout,
  t: number,
): void {
  const scale = scaleFor(layout);
  const r = BODY_RADIUS_BASELINE * scale;

  for (const enemy of game.enemies) {
    const [cx, cy] = cellCenter(layout, enemy.x, enemy.y);
    const look = lookFor(enemy.id);
    const vertices: Array<{ x: number; y: number; angle: number; radius: number }> = [];

    for (let i = 0; i < VERTEX_COUNT; i++) {
      const angle = (i / VERTEX_COUNT) * Math.PI * 2;
      let radius = r * look.baseCoeffs[i] * (1 + 0.12 * Math.sin(1.4 * t + look.phases[i]));
      if (look.isSpike[i]) radius *= 1.55;
      vertices.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        angle,
        radius,
      });
    }

    ctx.save();
    ctx.shadowColor = rgba(MAGENTA, 0.55);
    ctx.shadowBlur = 15 * scale;
    ctx.fillStyle = rgba(MAGENTA, 0.3);
    ctx.beginPath();
    vertices.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = rgba(MAGENTA, 0.55);
    ctx.shadowBlur = 8 * scale;
    ctx.strokeStyle = rgba(MAGENTA, 0.55);
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    vertices.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < VERTEX_COUNT; i++) {
      if (!look.hasFlagellum[i]) continue;
      const v = vertices[i];
      const sway = SWAY_BASELINE * scale * Math.sin(2 * t + look.phases[i]);
      const perpX = -Math.sin(v.angle);
      const perpY = Math.cos(v.angle);
      const length = v.radius * 1.3;
      const tipX = v.x + Math.cos(v.angle) * length + perpX * sway;
      const tipY = v.y + Math.sin(v.angle) * length + perpY * sway;
      ctx.strokeStyle = rgba(MAGENTA, 0.4);
      ctx.lineWidth = 0.8 * scale;
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }

    ctx.save();
    ctx.shadowColor = rgba(MAGENTA_CORE, 0.9);
    ctx.shadowBlur = 10 * scale;
    ctx.fillStyle = rgba(MAGENTA_CORE, 0.9);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
