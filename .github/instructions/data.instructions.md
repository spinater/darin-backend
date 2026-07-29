---
description: Coding standards for the data layer — Prisma schema, seed, and the database client
applyTo: 'prisma/**,prisma.config.ts,lib/db.ts'
---

# Data layer (`prisma/`)

19 models in one `schema.prisma`, grouped by Thai section banners: people & permissions, config,
Google Sheet sync, manual entry, results. The schema **is** the data model documentation — §3 of
[REQUIREMENTS.md](../../REQUIREMENTS.md) explains why each table exists.

## Pre-flight (read in this order)

1. [.claude/knowledge/data/schema.md](../../.claude/knowledge/data/schema.md) — the card.
2. [REQUIREMENTS.md](../../REQUIREMENTS.md) §3 and
   [darin-payroll-system.md](../../darin-payroll-system.md) §5 — the model and what it is for.
3. The existing `schema.prisma` banners. Put a new model under the right one rather than appending.

## Hard rules

- **There is no migration folder.** This project uses `bunx --bun prisma db push`, not
  `prisma migrate`. Do not invent `prisma/migrations/` or reference `migrate dev`. The Docker
  `migrate` service runs `db push` + seed once at startup.
- **Always `bunx --bun`** so `.env` reaches [prisma.config.ts](../../prisma.config.ts).
- **A schema change means regenerating the client.** `bunx --bun prisma generate` before
  `typecheck`, or `@/generated/prisma` is stale and `tsc` lies to you.
- **Never widen `onDelete: Restrict` to `SetNull`** on anything a payslip is computed from.
  `TeachSession.staff` is `Restrict` on purpose: with `SetNull`, deleting a staff member silently
  drops their sessions out of both the payslip query and the review queue. Deactivate
  (`active = false`) instead of deleting — that is the supported workflow and the UI does it.
- **Uniqueness is what makes sync idempotent.** `TeachSession` is keyed
  `(sourceId, rowIndex, colIndex)` and `SheetRowRaw` `(sourceId, rowIndex)`. Changing or removing
  those constraints turns every re-sync into duplicate rows and double pay.
- **`reviewed` means "a human decided".** Nothing automatic may set it to `true`.
- **Money columns stay `Int` in satang-free baht** as they are today; if that ever changes it is a
  spec-level decision, not a schema tweak.
- **New config keys go in two places** — the `PayrollConfig` seed and `CONFIG_DEFAULTS` in
  [lib/config-keys.ts](../../lib/config-keys.ts) — and are documented in §4 of the pay-rules spec.
- **`prisma/seed.ts` must stay idempotent and safe to re-run**; it runs on every container start.
  It must never print or invent a password for an account that already has one.

## Required after edit

1. Update [.claude/knowledge/data/schema.md](../../.claude/knowledge/data/schema.md) and bump
   `verified[0].at`.
2. Update §3 of [REQUIREMENTS.md](../../REQUIREMENTS.md) when a model or relation changes.
3. State the backfill: an existing production database already holds real payslips. A new
   non-null column needs a default or an explicit backfill step written into the task file.
4. Run and paste the output:

```bash
bunx --bun prisma validate
bunx --bun prisma generate
bun run check:knowledge
bunx tsc --noEmit
bun test
```
