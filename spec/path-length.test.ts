import { describe, expect, it } from "vitest";
import { cellIndex, distanceFromCore, type CellKind, type PathGrid } from "../src/pathing";

// Hand-written fixture, same pattern as no-blockade.test.ts.
// E = entrance, C = core, # = blocked, . = empty.
function grid(rows: string[]): PathGrid {
  const width = rows[0].length;
  for (const row of rows) {
    if (row.length !== width) throw new Error("fixture rows must all be the same width");
  }
  const cells: CellKind[] = [];
  for (const row of rows) {
    for (const ch of row) {
      cells.push(ch === "E" ? "entrance" : ch === "C" ? "core" : ch === "#" ? "blocked" : "empty");
    }
  }
  return { width, height: rows.length, cells };
}

describe("the path-length readout tracks the real BFS shortest path to an entrance", () => {
  it("lengthens from 4 to 10 once the near gap gets built over", () => {
    // A two-row-thick wall separates the entrance (top) from the core
    // (bottom): a gap straight down from the entrance gives a length-4
    // route, a second gap three columns over gives a length-10 detour that
    // only matters once the near gap is sealed — exactly the recompute a
    // unit placement drives on the real board.
    const g = grid(["E...", ".##.", ".##.", "....", "C..."]);
    const entranceIndex = cellIndex(g, 0, 0);

    const before = distanceFromCore(g);
    expect(before[entranceIndex]).toBe(4);

    g.cells[cellIndex(g, 0, 2)] = "blocked";
    const after = distanceFromCore(g);
    expect(after[entranceIndex]).toBe(10);
  });
});
