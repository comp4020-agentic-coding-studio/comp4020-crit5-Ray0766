// A big numeral that flashes up whenever the wave counter changes, sitting a
// bit above center. Purely a readout of a number already on the HUD in small
// print — no words, same rule as everywhere else on this board.
import { BOSS_WAVE } from "../constants";
import type { Game } from "../game";
import { scaleFor, type Layout } from "./layout";
import { CYAN, MAGENTA, rgba } from "./palette";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';
const VISIBLE_SECONDS = 2.2;
const FADE_IN_SECONDS = 0.4;
const BANNER_HEIGHT_RATIO = 0.36;
const FONT_SIZE_BASELINE = 52;

let lastSeenWave = 0;
let shownAt = -Infinity;
let shownWave = 0;

function ingestWave(game: Game, t: number): void {
  if (game.waveNumber === lastSeenWave) return;
  lastSeenWave = game.waveNumber;
  if (game.waveNumber >= 1) {
    shownAt = t;
    shownWave = game.waveNumber;
  }
}

export function drawWaveBanner(
  ctx: CanvasRenderingContext2D,
  game: Game,
  layout: Layout,
  width: number,
  height: number,
  t: number,
): void {
  ingestWave(game, t);
  const elapsed = t - shownAt;
  if (elapsed < 0 || elapsed > VISIBLE_SECONDS) return;

  const alpha = Math.min(1, elapsed / FADE_IN_SECONDS);
  const scale = scaleFor(layout);
  const color = shownWave === BOSS_WAVE ? MAGENTA : CYAN;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${FONT_SIZE_BASELINE * scale}px ${FONT_STACK}`;
  ctx.shadowColor = rgba(color, 0.9 * alpha);
  ctx.shadowBlur = 24 * scale;
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(String(shownWave), width / 2, height * BANNER_HEIGHT_RATIO);
  ctx.restore();
}
