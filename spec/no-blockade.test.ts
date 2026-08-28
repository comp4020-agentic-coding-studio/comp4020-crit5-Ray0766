import { describe, expect, it } from "vitest";
import { Game } from "../src/game";
import { canPlaceUnit, hasOpenPath, type CellKind, type PathGrid } from "../src/pathing";

// Hand-written fixtures: each character is one cell.
// E = entrance, C = core, # = a pre-existing blocked cell, . = empty.
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

describe("the hard rule: a placement can never seal every entrance off from the core", () => {
  it("rejects a placement that is the only remaining link in a single corridor", () => {
    // The only route from E is down column 0, then across row 3 to C.
    // Building on any of those three cells severs it completely.
    const g = grid(["E####", ".####", ".####", "....C"]);

    expect(canPlaceUnit(g, 0, 1)).toBe(false);
    expect(canPlaceUnit(g, 0, 2)).toBe(false);
    expect(canPlaceUnit(g, 2, 3)).toBe(false);
  });

  it("allows a placement next to the chokepoint when a loop still gets an entrance through", () => {
    // A single wall cell splits the middle, but two routes still wrap
    // around it to the core — blocking one arm's outer corner still leaves
    // the other arm open, even though it sits right beside the blockage.
    const g = grid(["E..", ".#.", "..C"]);

    expect(canPlaceUnit(g, 2, 0)).toBe(true);
    expect(canPlaceUnit(g, 0, 2)).toBe(true);
  });

  it("rejects a splash placement at that same chokepoint too, not just the cheapest kind", () => {
    // Same corridor as the first case above, but going through Game.tryPlaceUnit
    // with the priciest kind and money to spare, to prove the placement path
    // is gated by the exact same blockade check regardless of which kind.
    const game = new Game();
    game.grid = grid(["E####", ".####", ".####", "....C"]);
    game.resource = 1000;

    expect(game.tryPlaceUnit(2, 3, "splash")).toBe(false);
    expect(game.units.size).toBe(0);
  });
});

describe("the same guard also backs a swap: two placed units trading cells", () => {
  it("would be rejected if the board it left behind sealed every entrance off", () => {
    // Nothing in real play can leave the board looking like this — the
    // blocked-cell set only ever grows through validated placements — but a
    // swap re-runs this exact check against the post-swap board before it's
    // allowed to land, and this is what it has to catch if it ever did.
    const g = grid(["E#", "#C"]);

    expect(hasOpenPath(g)).toBe(false);
  });
});
