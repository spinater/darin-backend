# "✓ Sync เสร็จ" stays green even when every sheet failed to arrive

- status: todo
- commit:

## Goal

Task 009 made an individual sheet whose grid is missing say so — `app/sync/sync-runner.tsx` renders
that row amber with words, not an all-zero counter row. What it did not touch is the aggregate
banner **above** the table: the `card-ok` "✓ Sync เสร็จใน…" header reads as unqualified success
even when every sheet in the run came back `missingGrid` and nothing at all was imported.

A run that imported nothing, announced in green, is the same failure class §2 rule 4 exists to
prevent — the counter staff have no reason to scroll down to a table they have been told is fine.

## Scope

- The aggregate banner qualifies itself when any sheet is missing, and does not claim success when
  all of them are. Route through `uxui-designer` — the wording and the colour ruling are its call.
- Check the same question on the no-JS fallback path (`app/sync/page.tsx`'s `?warn=` banner), which
  after task 009 says how many sheets missed but sits beside no success claim.

## Notes

- Flagged deliberately and out of scope by `uxui-designer` in the task 009 design
  (`.scratch/009-ui-design.md`), then re-flagged by `code-reviewer` in the 009 review so it would
  not be lost when that scratch file goes.
- One edge task 009 also left, worth closing here or in a line of its own: a sheet missing on its
  **first ever** sync has `lastSyncAt = null` and renders `—`, so "never synced" and "missing this
  round" look identical in the sources table.
- Same table, same question: the sources list shows every `SheetSource`, but `syncSources` only
  fetches `where: { active: true }`, and there is **no `active` column on the table at all** — so a
  disabled sheet is silently indistinguishable from an enabled one. Task 009 stopped the disabled
  sheet from being painted amber forever (it had no way to advance its `lastSyncAt`, so it read as
  "missed this round" permanently), but it deliberately added no badge: whether the table should
  show `ปิดใช้งาน` as a state of its own is this card's kind of question, not a predicate fix.
  `payroll-auditor` raised it in the 009 second review; the risk is the familiar one — an amber that
  is always there teaches the counter that amber means nothing, and the next amber is a real sheet
  whose sessions never reached a payslip.
