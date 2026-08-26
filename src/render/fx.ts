// The feedback hub: watches game.flashes and game.fx for anything new, and
// turns each into a particle burst, a shove of screen shake and/or a sound.
// Nothing here changes game state — it only reacts to facts the game logic
// already recorded.
import type { Game } from "../game";
import { playCoreHit, playKill, playMerge, playShoot } from "../audio";
import { cellCenter, scaleFor, type Layout } from "./layout";
import { burst, drawParticles, updateParticles } from "./particles";
import { addShake } from "./shake";
import { CYAN, MAGENTA, rgba } from "./palette";

const seenFlashes = new WeakSet<object>();
const seenFx = new WeakSet<object>();

// Trigger table straight out of the spec: [particle count, particle speed].
const HIT_BURST: [number, number] = [4, 90];
const KILL_BURST: [number, number] = [14, 150];
const BOSS_KILL_BURST: [number, number] = [60, 260];
const PLACE_BURST: [number, number] = [14, 140];
const MERGE_BURST: [number, number] = [26, 220];

const SHAKE_KILL = 0.1;
const SHAKE_MERGE = 0.35;
const SHAKE_CORE_HIT = 1.1;
const SHAKE_BOSS = 1.2;

interface DeniedMarker {
  x: number;
  y: number;
  startedAt: number;
}

const DENIED_DURATION = 0.35;
const DENIED_MAX_RADIUS = 18;
let deniedMarkers: DeniedMarker[] = [];

let lastFrameT: number | null = null;
function frameDt(t: number): number {
  if (lastFrameT === null) {
    lastFrameT = t;
    return 0;
  }
  const dt = Math.min(0.05, Math.max(0, t - lastFrameT));
  lastFrameT = t;
  return dt;
}

function ingestFlashes(game: Game, layout: Layout): void {
  const scale = scaleFor(layout);
  for (const flash of game.flashes) {
    if (seenFlashes.has(flash)) continue;
    seenFlashes.add(flash);
    const [tx, ty] = cellCenter(layout, flash.toX, flash.toY);
    const [n, speed] = HIT_BURST;
    burst(tx, ty, CYAN, n, speed * scale);
    const attacker = game.unitAt(flash.fromX, flash.fromY);
    playShoot(attacker ? attacker.level : 1);
  }
}

function ingestFx(game: Game, layout: Layout, t: number): void {
  const scale = scaleFor(layout);
  for (const event of game.fx) {
    if (seenFx.has(event)) continue;
    seenFx.add(event);
    const [px, py] = cellCenter(layout, event.x, event.y);

    switch (event.kind) {
      case "place": {
        const [n, speed] = PLACE_BURST;
        burst(px, py, CYAN, n, speed * scale);
        break;
      }
      case "merge": {
        const [n, speed] = MERGE_BURST;
        burst(px, py, CYAN, n, speed * scale);
        addShake(SHAKE_MERGE);
        playMerge();
        break;
      }
      case "swap":
        break;
      case "kill": {
        const [n, speed] = KILL_BURST;
        burst(px, py, MAGENTA, n, speed * scale);
        addShake(SHAKE_KILL);
        playKill();
        break;
      }
      case "boss-kill": {
        const [n, speed] = BOSS_KILL_BURST;
        burst(px, py, MAGENTA, n, speed * scale);
        addShake(SHAKE_BOSS);
        playKill();
        break;
      }
      case "boss-spawn":
        addShake(SHAKE_BOSS);
        break;
      case "core-hit":
        addShake(SHAKE_CORE_HIT);
        playCoreHit();
        break;
      case "place-denied":
        deniedMarkers.push({ x: px, y: py, startedAt: t });
        break;
    }
  }
}

function drawDeniedMarkers(ctx: CanvasRenderingContext2D, layout: Layout, t: number): void {
  const scale = scaleFor(layout);
  deniedMarkers = deniedMarkers.filter((marker) => t - marker.startedAt < DENIED_DURATION);
  for (const marker of deniedMarkers) {
    const progress = (t - marker.startedAt) / DENIED_DURATION;
    const radius = DENIED_MAX_RADIUS * scale * progress;
    ctx.save();
    ctx.strokeStyle = rgba(MAGENTA, 0.9 * (1 - progress));
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawFx(
  ctx: CanvasRenderingContext2D,
  game: Game,
  layout: Layout,
  t: number,
): void {
  const dt = frameDt(t);
  ingestFlashes(game, layout);
  ingestFx(game, layout, t);
  updateParticles(dt);
  drawParticles(ctx, layout);
  drawDeniedMarkers(ctx, layout, t);
}
