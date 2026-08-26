// Tracks the pointer purely for the grid's mouse-proximity glow. This is a
// second, read-only listener on the same canvas input.ts already wires up —
// it never calls setPointerCapture or touches game state, so it can't
// interfere with placing, collecting or merging.
const attached = new WeakSet<HTMLCanvasElement>();
const lastPos = new WeakMap<HTMLCanvasElement, { px: number; py: number } | null>();

export function trackPointer(canvas: HTMLCanvasElement): { px: number; py: number } | null {
  if (!attached.has(canvas)) {
    attached.add(canvas);
    lastPos.set(canvas, null);
    canvas.addEventListener("pointermove", (event) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      lastPos.set(canvas, {
        px: ((event.clientX - rect.left) / rect.width) * canvas.width,
        py: ((event.clientY - rect.top) / rect.height) * canvas.height,
      });
    });
    canvas.addEventListener("pointerleave", () => lastPos.set(canvas, null));
  }
  return lastPos.get(canvas) ?? null;
}
