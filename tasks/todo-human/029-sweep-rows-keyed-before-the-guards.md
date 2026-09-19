# Sweep the real database for money rows keyed before the input guards existed

- status: todo-human
- commit:

- 🚫 **Blocked on linus:** the only database with real rows is on the deploy host, and nobody can
  reach it — the repo has no `DEPLOY_SSH_KEY` secret and `157.85.104.171` still stands on
  `feat/sync-progress-ui` ([002](002-deploy-host-setup.md) ·
  [008](008-merge-sync-progress-then-deploy-develop.md)). Until one of those lands, this card cannot
  be started by any agent, however capable: the local database is **seed-only** (0 rows in
  `TeachSession`, `Sale`, `ClassSession`, `Payslip`, `OtEntry`), so the query answers `0 bad of 0`
  and proves nothing.

## Goal

Task 013 item 4 shut the doors: a value that is absent, unreadable, non-finite, negative or a
fraction into an `Int` column can no longer be written from any form. **It does not sweep the room.**
Rows keyed before those guards are untouched, and `payroll-auditor` confirmed on a throwaway Postgres
that the bad values genuinely round-trip:

```
OtEntry.hours = NaN       → stored, hours::text = 'NaN',      is_null = false
OtEntry.hours = Infinity  → stored, hours::text = 'Infinity', is_null = false
```

A single such row still arrives at `computePayslip` as `NaN`/`Infinity` and takes `otPay`, `net`, the
stored `Payslip.net` and the period total on `/payslips` with it — for **every** staff member in that
`reduce`, not just the one whose row is bad.

**Why this is its own card:** the local database here is seed-only (7 `Staff`, 18 `PayrollConfig`,
**0** rows in `TeachSession`, `Sale`, `ClassSession`, `Payslip`, `OtEntry`), so the query returns
`0 bad of 0` and proves nothing. The only database with real rows is on the deploy host, which is
blocked on linus ([002](../todo-human/002-deploy-host-setup.md),
[008](../todo-human/008-merge-sync-progress-then-deploy-develop.md)).

## Scope

Run on the real database, read-only first, and report counts before changing anything:

| Table · column | What to look for |
| --- | --- |
| `OtEntry.hours` | `hours < 0 OR hours <> hours OR hours = 'Infinity' OR hours = '-Infinity'` (`x <> x` is the SQL test for `NaN`) |
| `Sale.netPrice`, `Sale.listPrice` | same three shapes |
| `ClassSession.booked`, `noShow` | negative, and `noShow > booked` (card 025's subject) |
| `Staff.baseSalary`, `classCredit` · `TeachRate.rate` · `ClassPrice.price` | negative, and `0` where a price was expected (the truncation case: `0.4` became `0`) |
| `PayrollConfig.value` | blank, non-numeric, non-finite, negative — `num()` now throws on the first three, so a blank here **stops the payroll run** until it is fixed |

- 🔴 **Never compose the connection string on the host** (§6 "Secrets during testing"): run inside the
  container that already holds the env — `docker compose exec -T app sh -c '…'`.
- A row that is wrong cannot be corrected by guessing. Report it to linus with the person, the date
  and the value; the fix is a human re-keying it, not a script.
- 🔴 `PayrollConfig` is the urgent one, and it is urgent **before the next deploy, not before the
  next payroll run**. `num()` now throws on a blank, and `/ot` and `/classes` call it **at page
  render** — so a legacy blank value in the deployed database turns those two screens into Next's
  default error page the moment this lands, and a production build **redacts** the message, so the
  new Thai text reaches only the container log. `/admin/config` does not call `num()`, so it stays
  reachable and its notice names the blank ⇒ the repair path exists, but only for someone who knows
  to go there. See [020](../done/020-no-error-boundary-anywhere.md) — this is the first concrete case of the
  hole that card names.
  This is why the order is: sweep → fix → deploy. `develop` deploys with no gate in front of it
  (§6 "Deploy"), so nothing else will catch it.

## Notes

- Opened from `payroll-auditor`'s round-2 note on task 013 item 4 (2026-09-18): *the door is now shut,
  but a row keyed before today is unaffected.*
- Related: [025](../done/025-negative-class-attendance-pays-zero-in-silence.md) (the `noShow > booked` rows this sweep
  would find) · [028](../todo/028-config-values-have-no-per-key-spec.md) (a value that is in range but
  implausible — `12` where `0.12` was meant — which this sweep **cannot** find).
