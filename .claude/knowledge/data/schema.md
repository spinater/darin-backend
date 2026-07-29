---
type: contract
title: Data model
description: 19 Prisma models in five groups — people, config, sheet sync, manual entry, results — plus the unique keys that make sync idempotent and the FK rule that keeps money from vanishing.
tags: [prisma, schema, seed, postgres]
sources:
  - prisma/schema.prisma
  - prisma/seed.ts
  - prisma.config.ts
  - lib/db.ts
verified:
  - by: claude-code/opus-5
    at: 2026-07-29
---

# Data model

One PostgreSQL 18 database, accessed only through Prisma 7 with the `pg` adapter. The schema is
organised by Thai section banners; put new models under the right one. Schema changes ship via
`prisma db push` — **there is no migration folder**.

## Covers

| File | Role |
| --- | --- |
| `prisma/schema.prisma` | all 19 models |
| `prisma/seed.ts` | rates, class prices, config defaults, staff, aliases, sheet sources, the owner account |
| `prisma.config.ts` | points Prisma at the schema and `DATABASE_URL`; registers the seed command |
| `lib/db.ts` | the `PrismaClient` singleton, cached on `globalThis` outside production |

## The five groups

| Group | Models |
| --- | --- |
| People & permissions | `Staff`, `Session` |
| Config (nothing hardcoded) | `TeachRate`, `PayrollConfig`, `ClassPrice`, `ColorRule` |
| Sheet sync | `SheetSource`, `SheetRowRaw`, `TrainerAlias`, `TeachSession`, `SyncRun`, `JobDuration` |
| Manual entry | `ClassSession`, `Sale`, `SaleAttribution`, `OtEntry` |
| Results | `Payslip`, `PayslipLine` |

## Invariants & gotchas

- **`TeachSession.staff` is `onDelete: Restrict` and must stay that way.** With `SetNull`, deleting
  a staff member leaves sessions with `status: "ok"` and no trainer — which drops them out of *both*
  the payslip query (it filters `staffId != null`) and the review queue. The money would disappear
  with no error. Deactivate (`active = false`) instead; the admin UI already does.
- **Three unique keys carry the idempotency of the whole system:**
  `TeachSession(sourceId, rowIndex, colIndex)`, `SheetRowRaw(sourceId, rowIndex)`,
  `Payslip(staffId, period)`. Change any of them and re-running a sync or a payroll duplicates rows.
- **`TeachSession.reviewed` means "a human decided".** Nothing automatic may set it `true`; sync
  reads it to decide what not to touch.
- **`TeachSession.date` is nullable** — an unparseable cell still becomes a row, so it can appear in
  the review queue. Payroll filters on a date range, so a null-dated row is invisible to payslips by
  design and visible to the queue by design.
- **`Payslip.status` is a one-way gate in practice.** `runPayroll` refuses to recompute anything that
  is not `draft`, so setting `approved` or `paid` freezes that period for that person.
- **`PayslipLine` is a rebuilt audit trail, not history.** Every payroll run deletes and recreates
  the lines for a draft slip.
- **`colMap` is untyped `Json`** cast to `ColMap` at the call site in `lib/sync.ts` — a wrong column
  index is a runtime problem, not a compile-time one. It is one of the few places `as` is warranted.
- **Money columns are `Float`; `baseSalary` and `classCredit` are `Int`.** Rounding is the engine's
  job (`money()`, 2 dp), not the database's.
- **`period` is the string `"YYYY-MM"`**, and all dates are stored at UTC midnight. `periodRange()`
  is the only correct way to turn one into a range.
- `SyncRun` rows with a non-null `error` are kept but must not feed the "how long will this take"
  estimate. `JobDuration` keeps only the latest duration per job — no history, by design.
- **`generated/prisma` is gitignored.** After any schema edit, `bunx --bun prisma generate`, or
  `tsc` will typecheck a stale client and tell you everything is fine.
- **Always `bunx --bun prisma`** — the plain form does not load `.env` into `prisma.config.ts`.
- `prisma/seed.ts` runs on every container start and must stay idempotent; it must never rotate or
  reprint a password for an account that already has one.

## Read next

- Model rationale — [REQUIREMENTS.md](../../../REQUIREMENTS.md) §3, [darin-payroll-system.md](../../../darin-payroll-system.md) §5
- Standards and the backfill rule — [.github/instructions/data.instructions.md](../../../.github/instructions/data.instructions.md)
- Who writes these tables — [domain/sheet-sync.md](../domain/sheet-sync.md), [domain/payroll-engine.md](../domain/payroll-engine.md)
