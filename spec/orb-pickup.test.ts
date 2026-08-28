import { describe, expect, it } from "vitest";
import { RESOURCE_DROP_BY_TIER } from "../src/constants";
import { Game, type Enemy } from "../src/game";

function deadNormalEnemy(id: number): Enemy {
  return {
    id, x: 0, y: 0, targetX: 0, targetY: 0,
    hp: 0, maxHp: 30, speed: 1, tier: "normal",
  };
}

describe("killing an enemy drops an orb you can actually collect", () => {
  it("spawns a pickable orb on kill, then grows resource by its value on pickup", () => {
    const game = new Game();
    const startingResource = game.resource;

    game.enemies.push(deadNormalEnemy(1));
    game.update(0.016);

    expect(game.orbs.length).toBe(1);
    expect(game.orbs[0].value).toBe(RESOURCE_DROP_BY_TIER.normal);

    const collected = game.collectOrb(game.orbs[0].id);

    expect(collected).toBe(true);
    expect(game.orbs.length).toBe(0);
    expect(game.resource).toBe(startingResource + RESOURCE_DROP_BY_TIER.normal);
  });
});
