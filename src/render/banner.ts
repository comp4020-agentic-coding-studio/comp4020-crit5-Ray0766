// A big numeral that flashes up whenever the wave counter changes, sitting a
// bit above center. Purely a readout of a number already on the HUD in small
// print — no words, same rule as everywhere else on this board.
import { BOSS_WAVE } from "../constants";
import type { Game } from "../game";
import { scaleFor, type Layout } from "./layout";
import { CYAN, MAGENTA, rgba } from "./palette";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';
const LIFETIME_SECONDS = 1.9;
const SCALE_IN_END = 0.18; // fraction of lifetime
const HOLD_END = 0.78;
const BANNER_HEIGHT_RATIO = 0.42;
const FONT_SIZE_BASELINE = 140;

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

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
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
  if (elapsed < 0 || elapsed > LIFETIME_SECONDS) return;

  const frac = elapsed / LIFETIME_SECONDS;
  let bannerScale: number;
  let alpha: number;
  if (frac < SCALE_IN_END) {
    const p = easeOutCubic(frac / SCALE_IN_END);
    bannerScale = 2.6 + (1 - 2.6) * p;
    alpha = 1;
  } else if (frac < HOLD_END) {
    bannerScale = 1;
    alpha = 1;
  } else {
    const p = (frac - HOLD_END) / (1 - HOLD_END);
    bannerScale = 1 + (0.9 - 1) * p;
    alpha = 1 - p;
  }

  const scale = scaleFor(layout);
  const color = shownWave === BOSS_WAVE ? MAGENTA : CYAN;

  ctx.save();
  ctx.translate(width / 2, height * BANNER_HEIGHT_RATIO);
  ctx.scale(bannerScale, bannerScale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${FONT_SIZE_BASELINE * scale}px ${FONT_STACK}`;
  ctx.shadowColor = rgba(color, 0.9 * alpha);
  ctx.shadowBlur = 24 * scale;
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(String(shownWave), 0, 0);
  ctx.restore();
}
