// Once the run ends, the sidebar chrome (path length, selector, score,
// hearts) fades out over FADE_DURATION so the ending animation is left with
// just the heart, stars, and score — mirrors ending.ts's own
// lastStatus/statusSince status-change tracking.
import type { Game, GameStatus } from "../game";

const FADE_DURATION = 0.6;

let lastStatus: GameStatus = "playing";
let statusSince = -Infinity;

export function hudFadeAlpha(game: Game, t: number): number {
  if (game.status !== lastStatus) {
    lastStatus = game.status;
    if (game.status !== "playing") statusSince = t;
  }
  if (game.status === "playing") return 1;
  return Math.max(0, 1 - (t - statusSince) / FADE_DURATION);
}
