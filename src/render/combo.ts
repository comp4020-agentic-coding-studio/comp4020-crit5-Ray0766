// A ×N readout for kills landing within 1.5s of each other — watches
// game.fx the same way fx.ts does (WeakSet dedup, no game-state mutation),
// so this stays a pure reaction to facts the game already recorded.
import type { FxEvent, Game } from "../game";
import { scaleFor, type Layout } from "./layout";
import { CYAN_CORE, rgba } from "./palette";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';
const COMBO_WINDOW = 1.5;
const SPRING_DURATION = 0.25;

const seenFx = new WeakSet<FxEvent>();
let comboCount = 0;
let lastKillAt = -Infinity;
let comboStartedAt = -Infinity;

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function ingest(game: Game, t: number): void {
  for (const event of game.fx) {
    if (seenFx.has(event)) continue;
    seenFx.add(event);
    if (event.kind !== "kill" && event.kind !== "boss-kill") continue;

    comboCount = t - lastKillAt <= COMBO_WINDOW ? comboCount + 1 : 1;
    lastKillAt = t;
    comboStartedAt = t;
  }
}

export function drawCombo(
  ctx: CanvasRenderingContext2D,
  game: Game,
  layout: Layout,
  width: number,
  height: number,
  t: number,
): void {
  ingest(game, t);
  if (comboCount < 2 || t - lastKillAt >= COMBO_WINDOW) return;

  const scale = scaleFor(layout);
  const springP = easeOutCubic(Math.min(1, (t - comboStartedAt) / SPRING_DURATION));
  const springScale = 1.6 - 0.6 * springP;

  ctx.save();
  ctx.translate(width / 2, height * 0.22);
  ctx.scale(springScale, springScale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${36 * scale}px ${FONT_STACK}`;
  ctx.fillStyle = rgba(CYAN_CORE, 0.9);
  ctx.fillText(`×${comboCount}`, 0, 0);
  ctx.restore();
}
