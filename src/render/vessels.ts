import { CORE_X, CORE_Y, ENTRANCES } from "../constants";
import { hashAngle, mulberry32, sampleCubicBezier, type PathSample, type Point } from "./geometry";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { rgba, VESSEL, VESSEL_GRAIN } from "./palette";

interface VesselPath {
  samples: PathSample[];
  width: number;
}

const SAMPLE_COUNT = 90;
const PARTICLE_COUNT = 24;
const PARTICLE_CYCLE_SECONDS = 26;

function buildControlPoints(a: Point, b: Point, seed: number): [Point, Point, Point, Point] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const bend = dist * 0.14;
  const s1 = Math.sin(seed);
  const s2 = Math.sin(seed + 1.7);
  return [
    a,
    { x: a.x + dx / 3 + nx * bend * s1, y: a.y + dy / 3 + ny * bend * s1 },
    { x: a.x + (dx * 2) / 3 + nx * bend * s2, y: a.y + (dy * 2) / 3 + ny * bend * s2 },
    b,
  ];
}

function buildVessels(layout: Layout): VesselPath[] {
  const [coreX, coreY] = cellCenter(layout, CORE_X, CORE_Y);
  const width = layout.cellSize * 0.5;
  return ENTRANCES.map(([ex, ey], i) => {
    const [ax, ay] = cellCenter(layout, ex, ey);
    const [p0, p1, p2, p3] = buildControlPoints({ x: ax, y: ay }, { x: coreX, y: coreY }, i * 2.399);
    return { samples: sampleCubicBezier(p0, p1, p2, p3, SAMPLE_COUNT), width };
  });
}

function renderBaseLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layout: Layout,
): void {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  const scale = scaleFor(layout);
  const vessels = buildVessels(layout);
  const passes: ReadonlyArray<readonly [number, number]> = [
    [2.3, 0.05],
    [1.5, 0.08],
    [0.9, 0.11],
    [0.42, 0.16],
  ];

  for (const vessel of vessels) {
    for (const [widthMul, alpha] of passes) {
      ctx.save();
      ctx.shadowColor = rgba(VESSEL, 0.8);
      ctx.shadowBlur = 22 * scale;
      ctx.strokeStyle = rgba(VESSEL, alpha);
      ctx.lineWidth = vessel.width * widthMul;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      vessel.samples.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
    }

    const mouth = vessel.samples[0];
    const mouthRadius = vessel.width * 1.6;
    const gradient = ctx.createRadialGradient(mouth.x, mouth.y, 0, mouth.x, mouth.y, mouthRadius);
    gradient.addColorStop(0, rgba(VESSEL, 0.14));
    gradient.addColorStop(1, rgba(VESSEL, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(mouth.x, mouth.y, mouthRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

let cache: { width: number; height: number; canvas: HTMLCanvasElement } | null = null;

/** The static black-background-plus-vessels layer, rebuilt only when the canvas resizes. */
export function getVesselBaseLayer(width: number, height: number, layout: Layout): HTMLCanvasElement {
  if (cache && cache.width === width && cache.height === height) return cache.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const offscreenCtx = canvas.getContext("2d");
  if (!offscreenCtx) throw new Error("2d context unavailable for offscreen vessel layer");
  renderBaseLayer(offscreenCtx, width, height, layout);
  cache = { width, height, canvas };
  return canvas;
}

interface ParticleParams {
  radius: number;
  lateralFrac: number;
  speedFactor: number;
  initialOffset: number;
  alphaBase: number;
}

function particleParams(vesselIndex: number, particleIndex: number): ParticleParams {
  const rand = mulberry32(vesselIndex * 9973 + particleIndex * 131 + 17);
  return {
    radius: 0.7 + rand() * 1.1,
    lateralFrac: (rand() * 2 - 1) * 0.275,
    speedFactor: 0.7 + rand() * 0.6,
    initialOffset: rand(),
    alphaBase: 0.1 + rand() * 0.22,
  };
}

function sampleAlong(vessel: VesselPath, progress: number): PathSample {
  const n = vessel.samples.length;
  const pos = progress * (n - 1);
  const i0 = Math.floor(pos);
  const i1 = Math.min(n - 1, i0 + 1);
  const frac = pos - i0;
  const s0 = vessel.samples[i0];
  const s1 = vessel.samples[i1];
  return {
    x: s0.x + (s1.x - s0.x) * frac,
    y: s0.y + (s1.y - s0.y) * frac,
    nx: s0.nx + (s1.nx - s0.nx) * frac,
    ny: s0.ny + (s1.ny - s0.ny) * frac,
    t: progress,
  };
}

/** The flowing granules inside each vessel — dynamic, drawn fresh every frame. */
export function drawVesselParticles(ctx: CanvasRenderingContext2D, layout: Layout, t: number): void {
  const scale = scaleFor(layout);
  const vessels = buildVessels(layout);

  vessels.forEach((vessel, vesselIndex) => {
    // A hash offset per vessel keeps particle phase from lining up across vessels.
    void hashAngle(vesselIndex);
    for (let particleIndex = 0; particleIndex < PARTICLE_COUNT; particleIndex++) {
      const params = particleParams(vesselIndex, particleIndex);
      const speedPerSecond = params.speedFactor / PARTICLE_CYCLE_SECONDS;
      const progress = (params.initialOffset + t * speedPerSecond) % 1;
      const point = sampleAlong(vessel, progress);
      const lateral = params.lateralFrac * vessel.width;
      const px = point.x + point.nx * lateral;
      const py = point.y + point.ny * lateral;

      let alpha = params.alphaBase;
      if (progress > 0.92) {
        alpha *= Math.max(0, 1 - (progress - 0.92) / 0.08);
      }

      ctx.fillStyle = rgba(VESSEL_GRAIN, alpha);
      ctx.beginPath();
      ctx.arc(px, py, params.radius * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
