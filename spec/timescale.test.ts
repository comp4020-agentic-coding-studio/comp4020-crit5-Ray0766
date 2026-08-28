import { describe, expect, it } from "vitest";
import { Game, type Enemy } from "../src/game";

function farEnemy(id: number): Enemy {
  return {
    id,
    x: 0,
    y: 0,
    targetX: 10,
    targetY: 0,
    hp: 100,
    maxHp: 100,
    speed: 1,
    tier: "normal",
  };
}

describe("timeScale scales dt for the whole simulation, not a cosmetic counter", () => {
  it("running 1s of game time at 3x moves an enemy exactly 3x as far as 1x does", () => {
    const base = new Game();
    base.enemies.push(farEnemy(1));
    base.update(1);

    const fast = new Game();
    fast.timeScale = 3;
    fast.enemies.push(farEnemy(2));
    fast.update(1);

    expect(fast.enemies[0].x).toBe(base.enemies[0].x * 3);
  });
});
