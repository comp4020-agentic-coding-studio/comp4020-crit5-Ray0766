// Per-kind flourishes layered on top of the generic hit burst every shooter
// already gets from fx.ts: heavy gets a muzzle-flash ring at the shooter's
// own cell, splash gets a ripple ring at the hit point. Both just watch
// game.flashes for a new entry from the right kind of attacker — no new
// game-state plumbing needed.
import type { AttackFlash, Game } from "../game";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { CYAN, CYAN_CORE, rgba } from "./palette";

const MUZZLE_DURATION = 0.22;
const MUZZLE_MAX_RADIUS = 22;
const RIPPLE_DURATION = 0.32;
const RIPPLE_MAX_RADIUS = 34;

interface RingFx {
  x: number;
  y: number;
  startedAt: number;
  duration: number;
  maxRadius: number;
  color: string;
}

const seenFlashes = new WeakSet<AttackFlash>();
let muzzles: RingFx[] = [];
let ripples: RingFx[] = [];

function ingest(game: Game, layout: Layout, t: number): void {
  for (const flash of game.flashes) {
    if (seenFlashes.has(flash)) continue;
    seenFlashes.add(flash);
    const attacker = game.unitAt(flash.fromX, flash.fromY);
    if (!attacker) continue;
    if (attacker.kind === "heavy") {
      const [x, y] = cellCenter(layout, flash.fromX, flash.fromY);
      muzzles.push({ x, y, startedAt: t, duration: MUZZLE_DURATION, maxRadius: MUZZLE_MAX_RADIUS, color: CYAN_CORE });
    } else if (attacker.kind === "splash") {
      const [x, y] = cellCenter(layout, flash.toX, flash.toY);
      ripples.push({ x, y, startedAt: t, duration: RIPPLE_DURATION, maxRadius: RIPPLE_MAX_RADIUS, color: CYAN });
    }
  }
}

function drawRings(ctx: CanvasRenderingContext2D, rings: RingFx[], t: number, scale: number): RingFx[] {
  const alive: RingFx[] = [];
  for (const ring of rings) {
    const progress = (t - ring.startedAt) / ring.duration;
    if (progress >= 1) continue;
    alive.push(ring);
    const radius = ring.maxRadius * scale * progress;
    ctx.save();
    ctx.strokeStyle = rgba(ring.color, 0.85 * (1 - progress));
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  return alive;
}

export function drawImpactFx(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  ingest(game, layout, t);
  const scale = scaleFor(layout);
  muzzles = drawRings(ctx, muzzles, t, scale);
  ripples = drawRings(ctx, ripples, t, scale);
}
