# Process overview

## What I built

A top-down defense game about an immune system: pathogens spawn at the grid's
edges and walk a shortest path toward a core in the middle, and the only thing
the player can do is place immune cells that block a square and force
pathogens to route around them. Dragging one placed cell onto another fuses
them into a stronger one, up to level 3. There's no menu, no on-screen
explanation and no start button --- tapping a cell places or collects, and
dragging merges.

## The moments that mattered

1. The spec's one hard rule is that a placement can never seal off every
   entrance from the core. My first instinct was to check whether the specific
   corridor being clicked stays open, but that misses the case where three
   separate placements, each individually fine, add up to sealing the last
   entrance. So `canPlaceUnit` instead runs a fresh BFS from the core with the
   candidate cell temporarily blocked and asks whether any entrance is still
   reachable at all, recomputed on every placement rather than reasoned about
   locally. Before trusting it I broke it on purpose: commented the BFS check
   down to a bare `return true`, ran `spec/no-blockade.test.ts` and watched the
   sealing-corridor case fail with `expected true to be false`, then restored
   the real check and reran it to two passing tests.
   [9f51da0](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Ray0766/commit/9f51da0)

2. "Merging doesn't free up the cell" is easy to get wrong, since the obvious
   implementation deletes the source unit and its cell reverts to walkable. I
   added a `scars` set instead: a merged-away cell joins it permanently, stays
   blocked for pathing and placement forever after, and has no `Unit` attached
   to it anymore, so the total obstacle count on the board never drops.
   [911c28b](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Ray0766/commit/911c28b)

3. I first read "no explanatory text anywhere" as "no text of any kind" and
   built the whole HUD around that stricter rule --- core health, resource and
   wave progress were bars and pips whose fill was the only signal, no digits
   anywhere on screen.
   [8d9c482](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Ray0766/commit/8d9c482)
   Coming back to it later I realised a number isn't an explanation --- it's
   only "how do I play this" text that the rule actually bans, a plain digit
   reporting a value is fine. So the bars and pips came out in favour of
   floating damage numbers over whatever just got hit plus a small numeral
   readout for resource and wave count, and the page's one required heading
   stayed a real `<h1>`, visually hidden rather than missing.
   [881522d](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Ray0766/commit/881522d)
   [b950c57](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Ray0766/commit/b950c57)
