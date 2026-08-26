import type { AttackFlash, Game } from "../game";
import { TOTAL_WAVES, UNIT_LEVELS } from "../constants";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { AMBER_CORE, CYAN_CORE, rgba } from "./palette";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';
const POPUP_DURATION = 0.7;

interface DamagePopup {
  x: number;
  y: number;
  value: number;
  startedAt: number;
}

// game.ts drops a flash after ~0.1s (just long enough to draw an attack line),
// far shorter than a readable pop-up. So a fresh flash seeds our own
// independent, longer-lived popup instead of being drawn directly.
const seenFlashes = new WeakSet<AttackFlash>();
let activePopups: DamagePopup[] = [];

function ingestFlashes(game: Game, t: number): void {
  for (const flash of game.flashes) {
    if (seenFlashes.has(flash)) continue;
    seenFlashes.add(flash);
    const attacker = game.unitAt(flash.fromX, flash.fromY);
    const value = attacker ? UNIT_LEVELS[attacker.level - 1].damage : 0;
    if (value > 0) activePopups.push({ x: flash.toX, y: flash.toY, value, startedAt: t });
  }
  activePopups = activePopups.filter((popup) => t - popup.startedAt < POPUP_DURATION);
}

function drawPopups(ctx: CanvasRenderingContext2D, layout: Layout, t: number): void {
  const scale = scaleFor(layout);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${12 * scale}px ${FONT_STACK}`;
  for (const popup of activePopups) {
    const progress = Math.min(1, (t - popup.startedAt) / POPUP_DURATION);
    const [cx, cy] = cellCenter(layout, popup.x, popup.y);
    const y = cy - (10 + 22 * progress) * scale;
    ctx.fillStyle = rgba(CYAN_CORE, 1 - progress);
    ctx.fillText(`-${popup.value}`, cx, y);
  }
}

function drawHud(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, width: number): void {
  const scale = scaleFor(layout);
  ctx.textBaseline = "middle";
  ctx.font = `${15 * scale}px ${FONT_STACK}`;
  const y = layout.hudTop / 2;

  ctx.textAlign = "left";
  ctx.fillStyle = rgba(AMBER_CORE, 0.85);
  ctx.fillText(String(Math.floor(game.resource)), 16 * scale, y);

  ctx.textAlign = "right";
  ctx.fillStyle = rgba(CYAN_CORE, 0.85);
  const wave = Math.min(game.waveNumber, TOTAL_WAVES);
  ctx.fillText(`${wave}/${TOTAL_WAVES}`, width - 16 * scale, y);
}

export function drawNumbers(
  ctx: CanvasRenderingContext2D,
  game: Game,
  layout: Layout,
  width: number,
  t: number,
): void {
  ingestFlashes(game, t);
  drawPopups(ctx, layout, t);
  drawHud(ctx, game, layout, width);
}
