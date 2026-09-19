# `noShow` larger than `booked` stores, and the class then pays 0 ฿ with no warning

- status: done
- commit: 54d2526

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

> ⚠️ **Bound correction** (`payroll-auditor`, 2026-09-18): "four such rows = 800 ฿" is the **lower**
> bound, not the figure. Each broken row costs the trainer **200 ฿** if the true attendance was 1–2
> or **400 ฿** if it was ≥ `class.minAttendees`, so four rows is **800–1,600 ฿** — and **0 ฿** for a
> trainer whose month's class value stays under their `classCredit`, because §1.3's
> `max(0, classValue − classCredit)` absorbs the entire loss before it reaches `net`. Measured with
> `CONFIG_DEFAULTS`: `classCredit 5,000` with 14 full Aqua Fit rows (5,600 ฿) plus one row keyed
> `booked 2 / noShow 5` pays `net 10,600`, against `10,800` (half) or `11,000` (full) had that row
> been keyed right; the same broken row on a trainer with only 3 classes that month costs nothing at
> all.

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

## What shipped — `54d2526`

`attended < 0` now pushes a warning **before** the unchanged ratio branch, naming the class, both
head counts, the negative result and the price, and ending with the remedy `/classes` actually
offers (`ลบคาบนี้แล้วคีย์ใหม่` — that screen has `add` and `del`, no edit action). It still pays
**0 ฿**, and the recorded reason is the one that survives review: the input is *unreadable*, not the
rule undecided. Paying anything means guessing which of the two counts is wrong, and on
`{price 400, booked 2, noShow 5}` a transposed pair (`booked 5 / noShow 2`) is 3 attended and pays
**400 ฿** while a `noShow` mistyped alone (`booked 2 / noShow 0`) is 2 attended and pays **200 ฿**.
⇒ §2 rule 4 sends it to `warnings` and the human picks.

The door guard at `/classes` (`err=noShowOverBooked`) is the cheap half; the engine change is the
deliverable, because rows keyed before the guard existed are already stored. `app/classes/page.tsx`
is the **only** writer of `ClassSession` — `lib/sync.ts` writes `teachSession` and `sheetRowRaw`
only, since the sheet's schedule is 1-on-1 throughout.

- **No baht figure moved.** `git diff --numstat lib/payroll.ts` → `16 0`, one hunk, pure insertion;
  `payroll-auditor` ran HEAD against it over 126 cases (`booked 0..6 × noShow 0..8 × classCredit
  {0, 5000}`) comparing every total and deep-equal `lines[]`.
- **Pin 30 → 33.** Three tests: the negative row warns *and* contributes exactly 0 to the class
  line (`classPay` alone cannot fail — `max(0, classValue − classCredit)` clamps it, and a mutation
  making a negative row subtract 400 ฿ stayed green against it) · the head counts are pinned as one
  **ordered** substring (a set of substrings passed even when the message swapped which number was
  the no-show) · two identically-broken rows produce **two** warnings while `byClass` still merges
  them into one payslip line.
- **Reviewed twice.** `code-reviewer` PASS → PASS · `payroll-auditor` APPROVE → **BLOCK** → fixed.
  The block was not in the money: the worked example justifying the 0 ฿ was self-refuting, silently
  carrying one reading's correction into the other so both branches landed on 200 ฿. Corrected in
  `lib/payroll.ts` and `payroll-rules.md`; `money-input-guards.md` needed no change.

**Left open on purpose → [030](../todo/030-class-warning-cannot-name-its-row.md):** `ClassSessionInput` has
no `date`, so two identically-broken rows of the same class warn identically and the admin must scan
the period to find both. Deferred rather than bundled because adding `date` widens a type consumed by
`lib/payroll-run.ts` and would dissolve this diff's one provable property — 16 added, 0 removed, no
amount moved. The `toHaveLength(2)` pin already tells the admin there are **two** rows to find, which
is the half that protects the baht. That card is also the one that splits `lib/payroll.test.ts`
(433 lines, §4 warn at 450).
