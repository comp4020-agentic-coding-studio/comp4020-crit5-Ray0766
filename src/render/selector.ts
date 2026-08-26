import type { Game } from "../game";
import { GRID_SIZE, MAX_UNIT_LEVEL, PLACE_COST_BY_LEVEL } from "../constants";
import { drawLeaf, drawMembrane } from "./cells";
import { scaleFor, type Layout } from "./layout";
import { CYAN_CORE, rgba } from "./palette";

const FONT_STACK = '"IBM Plex Mono", ui-monospace, monospace';

// Which level a click on an empty cell places. Lives here rather than on
// Game since it's purely a UI selection, not run state.
let selectedLevel = 1;

export function getSelectedLevel(): number {
  return selectedLevel;
}

export function setSelectedLevel(level: number): void {
  if (level < 1 || level > MAX_UNIT_LEVEL) return;
  selectedLevel = level;
}

export interface SelectorSlot {
  level: number;
  cx: number;
  cy: number;
  radius: number;
}

export function selectorSlots(layout: Layout): SelectorSlot[] {
  const boardRight = layout.offsetX + layout.cellSize * GRID_SIZE;
  const cx = boardRight + layout.hudRight / 2;
  const boardHeight = layout.cellSize * GRID_SIZE;
  const bandHeight = boardHeight / MAX_UNIT_LEVEL;
  const radius = Math.min(layout.hudRight, bandHeight) * 0.32;
  const slots: SelectorSlot[] = [];
  for (let i = 0; i < MAX_UNIT_LEVEL; i++) {
    slots.push({
      level: i + 1,
      cx,
      cy: layout.offsetY + bandHeight * (i + 0.5),
      radius,
    });
  }
  return slots;
}

/** Hit-test a canvas-space point against the sidebar slots; returns the
 *  level clicked, or -1 if the point isn't near any of them. */
export function selectorHitTest(layout: Layout, px: number, py: number): number {
  for (const slot of selectorSlots(layout)) {
    if (Math.hypot(px - slot.cx, py - slot.cy) <= slot.radius * 1.7) return slot.level;
  }
  return -1;
}

function drawIcon(ctx: CanvasRenderingContext2D, level: number, slot: SelectorSlot, t: number, scale: number): void {
  if (level === 1) {
    drawLeaf(ctx, slot.cx, slot.cy, slot.radius * 0.9, 1, scale);
  } else if (level === 2) {
    const r = slot.radius * 0.62;
    const d = slot.radius * 0.5;
    drawLeaf(ctx, slot.cx - d, slot.cy, r, 1, scale);
    drawLeaf(ctx, slot.cx + d, slot.cy, r, 1, scale);
  } else {
    drawMembrane(ctx, slot.cx, slot.cy, slot.radius * 0.95, level, t, scale);
    const innerLeafCount = 5;
    const orbitRadius = slot.radius * 0.42;
    for (let i = 0; i < innerLeafCount; i++) {
      const a = (i / innerLeafCount) * Math.PI * 2;
      const lx = slot.cx + Math.cos(a) * orbitRadius;
      const ly = slot.cy + Math.sin(a) * orbitRadius;
      drawLeaf(ctx, lx, ly, slot.radius * 0.3, 0.8, scale);
    }
  }
}

export function drawSelector(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  const scale = scaleFor(layout);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const slot of selectorSlots(layout)) {
    const cost = PLACE_COST_BY_LEVEL[slot.level - 1];
    const affordable = game.resource >= cost;

    ctx.save();
    ctx.globalAlpha = affordable ? 1 : 0.3;
    drawIcon(ctx, slot.level, slot, t, scale);
    ctx.restore();

    if (slot.level === selectedLevel) {
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
