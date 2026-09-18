# A second, pinned `bun test` lane that has a database

- status: todo
- commit:

## Goal

`scripts/check-code.sh` runs `bun test` at stage 4, **before** stage 5 brings up the throwaway
postgres — so stage 4 has no `DATABASE_URL` and **no DB-backed test can exist in this repo today**.

Task 009 hit this wall directly: its card asked for "the assertion that warnings survive
`runPayroll` and reach the DB", and that assertion is unwritable. Every escape route is closed on
purpose, which is why this needs a gate change rather than a clever test:

- a DB-backed `lib/payroll-run.test.ts` runs in stage 4 with no DB ⇒ red;
- `test.skipIf(!process.env.DATABASE_URL)` ⇒ `tests - skipped == 0` ⇒ junit layer 2 fails it
  (`scripts/lib/check-code-junit.sh:282-286`), and layer 1's header forbids env-conditional counts;
- a `*.dbtest.ts` inside `db_stage` slips past the layer-2 corpus filter into an **unpinned** second
  junit report — a gate that can vanish in silence, the exact class §7 exists to prevent.

The consequence today: `PayslipWarning` rows are written by code that no test executes. The screens
task 009 shipped are the first thing that will ever read one.

## Scope

A second **pinned** `bun test` pass inside `db_stage`, after `prisma db push` + seed:

- extend `scripts/lib/check-code-junit.sh` to read a second junit file and pin it the same way —
  the point is that the new lane is as unskippable as the first, not that it merely runs;
- `scripts/junit-pins.txt` grows rows for the DB lane;
- `.docs/knowledge/ops/gate-tiers-and-pins.md` has the finding recorded already (split out of
  `gates.md` at task 023) — update it with what shipped;
- first test to write in the new lane: `runPayroll` persists `warnings` and a recompute replaces
  them wholesale rather than appending.

## Notes

- Ruled and reasoned by `architect` during task 009; the structural finding is in
  `.docs/knowledge/ops/gate-tiers-and-pins.md` rather than in the 009 card, so it survives that card's archival.
- §7's price rule applies: measure before adding, and the new lane must not make the gate slow
  enough that people reach for `SKIP_CODE_CHECKS=1`.
