import { describe, expect, it } from "vitest";
import { MAX_UNIT_LEVEL, UNIT_KIND_ORDER, UNIT_KINDS, unitDps } from "../src/constants";

describe("the four cell types stay strictly ordered by price and strength", () => {
  it("costs strictly increase from rapid to blocker to heavy to splash", () => {
    const costs = UNIT_KIND_ORDER.map((kind) => UNIT_KINDS[kind].cost);
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    }
  });

  it("DPS strictly increases in cost order at every fusion level, so a pricier cell is never weaker", () => {
    for (let level = 1; level <= MAX_UNIT_LEVEL; level++) {
      const dpsByKind = UNIT_KIND_ORDER.map((kind) => unitDps(kind, level));
      for (let i = 1; i < dpsByKind.length; i++) {
        expect(dpsByKind[i]).toBeGreaterThan(dpsByKind[i - 1]);
      }
    }
  });
});
