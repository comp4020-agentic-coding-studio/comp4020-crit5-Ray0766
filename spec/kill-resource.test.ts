import { describe, expect, it } from "vitest";
import { RESOURCE_DROP_BY_TIER } from "../src/constants";
import { Game, type Enemy } from "../src/game";

function deadNormalEnemy(id: number): Enemy {
  return {
    id, x: 0, y: 0, targetX: 0, targetY: 0,
    hp: 0, maxHp: 30, speed: 1, tier: "normal",
  };
}

describe("killing an enemy pays out resource immediately, no pickup step", () => {
  it("grows resource by the tier's drop value the instant the kill is processed", () => {
    const game = new Game();
    const startingResource = game.resource;

    game.enemies.push(deadNormalEnemy(1));
    game.update(0.016);

    expect(game.resource).toBe(startingResource + RESOURCE_DROP_BY_TIER.normal);
  });

  it("leaves nothing pickable on the field — there's no orb system left at all", () => {
    const game = new Game();
    game.enemies.push(deadNormalEnemy(1));
    game.update(0.016);

    expect((game as unknown as { orbs?: unknown }).orbs).toBeUndefined();
    expect(game.enemies.length).toBe(0);
  });
});
