// A single number sitting above the core: the current shortest BFS route
// from any entrance in, recomputed every frame straight off game.distanceField
// so it's never out of sync with what the board actually allows. A floater
// pops off it on change — the only feedback for "that placement mattered."
import type { Game } from "../game";
import { CORE_X, CORE_Y, ENTRANCES } from "../constants";
import { cellIndex } from "../pathing";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { CYAN, CYAN_CORE, MAGENTA, rgba } from "./palette";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';
const FLOAT_RISE_PER_SECOND = 34;
const FLOAT_FADE_DURATION = 0.9;

export const PATH_LEN_OFFSET_Y = 92;

interface Floater {
  value: number;
  startedAt: number;
}

let lastShown: number | null = null;
let floaters: Floater[] = [];

function currentPathLength(game: Game): number | null {
  let best: number | null = null;
  for (const [ex, ey] of ENTRANCES) {
    const d = game.distanceField[cellIndex(game.grid, ex, ey)];
    if (d === -1) continue;
    if (best === null || d < best) best = d;
  }
  return best;
}

function ingest(game: Game, t: number): void {
  const current = currentPathLength(game);
  if (current === null) return;
  if (lastShown === null) {
    lastShown = current;
  } else if (current !== lastShown) {
    floaters.push({ value: current - lastShown, startedAt: t });
    lastShown = current;
  }
  floaters = floaters.filter((f) => t - f.startedAt < FLOAT_FADE_DURATION);
}

export function drawPathLength(
  ctx: CanvasRenderingContext2D,
  game: Game,
  layout: Layout,
  t: number,
): void {
  ingest(game, t);
  if (lastShown === null) return;

  const scale = scaleFor(layout);
  const [cx, cy] = cellCenter(layout, CORE_X, CORE_Y);
  const y = cy - PATH_LEN_OFFSET_Y * scale;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${21 * scale}px ${FONT_STACK}`;
  ctx.fillStyle = rgba(CYAN_CORE, 0.85);
  ctx.fillText(String(lastShown), cx, y);

  ctx.textAlign = "left";
  ctx.font = `${15 * scale}px ${FONT_STACK}`;
  for (const f of floaters) {
    const elapsed = t - f.startedAt;
    const progress = Math.min(1, elapsed / FLOAT_FADE_DURATION);
    const fy = y - FLOAT_RISE_PER_SECOND * elapsed * scale;
    const fx = cx + 22 * scale;
    const text = f.value > 0 ? `+${f.value}` : `${f.value}`;
    ctx.fillStyle = rgba(f.value > 0 ? CYAN : MAGENTA, 1 - progress);
    ctx.fillText(text, fx, fy);
  }
}
