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

function bezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
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

function bezierTangent(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
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
