import { Game } from "./src/game";
import { attachInput } from "./src/input";
import { draw } from "./src/render";
import { shouldAutoRestart } from "./src/render/ending";

const canvasEl = document.querySelector<HTMLCanvasElement>("#board");
if (!canvasEl) throw new Error("missing #board canvas");
const canvas = canvasEl;
const ctx2d = canvas.getContext("2d");
if (!ctx2d) throw new Error("2d context unavailable");
const ctx = ctx2d;

function resize(): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
}
resize();
window.addEventListener("resize", resize);

const game = new Game();
attachInput(canvas, game);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  draw(ctx, game, canvas.width, canvas.height);
  if (shouldAutoRestart(game, now / 1000)) game.reset();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
