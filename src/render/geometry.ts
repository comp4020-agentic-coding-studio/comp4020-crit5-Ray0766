export interface Point {
  x: number;
  y: number;
}

export interface PathSample extends Point {
  /** Unit normal, perpendicular to the direction of travel at this point. */
  nx: number;
  ny: number;
  /** 0..1 progress along the sampled path. */
  t: number;
}

export function bezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

export function bezierTangent(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = 3 * mt * mt;
  const b = 6 * mt * t;
  const c = 3 * t * t;
  return {
    x: a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x),
    y: a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y),
  };
}

/** Sample a cubic bezier into `count` points, each carrying its unit normal. */
export function sampleCubicBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  count: number,
): PathSample[] {
  const samples: PathSample[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const pos = bezierPoint(p0, p1, p2, p3, t);
    const tan = bezierTangent(p0, p1, p2, p3, t);
    const len = Math.hypot(tan.x, tan.y) || 1;
    samples.push({ x: pos.x, y: pos.y, nx: -tan.y / len, ny: tan.x / len, t });
  }
  return samples;
}

/** Cubic-bezier control points that make a Catmull-Rom spline through p1..p2. */
function catmullRomToBezier(p0: Point, p1: Point, p2: Point, p3: Point): [Point, Point] {
  const tension = 6;
  return [
    { x: p1.x + (p2.x - p0.x) / tension, y: p1.y + (p2.y - p0.y) / tension },
    { x: p2.x - (p3.x - p1.x) / tension, y: p2.y - (p3.y - p1.y) / tension },
  ];
}

/** Turn a handful of anchor points into cubic-bezier segments that pass smoothly
 *  through every one of them (Catmull-Rom). `closed` loops the last point back
 *  into the first instead of stopping there. Each returned segment is
 *  [start, control1, control2, end], ready for ctx.bezierCurveTo. */
export function catmullRomSegments(
  points: Point[],
  closed: boolean,
): Array<[Point, Point, Point, Point]> {
  const n = points.length;
  const at = (i: number): Point =>
    closed ? points[((i % n) + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  const segCount = closed ? n : n - 1;
  const segments: Array<[Point, Point, Point, Point]> = [];
  for (let i = 0; i < segCount; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const [c1, c2] = catmullRomToBezier(p0, p1, p2, p3);
    segments.push([p1, c1, c2, p2]);
  }
  return segments;
}

/** Sample an open Catmull-Rom spline through `points` into `count` evenly
 *  t-spaced points, each carrying a unit normal — same output shape as
 *  sampleCubicBezier, but for a path with however many waypoints it happens
 *  to have right now (a BFS route, which grows or shrinks as the board
 *  changes) instead of a fixed 4-point curve. */
export function sampleOpenCatmullRom(points: Point[], count: number): PathSample[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    const p = points[0];
    return Array.from({ length: count }, (_, i) => ({
      x: p.x,
      y: p.y,
      nx: 0,
      ny: -1,
      t: count > 1 ? i / (count - 1) : 0,
    }));
  }
  const segments = catmullRomSegments(points, false);
  const samples: PathSample[] = [];
  for (let i = 0; i < count; i++) {
    const tGlobal = count > 1 ? i / (count - 1) : 0;
    const segPos = tGlobal * segments.length;
    const segIndex = Math.min(segments.length - 1, Math.floor(segPos));
    const localT = segPos - segIndex;
    const [p0, c1, c2, p1] = segments[segIndex];
    const pos = bezierPoint(p0, c1, c2, p1, localT);
    const tan = bezierTangent(p0, c1, c2, p1, localT);
    const len = Math.hypot(tan.x, tan.y) || 1;
    samples.push({ x: pos.x, y: pos.y, nx: -tan.y / len, ny: tan.x / len, t: tGlobal });
  }
  return samples;
}

/** Chaikin corner-cutting: each pass replaces every edge with two points 1/4
 *  and 3/4 of the way along it, rounding off every corner a little more each
 *  iteration. Endpoints are left exactly in place so a channel still starts
 *  and ends where it's supposed to. */
export function chaikinSmooth(points: Point[], iterations: number): Point[] {
  let current = points;
  for (let iter = 0; iter < iterations; iter++) {
    if (current.length < 3) break;
    const next: Point[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];
      next.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 });
      next.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

/** Resample a polyline into `count` evenly arc-length-spaced points, each
 *  carrying the unit normal of its local segment — same output shape as
 *  sampleOpenCatmullRom, but for a plain polyline (e.g. one already rounded
 *  off by chaikinSmooth) rather than a spline needing its own curve fit. */
export function resampleByArcLength(points: Point[], count: number): PathSample[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    const p = points[0];
    return Array.from({ length: count }, (_, i) => ({
      x: p.x,
      y: p.y,
      nx: 0,
      ny: -1,
      t: count > 1 ? i / (count - 1) : 0,
    }));
  }
  const cumLen: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumLen.push(cumLen[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const totalLen = cumLen[cumLen.length - 1] || 1;
  const samples: PathSample[] = [];
  let segIndex = 0;
  for (let i = 0; i < count; i++) {
    const targetLen = (count > 1 ? i / (count - 1) : 0) * totalLen;
    while (segIndex < cumLen.length - 2 && cumLen[segIndex + 1] < targetLen) segIndex++;
    const segStart = cumLen[segIndex];
    const segEnd = cumLen[segIndex + 1] ?? segStart;
    const frac = Math.max(0, Math.min(1, (targetLen - segStart) / (segEnd - segStart || 1)));
    const p0 = points[segIndex];
    const p1 = points[segIndex + 1] ?? p0;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    samples.push({
      x: p0.x + dx * frac,
      y: p0.y + dy * frac,
      nx: -dy / len,
      ny: dx / len,
      t: count > 1 ? i / (count - 1) : 0,
    });
  }
  return samples;
}

/** Trace a rounded square (used for the placeable-cell highlight) into the current path. */
export function tracePlaceableSquare(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  halfSize: number,
  radius: number,
): void {
  const x = cx - halfSize;
  const y = cy - halfSize;
  const size = halfSize * 2;
  const r = Math.min(radius, halfSize);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + size, y, x + size, y + size, r);
  ctx.arcTo(x + size, y + size, x, y + size, r);
  ctx.arcTo(x, y + size, x, y, r);
  ctx.arcTo(x, y, x + size, y, r);
  ctx.closePath();
}

/** Deterministic pseudo-random angle in [0, 2*PI) from an integer seed. */
export function hashAngle(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * Math.PI * 2;
}

/** Small deterministic PRNG (mulberry32) for stable per-entity jitter. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
