# Deleting an imported คาบ is undone by the next import — so the fix for a duplicate re-creates it

- status: done
- commit: 5d394fc
- found by `payroll-auditor` while reviewing [063](../todo/063-import-gymmo-sessions-into-the-database.md) ·
  `backend-dev` + `frontend-dev`
- 🔴 **blocks [063](../todo/063-import-gymmo-sessions-into-the-database.md) item 4** (the upload screen), and
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
*plus* a re-created imported row on the next upload: **200 + 200 = 400 ฿ for one 200 ฿ คาบ** once
Gymmo is also corrected. <!-- corrected while closing: this line said 400 + 400 = 800 about the same
4 Aug Core Strength the card prices at 200 ฿ eighteen lines above. `payroll-auditor` found the wrong
figure propagated into six files from here. §1.4's price table is the authority: Core Strength 200,
Aqua Fit / Body Pump / Body Combat 400. -->

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

---

## What landed

Both halves plus the warning, and **six review rounds** (`code-reviewer` ×2 → PASS ·
`payroll-auditor` ×4 → APPROVE-WITH-NITS). The fix rounds are most of the value of this card, so
they are written up below rather than summarised away.

| Piece | Where |
|---|---|
| provenance on `/classes` | `app/classes/_components/session-table.tsx` — a `ที่มา` column reading `คีย์เอง` / `นำเข้าจาก Gymmo · <เวลา> · <ชื่อคลาสในไฟล์>` |
| delete refused for an imported row | `del` in `app/classes/page.tsx` re-reads `sourceKey` and refuses unless the post carries `confirm=imported`; `?err=imported` · `?err=gone` |
| the problem queue on screen | `app/classes/_components/import-problems.tsx` + `listClassImportProblems` |
| one exit per `(kind, state)` | **`lib/class-problems-copy.ts`** (new, pure, pinned at **7**) |
| three-valued state, one home | `readProblemStates` + `problemIsCleared` in `lib/class-problems-run.ts` / `lib/class-problems-copy.ts` |
| preview: list, not count | **`lib/gymmo-hand-keyed.ts`** (new, pure, pinned at **5**) + `readHandKeyedSignal` |
| the ใบ 025 warning branches on provenance | `lib/payroll.ts` · `ClassSessionInput.sourceKey` · `lib/payroll-run.ts` passes it |
| the key's inverse | `decodeGymmoSourceKey` beside `gymmoSourceKey` in `lib/gymmo-import.ts` |

Pins: `lib/payroll/class.test.ts` **6 → 7** · `lib/gymmo-import.test.ts` **22 → 24** ·
new `lib/gymmo-hand-keyed.test.ts` **5** · new `lib/class-problems-copy.test.ts` **7**.
**No pin was lowered.** `bash scripts/verify.sh` → `ALL GREEN`, 210 tests.

### "Done when", honestly

1. ✅ An imported คาบ cannot be deleted in a way the next import silently undoes — **as a default,
   not a prohibition.** Round 4 found the refusal was unconditional while its justification is not:
   `diffGymmoPlan` re-creates a key **the file still carries**, so a คาบ whose clock was corrected in
   Gymmo is *orphaned*, and `del` here is the repo's only `classSession.delete` ⇒ refusing outright
   left it unrepairable anywhere (ธันยา's August 8,050 → 8,250 ⇒ `classPay` **3,050 → 3,250 ฿ every
   run**). It is now a second, explicit post from a disclosure that states the condition.
2. ⚠️ The confirm screen names the rows — **produced, not rendered.** `handKeyedMatches` and
   `handKeyedUnmatchedInRange` have no consumer because the upload screen is ใบ 063 item 4, which
   this card blocks. The contract, including the exact Thai for the residual, is in
   `lib/gymmo-import-run.ts`'s doc comment; **063 item 4 cannot ship without rendering both.**
3. ✅ The ใบ 025 warning no longer sends the reader down the doubling path — and after round 5 it
   states the forbidden action **conditionally**, because an unconditional *ห้ามลบ* forbids the only
   exit for an orphaned row and leaves a red warning on the slip that nobody can ever clear.

### The six rounds, because the same defect got through three of them

| Round | Found | Cost if shipped |
|---|---|---|
| 1 (both lanes) | `accountedFor` was a **boolean** over a three-state world: a คาบ in the database on a closed slip read as *"ไม่มีอยู่ในฐานข้อมูล"* with *"นำเข้าซ้ำ"* as the exit — which `leaveAlone` guarantees will not clear it | ประพัฒน์'s **8,000 ฿** keyed in again by hand |
| 2 | the same shape through `kind: "duplicate"`, whose คาบ may exist at the **wrong head count** | **600 ฿** on one 400 ฿ Aqua Fit |
| 3 | the count keyed the rule on `(kind, state)` while the screen keyed it on `state` — so that row was **counted as blocking and displayed as resolved**, and round 2's copy became dead code under a green pin | a period reading *"1 คาบ"* on `/payslips` and **`ไม่มีแถวค้าง`** on the screen it links to |
| 4 | the delete refusal was unconditional; its justification is not | **200 ฿/month for ever**, unrepairable |
| 5 | the two-step delete asks the admin to choose between two rows that render **byte-identically** — `ClassSession` has no clock | 50/50, and the wrong half returns next upload **with a two-click confirmation saying it was fixed** |
| 6 | — | APPROVE-WITH-NITS |

🔑 **The lesson, and the reason `lib/class-problems-copy.ts` exists.** Every one of rounds 1–3 was
the *same* defect: an instruction decided from **less state than the decision needs**. It survived
three rounds because it lived in a `.tsx` string, where no gate in this repo can see it. Moving the
`(kind, state) → text` grid into a pure module made it pinnable at all; one arm now walks every cell.
Round 3 is the sharpest form of the warning: **the round-2 fix was simultaneously pinned and
unreachable**, so the gate was green over a string no screen could print.

### Decisions taken here that are worth a second pair of eyes

- **`"closedSlip"` cannot tell "never paid" from "already paid, stale row"**, and I did **not** add a
  fourth `kind` to separate them: `pendingClassImportInPeriod`'s exclusion is keyed on `kind`, so a
  new value silently changes the blocker count — which is exactly the fragility round 3 exposed.
  Instead the exit carries the caveat for every row it covers: a recompute reads **today's** config,
  so Core Strength 200 → 250 turns a 3,050 ฿ transfer into a 3,150 ฿ slip with nothing recording the
  gap. Separating them properly is a card of its own.
- **`gymmoHandKeyedMatches` matches on `(UTC day, staffId, classId)`** — a duplicate *heuristic*,
  never an import key (ใบ 063's ⛔). It is **narrower** than the count it replaced, so the residual
  `handKeyedUnmatchedInRange` is reported beside it: a คาบ on ธันยา's sheet keyed by hand under
  ประพัฒน์, who actually taught it, misses the triple — 200 ฿ twice, one on each of two slips.
- **`app/classes/page.tsx` keeps both server actions**; only the two tables moved to `_components/`,
  so `money-input-guards.md`'s claims about that file's guards stay where they are.

### 🔴 The price I got wrong, recorded because it outlived its own correction

This card said **400 + 400 = 800 ฿ for one 400 ฿ คาบ** about the same 4 Aug Core Strength it prices
at 200 ฿ eighteen lines earlier. I propagated the wrong half into **six files**. §1.4's price table
and `prisma/seed.ts` are the authority — Core Strength is **200**; 400 is Aqua Fit / Body Pump /
Body Combat. All corrected, and the card's own line is fixed above with a note. *A worked example
that disagrees with the price table it cites stops being evidence the next time anyone checks it.*

### What is NOT closed, and where it went

- **An orphaned `kind: "session"` queue row.** Fix a class-name typo **in the file** and re-upload:
  the คาบ imports cleanly and is paid, but `applyGymmoImport`'s `deleteMany` only touches keys *this
  parse* carries, so the old row survives saying `ยังไม่อยู่ในฐาน` — on the same page as the hand-key
  form ⇒ **200 + 200 for one 200 ฿ คาบ**, `warnings: []`. It needs a decision, not an edit (both
  shapes change what the blocker count counts), so the measured case is now a section of
  [066](../todo-human/066-may-a-human-dismiss-an-import-problem.md), whose three questions it sharpens.
- **`/classes` has no closed-period awareness at all** — a hand-keyed คาบ can be added or deleted
  inside a `paid` period with no banner. Pre-existing, not introduced here; `del`'s new read-back is
  where that check would go.
- **`del`'s `confirm` guard has no pin** — a server action, so it is in the same reviewed-not-pinned
  zone as `applyGymmoImport`'s transaction ([015](../todo/015-db-test-lane.md)).
- **Three knowledge cards and one module are in the warn band**, all pushed there by these six
  rounds: [068](../todo/068-three-cards-in-the-warn-band-split-them.md).
- The eight-column problem table has never had a `uxui-designer` pass — both lanes said so and
  neither gated on it. Worth `/design-review` on `/classes` before an admin sees it.
