// Graphical preview of what's about to come through each vessel, live only
// during (and just after) the prep window. Reads game.upcomingPlan — the
// same data spawnEnemy will actually consume — so this is never a guess.
import { ENEMY_TIER_ORDER, ENTRANCES, type EnemyTier } from "../constants";
import type { Game, SpawnPlan } from "../game";
import { scaleFor, type Layout } from "./layout";
import { MAGENTA, MAGENTA_CORE, rgba } from "./palette";
import { drawPathogenSilhouette } from "./pathogens";
import type { VesselPath } from "./vessels";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';
// One flat icon size for every "normal" group so a glance at the column
// reads as consistent slots, not a jumble of tier-scaled sizes; elite/boss
// break out of that on purpose (see BIG_TIER_MULTIPLIER below).
const ICON_RADIUS_BASELINE = 20;
// Derived, not a second hardcoded literal, so it can't drift out of sync
// with the icon size - keeps roughly the same font/diameter ratio the old
// 14px-on-18px-diameter layout already had (~0.78).
const LABEL_FONT_SCALE = 0.8;
const GROUP_ROW_HEIGHT_BASELINE = 50;
const INTEL_OFFSET_Y = 46;
const FADE_DURATION = 0.4;
const MAX_GROUPS_PER_ENTRANCE = 3;
const BIG_TIER_MULTIPLIER = 1.5;

function tierOf(entry: SpawnPlan): EnemyTier {
  return entry.tier;
}

function isBigTier(tier: EnemyTier): boolean {
  return tier === "elite" || tier === "boss";
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

// Groups by tier (one silhouette + ×N per tier present), strongest first.
// Caps at MAX_GROUPS_PER_ENTRANCE — anything beyond the cap gets folded
// into the last group's count rather than dropped, so the total displayed
// count always matches what's actually queued.
function groupsFor(game: Game, ex: number, ey: number): IntelGroup[] {
  const counts = new Map<EnemyTier, number>();
  for (const entry of game.upcomingPlan) {
    if (entry.ex !== ex || entry.ey !== ey) continue;
    const tier = tierOf(entry);
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }
  const present = ENEMY_TIER_ORDER.filter((tier) => counts.has(tier));
  const toGroup = (tier: EnemyTier, count: number): IntelGroup => ({ tier, count, seed: seedFor(ex, ey, tier) });

  if (present.length <= MAX_GROUPS_PER_ENTRANCE) {
    return present.map((tier) => toGroup(tier, counts.get(tier)!));
  }

  const kept = present.slice(0, MAX_GROUPS_PER_ENTRANCE - 1);
  const overflow = present.slice(MAX_GROUPS_PER_ENTRANCE - 1);
  const mergedTier = overflow[0];
  const mergedCount = overflow.reduce((sum, tier) => sum + counts.get(tier)!, 0);
  return [...kept.map((tier) => toGroup(tier, counts.get(tier)!)), toGroup(mergedTier, mergedCount)];
}

let lastInPrep = false;
let prepEndedAt = -Infinity;

function ingestPrepState(game: Game, t: number): void {
  if (lastInPrep && !game.inPrep) prepEndedAt = t;
  lastInPrep = game.inPrep;
}

function drawGroupColumn(
  ctx: CanvasRenderingContext2D,
  groups: IntelGroup[],
  anchorX: number,
  anchorY: number,
  scale: number,
  t: number,
  alpha: number,
): void {
  groups.forEach((group, i) => {
    const big = isBigTier(group.tier);
    const radius = ICON_RADIUS_BASELINE * scale * (big ? BIG_TIER_MULTIPLIER : 1);
    const y = anchorY - (INTEL_OFFSET_Y + i * GROUP_ROW_HEIGHT_BASELINE) * scale;

    if (big) {
      ctx.save();
      ctx.shadowColor = rgba(MAGENTA_CORE, 0.6 * alpha);
      ctx.shadowBlur = 16 * scale;
      ctx.fillStyle = rgba(MAGENTA, 0.25 * alpha);
      ctx.beginPath();
      ctx.arc(anchorX, y, radius * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawPathogenSilhouette(ctx, anchorX, y, radius, group.seed, t, scale, {
      sharp: group.tier === "spore",
      thick: group.tier === "armored",
      winged: group.tier === "flying",
      alpha,
    });

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `${ICON_RADIUS_BASELINE * 2 * LABEL_FONT_SCALE * scale}px ${FONT_STACK}`;
    ctx.fillStyle = rgba(MAGENTA_CORE, 0.9 * alpha);
    ctx.fillText(`×${group.count}`, anchorX + radius + 6 * scale, y);
  });
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
    drawGroupColumn(ctx, groups, anchor.x, anchor.y, scale, t, alpha);
  });
}
