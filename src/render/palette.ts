// Fluorescent dark-field palette. Each constant is an "r,g,b" fragment;
// callers pick the alpha per-use with rgba().
export const CYAN = "35,255,208";
export const CYAN_CORE = "234,255,248";
export const MAGENTA = "255,47,166";
export const MAGENTA_CORE = "255,217,239";
export const AMBER = "255,182,58";
export const AMBER_CORE = "255,242,208";
export const VESSEL = "150,60,80";
export const VESSEL_GRAIN = "255,150,170";
export const GRID_LINE = "90,255,215";

export function rgba(base: string, alpha: number): string {
  return `rgba(${base}, ${Math.max(0, Math.min(1, alpha))})`;
}

function parseTriplet(base: string): [number, number, number] {
  const [r, g, b] = base.split(",").map((part) => Number(part));
  return [r, g, b];
}

/** Linear-interpolate two "r,g,b" fragments by t in [0,1]. */
export function mix(baseA: string, baseB: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const a = parseTriplet(baseA);
  const b = parseTriplet(baseB);
  const r = a.map((value, i) => Math.round(value + (b[i] - value) * clamped));
  return r.join(",");
}
