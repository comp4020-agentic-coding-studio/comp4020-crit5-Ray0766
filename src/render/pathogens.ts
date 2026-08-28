import { ATTACK_FLASH_TTL, type Game } from "../game";
import { ENEMY_TIERS } from "../constants";
import { mulberry32 } from "./geometry";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { MAGENTA, MAGENTA_CORE, rgba } from "./palette";

const VERTEX_COUNT = 15;
const BODY_RADIUS_BASELINE = 13;
const SWAY_BASELINE = 1.5;
const HP_RING_GAP = 7;
const HIT_FLASH_DURATION = 0.08;
const SPIKE_MULTIPLIER = 1.55;
const SHARP_EXAGGERATION = 1.3; // fast tier: spikes push further out, the rest dents further in

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

interface SilhouetteOptions {
  sharp?: boolean;
  thick?: boolean;
  winged?: boolean;
  alpha?: number;
  color?: string;
}

/** Draws one jittered pathogen body — silhouette, flagella, core dot — at
 *  the given center/radius. Shared by live enemies and the wave-intel
 *  preview icons, which reuse the same `seed` a live enemy of that id would
 *  produce so the preview is the real shape, not a stand-in. */
export function drawPathogenSilhouette(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
  t: number,
  scale: number,
  options: SilhouetteOptions = {},
): void {
  const { sharp = false, thick = false, winged = false, alpha = 1, color = MAGENTA } = options;
  const look = lookFor(seed);
  const vertices: Array<{ x: number; y: number; angle: number; radius: number }> = [];

  for (let i = 0; i < VERTEX_COUNT; i++) {
    const angle = (i / VERTEX_COUNT) * Math.PI * 2;
    const swayScale = thick ? 0.05 : 0.12;
    let r = radius * look.baseCoeffs[i] * (1 + swayScale * Math.sin(1.4 * t + look.phases[i]));
    if (look.isSpike[i]) r *= sharp ? SPIKE_MULTIPLIER * SHARP_EXAGGERATION : thick ? 1.08 : SPIKE_MULTIPLIER;
    else if (sharp) r /= SHARP_EXAGGERATION;
    else if (thick) r *= 1.05;
    vertices.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      angle,
      radius: r,
    });
  }

  ctx.save();
  ctx.shadowColor = rgba(MAGENTA, 0.55 * alpha);
  ctx.shadowBlur = 15 * scale;
  ctx.fillStyle = rgba(color, (thick ? 0.42 : 0.3) * alpha);
  ctx.beginPath();
  vertices.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = rgba(MAGENTA, 0.55 * alpha);
  ctx.shadowBlur = 8 * scale;
  ctx.strokeStyle = rgba(color, 0.55 * alpha);
  ctx.lineWidth = (thick ? 2.2 : 1) * scale;
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
    ctx.strokeStyle = rgba(color, 0.4 * alpha);
    ctx.lineWidth = 0.8 * scale;
    ctx.beginPath();
    ctx.moveTo(v.x, v.y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  }

  ctx.save();
  ctx.shadowColor = rgba(MAGENTA_CORE, 0.9 * alpha);
  ctx.shadowBlur = 10 * scale;
  ctx.fillStyle = rgba(MAGENTA_CORE, 0.9 * alpha);
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (winged) {
    const flap = Math.sin(t * 10 + look.phases[0]);
    const wingSpan = radius * 1.1;
    const lift = radius * 0.3 * flap;
    ctx.save();
    ctx.fillStyle = rgba(color, 0.35 * alpha);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + side * radius * 0.6, cy - lift);
      ctx.rotate(side * (0.5 + flap * 0.3));
      ctx.beginPath();
      ctx.ellipse(0, 0, wingSpan * 0.5, wingSpan * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

export function drawPathogens(
  ctx: CanvasRenderingContext2D,
  game: Game,
  layout: Layout,
  t: number,
): void {
  const scale = scaleFor(layout);

  for (const enemy of game.enemies) {
    const sizeMultiplier = ENEMY_TIERS[enemy.tier].sizeMultiplier;
    const r = BODY_RADIUS_BASELINE * scale * sizeMultiplier;
    const [cx, cy] = cellCenter(layout, enemy.x, enemy.y);

    const justHit = game.flashes.some(
      (f) => f.targetId === enemy.id && ATTACK_FLASH_TTL - f.ttl < HIT_FLASH_DURATION,
    );
    const bodyColor = justHit ? MAGENTA_CORE : MAGENTA;

    drawPathogenSilhouette(ctx, cx, cy, r, enemy.id, t, scale, {
      sharp: enemy.tier === "spore",
      thick: enemy.tier === "armored",
      winged: enemy.tier === "flying",
      color: bodyColor,
    });

    if (enemy.hp < enemy.maxHp) {
      const sweep = Math.PI * 2 * Math.max(0, enemy.hp / enemy.maxHp);
      ctx.save();
      ctx.strokeStyle = rgba(MAGENTA, 0.9);
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, r + HP_RING_GAP * scale, -Math.PI / 2, -Math.PI / 2 + sweep, false);
      ctx.stroke();
      ctx.restore();
    }
  }
}
