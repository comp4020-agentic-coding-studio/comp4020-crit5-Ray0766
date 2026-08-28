import type { Game } from "../game";
import { GRID_SIZE, UNIT_KINDS, UNIT_KIND_ORDER, type UnitKind } from "../constants";
import { drawBlockerBody, drawHeavyBody, drawIdleSatellites, drawRapidBody, drawSplashBody } from "./cells";
import { scaleFor, type Layout } from "./layout";
import { CYAN_CORE, rgba } from "./palette";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';

// Which kind a click on an empty cell places. Lives here rather than on
// Game since it's purely a UI selection, not run state.
let selectedKind: UnitKind = UNIT_KIND_ORDER[0];

export function getSelectedKind(): UnitKind {
  return selectedKind;
}

export function setSelectedKind(kind: UnitKind): void {
  if (!UNIT_KIND_ORDER.includes(kind)) return;
  selectedKind = kind;
}

export interface SelectorSlot {
  kind: UnitKind;
  cx: number;
  cy: number;
  radius: number;
}

// A compact, vertically-centered cluster with equal spacing between icons,
// rather than spreading them across the whole board height.
const SLOT_SPACING_BASELINE = 76;
const ICON_RADIUS_BASELINE = 17;

export function selectorSlots(layout: Layout): SelectorSlot[] {
  const scale = scaleFor(layout);
  const boardRight = layout.offsetX + layout.cellSize * GRID_SIZE;
  const cx = boardRight + layout.hudRight / 2;
  const boardCenterY = layout.offsetY + (layout.cellSize * GRID_SIZE) / 2;
  const spacing = SLOT_SPACING_BASELINE * scale;
  const radius = Math.min(layout.hudRight * 0.4, ICON_RADIUS_BASELINE * scale);
  const n = UNIT_KIND_ORDER.length;
  const startY = boardCenterY - (spacing * (n - 1)) / 2;
  const slots: SelectorSlot[] = [];
  for (let i = 0; i < n; i++) {
    slots.push({
      kind: UNIT_KIND_ORDER[i],
      cx,
      cy: startY + spacing * i,
      radius,
    });
  }
  return slots;
}

/** Hit-test a canvas-space point against the sidebar slots; returns the
 *  kind clicked, or null if the point isn't near any of them. */
export function selectorHitTest(layout: Layout, px: number, py: number): UnitKind | null {
  for (const slot of selectorSlots(layout)) {
    if (Math.hypot(px - slot.cx, py - slot.cy) <= slot.radius * 1.7) return slot.kind;
  }
  return null;
}

function drawIcon(ctx: CanvasRenderingContext2D, kind: UnitKind, slot: SelectorSlot, t: number, scale: number): void {
  if (kind === "rapid") {
    drawRapidBody(ctx, slot.cx, slot.cy, slot.radius * 1.05, 0, scale, 1);
  } else if (kind === "blocker") {
    drawBlockerBody(ctx, slot.cx, slot.cy, slot.radius * 0.8, 1, scale);
    drawIdleSatellites(ctx, slot.cx, slot.cy, slot.radius * 1.35, slot.radius * 0.22, t, scale);
  } else if (kind === "heavy") {
    drawHeavyBody(ctx, slot.cx, slot.cy, slot.radius * 0.95, 1, scale);
  } else {
    drawSplashBody(ctx, slot.cx, slot.cy, slot.radius * 0.95, 2, t, scale, 1);
  }
}

export function drawSelector(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  const scale = scaleFor(layout);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const slot of selectorSlots(layout)) {
    const cost = UNIT_KINDS[slot.kind].cost;
    const affordable = game.resource >= cost;

    ctx.save();
    ctx.globalAlpha *= affordable ? 1 : 0.3;
    drawIcon(ctx, slot.kind, slot, t, scale);
    ctx.restore();

    if (slot.kind === selectedKind) {
      ctx.save();
      ctx.strokeStyle = rgba(CYAN_CORE, 0.85);
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.arc(slot.cx, slot.cy, slot.radius * 1.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.font = `${13 * scale}px ${FONT_STACK}`;
    ctx.fillStyle = rgba(CYAN_CORE, affordable ? 0.85 : 0.3);
    ctx.fillText(String(cost), slot.cx, slot.cy + slot.radius * 1.95);
  }
}
