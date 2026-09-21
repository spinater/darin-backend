# Deleting an imported คาบ is undone by the next import — so the fix for a duplicate re-creates it

- status: todo
- commit:
- found by `payroll-auditor` while reviewing [063](063-import-gymmo-sessions-into-the-database.md) ·
  `backend-dev` + `frontend-dev`
- 🔴 **blocks [063](063-import-gymmo-sessions-into-the-database.md) item 4** (the upload screen), and
  **must land before it, not merely with it** — task 064's count on `/payslips` links here for the
  per-row reasons, and until this card lands that link goes to a screen that shows none of them.
  Today nothing can import, so this trap cannot be walked into; **it arms itself the hour that screen
  lands**, and the task 025 warning text points straight at it.

## Goal

`/classes` does not `select` `sourceKey`, so the table cannot show which คาบ came from a Gymmo file,
and `del` deletes by `id` with **no tombstone**. A deleted `sourceKey` is therefore a `sourceKey`
the next import has never seen.

## The trap, in baht

ธันยา's 4 Aug 18:00 Core Strength was keyed by hand at `/classes` (200 ฿) before the import; the
file adds it again.

1. The admin finds the pair on `/classes` and deletes the **imported** row — the correct action.
   The slip is now right.
2. Next month the same Jan–Sep file is re-uploaded. That `sourceKey` is no longer in the table, so
   `diffGymmoPlan` classifies it `create` and the row **comes back**.
3. Both rows again ⇒ `classValue` +200 ฿. ธันยา is above the 5,000 credit, so that is **200 ฿ paid
   twice, every month the file is re-uploaded.**

🔴 **The task 025 warning routes the reader straight into this trap by name.** Its text says
`ลบคาบนี้แล้วคีย์ใหม่ที่หน้าคาบสอนคลาส Group` — for an imported row that yields a hand-keyed row
*plus* a re-created imported row on the next upload: **400 + 400 = 800 ฿ for one 400 ฿ คาบ** once
Gymmo is also corrected.

## Two halves

**Screen** — render `sourceKey != null` on `/classes` as `นำเข้าจาก Gymmo`, and replace delete for
those rows with `แก้ที่ Gymmo แล้วนำเข้าใหม่`. A row whose source of truth is another system must
not offer an edit that the next sync silently reverts (§2 rule 6).

**Preview** — task 063's `handKeyedInRange` is a bare **count** over the whole `[min, max]` day span
of the plan (nine months for a Jan–Sep upload). A count of 12 among 400+ new คาบ is true and
unactionable. Replace it with the hand-keyed rows that match a planned write on
`(date, staffId, classId)` — **listed, not counted**.

## 🔴 Two constraints inherited from task 064, which this card is the first to render

**1. Render every `kind: "session"` row through `readClosedByStaff`, and never print the stored
`reason` raw.** A closed-slip problem row stops being **counted** the moment the slip is reopened (the
count re-checks live), but **nothing deletes the stored row** — `deleteMany` runs only inside
`applyGymmoImport`, i.e. on the next upload. So after a reopen-and-recompute the row survives carrying
`"…ยังไม่ถูกจ่าย"` about a คาบ that has just been paid. Printed raw, that is **a screen asserting paid
money is unpaid** — the opposite direction of §2 rule 4, and precisely the false alarm that kills the
blocker count ([class-import-blockers.md](../../.docs/knowledge/domain/class-import-blockers.md)).

**2. The queue's reads live in `lib/class-problems-run.ts`** (`listClassImportProblems`), and no page may
query `db.classImportProblem` directly — the §4 one-home boundary for that model. A `kind: "row"` row has
**no clearing path at all**, so the screen must not tell anyone a re-upload will remove it (card 066).

## Done when

- An imported คาบ cannot be deleted from `/classes` in a way the next import silently undoes.
- The confirm screen names the specific hand-keyed rows a file is about to duplicate, not how many.
- The task 025 warning text no longer sends the reader down a path that doubles the row.
