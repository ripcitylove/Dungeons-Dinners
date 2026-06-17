# Deploying & rolling back

Production is **mythicmeal.io** (Vercel), served from whatever the GitHub `main`
branch points at. Day-to-day work happens on `dev`. Every deploy and rollback goes
through one tool so there is always a dependable way back.

```
node scripts/deploy.mjs <command> [flags]
```

| Command | What it does |
|---|---|
| `status` | Show what's live, the deploy log, and the current rollback target |
| `deploy` | Build-gate → push `dev`→`main` → stamp a `live/<timestamp>` tag → verify the Vercel build |
| `rollback` | **Revert production to the previous deployed version** |
| `rollback --steps N` | Rewind N versions back |
| `rollback --to live/<ts>` | Jump to a specific past deploy (also rolls **forward**) |
| `verify [sha]` | Confirm the Vercel Production build succeeded and mythicmeal.io is in sync |
| `init` | One-time: backfill the deploy log from Vercel's real Production history |

Flags: `--dry-run` (preview, change nothing) · `--yes` (confirm a real action) · `--skip-build`.

## How it works (and why it's safe to roll back)

- Each deploy stamps an **immutable git tag** `live/<UTC-timestamp>` at the deployed
  commit. These tags are an ordered, durable **deploy log** that matches exactly what
  Vercel shipped (the log was seeded from Vercel's Production deployment history).
- **Rollback force-points `main`** at a tagged commit; Vercel rebuilds and re-serves
  that exact version (~90s). Git stays the single source of truth — repo and
  production never drift.
- Every action **polls Vercel until the Production build succeeds** and checks that
  mythicmeal.io is serving it, so you get a real pass/fail.
- It's a loop: `rollback` steps backward through deploys; `rollback --to <later tag>`
  steps forward. You can land on any version in either direction.

## Typical use

```
# Ship the current dev branch
node scripts/deploy.mjs deploy

# A bad deploy went out — undo it (back to the prior version)
node scripts/deploy.mjs rollback --yes

# See where things stand / what rollback would target
node scripts/deploy.mjs status

# Go back two versions, or to a specific deploy
node scripts/deploy.mjs rollback --steps 2 --yes
node scripts/deploy.mjs rollback --to live/20260616-233520 --yes
```

> Rollback rebuilds the target commit (dependable, build re-verified) rather than an
> instant alias-swap. Vercel's dashboard also offers a one-click instant rollback if
> ever needed, but that diverges git from production — prefer this tool.
