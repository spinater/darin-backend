# An import problem is loud once and then has no home at all

- status: done
- commit: `c628748` (งาน) · `774a179` (ใบ 066/067 ที่รีวิวใบนี้เปิดขึ้น)
- found by `payroll-auditor` while reviewing [063](../todo/063-import-gymmo-sessions-into-the-database.md) ·
  designed by `architect` (`.scratch/064-architect-design.md`) · implemented by `backend-dev`
- 🔴 **blocks [063](../todo/063-import-gymmo-sessions-into-the-database.md) item 4** (the upload screen).
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
[046](../todo/046-no-screen-can-add-a-class-price-or-a-sheet-source.md)). So on the real system every
`Pilates Flow` คาบ resolves to `ไม่รู้จักคลาส "Pilates Flow" — ยังไม่มีราคาในระบบ`.

ประพัฒน์'s ~20 such คาบ/month become `problem` rows. The admin reads them, closes the page, and the
record is gone. The 09/2026 run then builds his slip from a `ClassSession` table those 20 คาบ never
entered: **~8,000 ฿ of class value absent, `warnings: []` on the slip, nothing in any queue.**

🔑 **The payslip cannot warn about a row that does not exist** — which is exactly why the problem
has to outlive the import. This is the §2 rule 4 silent zero, reached by a path where the engine is
blameless.

---

## The spec — the four answers, decided by `architect` 2026-09-21

`REQUIREMENTS.md` is the client-facing Thai spec of the **sheet** path (§1.5, §4.3) and has no Gymmo
section, so this card **is** the spec artifact for §3's edit order. The full reasoning is
`.scratch/064-architect-design.md`; what is binding is below.

### 1. One queue or two? — **two tables, one screen slot, one blocker function**

Own table `ClassImportProblem`, not a widened `SheetRowRaw`.

- The two sides store **opposite facts**. `SheetRowRaw` + `TeachSession.status = "needs_review"` is
  *a payable row that exists and is flagged*, repaired **in place** at `/sync/review`. A
  `ClassImportProblem` is *a payable row that does not exist*; its repair is upstream (add a
  `ClassPrice`, add a `TrainerAlias`) followed by a **re-upload**.
- Row identity is incompatible: `SheetRowRaw` is `@@unique([sourceId, rowIndex])` with `sourceId` a
  required FK to `SheetSource` (`onDelete: Cascade`). A Gymmo upload has **no `SheetSource`** — a
  merge forces a fake source row per upload or `sourceId String?`, dropping the FK the cascade rests
  on, i.e. a real regression on the working side.
- §2 rule 8 decides it outright: a **new** table touches no existing column, and everything in it is
  **derived** (re-uploading regenerates every row). Widening `TeachSession` puts a one-way
  `db push` on top of `reviewed`/`reviewNote` — a human's decisions, which cannot be regenerated.

**What stays unified is the *meaning*** "this period is not clean": `runBlockers(period)` in
`lib/run-blockers.ts` is its one home, and both numbers render in the same slot on `/payslips` and
`/` as **two labelled numbers, never one total** (a total hides which queue to open).

### 2. Row per problem or row per key? — **row per key, latest reason wins, rewritten per import**

`key String @id`. No `cuid()`. The key *is* the identity — that is what bounds growth and what makes
clearing possible. It holds one of three shapes, all `JSON.stringify` of an array, kept apart by
**arity** so they cannot collide (the decodability argument `gymmoSourceKey` already rests on):

| arity | shape | when |
|---|---|---|
| 4 | `[normTrainer, "YYYY-MM-DD", timeText, rawClassName]` — **byte-identical to `gymmoSourceKey(row)`** | the row reached the planner: trainer or class unmatched, or an in-file duplicate |
| 3 | `[sheetName, rowText, rawWhen]` — the `#` and `Date & Time` cells **verbatim** (`""` when blank) | the reader rejected the row |
| 1 | `[sheetName]` | the reader rejected a whole sheet (no header row) |

🔴 **`rawWhen` is in the reader key because `#` alone is not an identity** (fix round, `payroll-auditor`).
Gymmo's `#` is a per-sheet running number that **restarts in every export**, so `[ชีต, "14"]` names one
คาบ in the August file and a different one in the September file: uploading the second would
`deleteMany` the first file's still-true problem and store an unrelated row's reason under that key —
T3's silent loss reached through a key that is not an identity rather than through a date range. This
is not a re-opening of the decision above; arity-distinguished JSON stays exactly as designed, and the
reader key was made to actually satisfy what that decision already required of it. Fixed while the
table was empty and nothing calls `applyGymmoImport`.

**`kind` has three values, and the third is money.** `"session"` (a real `sourceKey`; an import into an
**open** period clears it) · `"duplicate"` (a real `sourceKey`, but the file holds two rows for it with
different head counts, so an existing `ClassSession` says nothing about the amount ⇒ the count never
excludes it) · `"row"` (the reader never got a `sourceKey`, so **nothing clears it** — see below).

**There is no upsert.** The write is **delete-then-insert over the keys this file mentions** — the
`PayslipWarning` pattern ("rewritten whole on every recompute"), scoped to the file instead of to a
slip. A corrected re-upload therefore cannot leave an old reason behind.

**Two problems sharing one key merge into one row**, by a **pure** function before the write:
`rowLabel` = distinct labels joined ` · `, `reason` = distinct reasons joined ` · `. Nothing is
dropped. This happens for real twice — the in-file duplicate rule pushes two problems for one
`sourceKey`, and two blank-`#` reader rejects on one sheet both key to `[sheet, ""]`.

**No `firstSeenAt`.** Under rewrite-per-key it would be a lie unless the write became an
upsert-per-row, the per-row round trip inside a 5 s interactive transaction that task 063 rejected.
`seenAt` is the honest column: the last import that saw this problem.

🔴 **The table holds NO MONEY, ever.** This card quotes *~8,000 ฿* and storing it would be a
**second path to an amount** (§2 rule 2) and a rate read outside `PayrollConfig`/`ClassPrice`
(§2 rule 3). A baht figure for these คาบ can only come from `computePayslip` over `ClassSession`
rows, which by definition do not exist for any key in this table.

### 3. How a problem stops being a problem — inside `applyGymmoImport`'s existing `$transaction`

Only `applyGymmoImport` writes this table; `previewGymmoImport` stays read-only. After the
`createMany`/`update` block and **still inside the same transaction**, delete the keys
`writes ∪ current problems` and insert the current ones. **Keyed, never a date range** — a range
delete discards a still-true problem for a คาบ a narrower export simply does not mention, the same
silent loss `importedInRangeNotInFile` exists to catch.

Atomicity direction, deliberately: if the problem insert fails the whole import rolls back and no
คาบ are written. คาบ written while their problem list failed to persist is exactly the silent-money
failure this card closes; nothing written is loud and the admin retries.

### 4. The foreign-key inversion, and the growth bound

**No relation, and no `staffId`.** The precedent is `TeachActivity`, whose doc comment already
records that no FK points at it because a constraint would turn a data-quality problem into a throw
on the sync path. Here the referent does not exist *by construction*, so a nullable FK would be a
column null on every row. The row carries the display columns a join would have given — and they are
not redundant with the key, because the key's trainer half is `normalizeTrainer` output, which is
**not a display name**. A later card wanting per-staff attribution resolves `trainerSheet` through
`matchTrainer` at read time (§2 rule 6: one home).

Growth is bounded by **idempotence**, not by a cron: the PK is the key and the write deletes before
it inserts, so uploading the same file a hundred times writes the same rows. ~240 rows/year at the
measured rate; ~2,000 in the pathological case. **No TTL, deliberately** — a job that deletes
unresolved problems after N days is this card's own bug on a timer.

### 5. The count on `/payslips`, and why its exclusion is not the forbidden subtraction

`pendingClassImportInPeriod(period)` filters `OR: [{ date: in period }, { date: null }]` (copied
from `pendingReviewInPeriod`, so an undated row counts in every period), then **excludes keys whose
คาบ is genuinely accounted for**. Excluding at all is right and reachable: delete a `TrainerAlias` at
`/admin/config` and re-upload, and a คาบ that **is** imported and **is** paid becomes a problem again.
Counting it would tell the admin a paid คาบ is missing, and a count that cries wolf is a count nobody
reads.

🔴 **"A `ClassSession` exists" is NOT "this คาบ is accounted for" — the fix round's blocker.** Two
narrowings, both money:

1. **The slip is already closed.** `runPayroll` refuses to recompute a non-draft slip and no screen
   reopens one, so a คาบ imported into an `approved`/`paid` month is never paid by anybody. Measured
   by `payroll-auditor`: ประพัฒน์ (`baseSalary: 0`, `classCredit: 0`), 20 `Pilates Flow` คาบ in 08/2026
   at attended ≥ 3 ⇒ 400 ฿ each ⇒ `classPay = max(0, 8000 − 0) = 8,000 ฿`, his **entire month**. Queue
   them, add the `ClassPrice` in October, re-upload: the first cut reported `created: 20`, deleted all
   twenty problem rows, and left `/payslips?period=2026-08` reading `คาบรอตรวจ 0` **and**
   `คาบนำเข้าไม่ได้ 0`. That is *"reported once and then vanished"* reproduced inside this card's own
   write. ⇒ the **write** side turns such a คาบ back into a problem under the same key
   (`closedSlipOutcome`, reason naming the period, the status and **card 013 item 2**), and the
   **read** side excludes a key only when that คาบ's own slip (`staffId` + period) is absent or still
   `draft` — i.e. only when a recompute can still pick it up.
2. **`kind: "duplicate"`.** The file holds two rows for that key with different head counts, so the
   stored คาบ may be present at the **wrong amount**: stored booked 5 / noShow 3 ⇒ attended 2 ⇒ half of
   400 = **200 ฿**, against the file's booked 9 / noShow 0 ⇒ 400 ฿. Its existence proves nothing, so
   it is never excluded.

🔑 **This is set membership over the key list the first query returned, not the `imported − matched`
subtraction [gymmo-import.md](../../.docs/knowledge/domain/gymmo-import.md) forbids.** The
difference is which set the second query ranges over. That bug had a subtrahend (`matched`, no date
filter) that was **not a subset** of the minuend (`imported`, range-confined), so twelve out-of-range
rows cancelled twelve in-range orphans. Here the second query is `sourceKey: { in: keys }` — keyed by
the first query's **own output** — so the excluded set is a subset of the counted set by
construction and a row outside the period cannot exist in it, let alone cancel one inside it. The
row is still stored and still visible on `/classes`, so the file/database disagreement is not hidden,
only kept out of the blocker count.

---

## 🔴 What this card leaves permanent, and why task 066 has to answer

The design's §6(a) — *may a human dismiss a problem* — is **linus's**, opened as
[066](../todo-human/066-may-a-human-dismiss-an-import-problem.md). The stated default is
implemented: **there is no dismissal**, and the only clearing is a clean import. The price:

| Symptom | Consequence under the default |
|---|---|
| 🔴 **any** reader reject (`kind: "row"`) | **never clears at all — not even by fixing the file.** The reject is keyed `[ชีต, #, วันเวลา]` (arity 3) while the same คาบ, once it parses, is written under a 4-tuple `sourceKey`, so no `deleteMany` can ever match it: the row survives its own repair. ⇒ card 066's dismissal is its **only** exit, and no comment, card or screen may say a re-upload makes it disappear |
| a reader reject whose **date** was the unreadable part (`date: null`) | counted in **every** period, on top of the above. Narrowed in the fix round to the smallest possible set — `lib/gymmo.ts` now carries the date on all three rejects that happen *after* `parseGymmoWhen` succeeded, since a dated August reject blocking October for ever is what teaches an admin to ignore the count |
| a คาบ written into a period whose slip is **closed** | stays listed with a "slip already closed" reason until somebody reopens the slip — the policy half is **013 item 2**, open with linus |
| an orphaned key — a re-export that renumbers rows, or an edit to `normalizeTrainer` | **never clears at all**; no import can match it |

⇒ a blocker count that is stuck at a constant is a count people learn to ignore, which costs the
whole gate its meaning. That is the reason 066 needs an answer, and it is why nothing here is
auto-deleted in the meantime (silent deletion is the failure this card closes).

⚠️ **Changing `normalizeTrainer` now re-keys TWO tables** — `ClassSession.sourceKey` and this one.
Recorded in [class-import-queue.md](../../.docs/knowledge/domain/class-import-queue.md).

## 🔴 A residual that is card 013's, not this one's — named so nobody re-derives it as a 064 bug

A คาบ imported into a slip that is **`draft` at import time** and is then **approved without a
recompute** is unpaid, with **no record anywhere**. The import read `draft`, was correct at the time, and
therefore recorded nothing; `runPayroll` never ran again; the approval moved the slip past the point
where it ever would. 064 cannot see it — its inputs are the file and the slip's status *now*.

That is the **stale-draft hole**, and it belongs to
[013](../todo/013-payslip-lifecycle-integrity.md): approving a slip is the moment something has to notice that
its inputs changed since it was computed. Found by `payroll-auditor` on this card's fix round.

## Out of scope, named so nobody re-derives it

- **`/classes` rendering the queue** is [065](../todo/065-deleting-an-imported-class-session-is-undone-by-the-next-import.md).
  Until it lands, the `/payslips` warning links to a screen that does **not** yet list the rows —
  the count is honest, the destination is incomplete. ⇒ **065 must land before
  [063](../todo/063-import-gymmo-sessions-into-the-database.md) item 4**, or the first admin to follow that
  link learns the count lies, and a count people ignore is worse than no count.
- **`listClassImportProblems()` has no caller.** It was written for 065's screen, which does not
  exist, so it ships **unused and unexercised** — its `orderBy` tie-break has never run. That is
  deliberate (the design asked for the read side with the table), and it is written down here so a
  later reader does not mistake it for something that has been proven to work. If 065 wants a
  different shape, rewrite it freely — nothing depends on it.
- **The upload screen** is [063](../todo/063-import-gymmo-sessions-into-the-database.md) item 4, still
  blocked. Nothing calls `applyGymmoImport` yet, so nothing writes this table on the live system.
- **`/classes` writing `sourceKey` for a hand-keyed คาบ** (design §6b) — the better answer to 066,
  recommended not decided.
- **A `PayslipWarning` naming the missing คาบ** (design §6c) — the strongest §2 rule 4 answer. It
  changes `computePayslip`'s input contract, so it needs linus and `payroll-auditor`. A later card.
- **`.docs/knowledge/domain/class-import-queue.md` was split at creation**, into that card (the table,
  the three key shapes, the write) and **`class-import-blockers.md`** (the `/payslips` count, the
  exclusion rule, everything with no clearing path) — 140 + 88. It had reached **195/200** in one round
  with the widest `sources:` list in the repo, and card 065 must touch both halves, so splitting then
  would have happened under pressure beside a new screen or breached the cap. `sources:` shrank with the
  prose per §5: the queue card dropped `app/page.tsx`, the blockers card dropped
  `prisma/schema.prisma`. Free now, expensive in 065.
- **`lib/gymmo-import-run.ts` was split in the fix round** (not deferred): it reached 482 lines, past
  the 450 warn, so the problem queue's db half moved to **`lib/class-problems-run.ts`**
  (`ClassImportProblemView` · `listClassImportProblems` · `pendingClassImportInPeriod` ·
  `readClosedByStaff`) — 342 + 162. That follows this repo's own pure/`-run` convention rather than §4's
  barrel pattern **on purpose**: a barrel through `lib/class-problems.ts` would re-export `./db` and
  break the purity `lib/gymmo-import.ts` and every `bun test` depend on. The documented "all
  `db.classImportProblem` access lives in one file" boundary moved with the code, to a better home.
- **Splitting `prisma/schema.prisma`** (design §6d) — plan only. It lands at **400** of the 500 ceiling
  with the 450 warn in sight, and a `.prisma` file has no sub-module pattern in §4's table. Prisma
  7's `prismaSchemaFolder` (`prisma/schema/*.prisma`) is the real answer and it moves the generator
  invocation and `prisma validate` in `scripts/check-code.sh` ⇒ its own card, not this one.
- **Retention** (design §6e) — nothing is auto-deleted. A purge is a card of its own with the
  silent-loss risk named in it.

## §2 rule 8 — what is lost if the push is wrong

**One new table, no existing column touched.** A wrong shape is fixed by a second `prisma db push`
that **drops `ClassImportProblem` and every reason in it**. Those rows are derived **from the export
file, which must therefore be kept** — ⚠️ nothing in this system archives an upload today (ใบ 063 item
4 has not built the screen, let alone a store), so "just re-upload" assumes a human still has the
`.xlsx`. On that assumption the loss is a re-upload, not money; without it the reasons are gone. No `ClassSession`,
`TeachSession`, `Payslip` or `PayslipWarning` row is at risk from this change.

⛔ Back up before any push against a database holding real data, from inside the container:
`docker compose -p darin-local exec -T db pg_dump … > .scratch/pre-064.sql` — never `/tmp` (§6 rule 5).
The one irreversible thing in this area is unrelated and already true: `ClassSession.sourceKey`.

## Done when

- A problem survives the request that found it, and is still readable on the next login.
- A key that later imports cleanly **stops** being a problem, with no manual step.
- `/payslips` names the count, so a run cannot look complete while คาบ are missing.
