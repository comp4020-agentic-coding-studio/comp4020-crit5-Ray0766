// A short cyan streak along the shot line while an attack flash is alive,
// sampled at a handful of points between shooter and target so it reads as a
// trail rather than a single stroke.
import { ATTACK_FLASH_TTL, type Game } from "../game";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { CYAN, rgba } from "./palette";

const TRAIL_POINTS = 6;

export function drawAttackTrails(ctx: CanvasRenderingContext2D, game: Game, layout: Layout): void {
  const scale = scaleFor(layout);
  for (const flash of game.flashes) {
    const progress = Math.max(0, Math.min(1, flash.ttl / ATTACK_FLASH_TTL));
    const [fx, fy] = cellCenter(layout, flash.fromX, flash.fromY);
    const [tx, ty] = cellCenter(layout, flash.toX, flash.toY);

    ctx.save();
    ctx.shadowColor = rgba(CYAN, 0.9 * progress);
    ctx.shadowBlur = 10 * scale;
    ctx.strokeStyle = rgba(CYAN, 0.9 * progress);
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const p = i / (TRAIL_POINTS - 1);
      const px = fx + (tx - fx) * p;
      const py = fy + (ty - fy) * p;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
}
