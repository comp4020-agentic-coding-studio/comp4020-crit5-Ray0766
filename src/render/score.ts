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

interface ScorePopup {
  value: number;
  startedAt: number;
}

let popups: ScorePopup[] = [];

function ingestScore(game: Game, t: number): void {
  if (game.score > lastScore) popups.push({ value: game.score - lastScore, startedAt: t });
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

  ctx.font = `${20 * scale}px ${FONT_STACK}`;
  ctx.fillStyle = rgba(CYAN_CORE, 0.9);
  ctx.fillText(String(game.score), cx, scoreY);

  ctx.font = `${13 * scale}px ${FONT_STACK}`;
  ctx.fillStyle = rgba(CYAN_CORE, 0.3);
  ctx.fillText(String(highScore), cx, highY);

  ctx.font = `${13 * scale}px ${FONT_STACK}`;
  const popupX = cx + layout.hudLeft * 0.32;
  for (const popup of popups) {
    const progress = Math.min(1, (t - popup.startedAt) / POPUP_DURATION);
    ctx.fillStyle = rgba(CYAN_CORE, 1 - progress);
    const y = scoreY - (6 + 20 * progress) * scale;
    ctx.fillText(`+${popup.value}`, popupX, y);
  }
}
