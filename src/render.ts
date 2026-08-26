import type { Game } from "./game";
import { drawUnits } from "./render/cells";
import { drawWaveBanner } from "./render/banner";
import { drawCoreFlash } from "./render/coreflash";
import { drawFx } from "./render/fx";
import { computeLayout, type Layout } from "./render/layout";
import { drawNumbers } from "./render/numbers";
import { drawOrbs } from "./render/orbs";
import { CYAN, MAGENTA, rgba } from "./render/palette";
import { drawPathogens, prunePathogenCache } from "./render/pathogens";
import { drawGrid } from "./render/grid";
import { drawHeart } from "./render/heart";
import { tickShake } from "./render/shake";
import { drawAttackTrails } from "./render/trails";
import { drawVesselParticles, getVesselBaseLayer } from "./render/vessels";

export { computeLayout, type Layout };

export function draw(ctx: CanvasRenderingContext2D, game: Game, width: number, height: number): void {
  const layout = computeLayout(width, height);
  const t = performance.now() / 1000;

  ctx.globalCompositeOperation = "source-over";
  const base = getVesselBaseLayer(width, height, layout);
  ctx.drawImage(base, 0, 0);

  const shakeOffset = tickShake(t);
  ctx.save();
  ctx.translate(shakeOffset.x, shakeOffset.y);

  ctx.globalCompositeOperation = "lighter";
  drawVesselParticles(ctx, layout, t);
  drawGrid(ctx, game, layout, t);
  drawOrbs(ctx, game, layout, t);
  drawPathogens(ctx, game, layout, t);
  prunePathogenCache(game);
  drawUnits(ctx, game, layout, t);
  drawAttackTrails(ctx, game, layout);
  drawHeart(ctx, game, layout, t);
  drawFx(ctx, game, layout, t);
  drawCoreFlash(ctx, game, width, height, t);
  drawWaveBanner(ctx, game, layout, width, height, t);
  drawNumbers(ctx, game, layout, width, t);

  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
  drawEndOverlay(ctx, game, width, height);
}

function drawEndOverlay(
  ctx: CanvasRenderingContext2D,
  game: Game,
  width: number,
  height: number,
): void {
  if (game.status === "won") {
    ctx.fillStyle = rgba(CYAN, 0.22);
    ctx.fillRect(0, 0, width, height);
  } else if (game.status === "lost") {
    ctx.fillStyle = rgba(MAGENTA, 0.28);
    ctx.fillRect(0, 0, width, height);
  }
}
