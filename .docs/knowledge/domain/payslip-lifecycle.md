---
sources:
  # The run loop itself: the non-draft guard read *inside* the transaction, the
  # `updateMany … where status: "draft"` that re-checks the predicate, and `staffInPeriodWhere`'s
  # six arms. Re-widening any of those must land here as STALE.
  - lib/payroll-run.ts
  # The pin that keeps the two task-013 decisions honest *as predicates* — the refusal wording, the
  # refuse-by-default shape, and the six-arm staff scope including the leaver arms.
  - lib/payroll-run.test.ts
  # `PayslipWarning` is a table with `@@unique([payslipId, seq])` and `onDelete: Cascade`, and
  # `Payslip` carries the `@@unique([staffId, period])` the concurrent create loses on. Turning
  # either into something else must land here, not pass under a card still describing a table.
  - prisma/schema.prisma
  # The other half of the lock: `setStatus` writing only when the row still holds the status it was
  # rendered for, plus the state-derived `closedCount` box and the `— (ไม่ได้คำนวณใหม่)` marker
  # that are the only things telling the admin a slip was not recomputed.
  - app/payslips/page.tsx
  # The other screen the "rendered above the amounts, never collapsed" promise covers — moving
  # `WarningCard` below the totals or into a `<details>` would silence a warning the engine
  # produced, which is §2 rule 4's most expensive failure, with no card going STALE.
  - app/payslips/[id]/page.tsx
---

# วงจรชีวิตของสลิป — ล็อกสถานะ · ใครเข้ารอบ · อะไรถูกคิดใหม่

Split out of [payroll-rules.md](payroll-rules.md) at task 023, which had reached 198/200 lines.
That card is the **engine**: the formulas, and the invariants `computePayslip` must hold. This card
is the **run loop around it** — how a warning survives to the database, how `Payslip.status` is made
an actual lock, who a run selects, and what a recompute rebuilds. Read **both** before changing
`lib/payroll-run.ts` **or either payslip screen**. The teach-rate lookup itself moved to
[teach-rate-lookup.md](teach-rate-lookup.md) at task 039. This card never restates
[payroll-rules.md](payroll-rules.md) rule 4 (*round once*) or its screen half,
[money-on-screen.md](money-on-screen.md) (*no screen computes money*), and a
screen that re-derives a total obeys that rule or breaks money whatever this card says. A rule
broken here is broken money just as surely as a wrong formula.

## How a warning is kept true end-to-end (task 009)

**The invariant this serves is [payroll-rules.md](payroll-rules.md) rule 3** — what the engine
cannot decide goes into `warnings`, never silently to zero. Until 009, `runPayroll` destructured `warnings`
out and dropped it — the invariant held inside the engine and was violated one line later:
- **`PayslipWarning`** (`prisma/schema.prisma`) persists them: `payslipId` + `seq` + `message`,
  `@@unique([payslipId, seq])`, `onDelete: Cascade`. `seq` is the engine's emission order,
  because a table has no implicit one.
- **A table, not a `String[]` column** — §2 rule 8. Adding a `sourceKind`/`sourceId` later is an
  additive nullable column on a table, but on a `String[]` it means a drop +
  `--accept-data-loss`, and warnings on `approved`/`paid` slips are **not recomputable**.
- **Written in the same transaction as the lines**, one interactive `$transaction` **per staff
  member** (never one around the loop — the 5 s timeout would roll back the whole period), in
  the order upsert → `deleteMany` lines → `deleteMany` warnings → `createMany` both. Not a
  nested write: Prisma does not guarantee a nested `deleteMany` runs before a nested
  `createMany`.
- **Rewritten wholesale on every recompute**, exactly like `PayslipLine`. Dropping the unique
  "because the insert is failing" converts a loud error into duplicated warnings.
- 🔴 **Not recomputable once the slip leaves `draft`** — `runPayroll` refuses non-draft slips,
  so whatever warnings a slip carries at approval time are final. **Task 013 made `status` an
  actual lock**, which took two changes and not one: the status is read **inside** the
  `$transaction` that writes (`nonDraftSkipReason` on a `tx.payslip.findUnique`), *and* the write
  is **conditional on the status that read saw** —
  `tx.payslip.updateMany({ where: { staffId, period, status: "draft" }, data: totals })`, with
  `count === 0` meaning an approval landed mid-run ⇒ refuse with `RACED_SKIP_REASON`
  (`สลิปเปลี่ยนสถานะระหว่างคิดเงิน ไม่คำนวณทับ`, deliberately worded apart from the ordinary
  already-closed refusal). **The read alone is not enough**: under READ COMMITTED it only sees
  what was committed at that statement, so an approval committing between read and write would
  still have won — the `WHERE status = 'draft'` is what re-checks the predicate against the
  committed row. `status: "draft"` is gone from the update payload; it was the line that pushed
  an approved or paid slip back to draft. The no-slip-yet case is a plain `create`, so a
  concurrent create loses on `@@unique([staffId, period])` and **throws** — loud on purpose.
  **The other half of the same lock is `setStatus` on `app/payslips/page.tsx`**: the form submits
  the status its row was *rendered* for and the action updates only if the row still holds it
  (`updateMany … where: { id, status: was }`, `count === 0` ⇒ write nothing, `?err=stale`). Without
  it the reverse interleaving stands — a recompute commits first, the approval lands second, and
  the slip closes at a figure the approver never saw. A lock that only one side honours is not one.
  ⚠️ **Neither skip reason reaches a screen today** — `runPayroll` returns them in `skipped` and
  the `compute` action discards its return value. What tells the admin is state-derived, by
  design (009 removed the event banner): the `closedCount` box and the `— (ไม่ได้คำนวณใหม่)`
  marker. Rendering the run's own refusals is carded separately.
- **Deliberately not a workflow**: no `severity`, no `acknowledgedAt`/`resolvedBy`, no
  `/admin/warnings` inbox. This is a display of what the engine could not decide, not a
  decision. Do not add one without a card that says why.

## Who a run selects, and what a recompute rebuilds (task 013)

- **A deactivated staff member is warned about, never zeroed or skipped (task 013).** Who a run
  selects is `staffInPeriodWhere(period)`, a six-arm `OR`, each arm one way the period can still
  be owed: `active: true` · `payslips: { some: { period } }` · and four **leaver arms** for
  payable work dated inside the period — `teachSessions` (`status: "ok"`), `classSessions`,
  `attributions` (by `sale.date`) and `otEntries`. 🔴 **The leaver arms are the whole point.**
  Variable pay is computed after the month closes (`darin-payroll-system.md` §6), so the ordinary
  case — resigns 20 July, deactivated that day, run on 3 August — has *no slip yet*: under
  `{ active: true }` alone that person matched nothing and their month vanished with no slip, no
  warning, no `skipped` entry and no review-queue row. A slip that exists is recomputed rather
  than left stale in "รวมทั้งงวด"; a non-draft one is still refused by the guard above.
- 🔴 **A recompute rebuilds the slip from *today's* `Staff` row, not from the period.** `base`,
  `classCredit`, `rank` and `role` are read live, so an edit in `/admin/config` between two runs
  changes a past period's draft slip. **Nothing is pro-rated for anybody** — a leaver's slip
  carries a full period of `baseSalary` whether they worked one day of it or twenty. That is a
  policy question for the owner, not the engine's to answer: `StaffInput.active` exists for
  **one** purpose, pushing `พนักงานถูกปิดการใช้งานแล้ว แต่ยังมีงวดนี้ค้างอยู่ — ฐานเงินเดือนคิดเต็มงวด
  ไม่ได้หารตามสัดส่วนวันที่ทำงานจริง ⇒ ตรวจยอดก่อนอนุมัติ` onto `warnings`. It moves **no amount**:
  paying 0 "because they are inactive" is the silent zero [payroll-rules.md](payroll-rules.md)
  rule 3 forbids, and inventing a daily rate is a literal in a formula
  ([payroll-rules.md](payroll-rules.md) rule 1). **No new UI** —
  it rides 009's surface
  (`PayslipWarning` → count column + banner on `/payslips` → `WarningCard`).

⚠️ **ใบ 065 added one field to what the run hands the engine** — `classSessions[].sourceKey`, read
straight off the row. It selects the repair the ใบ 025 class warning names and **moves no amount**;
see [payroll-rules.md](payroll-rules.md) rule 3. Nothing about who a run selects, what it locks or
what a recompute rebuilds changed.

## Where a warning is shown — and what is not a `PayslipWarning`

- **Rendered above the amounts** on both payslip screens, never below, and never collapsed —
  `app/admin/config/page.tsx` already promises the user in Thai that unmatched work
  "ขึ้นเตือนในสลิป".
- The same shape elsewhere has **different lifetimes and therefore different homes**: the OT
  paste's rejected lines live one submission (returned by the action, `lib/ot-import.ts` —
  `unmatched` for a username nobody has, `invalidHours` for an hours field that is not a usable
  number), and a sheet whose grid did not arrive lives one sync run (`SyncResult.missingGrid`).
  Neither belongs in `PayslipWarning`.
- **`SeedMark` (task 040) is not part of this lifecycle at all.** One row, written last by
  `prisma/seed.ts` to record that this database's reference fixture has been planted or adopted.
  It holds **no money and no payslip state**, and nothing on the run path reads it — it is named
  here only so a new table in `prisma/schema.prisma` is not mistaken for something a slip depends
  on. What it governs is [../ops/deploy.md](../ops/deploy.md).
- **`ClassSession.sourceKey` (task 063) is not part of this lifecycle either.** It is the identity of
  one row of one Gymmo export, `@unique` so a second import cannot pay the same คาบ twice. A run
  reads `ClassSession` exactly as before — through `include: { class: true }`, with no regard for how
  the row arrived — and `null` (a คาบ keyed by hand) is ordinary. The one thing to know before
  writing `ClassSession` from anywhere new: a null is exempt from `@unique`, so a hand-keyed row and
  an imported one **can both exist for the same session and the slip pays both**.
  See [gymmo-import.md](gymmo-import.md).
- 🔴 **A run can look complete while คาบ are missing, and no `PayslipWarning` can say so** (task 064).
  Every warning on a slip is produced by `computePayslip` from the rows it was handed, so a คาบ that
  **never entered `ClassSession`** — a Gymmo row whose class has no price or whose trainer is
  unmatched — is invisible to the whole mechanism above: the slip is short and `warnings` is `[]`.
  That is why the refusal is persisted outside the slip, in `ClassImportProblem`, and counted **before**
  the run on `/payslips` beside `pendingReviewInPeriod` (`runBlockers`, `lib/run-blockers.ts`).
  ⇒ an empty `warnings` list means "the engine decided everything it was given", never "nothing is
  missing". `ClassImportProblem` is **not** payslip state and holds no money —
  [class-import-queue.md](class-import-queue.md) · the count is [class-import-blockers.md](class-import-blockers.md). Making the slip itself warn would change
  `computePayslip`'s input contract and is a later card (design §6c).

⚠️ **A third box sits above the run button since ใบ 043**, and it is not a queue: สีพื้นในชีตที่ยังไม่มีกฎ
([colour-gap-states.md](colour-gap-states.md)). Nothing in this card's lifecycle can catch it —
an unruled colour syncs as `status: "ok"`, so the คาบ is ordinary input, `computePayslip` has no
reason to warn, and the slip is **correct for the input it was given**. The only place to say it is
before the run.

📌 **ใบ 070 gave that box a working link** — the swatch now points at `/sync/review?hex=`, where a
hand-reviewed payable คาบ can be sent to `status: "ignored"`. It still sits outside this card's
lifecycle: the repair happens to a `TeachSession` *before* any slip is computed, and a slip already
approved or paid is not reopened by it (`runPayroll` refuses a non-draft slip — item 1 above).
