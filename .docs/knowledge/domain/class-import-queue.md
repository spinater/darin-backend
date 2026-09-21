---
sources:
  # The table itself, and the doc comments that carry the "no FK, no money" decisions.
  - prisma/schema.prisma
  # The pure half: the three key shapes, the merge, and the storage row.
  - lib/class-problems.ts
  # The pin on all of it, including the byte-identity arm the clearing rests on.
  - lib/class-problems.test.ts
  # The write: the transaction that clears and re-records, inside the import's own `$transaction`.
  - lib/gymmo-import-run.ts
  # The one home for "which queues block a run".
  - lib/run-blockers.ts
  # The screen that names the count, so a run cannot look complete while คาบ are missing. Kept here
  # too: the copy this card's "no clearing path" facts are rendered as lives on it.
  - app/payslips/page.tsx
  # ใบ 065: the second screen rendering this card's "what clears a row of this kind" facts — including
  # the `kind: "row"` one that clears never (ใบ 066). Editing that copy must land here as STALE, the
  # same reason `app/payslips/page.tsx` is listed.
  - app/classes/_components/import-problems.tsx
---

# The class-import queue — where a Gymmo row that never became a คาบ lives

> 📌 **ใบ 064 ปิดแล้ว** (`c628748`) — การ์ดใบงานย้ายไป `tasks/done/` และลิงก์ในโค้ดถูกเขียนตาม
> โดย `scripts/task-move.sh` · สิ่งที่ยัง**ไม่**ปิดคือผู้ใช้ของคิวนี้: ไม่มีอะไรเรียก
> `applyGymmoImport` จนกว่าหน้าอัปโหลด (ใบ 063 ข้อ 4) จะลง และใบ 065 ต้องลงก่อนหน้านั้น

Read [gymmo-import.md](gymmo-import.md) first: that card is about **identity and refusals** on the way
in. This one is about **what a refused row is and how it is stored** — task **064**. Its other half, the
`/payslips` count and the rows that never clear, is
[class-import-blockers.md](class-import-blockers.md); split at creation because this one reached 195/200
and card 065 has to touch both (§5: split, never a bigger cap).

🔑 **The payslip cannot warn about a row that does not exist.** `PayslipWarning` is produced by
`computePayslip` over `ClassSession` rows, so a คาบ that never entered the database is invisible to
every warning the engine has. Before 064 those คาบ were returned by a pure function, rendered once on
the import screen, and gone with the request: ~20 `Pilates Flow` คาบ/month (~8,000 ฿ of class value)
would have left a slip reading `net` short with `warnings: []` — CLAUDE.md §2 rule 4 reached by a path
where the engine is blameless.

## Two queues, on purpose — and one function that means "this period is not clean"

| | `SheetRowRaw` + `TeachSession.status = "needs_review"` | `ClassImportProblem` |
|---|---|---|
| the fact stored | a payable row that **exists** and is flagged | a payable row that **does not exist** |
| the repair | in place, at `/sync/review` | upstream (add a `ClassPrice`/`TrainerAlias`) then **re-upload** |
| identity | `@@unique([sourceId, rowIndex])`, FK to `SheetSource` | `key String @id`; a Gymmo upload has **no `SheetSource`** |

Merging them would need a nullable `sourceId` — dropping the FK the cascade rests on — plus a one-way
`db push` over `TeachSession.reviewed`/`reviewNote`, which are a **human's decisions** and cannot be
regenerated. Everything in `ClassImportProblem` is derived: re-uploading rebuilds every row. §2 rule 8
and correct modelling pointed the same way.

What is unified is the **meaning**, and it has exactly one home: `runBlockers(period)` in
`lib/run-blockers.ts`, read by both `/payslips` and `/`. 🔴 **Labelled members, never one total** —
a sum reads as one queue and hides which screen to open. Three of them since ใบ 043, and the third is
a *list* of colours rather than a count ([colour-gap-states.md](colour-gap-states.md)); what that
proves about this one is that the shape of a member follows the repair, not the other way round.

## `key` — three shapes in one column, kept apart by arity

All three are `JSON.stringify` of an array, so the column is **decodable** and two keys are equal only
when their tuples are (the argument `gymmoSourceKey` already rests on; a `a|b|c` join is ใบ 035's bug
class — see [teach-rate-lookup.md](teach-rate-lookup.md)).

| arity | shape | when | clears itself? |
|---|---|---|---|
| 4 | `[normTrainer, "YYYY-MM-DD", timeText, rawClassName]` | the row reached the planner: trainer or class unmatched, or an in-file duplicate | **yes**, if the period is open |
| 3 | `[sheetName, rowText, rawWhen]` — the `#` and `Date & Time` cells **verbatim**, `""` included | the reader rejected the row | 🔴 **never** |
| 1 | `[sheetName]` | the reader rejected a whole sheet (no header) | 🔴 **never** |

🔴 **`rawWhen` is in the reader key because `#` is not an identity across exports.** Gymmo's `#` is a
per-sheet running number that **restarts in every export**, so `[ชีต, "14"]` names one คาบ in the
August file and a different one in the September file: uploading the second would `deleteMany` the
first's still-true problem and store an unrelated row's reason under that key — T3's silent loss
reached through a key that is not an identity rather than through a date range. The raw `Date & Time`
cell is the one field on a rejected row that says *which* คาบ even when it cannot be parsed. Neither
cell is defaulted the way the label's `"?"` is: the label is for a human, the key is an identity.

🔴 **An arity-3/1 row has NO clearing path, and this is the sentence to read twice.** Fixing the cell
and re-uploading does **not** remove it: the repaired คาบ is written under a **4-tuple** `sourceKey`, so
the `deleteMany` cannot match the 3-tuple and the row survives its own repair. It is then listed for
ever, telling an admin to do the thing they just did — and one permanently stuck blocker is what
teaches them to ignore **both** counts, including the one carrying 8,000 ฿ below.
[066](../../../tasks/todo-human/066-may-a-human-dismiss-an-import-problem.md)'s dismissal is its only
exit, which is now the main reason 066 needs an answer. ⇒ never write, in a comment or on a screen,
that a re-upload makes one of these disappear.

🔴 **The 4-arity key is produced by calling `gymmoSourceKey` itself**, never re-derived — that equality
*is* the clearing, since the `deleteMany` runs over the very `sourceKey`s the import writes. One byte of
drift and a fixed คาบ stays queued for ever while `/payslips` blocks a clean period. Highest-value arm
in `lib/class-problems.test.ts`; re-deriving the tuple instead of calling that function turns **8** arms
red across two files (counter-tested on a clean tree — see `scripts/junit-pins.txt` for the names).

**`kind`** — `"session"` clears on a clean import into an **open** period · `"duplicate"` has a real
`sourceKey` too, but the file disagrees with itself about the head count, so an existing คาบ proves
nothing about the amount and the count never excludes it · `"row"` has no `sourceKey` at all.

⚠️ **ใบ 065 changed one field of the preview this module returns and nothing about this table**:
`handKeyedInRange` (a count) became `handKeyedMatches` (the rows a planned write would duplicate)
plus `handKeyedUnmatchedInRange` (the residual), and both are now on `GymmoImportResult` as well,
re-read inside this same transaction — see
[gymmo-import-preview.md](gymmo-import-preview.md). The queue's own read
side gained a three-valued `state` per row, in
[class-import-blockers.md](class-import-blockers.md).

## The write: delete-then-insert, keyed, inside the import's own transaction

`applyGymmoImport` is the **only** writer; `previewGymmoImport` stays read-only. After the คาบ are
written and still inside the same `db.$transaction`, it deletes the keys `writes ∪ current problems`
and inserts the current ones — the `PayslipWarning` pattern ("rewritten whole on every recompute")
scoped to a file instead of to a slip. The `writes` half **is** the clearing the card asked for; the
`problems` half makes a *changed* reason replace the old one instead of colliding with it.

- ⛔ **Never a date range.** A range delete discards a still-true problem for a คาบ a narrower export
  simply does not mention — the silent loss `importedInRangeNotInFile` exists to catch.
- 🔴 **`if (!plan.writes.length && !plan.problems.length)`** — both lists. The guard used to test
  `writes` alone, and the measured 064 case (every คาบ a `Pilates Flow` with no price) plans **zero**
  writes, so the persistence would never have run in the one scenario the card exists for.
- 🔴 **Two problems can share one key**, so a **pure** merge runs first (`gymmoProblemRows`): distinct
  labels and distinct reasons joined ` · `. The in-file duplicate rule emits two problems for one
  `sourceKey`, and two rejects sharing all three reader-key cells merge too. Without the merge
  `createMany` throws P2002 and the **whole import aborts** — a file that imported yesterday fails
  every attempt today because one row in it is duplicated.
- ⚠️ **That `createMany` deliberately has NO `skipDuplicates`**, unlike the `ClassSession` one sixty
  lines above it. There the alternative to absorbing a racing import is paying a คาบ twice; here it is
  the opposite — two admins importing overlapping files would both delete-then-insert the same key, and
  a P2002 that rolls the whole import back is the loud outcome. `skipDuplicates` would keep the loser's
  **stale reason** while reporting success, i.e. a money warning that quietly contradicts the คาบ
  beside it. Nothing written is a state the admin can retry; a wrong reason is not.
- 🔴 **A written คาบ is not a paid คาบ — `closedSlipOutcome`.** `runPayroll` refuses to recompute a
  non-draft slip and no screen reopens one, so a คาบ imported into an `approved`/`paid` month is never
  paid by anybody. Every write landing in one of the `closedPeriods` already read inside this
  transaction is therefore turned **back into a problem under the same key** (delete-then-insert, so
  the row is replaced rather than left holding the stale "ยังไม่มีราคาในระบบ" reason), and its reason
  names the period, the status and **card 013 item 2** (`paid → draft`, open with linus) as the way
  out. 🔑 **Keyed by (staffId, period), never by period alone** — `Payslip` is `@@unique([staffId,
  period])`, and an admin approves slips one at a time, so a month routinely holds one trainer's
  `approved` beside another's `draft`. A period-level test would flag every คาบ of that month,
  including ones the next run really will pay, and a false "ยังไม่ถูกจ่าย" is the crying wolf that kills
  the count. 🔴 **And `unchanged` is not `written`**: an `unchanged` write means the คาบ was already in
  `ClassSession`, so a closed slip beside it most likely **paid** it — such a key is reported in
  `leaveAlone` and kept out of the delete set entirely, leaving an earlier import's *true* closed-slip
  row exactly as found and manufacturing nothing. Measured the other way: ธันยา, 08/2026, 24 คาบ, slip
  `paid` at 3,050 ฿ — re-uploading the Jan–Sep workbook in October made August `unchanged: 24` and the
  previous cut wrote 24 rows claiming those คาบ were unpaid, which is the same crying wolf one step
  further on. All four cases and both measured failures are in `closedSlipOutcome`'s doc comment. Measured: ประพัฒน์ (`baseSalary: 0`, `classCredit: 0`), 20 `Pilates Flow` คาบ in 08/2026 ⇒
  8,000 ฿, his whole month — the first cut of this card deleted all twenty problem rows on the very
  import that wrote them and left both `/payslips` counts reading 0.
- **Atomicity direction, deliberately:** if the problem insert fails, no คาบ are written either. คาบ
  written while their problem list failed to persist is the silent-money failure this card closes.
- Two extra set-based statements, so the 5 s interactive budget argument is unchanged. Bind-parameter
  ceiling 65535 ⇒ ~60k keys / ~8k rows; measured scale ~180. No chunking, on purpose.

🔴 **No FK, no `staffId`, no baht.** The referent does not exist *by construction* (the precedent is
`TeachActivity`'s own doc comment), so the row carries display columns instead — and they are not
redundant with the key, whose trainer half is `normalizeTrainer` output and **not a display name**. A
baht figure here would be a second path to an amount (§2 rule 2) and a rate read outside
`PayrollConfig`/`ClassPrice` (§2 rule 3); the ~8,000 ฿ this card quotes can only come from
`computePayslip` over `ClassSession` rows, which by definition do not exist for these keys.

⇒ **The count built on all of this, the exclusion rule that keeps it readable, and every row that has
no clearing path: [class-import-blockers.md](class-import-blockers.md).** Read it before trusting the
number on `/payslips`.
