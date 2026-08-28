import type { AttackFlash, FxEvent, Game } from "../game";
import { TOTAL_WAVES, UNIT_KINDS } from "../constants";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { AMBER, AMBER_CORE, CYAN_CORE, rgba } from "./palette";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';
const POPUP_DURATION = 0.7;

interface DamagePopup {
  x: number;
  y: number;
  value: number;
  startedAt: number;
}

// game.ts drops a flash after ~0.1s (just long enough to draw an attack line),
// far shorter than a readable pop-up. So a fresh flash seeds our own
// independent, longer-lived popup instead of being drawn directly.
const seenFlashes = new WeakSet<AttackFlash>();
let activePopups: DamagePopup[] = [];

function ingestFlashes(game: Game, t: number): void {
  for (const flash of game.flashes) {
    if (seenFlashes.has(flash)) continue;
    seenFlashes.add(flash);
    const attacker = game.unitAt(flash.fromX, flash.fromY);
    const value = attacker ? (UNIT_KINDS[attacker.kind].damageByLevel?.[attacker.level - 1] ?? 0) : 0;
    if (value > 0) activePopups.push({ x: flash.toX, y: flash.toY, value, startedAt: t });
  }
  activePopups = activePopups.filter((popup) => t - popup.startedAt < POPUP_DURATION);
}

function drawPopups(ctx: CanvasRenderingContext2D, layout: Layout, t: number): void {
  const scale = scaleFor(layout);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${12 * scale}px ${FONT_STACK}`;
  for (const popup of activePopups) {
    const progress = Math.min(1, (t - popup.startedAt) / POPUP_DURATION);
    const [cx, cy] = cellCenter(layout, popup.x, popup.y);
    const y = cy - (10 + 22 * progress) * scale;
    ctx.fillStyle = rgba(CYAN_CORE, 1 - progress);
    ctx.fillText(`-${popup.value}`, cx, y);
  }
}

// Amber "+N" floats up from a kill's exact spot the instant resource is
// credited — a second, independent WeakSet watcher over game.fx, same
// pattern combo.ts already uses for its own ×N readout.
const RESOURCE_POPUP_DURATION = 0.9;
const RESOURCE_POPUP_RISE_PX_PER_SECOND = 34;

interface ResourcePopup {
  x: number;
  y: number;
  value: number;
  startedAt: number;
}

const seenKillFx = new WeakSet<FxEvent>();
let resourcePopups: ResourcePopup[] = [];

function ingestKillPopups(game: Game, t: number): void {
  for (const event of game.fx) {
    if (seenKillFx.has(event)) continue;
    seenKillFx.add(event);
    if (event.kind !== "kill" && event.kind !== "boss-kill") continue;
    if (!event.value) continue;
    resourcePopups.push({ x: event.x, y: event.y, value: event.value, startedAt: t });
  }
  resourcePopups = resourcePopups.filter((popup) => t - popup.startedAt < RESOURCE_POPUP_DURATION);
}

function drawResourcePopups(ctx: CanvasRenderingContext2D, layout: Layout, t: number): void {
  const scale = scaleFor(layout);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `bold ${13 * scale}px ${FONT_STACK}`;
  for (const popup of resourcePopups) {
    const elapsed = t - popup.startedAt;
    const progress = Math.min(1, elapsed / RESOURCE_POPUP_DURATION);
    const [cx, cy] = cellCenter(layout, popup.x, popup.y);
    const y = cy - RESOURCE_POPUP_RISE_PX_PER_SECOND * scale * elapsed;
    ctx.fillStyle = rgba(AMBER, 1 - progress);
    ctx.fillText(`+${popup.value}`, cx, y);
  }
}

// Resource readout punches out to 1.25x and settles back to 1.0 the instant
// game.resource ticks up, so a kill's payout reads on the HUD number itself,
// not just the floater. lastResource starts null so the very first frame
// (reading START_RESOURCE) never registers as a fake bump.
const RESOURCE_BUMP_DURATION = 0.18;
const RESOURCE_BUMP_SCALE = 1.25;
let lastResource: number | null = null;
let resourceBumpAt = -Infinity;

function drawHud(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, width: number, t: number): void {
  const scale = scaleFor(layout);
  ctx.textBaseline = "middle";
  ctx.font = `${15 * scale}px ${FONT_STACK}`;
  const y = layout.hudTop / 2;

  if (lastResource !== null && game.resource > lastResource) resourceBumpAt = t;
  lastResource = game.resource;
  const bumpProgress = Math.min(1, (t - resourceBumpAt) / RESOURCE_BUMP_DURATION);
  const bumpScale = bumpProgress < 1 ? 1 + (RESOURCE_BUMP_SCALE - 1) * (1 - bumpProgress) : 1;

  const resourceX = 16 * scale;
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(AMBER_CORE, 0.85);
  if (bumpScale !== 1) {
    ctx.save();
    ctx.translate(resourceX, y);
    ctx.scale(bumpScale, bumpScale);
    ctx.fillText(String(Math.floor(game.resource)), 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(String(Math.floor(game.resource)), resourceX, y);
  }

  ctx.textAlign = "right";
  ctx.fillStyle = rgba(CYAN_CORE, 0.85);
  const wave = Math.min(game.waveNumber, TOTAL_WAVES);
  ctx.fillText(`${wave}/${TOTAL_WAVES}`, width - 16 * scale, y);
}

export function drawNumbers(
  ctx: CanvasRenderingContext2D,
  game: Game,
  layout: Layout,
  width: number,
  t: number,
): void {
  ingestFlashes(game, t);
  drawPopups(ctx, layout, t);
  ingestKillPopups(game, t);
  drawResourcePopups(ctx, layout, t);
  drawHud(ctx, game, layout, width, t);
}
