# An OT import that fails halfway leaves the screen showing the old data

- status: todo
- commit:

## Goal

`app/ot/page.tsx`'s paste action writes rows in a loop. Task 009 made the failure *visible* — the
action now returns a Thai error and the unmatched usernames survive the throw — but three structural
problems remain, all deliberately left as pre-009 behaviour (3 was added by the third review round):

1. **The loop is not a transaction.** A row whose date or hours is unparseable (the gap documented
   in `lib/ot-import.ts`) throws partway through, and the rows before it stay committed. The
   operator fixes the bad row and re-pastes, and whether that double-writes depends on the upsert
   key rather than on anything deliberate.
2. ~~`revalidatePath("/ot")` sits after the loop.~~ **Closed by 009's fix pass** — it now runs
   after the try/catch, so the table reflects what actually landed even on a failure.

3. **A line with a valid username and date but an *empty hours cell* lands in no bucket at all.**
   `lib/ot-import.ts:83` — `if (!user || !date || !hours) continue;` — drops it before the username
   lookup, so it is not in `rows`, not in `unmatched`, not in `invalidHours`. A fingerprint export
   writes exactly that shape for a day someone did not scan out, so a 220-line paste reports
   **"นำเข้าแล้ว 219 รายการ"** with zero warnings while that person's OT is short — §2 rule 4, and
   invisible by construction.
   The doc comment defends the skip as "the blank line at the end of every paste, and a header row".
   That is true of those two and false of this third case the same condition catches: a wholly empty
   line has no username either, and a header row fails the username lookup. ⇒ the fix is to skip
   only what has **no username and no date**, and route a missing hours field into `invalidHours`
   like any other unusable hours value. Carried over verbatim from pre-009 code, which is why task
   009 left it here.

## Scope

- Wrap the write loop in one `db.$transaction` so an OT import is all-or-nothing, **or** move
  `revalidatePath` into a `finally` if partial-import-with-an-honest-screen is the wanted behaviour.
  Prefer the transaction: §2 rule 4's whole point is that money must not move without being seen.
- Watch the 5 s interactive-transaction timeout — a 110-row paste (5 staff × 22 days) is realistic.
  If that is tight, batch with `createMany`/`upsert` rather than raising the timeout.
- Narrow the skip condition in `parseOtPaste` (item 3) and raise the `lib/ot-import.test.ts` pin in
  the same change (§7) — the empty-hours line needs its own case, and the blank/header lines need
  one proving they are still skipped.

## Notes

- Found by `uxui-designer` (task 009 design review, finding 3) and `payroll-auditor` (finding 3a);
  item 3 by `payroll-auditor` in the third round, where it was explicitly ruled out of 009's scope
  as pre-existing.
- Worked example from the audit: a 110-row July paste with one non-ISO date throws at row ~85;
  84 rows commit, the screen shows the error, the table below still shows June.
