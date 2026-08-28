import { describe, expect, it } from "vitest";
import { Game, type Enemy } from "../src/game";

// A minimal already-dead enemy: updateEnemies() scores and removes it on the
// very next update() tick regardless of position, since the hp<=0 check runs
// before any core-contact check.
function deadNormalEnemy(id: number): Enemy {
  return {
    id,
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    hp: 0,
    maxHp: 30,
    speed: 1,
    tier: "normal",
  };
}

describe("score climbs immediately on each kill, not only at the end of a run", () => {
  it("goes from 0 to 40 across 4 sequential normal-tier kills", () => {
    const game = new Game();
    expect(game.score).toBe(0);

    for (let i = 1; i <= 4; i++) {
      game.enemies.push(deadNormalEnemy(i));
      game.update(0.016);
      expect(game.score).toBe(10 * i);
    }
  });
});
