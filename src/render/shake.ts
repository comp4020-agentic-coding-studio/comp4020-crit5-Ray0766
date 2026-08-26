// Screen shake: a single decaying scalar that render.ts turns into a
// per-frame canvas translate. Anything that wants to rattle the view just
// calls addShake(); the decay and the offset math live here.
const DECAY_PER_SECOND = 2.2;
const OFFSET_PER_UNIT = 9;
const MAX_SHAKE = 3;

let shake = 0;
let lastT: number | null = null;

export function addShake(amount: number): void {
  shake = Math.min(MAX_SHAKE, shake + amount);
}

/** Advance the decay by however long it's been since the last tick, and
 *  return this frame's canvas offset. Call exactly once per rendered frame. */
export function tickShake(t: number): { x: number; y: number } {
  const dt = lastT === null ? 0 : Math.min(0.05, Math.max(0, t - lastT));
  lastT = t;
  shake = Math.max(0, shake - DECAY_PER_SECOND * dt);
  if (shake <= 0) return { x: 0, y: 0 };
  const amount = shake * OFFSET_PER_UNIT;
  return {
    x: (Math.random() * 2 - 1) * amount,
    y: (Math.random() * 2 - 1) * amount,
  };
}
