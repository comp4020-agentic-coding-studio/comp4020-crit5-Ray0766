// Graphical preview of what's about to come through each vessel, live only
// during (and just after) the prep window. Reads game.upcomingPlan — the
// same data spawnEnemy will actually consume — so this is never a guess.
import { ENEMY_TIERS, ENEMY_TIER_ORDER, ENTRANCES, type EnemyTier } from "../constants";
import type { Game, SpawnPlan } from "../game";
import { scaleFor, type Layout } from "./layout";
import { MAGENTA_CORE, rgba } from "./palette";
import { drawPathogenSilhouette } from "./pathogens";
import type { VesselPath } from "./vessels";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';
const ICON_RADIUS_BASELINE = 9;
const SLOT_WIDTH = 46;
const INTEL_OFFSET_Y = 46;
const FADE_DURATION = 0.4;
const MAX_GROUPS_PER_ENTRANCE = 4;

function tierOf(entry: SpawnPlan): EnemyTier {
  return entry.tier;
}

function radiusMultiplier(tier: EnemyTier): number {
  return ENEMY_TIERS[tier].sizeMultiplier;
}

// Negative so it can never collide with a real (positive) enemy id in the
// shared silhouette-jitter cache — the preview still needs a stable seed of
// its own so the shape doesn't reshuffle every frame.
function seedFor(ex: number, ey: number, tier: EnemyTier): number {
  return -(1 + ex * 97 + ey * 13 + ENEMY_TIER_ORDER.indexOf(tier));
}

interface IntelGroup {
  tier: EnemyTier;
  count: number;
  seed: number;
}

function groupsFor(game: Game, ex: number, ey: number): IntelGroup[] {
  const counts = new Map<EnemyTier, number>();
  for (const entry of game.upcomingPlan) {
    if (entry.ex !== ex || entry.ey !== ey) continue;
    const tier = tierOf(entry);
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }
  return ENEMY_TIER_ORDER.filter((tier) => counts.has(tier))
    .slice(0, MAX_GROUPS_PER_ENTRANCE)
    .map((tier) => ({ tier, count: counts.get(tier)!, seed: seedFor(ex, ey, tier) }));
}

let lastInPrep = false;
let prepEndedAt = -Infinity;

function ingestPrepState(game: Game, t: number): void {
  if (lastInPrep && !game.inPrep) prepEndedAt = t;
  lastInPrep = game.inPrep;
}

function drawGroupRow(
  ctx: CanvasRenderingContext2D,
  groups: IntelGroup[],
  anchorX: number,
  anchorY: number,
  scale: number,
  t: number,
  alpha: number,
): void {
  const y = anchorY - INTEL_OFFSET_Y * scale;
  const totalWidth = groups.length * SLOT_WIDTH * scale;
  let slotCenterX = anchorX - totalWidth / 2 + (SLOT_WIDTH * scale) / 2;

  for (const group of groups) {
    const radius = ICON_RADIUS_BASELINE * scale * radiusMultiplier(group.tier);
    const iconX = slotCenterX - 8 * scale;
    drawPathogenSilhouette(ctx, iconX, y, radius, group.seed, t, scale, {
      sharp: group.tier === "spore",
      alpha,
    });

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `${14 * scale}px ${FONT_STACK}`;
    ctx.fillStyle = rgba(MAGENTA_CORE, 0.9 * alpha);
    ctx.fillText(`×${group.count}`, iconX + radius + 6 * scale, y);

    slotCenterX += SLOT_WIDTH * scale;
  }
}

export function drawWaveIntel(
  ctx: CanvasRenderingContext2D,
  game: Game,
  layout: Layout,
  vessels: VesselPath[],
  t: number,
): void {
  ingestPrepState(game, t);
  const fadeElapsed = t - prepEndedAt;
  if (!game.inPrep && fadeElapsed >= FADE_DURATION) return;
  const alpha = game.inPrep ? 1 : Math.max(0, 1 - fadeElapsed / FADE_DURATION);
  if (alpha <= 0) return;

  const scale = scaleFor(layout);
  ENTRANCES.forEach(([ex, ey], i) => {
    const groups = groupsFor(game, ex, ey);
    if (groups.length === 0) return;
    const anchor = vessels[i].samples[0];
    drawGroupRow(ctx, groups, anchor.x, anchor.y, scale, t, alpha);
  });
}
