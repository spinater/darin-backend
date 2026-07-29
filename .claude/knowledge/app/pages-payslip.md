---
type: route-group
title: Payslip pages
description: /payslips, /payslips/[id] and /me — running payroll for a period, the line-by-line audit trail, and the trainer view that shows hours but never money.
tags: [payslip, payroll, roles]
sources:
  - app/payslips/page.tsx
  - app/payslips/[id]/page.tsx
  - app/me/page.tsx
verified:
  - by: claude-code/opus-5
    at: 2026-07-29
---

# Payslip pages

Where the month is closed. `/payslips` runs the engine for a period and lists the results;
`/payslips/[id]` shows how one number was reached; `/me` is what everyone else sees instead.

## Covers

| File | Route | Role |
| --- | --- | --- |
| `app/payslips/page.tsx` | `/payslips` | period picker, run payroll, status changes |
| `app/payslips/[id]/page.tsx` | `/payslips/[id]` | one slip, broken out by `PayslipLine` group |
| `app/me/page.tsx` | `/me` | self view for `trainer` and `counter` |

## Invariants & gotchas

- **`/payslips` and `/payslips/[id]` are `requireAdmin()` — owner and admin only.** Everyone else is
  redirected to `/me` by `requireRole()`. Both the page and every action re-check.
- **`/me` shows hours, never baht.** That is a rule, not a layout choice: trainers can see what they
  taught, not what anyone earns. Any new field added here must be checked against that.
- **Running payroll only touches `draft` slips.** An `approved` or `paid` slip is skipped and the
  reason is surfaced. So changing a status is close to irreversible in practice — it freezes that
  person's period against recalculation.
- **Clear the review queue before running for real.** `pendingReviewInPeriod()` counts sessions that
  cannot be paid yet; running with a non-zero count produces slips that are quietly short. The
  README's pre-payout checklist says the same thing.
- **`PayslipLine` is regenerated on every run**, so the breakdown always reflects the current draft
  and never accumulates history.
- **`warnings[]` is the point of the run, not a side effect.** A missing teach rate or an
  unrecognised sale kind appears there and nowhere else — a slip with warnings is not a finished
  slip.
- The payslip form has several buttons (approve / mark paid / back to draft) in one form, which is
  exactly why `<SubmitButton>` compares `name`/`value` against the submitted `FormData`.
- `runPayroll` is wrapped in `timed("payroll", …)`, which is what feeds `<ActionProgress>` on the
  next run.
- `params` is a Promise in Next 16 — `await` it.

## Read next

- The engine — [domain/payroll-engine.md](../domain/payroll-engine.md)
- Monthly formulas — [darin-payroll-system.md](../../../darin-payroll-system.md) §1.7, §2.5; pay dates §6
- Before paying for real — [README.md](../../../README.md) "ก่อนใช้จ่ายเงินจริง"
- The queue that must be empty first — [app/pages-sync.md](pages-sync.md)
