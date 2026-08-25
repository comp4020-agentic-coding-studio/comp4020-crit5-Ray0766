# Sentinel

A COMP4020 crit prototype, built on the course's static-site template and
deployed to GitHub Pages.

## CI and Pages only turn on when you ship

Your repo starts private, and both CI jobs (`check` and `deploy`) are gated on
it being public. While private, a push to `main` runs nothing in CI ---
`pnpm check` (below) is your feedback loop until then. When you're ready, the
course's `/ship` skill flips the repo public, turns on GitHub Pages, and
dispatches the deploy for you; there's nothing to configure in the Pages
settings yourself. From that point, every push to `main` builds and deploys, and
the deploy step prints your live URL and checks it returns 200.

## What gets marked

The deployed site is the deliverable, assessed live in Chrome at two fixed
viewports --- see the course website's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#marking-environment)
for the details.

## Quick start

```sh
mise install       # supported path: install the template's Node and pnpm
pnpm install
pnpm dev             # local dev server
pnpm check           # most of what CI runs (links, secrets and deploy are CI-only)
pnpm check:evidence  # the process-evidence check CI runs before you ship
pnpm build           # produce dist/ (what gets deployed)

# reproduce CI's links check before you push
pnpm dlx linkinator ./dist --silent --skip "^https?://(?!localhost|127)"
```

`mise` is the course's recommended runtime manager. If you use another manager
or the official installers, that is fine: provide the Node and pnpm versions in
`mise.toml`, then run the same commands. Tutor support reproduces runtime
problems with mise.

## What's here

- `index.html`, `styles.css`, `main.ts` --- the page and its bootstrap.
- `src/` --- the game itself: grid pathing, state, rendering, input.
- `spec/` --- the shipped invariants (`invariants.test.ts`) plus the one rule
  this round's tests cover (`no-blockade.test.ts`).
- `CLAUDE.md` --- orients whoever works in this repo.
- `PROCESS.md` --- this round's process overview.
- `.github/workflows/checks.yml` --- the CI sensors that run on every push once
  the repo is public, and the GitHub Pages deploy.
- `.githooks/pre-commit` --- blocks any commit that contains something shaped
  like an API key. Installed automatically by `pnpm install`.
