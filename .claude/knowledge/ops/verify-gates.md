---
type: runbook
title: Verify gates
description: What "green" means here — the two checker scripts, the order they run in, their prerequisites, and the failure messages you will actually see.
tags: [verify, gates, ci, scripts]
sources:
  - scripts/check-file-length.ts
  - scripts/check-knowledge.ts
verified:
  - by: claude-code/opus-5
    at: 2026-07-29
---

# Verify gates

```bash
bun run verify   # check:lines && check:knowledge && typecheck && test
```

There is no CI. This command and a human reading the diff are the only things between a change and
production.

## Covers

| File | Role |
| --- | --- |
| `scripts/check-file-length.ts` | the 500-line ceiling (warns from 450) |
| `scripts/check-knowledge.ts` | card freshness, OKF conformance, and source coverage |

## Why this order

Both checkers are pure git operations over ~40 paths and finish in well under a second. They run
**before** `tsc` so the two failures that make everything downstream pointless — a file that should
have been split, and a card describing code that has moved — surface immediately.

Measured on this repo: `check:lines` and `check:knowledge` are sub-second, `tsc --noEmit` about
3 seconds, `bun test` about 0.6 seconds for 48 tests.

## Invariants & gotchas

- **`typecheck` needs the Prisma client.** `generated/` is gitignored, so a fresh clone has none and
  `tsc` fails with a module error that looks like an app bug. Run `bunx --bun prisma generate` once
  after `bun install`. `next typegen` is **not** required — `tsc` passes without `next-env.d.ts`.
- **`tsc` also typechecks `generated/prisma`** (26 files). That is intentional: `lib/db.ts` imports
  from it, and excluding it from `tsconfig` would not help — TypeScript still checks files that are
  imported. It costs a few seconds; leave it.
- **`incremental: true` writes `tsconfig.tsbuildinfo`**, which is covered by `*.tsbuildinfo` in
  `.gitignore`. So running `typecheck` can never dirty the tree or make a card go stale.
- **Both checkers read `git ls-files -co --exclude-standard`**, so they see untracked files (a new
  900-line file fails before it is ever staged) and never see gitignored ones (`generated/`, `docs/`).
- **`check-knowledge` refuses to run in a shallow clone.** Freshness is decided by per-file commit
  times, and a shallow clone reports the same timestamp for everything — the gate would pass
  vacuously while looking green. If CI is ever added, it needs full history.
- **`--untracked-files=all` in the status call is load-bearing.** Without it git reports a wholly
  untracked directory as a single entry (`?? app/api/`), so a card claiming a file inside it would
  miss the dirty set and the run would fail while reporting on a file that has no commit.
- **`scripts/` may use `Bun.*` freely.** These are Bun scripts by design; the no-`Bun.*` rule covers
  only code Next.js runs.

## Failure messages you will actually see

| Message | What to do |
| --- | --- |
| `STALE … source has uncommitted changes` | Normal mid-feature. Update the card before committing; both go in one commit. |
| `sources entry "lib/parser.ts" does not exist — was it split or renamed?` | The load-bearing error. Point `sources:` at the new paths. |
| `uncovered — N source file(s) covered by no card` | Add the file to the nearest card's `sources:`, or see the card contract for when a new card is warranted. |
| `both claim <file>` | Two cards list the same source. A file has exactly one home. |
| `no link to <card>` | A new card was not added to `index.md`. |
| `file-length: N file(s) over the 500-line limit` | Split it — §4a has the pattern per area. |

A rebase or `commit --amend` that reorders a card and its source can flip the card stale. The fix is
to touch the card and bump `verified[0].at` — deliberately the only escape hatch.

## Read next

- The rules these enforce — [.github/copilot-instructions.md](../../../.github/copilot-instructions.md) §4a, §5, §7
- The card contract — [.github/instructions/knowledge.instructions.md](../../../.github/instructions/knowledge.instructions.md)
- Running the app for real — [.claude/skills/verify/SKILL.md](../../skills/verify/SKILL.md)
