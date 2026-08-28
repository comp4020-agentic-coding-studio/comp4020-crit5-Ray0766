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

4. This one I didn't find by reading code at all --- I found it by actually
   playing the built game after last round shipped. Starting resource was 30
   and the very first placement already cost 20, climbing after that, so by
   the time I'd saved up for a second unit I was several waves in and the
   pathogens had long since overwhelmed the one cell I had down. Merging,
   the whole point of the level system, basically never came up in a real
   playthrough because you never had two units on the board at once to merge.
   Nothing in the code was wrong in the sense of a bug --- the numbers just
   didn't work together once I tried to actually win a run. Fixed by moving
   to flat per-level prices (25/70/140) instead of a cost that keeps growing,
   and raising the starting resource so a second and third placement are both
   reachable well before the pathogens pile up.
   [2b97f19](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Ray0766/commit/2b97f19)

5. Another one from actually playing rather than reading the code. A few
   waves into a run with three or four cells down and pathogens dying all
   over the board, I noticed I'd stopped clicking the orbs at all --- there
   were just too many going off at once to chase each one down, so half my
   income was sitting on the field decaying away unclaimed while I focused on
   placement instead. That's not a bug in the pickup logic, it's the pickup
   step itself being the wrong idea once the game gets busy. Pulled the whole
   orb system out --- spawning, drift, magnet, click hit-test, the 6s expiry
   --- and made a kill credit resource the instant it happens, with an amber
   floater and a HUD punch standing in for the old "watch it land" feedback.
   [bd0ae4a](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Ray0766/commit/bd0ae4a)

6. This one came from a slow stretch rather than a busy one. Early waves only
   have a handful of normal pathogens trickling in one at a time, and the
   three-second prep window between waves has nothing happening in it at all
   --- I caught myself just watching the screen wait for the next spawn
   instead of actually deciding anything. A cosmetic "fast" label wouldn't
   have fixed that, since the thing dragging was the sim itself, not my
   perception of it. So I put one `timeScale` multiplier in the single place
   `dt` gets consumed inside `Game.update`, instead of a UI trick or a pile of
   per-system speed knobs, so every timer in the game speeds up together
   automatically and I didn't have to go find each one individually. Forced
   it back to 1x the instant the run ends too, so a boss fight I fast-forward
   through doesn't leave the win screen playing out sped up as well.
   [01cb506](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Ray0766/commit/01cb506)
