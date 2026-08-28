import type { Game } from "./game";
import { drawUnits } from "./render/cells";
import { drawWaveBanner } from "./render/banner";
import { drawCallDot } from "./render/calldot";
import { drawCombo } from "./render/combo";
import { drawCoreFlash } from "./render/coreflash";
import { drawFx } from "./render/fx";
import { drawHearts } from "./render/hearts";
import { drawImpactFx } from "./render/impactfx";
import { drawWaveIntel } from "./render/intel";
import { computeLayout, type Layout } from "./render/layout";
import { drawNumbers } from "./render/numbers";
import { drawPathogens, prunePathogenCache } from "./render/pathogens";
import { drawPathLength } from "./render/pathlen";
import { drawEnding } from "./render/ending";
import { drawGrid } from "./render/grid";
import { drawHeart } from "./render/heart";
import { hudFadeAlpha } from "./render/hudfade";
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
  drawWaveIntel(ctx, game, layout, vessels, t);
  drawPathogens(ctx, game, layout, t);
  prunePathogenCache(game);
  drawUnits(ctx, game, layout, t);
  drawAttackTrails(ctx, game, layout);
  drawHeart(ctx, game, layout, t);
  drawFx(ctx, game, layout, t);
  drawImpactFx(ctx, game, layout, t);
  drawCoreFlash(ctx, game, width, height, t);

  const fade = hudFadeAlpha(game, t);
  ctx.save();
  ctx.globalAlpha = fade;
  drawPathLength(ctx, game, layout, t);
  ctx.restore();

  drawCallDot(ctx, game, layout, t);
  drawWaveBanner(ctx, game, layout, width, height, t);
  drawNumbers(ctx, game, layout, width, t);

  ctx.save();
  ctx.globalAlpha = fade;
  drawSelector(ctx, game, layout, t);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = fade;
  drawScoreSidebar(ctx, game, layout, t);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = fade;
  drawHearts(ctx, game, layout, t);
  ctx.restore();

  drawCombo(ctx, game, layout, width, height, t);

  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
  drawEnding(ctx, game, layout, width, height, t);
}
