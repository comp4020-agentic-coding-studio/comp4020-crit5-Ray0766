import {
  CORE_X,
  CORE_Y,
  ENTRANCES,
  entranceTier,
  MAJOR_VESSEL_WIDTH_CELLS,
  MINOR_VESSEL_WIDTH_CELLS,
  type EntranceTier,
} from "../constants";
import type { Game } from "../game";
import { tracePathFromEntrance } from "../pathing";
import { chaikinSmooth, mulberry32, resampleByArcLength, type PathSample, type Point } from "./geometry";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { rgba, VESSEL, VESSEL_GRAIN } from "./palette";

export interface VesselPath {
  samples: PathSample[];
  width: number;
  tier: EntranceTier;
}

const SAMPLE_COUNT = 90;
const PARTICLE_COUNT = 24;
const PARTICLE_CYCLE_SECONDS = 26;
const TRANSITION_SECONDS = 0.35;

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function lerpSamples(a: PathSample[], b: PathSample[], p: number): PathSample[] {
  return a.map((sa, i) => {
    const sb = b[i];
    return {
      x: sa.x + (sb.x - sa.x) * p,
      y: sa.y + (sb.y - sa.y) * p,
      nx: sa.nx + (sb.nx - sa.nx) * p,
      ny: sa.ny + (sb.ny - sa.ny) * p,
      t: sb.t,
    };
  });
}

interface EntranceVesselState {
  tier: EntranceTier;
  width: number;
  rawKey: string;
  fromSamples: PathSample[];
  targetSamples: PathSample[];
  transitionStart: number;
}

// Keyed by entrance coordinate, and deliberately never cleared on Game.reset
// — a fresh run's channels just ease into their base shape like any other
// path change, same as the selector and score modules' module-level state.
const states = new Map<string, EntranceVesselState>();

function currentDisplay(state: EntranceVesselState, t: number): PathSample[] {
  const p = Math.min(1, (t - state.transitionStart) / TRANSITION_SECONDS);
  return lerpSamples(state.fromSamples, state.targetSamples, easeInOutCubic(p));
}

/** Recompute (or ease toward) every vessel's channel from the real BFS route
 *  in pathing.ts. Call this once per frame; the result is shared by both the
 *  channel-drawing pass and the particle pass so a particle is never seen
 *  running along a channel shape that isn't actually on screen. */
export function computeVesselPaths(game: Game, layout: Layout, t: number): VesselPath[] {
  return ENTRANCES.map(([ex, ey]) => {
    const key = `${ex},${ey}`;
    const tier = entranceTier(ex, ey);
    const width = (tier === "major" ? MAJOR_VESSEL_WIDTH_CELLS : MINOR_VESSEL_WIDTH_CELLS) * layout.cellSize;
    let state = states.get(key);
    const gridPath = tracePathFromEntrance(game.grid, game.distanceField, ex, ey);

    if (gridPath) {
      const rawKey = gridPath.map(([x, y]) => `${x}:${y}`).join("|");
      if (!state || rawKey !== state.rawKey) {
        const points: Point[] = gridPath.map(([x, y]) => {
          const [px, py] = cellCenter(layout, x, y);
          return { x: px, y: py };
        });
        const targetSamples = resampleByArcLength(chaikinSmooth(points, 3), SAMPLE_COUNT);
        const fromSamples = state ? currentDisplay(state, t) : targetSamples;
        state = { tier, width, rawKey, fromSamples, targetSamples, transitionStart: t };
        states.set(key, state);
      }
    } else if (!state) {
      // This entrance's very first frame already has no path to the core —
      // shouldn't happen on a fresh board, but draw a straight stub instead
      // of nothing rather than assume it can't.
      const [ax, ay] = cellCenter(layout, ex, ey);
      const [bx, by] = cellCenter(layout, CORE_X, CORE_Y);
      const samples = resampleByArcLength(
        chaikinSmooth(
          [
            { x: ax, y: ay },
            { x: bx, y: by },
          ],
          3,
        ),
        SAMPLE_COUNT,
      );
      state = { tier, width, rawKey: "", fromSamples: samples, targetSamples: samples, transitionStart: t };
      states.set(key, state);
    }
    // else: this entrance is currently cut off but has drawn before — leave
    // it showing wherever its channel last settled instead of vanishing.

    state.width = width;
    return { samples: currentDisplay(state, t), width, tier };
  });
}

/** The vessel channels themselves: background fill plus the glowing strokes.
 *  Drawn fresh every frame now that the channel shape can move. */
export function drawVessels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layout: Layout,
  vessels: VesselPath[],
): void {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  const scale = scaleFor(layout);
  // Alphas are 0.6x the pre-round-7 values, so vessels stay clearly dimmer
  // than both the heart and the cells.
  const passes: ReadonlyArray<readonly [number, number]> = [
    [2.3, 0.03],
    [1.5, 0.048],
    [0.9, 0.066],
    [0.42, 0.096],
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

    // Only major mouths get the glow — they're the ones an elite (or the
    // wave-8 boss) is about to come out of; minor mouths draw nothing extra.
    if (vessel.tier === "major") {
      const mouth = vessel.samples[0];
      const mouthRadius = vessel.width * 2.2;
      const gradient = ctx.createRadialGradient(mouth.x, mouth.y, 0, mouth.x, mouth.y, mouthRadius);
      gradient.addColorStop(0, rgba(VESSEL, 0.084));
      gradient.addColorStop(1, rgba(VESSEL, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(mouth.x, mouth.y, mouthRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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

/** The flowing granules inside each vessel — dynamic, drawn fresh every
 *  frame, riding along whatever channel shape computeVesselPaths produced
 *  this frame so they never lag behind a path that just eased into a new
 *  shape. */
export function drawVesselParticles(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  t: number,
  vessels: VesselPath[],
): void {
  const scale = scaleFor(layout);

  vessels.forEach((vessel, vesselIndex) => {
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
