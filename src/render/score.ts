import type { Game } from "../game";
import { GRID_SIZE } from "../constants";
import { scaleFor, type Layout } from "./layout";
import { CYAN_CORE, rgba } from "./palette";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';
const HIGH_SCORE_KEY = "sentinel-high-score";
const POPUP_DURATION = 0.7;

function loadHighScore(): number {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(value: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch {
    // private browsing or storage disabled - just don't persist
  }
}

let highScore = loadHighScore();
let lastScore = 0;

export function getHighScore(): number {
  return highScore;
}

interface ScorePopup {
  value: number;
  startedAt: number;
}

let popups: ScorePopup[] = [];
const SCORE_FLASH_DURATION = 0.25;
let scoreFlashAt = -Infinity;

function ingestScore(game: Game, t: number): void {
  if (game.score > lastScore) {
    popups.push({ value: game.score - lastScore, startedAt: t });
    scoreFlashAt = t;
  }
  lastScore = game.score;
  if (game.score > highScore) {
    highScore = game.score;
    saveHighScore(highScore);
  }
  popups = popups.filter((popup) => t - popup.startedAt < POPUP_DURATION);
}

export function drawScoreSidebar(
  ctx: CanvasRenderingContext2D,
  game: Game,
  layout: Layout,
  t: number,
): void {
  ingestScore(game, t);
  const scale = scaleFor(layout);
  const cx = layout.hudLeft / 2;
  const boardCenterY = layout.offsetY + (layout.cellSize * GRID_SIZE) / 2;
  const scoreY = boardCenterY - 16 * scale;
  const highY = boardCenterY + 16 * scale;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const flashProgress = Math.min(1, (t - scoreFlashAt) / SCORE_FLASH_DURATION);
  const flashPunch = flashProgress < 1 ? 1 - flashProgress : 0;
  ctx.font = `${(28 + 6 * flashPunch) * scale}px ${FONT_STACK}`;
  ctx.fillStyle = rgba(CYAN_CORE, 1);
  ctx.shadowColor = rgba(CYAN_CORE, 0.8 * flashPunch);
  ctx.shadowBlur = 14 * scale * flashPunch;
  ctx.fillText(String(game.score), cx, scoreY);
  ctx.shadowBlur = 0;

  ctx.font = `${11 * scale}px ${FONT_STACK}`;
  ctx.fillStyle = rgba(CYAN_CORE, 0.45);
  ctx.fillText(String(highScore), cx, highY);

  ctx.font = `bold ${18 * scale}px ${FONT_STACK}`;
  const popupX = cx + layout.hudLeft * 0.32;
  for (const popup of popups) {
    const progress = Math.min(1, (t - popup.startedAt) / POPUP_DURATION);
    ctx.fillStyle = rgba(CYAN_CORE, 1 - progress);
    const y = scoreY - (6 + 26 * progress) * scale;
    ctx.fillText(`+${popup.value}`, popupX, y);
  }
}
