// A generic burst-of-dots system shared by every "something just happened"
// event — a hit, a kill, a placement landing. Nothing here knows what
// triggered it; fx.ts decides when to call burst() and with what color.
import { scaleFor, type Layout } from "./layout";
import { rgba } from "./palette";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  sizeSeed: number;
  color: string;
}

let particles: Particle[] = [];

const DRAG = 0.92;
const LIFE_DECAY_PER_SECOND = 1.8;

export function burst(x: number, y: number, color: string, n: number, speed: number): void {
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random()) * speed;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s,
      life: 1,
      sizeSeed: Math.random(),
      color,
    });
  }
}

export function updateParticles(dt: number): void {
  const alive: Particle[] = [];
  for (const p of particles) {
    p.vx *= DRAG;
    p.vy *= DRAG;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= LIFE_DECAY_PER_SECOND * dt;
    if (p.life > 0) alive.push(p);
  }
  particles = alive;
}

export function drawParticles(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const scale = scaleFor(layout);
  for (const p of particles) {
    const radius = (2 + p.sizeSeed * 3) * p.life * scale;
    if (radius <= 0) continue;
    ctx.fillStyle = rgba(p.color, Math.max(0, Math.min(1, p.life)));
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
