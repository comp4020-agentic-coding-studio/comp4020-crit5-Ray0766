# Crit 5

The breakthrough was realizing the "no full blockade" rule couldn't be checked
against the placement in isolation. My first draft asked "does this specific
corridor stay open," and it happily let three separate, individually-fine
placements add up to sealing off the last entrance, because none of them
looked dangerous on its own. The fix was to stop reasoning about the click and
instead ask a global question after it: run BFS from the core with the
candidate cell blocked, and check whether any entrance can still reach it at
all. That's a cheap thing to recompute every time the grid changes, and it's
the only version of the rule that's actually true regardless of how the board
got into its current shape. Writing the test before believing the fix worked
mattered too --- I would have accepted the first, wrong version if I'd only run
it against the case I designed it for.

This changed how I think about "one rule, one test." I used to treat a rule
like a checklist item to satisfy, something you implement once and move past.
Forcing myself to see the test fail on purpose --- commenting out the real
check, watching the assertion break, then restoring it --- made the rule feel
like a property of the whole system rather than a guard clause bolted onto one
function. I want to keep doing that: pick the one thing in a spec that's easy
to get subtly wrong, and prove the test would have caught the wrong version
before trusting that it catches anything at all.
