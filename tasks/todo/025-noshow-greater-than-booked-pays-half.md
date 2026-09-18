# `noShow` larger than `booked` stores, and the class then pays 0 ฿ with no warning

- status: todo
- commit:

## Goal

Task 013 item 4 closed the `Number()` holes on `/classes`: `booked` and `noShow` are each rejected
when absent, unreadable or negative. What it did **not** close is the pair being nonsense
*together* — `booked: 2, noShow: 5` passes both field guards and stores.

`attended = booked − noShow` is then **−3**, and `lib/payroll.ts`'s class branch reads
`attended <= 0 ? 0 : attended < minAtt ? halfRatio : 1` ⇒ **0 ฿, with `warnings: []`**.

⚠️ **Measured, not assumed** (`payroll-auditor`, 2026-09-18, against `computePayslip` with
`CONFIG_DEFAULTS`): `{ price: 400, booked: 2, noShow: 5 }` → `classPay 0`, no warning. The first
version of this card claimed it paid *half*; that was wrong, and the direction is what decides the
fix — an overpay would be visible on the slip, while this is the **invisible zero** §2 rule 4 exists
to forbid. Four such rows in a month is **800 ฿** missing from one payslip with nothing on it to
look at.

§1.4 of `darin-payroll-system.md` defines `0 คน = 0 · 1–2 คน = ครึ่งราคา · ≥3 คน = เต็มราคา` and says
nothing about a negative count — so the engine is choosing silently for a case the spec does not
cover, which is the thing the rulebook forbids.

## Scope

- Reject `noShow > booked` in the `/classes` add action, through the surface that page now has
  (`err` flag → Thai notice → clean-URL redirect on success), naming the pair that was refused.
- **Rows already stored cannot be fixed by the guard**, so the engine must stop deciding quietly:
  push a warning when `attended < 0` rather than folding it into the `<= 0` branch. That is the
  actual deliverable — the door guard alone lets a future reader think the case is handled.
- A test in `lib/payroll.test.ts` pinning both: what a negative `attended` pays **and** that it
  warns. A test of the payment alone passes against today's behaviour and proves nothing.

## Notes

- Found by `backend-dev` during task 013 item 4 and re-measured by `payroll-auditor`, who also
  corrected this card's original premise.
- Related: `class.minAttendees` / `class.halfRatio`, and `.docs/knowledge/domain/money-input-guards.md`
  (whose sentence on this case was corrected in the same round).
