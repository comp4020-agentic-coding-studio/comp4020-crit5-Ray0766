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

// Debug-only fast-forward, for reaching the wave-8 boss without sitting
// through the whole run. Only does anything when the URL explicitly asks
// for it - a normal visit has neither param and nothing here runs.
const debugParams = new URLSearchParams(window.location.search);
const debugSeed = debugParams.get("seed");
const debugWave = debugParams.get("wave");
if (debugSeed !== null) {
  const seed = Number(debugSeed);
  if (Number.isFinite(seed)) game.setSeed(seed);
}
if (debugWave !== null) {
  const wave = Number(debugWave);
  if (Number.isFinite(wave)) game.debugJumpToWave(wave);
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  draw(ctx, game, canvas.width, canvas.height);
  if (shouldAutoRestart(game, game.clock)) game.reset();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
