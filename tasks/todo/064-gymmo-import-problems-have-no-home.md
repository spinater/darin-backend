# An import problem is loud once and then has no home at all

- status: todo
- commit:
- found by `payroll-auditor` while reviewing [063](063-import-gymmo-sessions-into-the-database.md) ·
  needs `architect` for the table shape **before** `backend-dev`
- 🔴 **blocks [063](063-import-gymmo-sessions-into-the-database.md) item 4** (the upload screen).
  Today nothing can import, so this hole is harmless; **the hour the upload screen lands it goes live
  and silent**. That is the whole reason this was allowed to be deferred rather than fixed inline.

## Goal

§2 rule 6: *"Rows that cannot be matched go to **the review queue** with a reason, and the payroll
run still completes."* The Google-Sheet path honours that with **persisted** state — `SheetRowRaw`
plus `TeachSession.status: "needs_review"`, counted by `pendingReviewInPeriod`.

`GymmoProblem[]` is persisted **nowhere**. It is returned by a pure function, carried through
`GymmoImportPreview`, and ceases to exist when the request ends. There is no `ClassSession`-side
equivalent of `NEEDS_ATTENTION`.

Task 063 landed the interim minimum — `applyGymmoImport` returns `plan.problems` so the post-write
screen cannot lose them. That is a screen that shows them **once**, not a queue.

## Why this is a money bug, not a UX one

`Pilates Flow` is one of the five prices task 063 adds, and seed **withholds** it on the live
database while `ClassPrice` still has no add screen (task
[046](046-no-screen-can-add-a-class-price-or-a-sheet-source.md)). So on the real system every
`Pilates Flow` คาบ resolves to `ไม่รู้จักคลาส "Pilates Flow" — ยังไม่มีราคาในระบบ`.

ประพัฒน์'s ~20 such คาบ/month become `problem` rows. The admin reads them, closes the page, and the
record is gone. The 09/2026 run then builds his slip from a `ClassSession` table those 20 คาบ never
entered: **~8,000 ฿ of class value absent, `warnings: []` on the slip, nothing in any queue.**

🔑 **The payslip cannot warn about a row that does not exist** — which is exactly why the problem
has to outlive the import. This is the §2 rule 4 silent zero, reached by a path where the engine is
blameless.

## Shape to decide (`architect`)

A table keyed by `sourceKey` holding `where` · `reason` · `importedAt`, **cleared for a key the
moment that key writes successfully**, and counted on `/payslips` beside `pendingReviewInPeriod`.

Open questions for the architect, not for whoever implements:

1. Is a row per problem right, or a row per `sourceKey` with the latest reason? A re-upload of a
   corrected file must not leave the old reason behind.
2. `ClassSession` cannot hold it — the row does not exist yet. So this table is keyed by a
   `sourceKey` that has **no** `ClassSession`, which is the opposite of a foreign key.
3. Does it belong beside `SheetRowRaw` as one review queue with two sources, or as its own table?
   §4 says one decision, one home — two queues on two screens is the thing to argue about first.

## Done when

- A problem survives the request that found it, and is still readable on the next login.
- A key that later imports cleanly **stops** being a problem, with no manual step.
- `/payslips` names the count, so a run cannot look complete while คาบ are missing.
