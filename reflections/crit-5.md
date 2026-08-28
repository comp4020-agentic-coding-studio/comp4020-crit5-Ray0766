# Crit 5

Twice now this project has taught me the same lesson: a system can be
logically correct and still fail as a game, and neither reading the code nor
testing it in isolation will show you that. Both times I only found the
problem by sitting down and actually playing a full run.

The first time was the economy. Nothing in any single formula was wrong ---
starting resource, unit costs, and the growing price curve all did exactly
what they were written to do. But played together, the numbers meant you
never had enough saved up to place a second unit until you were several waves
deep and already losing, so merging --- the whole point of the level system
--- basically never happened in a real playthrough. No test would have
caught that, because there was nothing false to assert; the bug was in how
the numbers interacted over the shape of an actual game, not in any one of
them.

The second time was this round: killing a pathogen wasn't growing my
resource. The orb was spawning, it was rendering exactly where it should,
and the kill/reward logic was fine on its own --- I could read every one of
those pieces and find nothing wrong. The actual bug was a coordinate mismatch
between the frame a click gets measured in and the frame the orb's position
lives in, so a click landing dead-center on a visible orb still missed it
every single time. That seam --- between what the model tracks internally and
what a click on the screen actually means --- is invisible from either side
alone. You have to click the thing and watch it fail to be collected.

Both bugs live in that same place: the gap between "the model is correct"
and "the moment-to-moment experience of playing it is correct." That's
changed the order I check things in. I used to treat passing tests and a
clean read-through as most of the way to done, with playing as a final
formality. Now playing a full run comes first, before I trust anything is
finished, because it's the only check that sits at the seam where both of
these bugs actually lived.

Not everything is like that, to be fair --- the "no full blockade" placement
rule from early on was a bug I caught by reasoning about it and writing a
test, not by playing, since it's a property of the model itself and BFS
either proves it or doesn't. But that one's the exception in this project,
not the rule, and it's not the kind of bug that's bitten me twice.
