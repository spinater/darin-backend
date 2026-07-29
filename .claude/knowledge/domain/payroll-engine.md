---
type: module
title: Payroll engine
description: The pure salary calculator and its database driver — five stages, every rate from config, and anything undecidable pushed to warnings instead of silently becoming zero.
tags: [payroll, money, pure, config]
sources:
  - lib/payroll.ts
  - lib/payroll-run.ts
  - lib/config-keys.ts
  - lib/payroll.test.ts
verified:
  - by: claude-code/opus-5
    at: 2026-07-29
---

# Payroll engine

Computes one payslip for one person for one month. `payroll.ts` is a pure function with no database
and no numeric literals; `payroll-run.ts` is the only part that talks to Prisma. That split is what
makes the money testable without a database, and it is the invariant most worth protecting here.

## Covers

| File | Role |
| --- | --- |
| `lib/payroll.ts` | `computePayslip()` — the five stages, pure |
| `lib/payroll-run.ts` | loads everything from the DB, calls the engine, writes `Payslip` + `PayslipLine` |
| `lib/config-keys.ts` | the 19 config keys, their seed defaults, and the `num()`/`pct()` accessors |
| `lib/payroll.test.ts` | ~30 cases, grouped by the spec section each verifies |

## Public surface

- `computePayslip(input) → PayslipResult` — `{ base, teachPay, classPay, commission, otPay, net,
  lines, warnings }`
- `runPayroll(period) → { results, skipped }` — computes every active staff member for `"YYYY-MM"`
- `pendingReviewInPeriod(period) → number` — must be zero before a real payout
- `periodRange(period) → { from, to }` — throws a Thai error on a malformed period
- `NEEDS_ATTENTION` — the Prisma filter for "cannot be paid yet"
- `CONFIG_DEFAULTS`, `num(cfg, key)`, `pct(cfg, key)` — `pct` divides by 100

## Invariants & gotchas

- **`lib/payroll.ts` imports nothing but `config-keys`.** No `db`, no `Date.now()`, no
  `process.env`. Everything arrives through the single input object. Break this and the test suite
  stops being a guarantee.
- **There are no numeric literals for money.** Every rate, threshold and percentage comes from the
  `PayrollConfig` table. `CONFIG_DEFAULTS` is used **at seed time only** — changing a default does
  not change an existing database.
- **`warnings[]` is the whole safety mechanism.** A missing teach rate, an unknown sale kind, or a
  membership sale attributed to a non-`closer` role produces a Thai warning and skips the line. It
  never contributes `0`. A silent zero on a payslip is invisible; a warning is shown on screen.
- **Incentive is retroactive across the whole month.** The month's self-closed PT total is computed
  *first*; if it crosses the threshold, the higher rate applies to every self-closed sale in that
  month, including ones before the threshold was reached. A loop that decides per-sale is wrong.
- **"Self-closed" means every attribution on the bill is `closer`** *and* this person is one of
  them. A sale with a `referrer` is not self-closed for anyone. Do not simplify this test.
- **OT is per day, not per month.** `Σ max(0, hours − threshold)` over entries. Summing the month
  and subtracting the threshold once gives a different, larger number whenever any day is short.
- **Class credit is deducted from the month's class total, floored at zero** — never negative, and
  never per-class.
- **`money()` rounds to 2 dp at every accumulation boundary**, not once at the end.
- **`runPayroll` skips any slip that is not `draft`** and records a Thai reason in `skipped`. An
  `approved` or `paid` period is frozen — this is why an accidental status change is hard to undo.
- **`NEEDS_ATTENTION` deliberately includes `status: "ok"` rows with `staffId: null`.** Without that
  clause, a session with no trainer falls out of both the payslip query (which filters
  `staffId != null`) and the review queue, and the money disappears with no trace.
- `runPayroll` deletes and recreates all `PayslipLine` rows on every run — they are an audit trail
  of the current draft, not history.

## Read next

- Pay rules — [darin-payroll-system.md](../../../darin-payroll-system.md) §1.2–§1.7 (trainers),
  §2.1–§2.5 (counter), §3 (who gets commission), §4 (config keys)
- Engine design — [REQUIREMENTS.md](../../../REQUIREMENTS.md) §5
- Standards — [.github/instructions/domain.instructions.md](../../../.github/instructions/domain.instructions.md)
- Where the numbers are stored — [data/schema.md](../data/schema.md)
- Who may see them — [app/pages-payslip.md](../app/pages-payslip.md)
