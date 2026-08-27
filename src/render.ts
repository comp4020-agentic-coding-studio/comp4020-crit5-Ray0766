import type { Game } from "./game";
import { drawUnits } from "./render/cells";
import { drawWaveBanner } from "./render/banner";
import { drawCoreFlash } from "./render/coreflash";
import { drawFx } from "./render/fx";
import { computeLayout, type Layout } from "./render/layout";
import { drawNumbers } from "./render/numbers";
import { drawOrbs } from "./render/orbs";
import { drawPathogens, prunePathogenCache } from "./render/pathogens";
import { drawPathLength } from "./render/pathlen";
import { drawEnding } from "./render/ending";
import { drawGrid } from "./render/grid";
import { drawHeart } from "./render/heart";
import { drawScoreSidebar } from "./render/score";
import { drawSelector } from "./render/selector";
import { tickShake } from "./render/shake";
import { drawAttackTrails } from "./render/trails";
import { computeVesselPaths, drawVessels, drawVesselParticles } from "./render/vessels";

export { computeLayout, type Layout };

export function draw(ctx: CanvasRenderingContext2D, game: Game, width: number, height: number): void {
  const layout = computeLayout(width, height);
  const t = performance.now() / 1000;

  const vessels = computeVesselPaths(game, layout, t);
  drawVessels(ctx, width, height, layout, vessels);

  const shakeOffset = tickShake(t);
  ctx.save();
  ctx.translate(shakeOffset.x, shakeOffset.y);

  ctx.globalCompositeOperation = "lighter";
  drawVesselParticles(ctx, layout, t, vessels);
  drawGrid(ctx, game, layout, t);
  drawOrbs(ctx, game, layout, t);
  drawPathogens(ctx, game, layout, t);
  prunePathogenCache(game);
  drawUnits(ctx, game, layout, t);
  drawAttackTrails(ctx, game, layout);
  drawHeart(ctx, game, layout, t);
  drawFx(ctx, game, layout, t);
  drawCoreFlash(ctx, game, width, height, t);
  drawPathLength(ctx, game, layout, t);
  drawWaveBanner(ctx, game, layout, width, height, t);
  drawNumbers(ctx, game, layout, width, t);
  drawSelector(ctx, game, layout, t);
  drawScoreSidebar(ctx, game, layout, t);

  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
  drawEnding(ctx, game, layout, width, height, t);
}
