import type { Game, ResourceOrb } from "../game";
import { RESOURCE_ORB_LIFETIME } from "../constants";
import { hashAngle } from "./geometry";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { AMBER, AMBER_CORE, rgba } from "./palette";

const FADE_WINDOW = 1.5;

// Matches the solid ring drawn below - the crisp "ball" boundary a player
// actually aims at, as opposed to the much bigger ambient glow halo.
export const ORB_VISUAL_RADIUS_BASELINE = 9;

/** Pixel-space hit-test against live orbs - mirrors selectorHitTest /
 *  callDotHitTest so orb pickup follows the same convention instead of
 *  round-tripping through the grid-fractional coordinate frame. */
export function orbHitTest(game: Game, layout: Layout, px: number, py: number, radiusPx: number): ResourceOrb | null {
  let best: ResourceOrb | null = null;
  let bestDist = radiusPx;
  for (const orb of game.orbs) {
    const [ox, oy] = cellCenter(layout, orb.x, orb.y);
    const dist = Math.hypot(px - ox, py - oy);
    if (dist <= bestDist) {
      bestDist = dist;
      best = orb;
    }
  }
  return best;
}

export function drawOrbs(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  const scale = scaleFor(layout);

  for (const orb of game.orbs) {
    const phase = hashAngle(orb.id);
    const remaining = RESOURCE_ORB_LIFETIME - orb.age;
    const fade = remaining < FADE_WINDOW ? Math.max(0, remaining / FADE_WINDOW) : 1;
    if (fade <= 0) continue;

    const bob = 2 * scale * Math.sin(1.2 * t + phase);
    const [baseX, baseY] = cellCenter(layout, orb.x, orb.y);
    const cx = baseX;
    const cy = baseY + bob;

    const glowRadius = 32 * scale;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    glow.addColorStop(0, rgba(AMBER, 0.35 * fade));
    glow.addColorStop(1, rgba(AMBER, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = rgba(AMBER, 0.5 * fade);
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, 9 * scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = rgba(AMBER_CORE, 0.95 * fade);
    ctx.shadowBlur = 10 * scale;
    ctx.fillStyle = rgba(AMBER_CORE, 0.95 * fade);
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const orbitAngle = 1.5 * t + phase;
    const dotX = cx + Math.cos(orbitAngle) * 9 * scale;
    const dotY = cy + Math.sin(orbitAngle) * 9 * scale;
    ctx.fillStyle = rgba(AMBER, 0.8 * fade);
    ctx.beginPath();
    ctx.arc(dotX, dotY, 1.2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}
