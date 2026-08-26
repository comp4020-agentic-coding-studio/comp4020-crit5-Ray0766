import type { Game } from "../game";
import { CORE_MAX_HP, CORE_X, CORE_Y } from "../constants";
import type { Point } from "./geometry";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { CYAN, CYAN_CORE, MAGENTA, MAGENTA_CORE, mix, rgba } from "./palette";

/** Dual-Gaussian beat: a sharp systole bump followed by a softer second one. */
function beatIntensity(ph: number): number {
  return Math.exp(-(((ph - 0.12) / 0.05) ** 2)) + 0.55 * Math.exp(-(((ph - 0.3) / 0.07) ** 2));
}

/** Same low-frequency wobble the old single-outline heart used, now applied
 *  per shape by its angle from the heart's centre instead of per anchor. */
function perturbFactor(angle: number, t: number): number {
  return 1 + 0.05 * Math.sin(3 * angle + 0.35 * t) + 0.035 * Math.sin(5 * angle - 0.22 * t);
}

// Eight anatomical primitives in normalized heart-space (overall height ~= 1,
// origin at the heart's centre). Each is painted opaque onto an offscreen
// mask — overlapping fills just stay opaque, so the union falls out for free
// with no seams between shapes, unlike stroking each one separately.
interface EllipseShape {
  kind: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
}
interface TriangleShape {
  kind: "triangle";
  points: Point[];
}
// A great vessel: a round-capped stroke along `points`, either a straight
// line (2 points) or a single cubic bezier (4 points: start, cp1, cp2, end).
interface VesselShape {
  kind: "vessel";
  points: Point[];
  width: number;
}
type HeartShape = EllipseShape | TriangleShape | VesselShape;

// A crooked cone plus three great vessels, not a ring of round petals — a
// round atrium reads as a clover, not a heart, so the atria are flattened
// and the apex triangle is built so one vertex genuinely pokes past the
// ventricle mass instead of leaving a shallow notch.
const HEART_SHAPES: HeartShape[] = [
  { kind: "ellipse", cx: -0.02, cy: 0.1, rx: 0.36, ry: 0.5, rot: (-20 * Math.PI) / 180 }, // left ventricle
  { kind: "ellipse", cx: 0.2, cy: 0.06, rx: 0.28, ry: 0.4, rot: (-45 * Math.PI) / 180 }, // right ventricle
  {
    kind: "triangle", // apex, pointing down-left
    points: [
      { x: -0.28, y: 0.64 },
      { x: 0.06, y: 0.34 },
      { x: -0.22, y: 0.26 },
    ],
  },
  { kind: "ellipse", cx: -0.1, cy: -0.34, rx: 0.22, ry: 0.15, rot: 0 }, // left atrium, flattened
  { kind: "ellipse", cx: 0.2, cy: -0.3, rx: 0.18, ry: 0.13, rot: 0 }, // right atrium, flattened
  {
    // Aortic arch — cubic bezier through its own curve. The control points
    // are pulled well above and outside the endpoints so the arch's own
    // rise clears its stroke width by a wide margin; at the original 0.13
    // width and shallower control points the two sides of the curve nearly
    // touched at the peak and read as a closed loop instead of an open arch.
    kind: "vessel",
    points: [
      { x: 0.02, y: -0.42 },
      { x: -0.02, y: -0.94 },
      { x: 0.42, y: -0.82 },
      { x: 0.36, y: -0.44 },
    ],
    width: 0.08,
  },
  {
    kind: "vessel", // pulmonary artery trunk
    points: [
      { x: -0.1, y: -0.4 },
      { x: -0.17, y: -0.78 },
    ],
    width: 0.11,
  },
  {
    // Superior vena cava, angled further right than the arch's own path so
    // the two don't run parallel through the same stretch of sky and merge
    // into one mass at small sizes.
    kind: "vessel",
    points: [
      { x: 0.32, y: -0.3 },
      { x: 0.5, y: -0.66 },
    ],
    width: 0.08,
  },
];

// Normalized-unit -> pixel conversion, tuned so the merged silhouette reads
// at roughly the footprint the old single-outline heart had.
const HEART_SHAPE_SCALE = 1.55;
// How far the inner copy shrinks toward the centre to carve the outline band
// out of the full union — a smaller fraction here means a thicker rim.
const HEART_ERODE = 0.9;
// Mask canvas half-width as a multiple of unitPx; the vessel tips above reach
// about 0.8 units from the origin before wobble, cap radius and shadow bleed,
// so this leaves clear margin.
const MASK_MARGIN = 3;

function shapeAnchor(shape: HeartShape): Point {
  if (shape.kind === "triangle") {
    const [a, b, c] = shape.points;
    return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  }
  if (shape.kind === "vessel") {
    const n = shape.points.length;
    const sum = shape.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / n, y: sum.y / n };
  }
  return { x: shape.cx, y: shape.cy };
}

/** Scale a shape's own position and size by `k` around the heart's centre —
 *  the whole shape slides toward/away from the middle as it grows/shrinks,
 *  like it's on a spring from the centre. Used for the per-angle wobble. */
function wobbleShape(shape: HeartShape, k: number): HeartShape {
  if (shape.kind === "ellipse") {
    return { ...shape, cx: shape.cx * k, cy: shape.cy * k, rx: shape.rx * k, ry: shape.ry * k };
  }
  if (shape.kind === "triangle") {
    return { ...shape, points: shape.points.map((p) => ({ x: p.x * k, y: p.y * k })) };
  }
  return {
    ...shape,
    points: shape.points.map((p) => ({ x: p.x * k, y: p.y * k })),
    width: shape.width * k,
  };
}

/** Shrink a shape by `k` in place, around its own centre — unlike
 *  wobbleShape, position never moves. Scaling toward the shared heart
 *  origin instead would drag a far-from-centre shape (like a vessel tip)
 *  sideways as it shrinks, producing a shifted double-outline instead of a
 *  thin band; shrinking every shape around itself keeps the eroded copy
 *  concentric with the original everywhere, including at the vessel tips. */
function erodeShape(shape: HeartShape, k: number): HeartShape {
  if (shape.kind === "ellipse") {
    return { ...shape, rx: shape.rx * k, ry: shape.ry * k };
  }
  if (shape.kind === "triangle") {
    const cx = (shape.points[0].x + shape.points[1].x + shape.points[2].x) / 3;
    const cy = (shape.points[0].y + shape.points[1].y + shape.points[2].y) / 3;
    return { ...shape, points: shape.points.map((p) => ({ x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k })) };
  }
  // Vessel: only the stroke width thins — its centreline stays put, so a
  // straight or curved vessel erodes to a thinner copy of the same path.
  return { ...shape, width: shape.width * k };
}

function paintShape(
  ctx: CanvasRenderingContext2D,
  shape: HeartShape,
  originX: number,
  originY: number,
  unitPx: number,
): void {
  if (shape.kind === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(
      originX + shape.cx * unitPx,
      originY + shape.cy * unitPx,
      shape.rx * unitPx,
      shape.ry * unitPx,
      shape.rot,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  } else if (shape.kind === "triangle") {
    ctx.beginPath();
    shape.points.forEach((p, i) => {
      const x = originX + p.x * unitPx;
      const y = originY + p.y * unitPx;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  } else {
    const pts = shape.points.map((p) => ({ x: originX + p.x * unitPx, y: originY + p.y * unitPx }));
    ctx.lineCap = "round";
    ctx.lineWidth = shape.width * unitPx;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      ctx.bezierCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y);
    }
    ctx.stroke();
  }
}

// Three offscreen canvases, grown in place as needed: the full union mask,
// an eroded copy used to carve the outline band out of it, and a scratch
// canvas for recolouring a mask before it's drawn onto the real canvas.
let maskSize = 220;
const maskCanvas = document.createElement("canvas");
const innerMaskCanvas = document.createElement("canvas");
const tintCanvas = document.createElement("canvas");
maskCanvas.width = maskCanvas.height = maskSize;
innerMaskCanvas.width = innerMaskCanvas.height = maskSize;
tintCanvas.width = tintCanvas.height = maskSize;
const maskCtx = maskCanvas.getContext("2d")!;
const innerMaskCtx = innerMaskCanvas.getContext("2d")!;
const tintCtx = tintCanvas.getContext("2d")!;

function ensureMaskSize(unitPx: number): number {
  const needed = Math.ceil(unitPx * MASK_MARGIN);
  if (needed > maskSize) {
    maskSize = needed;
    maskCanvas.width = maskCanvas.height = maskSize;
    innerMaskCanvas.width = innerMaskCanvas.height = maskSize;
    tintCanvas.width = tintCanvas.height = maskSize;
  }
  return maskSize;
}

/** Paint the union of all eight shapes into `target`, opaque white on
 *  transparent — a coverage mask, not the final colour. `erode` shrinks
 *  every shape toward its own centre first (see HEART_ERODE above). */
function paintUnionMask(
  target: CanvasRenderingContext2D,
  size: number,
  origin: number,
  unitPx: number,
  t: number,
  erode: number,
): void {
  target.clearRect(0, 0, size, size);
  target.globalCompositeOperation = "source-over";
  target.fillStyle = "#fff";
  target.strokeStyle = "#fff";
  for (const shape of HEART_SHAPES) {
    const anchor = shapeAnchor(shape);
    const angle = Math.atan2(anchor.y, anchor.x);
    const wobbled = wobbleShape(shape, perturbFactor(angle, t));
    const final = erode < 1 ? erodeShape(wobbled, erode) : wobbled;
    paintShape(target, final, origin, origin, unitPx);
  }
}

/** Recolour a coverage mask into `target`, at a single flat alpha, with no
 *  double-blending in the overlap regions the mask already merged. */
function tintMask(
  source: HTMLCanvasElement,
  target: CanvasRenderingContext2D,
  size: number,
  color: string,
  alpha: number,
): void {
  target.clearRect(0, 0, size, size);
  target.globalCompositeOperation = "source-over";
  target.fillStyle = rgba(color, alpha);
  target.fillRect(0, 0, size, size);
  target.globalCompositeOperation = "destination-in";
  target.drawImage(source, 0, 0);
  target.globalCompositeOperation = "source-over";
}

export interface HeartDrawOptions {
  fillColor: string;
  fillAlpha: number;
  strokeColor: string;
  strokeAlpha: number;
  shadowBlur: number;
  /** Skip the fill pass entirely — used by the loss ending's final dimmed outline. */
  strokeOnly?: boolean;
}

/** Draw the merged heart silhouette at (cx, cy): a fill of the raw union,
 *  then exactly one stroke+glow pass on the union's outline (the full mask
 *  minus a slightly eroded copy of itself) — never the eight primitives
 *  outlined individually, which would show seams where they overlap. */
export function drawHeartShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  t: number,
  opts: HeartDrawOptions,
): void {
  const unitPx = radius * HEART_SHAPE_SCALE;
  const size = ensureMaskSize(unitPx);
  const origin = size / 2;

  paintUnionMask(maskCtx, size, origin, unitPx, t, 1);

  if (!opts.strokeOnly) {
    tintMask(maskCanvas, tintCtx, size, opts.fillColor, opts.fillAlpha);
    ctx.save();
    ctx.shadowColor = rgba(opts.fillColor, opts.fillAlpha);
    ctx.shadowBlur = opts.shadowBlur;
    ctx.drawImage(tintCanvas, cx - origin, cy - origin);
    ctx.restore();
  }

  paintUnionMask(innerMaskCtx, size, origin, unitPx, t, HEART_ERODE);
  maskCtx.globalCompositeOperation = "destination-out";
  maskCtx.drawImage(innerMaskCanvas, 0, 0);
  maskCtx.globalCompositeOperation = "source-over";

  tintMask(maskCanvas, tintCtx, size, opts.strokeColor, opts.strokeAlpha);
  ctx.save();
  ctx.shadowColor = rgba(opts.strokeColor, opts.strokeAlpha);
  ctx.shadowBlur = opts.shadowBlur;
  ctx.drawImage(tintCanvas, cx - origin, cy - origin);
  ctx.restore();
}

export function drawHeart(ctx: CanvasRenderingContext2D, game: Game, layout: Layout, t: number): void {
  const scale = scaleFor(layout);
  const [cx, cy] = cellCenter(layout, CORE_X, CORE_Y);
  const hpRatio = Math.max(0, Math.min(1, game.coreHp / CORE_MAX_HP));
  const injury = 1 - hpRatio;
  const bodyColor = mix(CYAN, MAGENTA, injury);
  const coreColor = mix(CYAN_CORE, MAGENTA_CORE, injury);

  // Near death the heart races: period drops from a calm 2.8s to a frantic 1.4s.
  const period = 1.4 + 1.4 * hpRatio;
  const ph = (t % period) / period;
  const b = beatIntensity(ph);
  const s = 1 + 0.07 * b;
  const gk = 0.55 + 0.5 * b;
  const ringPeakAlpha = 0.3 + 0.2 * injury;

  const glowRadius = (120 * s + 40) * scale;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
  glow.addColorStop(0, rgba(bodyColor, 0.3 * gk));
  glow.addColorStop(0.5, rgba(bodyColor, 0.1 * gk));
  glow.addColorStop(1, rgba(bodyColor, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  const bodyRadius = 40 * s * scale;
  drawHeartShape(ctx, cx, cy, bodyRadius, t, {
    fillColor: bodyColor,
    fillAlpha: 0.22,
    strokeColor: bodyColor,
    strokeAlpha: 0.5,
    shadowBlur: 26 * scale,
  });

  // The core is a small bright landmark, not a disc that swallows the
  // silhouette — the outline is what makes the shape read as a heart, so
  // this stays well inside it, off-centre toward the ventricles.
  const unitPx = bodyRadius * HEART_SHAPE_SCALE;
  const coreX = cx + -0.02 * unitPx;
  const coreY = cy + 0.06 * unitPx;
  const coreRadius = 0.08 * unitPx;
  ctx.save();
  const coreAlpha = 0.75 + 0.25 * b;
  ctx.shadowColor = rgba(coreColor, coreAlpha);
  ctx.shadowBlur = 20 * scale;
  ctx.fillStyle = rgba(coreColor, coreAlpha);
  ctx.beginPath();
  ctx.arc(coreX, coreY, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const ringRadius = (46 + (196 - 46) * ph) * scale;
  ctx.strokeStyle = rgba(bodyColor, ringPeakAlpha * (1 - ph) * (1 - ph));
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
}
