// A full-screen magenta flood the instant something reaches the core, so a
// hit on the core reads as a body-blow even before the health digit updates.
import type { Game } from "../game";
import { MAGENTA, rgba } from "./palette";

const DURATION = 0.45;

const seen = new WeakSet<object>();
let triggeredAt = -Infinity;

function ingest(game: Game, t: number): void {
  for (const event of game.fx) {
    if (event.kind !== "core-hit") continue;
    if (seen.has(event)) continue;
    seen.add(event);
    triggeredAt = t;
  }
}

export function drawCoreFlash(
  ctx: CanvasRenderingContext2D,
  game: Game,
  width: number,
  height: number,
  t: number,
): void {
  ingest(game, t);
  const remaining = DURATION - (t - triggeredAt);
  if (remaining <= 0) return;
  ctx.fillStyle = rgba(MAGENTA, remaining * 0.5);
  ctx.fillRect(0, 0, width, height);
}
