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

## What 014 deliberately left

- 🔴 **`.docs/knowledge/domain/form-refusals.md` is at 167 lines** against §5's warn at 170 and hard
  cap at 200. This card added to it and did not split it, because a split that happens while a
  money change is in flight makes the money diff unreadable. **The next card to touch that file
  splits it by topic** — and shrinks `sources:` with the split, per §5: a card that moves its prose
  but keeps the parent's whole source list goes `STALE` just as often as before.
- **`/ot`'s one-row `add` action does not validate its date.** `new Date(String(formData.get("date"))
  + "T00:00:00Z")` has no round-trip check, so it carries the same rolled-over-day hazard
  `parseOtPaste` now refuses (`2026-06-31` → `2026-07-01`, that day's OT counted in the next
  month's period). Found by `code-reviewer`. **Pre-existing and a different action**, so it is not
  fixed here — linus is opening its own card.
- **The concurrent-paste `P2002`** is named in `app/ot/page.tsx`'s comments but not tested: it
  needs two sessions and a real database, i.e. `tasks/todo/015-db-test-lane.md`.
- 🔴 **Provenance of `lib/ot-import.ts`: ~140 of its lines were retyped, not written once.** During
  the round-2 fix an in-place `perl -0777 -i -e` one-liner truncated the file to **0 bytes**,
  destroying the uncommitted round-1 work after it had already passed both review lanes. There was
  no stash and no `counter-test.sh save`; recovery was by retyping from a full read held in
  context. What was proved before this shipped: `git diff HEAD` has exactly **26 deletion lines,
  matching the round-1 diff one for one** ⇒ no pre-existing content was lost or altered — and both
  review lanes then re-reviewed the added lines **cold**, forbidden from carrying over round 1.
  `payroll-auditor` re-ran five mutants against a scratch copy and matched every counter-test
  number. The failure mode itself has no rule covering it ⇒
  [075](075-an-in-place-edit-ate-uncommitted-work-and-no-rule-covered-it.md).
- **Three more things the paste screen decides in silence** — duplicate person-day lines collapsing
  with no bullet, `imported` changing meaning, and the `unmatched` heading contradicting its own
  nameless-line bullet ⇒ [077](077-the-paste-screen-stays-quiet-about-three-things-it-decided.md).
  A decimal-comma export paying 20 ฿ short per row is pre-existing and untouched here ⇒
  [076](076-a-decimal-comma-export-pays-twenty-baht-short-in-silence.md).
