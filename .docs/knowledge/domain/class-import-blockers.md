---
sources:
  # The pure half of the decision the count depends on — `closedSlipOutcome`'s four cases.
  - lib/class-problems.ts
  # The pin on all of it, including the two arms that are this card's subject.
  - lib/class-problems.test.ts
  # The count itself, the exclusion, and the per-(staff, period) slip lookup.
  - lib/class-problems-run.ts
  # The one home for "which queues block a run".
  - lib/run-blockers.ts
  # The two screens that render the number — from the same function, or they disagree.
  - app/payslips/page.tsx
  - app/page.tsx
  # ใบ 065: the screen the two counts above link to. It renders `listClassImportProblems()` and is
  # the one place `accountedFor` decides whether a stored `reason` may be printed at all.
  - app/classes/_components/import-problems.tsx
  # ใบ 065 round 2: the exit and the *"คาบอยู่ไหน"* text as a pure `(kind, state)` grid, pinned at 7
  # (`scripts/junit-pins.txt` is the authority; round 3 added the `problemIsCleared` arms).
  # The card's three states and the "what never clears" list below ARE its contents.
  - lib/class-problems-copy.ts
  - lib/class-problems-copy.test.ts
---

# The run blockers — the `/payslips` count, and what never clears

The other half of [class-import-queue.md](class-import-queue.md), which owns the table, the key shapes
and the write. This card owns **the number a human reads before running payroll**, and the reasons it
can lie in either direction. Task **064**; `prisma/schema.prisma` is deliberately **not** a source here —
the storage decisions live on the other card.

**One function, two labelled numbers.** `runBlockers(period)` in `lib/run-blockers.ts` is the one home
for "is this period clean enough to run", read by **both** `/payslips` and `/`. 🔴 Never summed: a total
reads as one queue and hides which screen to open, and the two repairs are different actions.

## The count on `/payslips`, and why its exclusion is not `imported − matched`

`pendingClassImportInPeriod` filters `OR: [{ date: in period }, { date: null }]` — copied from
`pendingReviewInPeriod`, so an undated row counts in **every** period — then excludes keys whose คาบ is
genuinely accounted for. Excluding at all is reachable: delete a `TrainerAlias` and re-upload, and a
คาบ that **is** imported and **is** paid becomes a problem again; counting it would tell the admin a
paid คาบ is missing, and a count that cries wolf is a count nobody reads.

🔴 **But "a `ClassSession` exists" is not "accounted for", and reading it that way was the fix round's
blocker.** Two narrowings: a key is excluded only when that คาบ's **own** slip (`staffId` + period) is
absent or still `draft`, because a closed slip is never recomputed ⇒ the คาบ is never paid; and a
`kind: "duplicate"` is **never** excluded, because the stored คาบ may be there at the wrong amount
(stored booked 5 / noShow 3 ⇒ 200 ฿ against the file's booked 9 / noShow 0 ⇒ 400 ฿).
⚠️ An arity-3/1 key can never equal a 4-tuple `sourceKey`, so a `"row"` problem is never excluded by
construction — the same fact that means nothing clears it.

🔑 **This is set membership, not the subtraction [gymmo-import.md](gymmo-import.md) forbids.** That bug
had a subtrahend (`matched`, no date filter) that was **not a subset** of its minuend (`imported`,
range-confined), so twelve out-of-range rows cancelled twelve in-range orphans. Here the second query
is `sourceKey: { in: keys }` — keyed by the **first query's own output** — so the excluded set is a
subset of the counted set by construction and a row outside the period cannot appear in it at all; the
final line is a `filter` over that first list, not an arithmetic difference. The row is still stored and
still listed, so the disagreement is not hidden, only kept out of the count.

⚠️ **All `db.classImportProblem` access lives in `lib/class-problems-run.ts`** (`listClassImportProblems`
· `pendingClassImportInPeriod` · `readClosedByStaff`), split out of `lib/gymmo-import-run.ts` in the fix
round when that file passed the 450-line warn. The pair is this repo's own pure/`-run` convention, the
same split as `gymmo-import.ts`/`gymmo-import-run.ts` — and 🔴 **the pure module must never re-export the
`-run` one**, or a barrel drags `lib/db.ts` into every test that only wanted a key. The write is the
exception that proves the boundary: `applyGymmoImport` needs `tx.classImportProblem` inside its own
transaction and takes `readClosedByStaff` from here, so the two halves cannot drift about what "this
คาบ's slip is closed" means. No page may query this model directly.

## What has no clearing path — read this before calling the queue trustworthy

Under the no-dismissal default ([066](../../../tasks/todo-human/066-may-a-human-dismiss-an-import-problem.md)),
the only thing that removes a row is a clean import **of a `kind: "session"`/`"duplicate"` key into an
open period**. So:

- **every** `kind: "row"` row is permanent (the arity argument above), and a reader reject whose
  **date** was the unreadable part inflates **every** period's count on top of that — narrowed to the
  smallest possible set in the fix round, since `lib/gymmo.ts` now carries the date on all three
  rejects that happen *after* `parseGymmoWhen` succeeded;
- a คาบ written into a **closed** period stays **counted** until the slip is reopened — the count
  re-checks `readClosedByStaff` live, so reopening the slip drops it immediately. ⚠️ **The stored row and
  its reason survive until the file is re-uploaded**: `deleteMany` runs only inside `applyGymmoImport`.
  Invisible until ใบ 065 rendered the queue; printed raw it would be a screen asserting that paid
  money is unpaid. ✅ **Closed there by `readProblemStates`** — one private helper in
  `lib/class-problems-run.ts` that both the count and `listClassImportProblems` call, so the number
  and the table cannot drift. 🔴 **It answers in three states, not two, and the middle one is why**
  (the review round's BLOCK): `"missing"` the คาบ is not in the database · `"closedSlip"` it **is**,
  on a closed slip · `"accountedFor"` it is, on an open slip. The count excludes `"accountedFor"`
  **and nothing else**, so the number is unchanged; what the third state buys is the screen. A
  boolean put `"missing"` and `"closedSlip"` in one bucket under one sentence — *"ไม่มีอยู่ในฐานข้อมูล
  ⇒ แก้ต้นทางแล้วนำเข้าซ้ำ"* — and for a closed-slip row that is wrong twice: the re-upload writes into
  a still-closed period so the row does not move, and an admin told the คาบ is absent keys it in by
  hand ⇒ a second row beside the imported one ⇒ **ประพัฒน์'s 8,000 ฿ paid twice**, the ใบ 065 trap
  through its other door. `lib/class-problems-copy.ts` turns `(kind, state)` into the exit and the
  *"คาบอยู่ไหน"* text — pure, so every cell is pinned — and `import-problems.tsx` renders it, listing
  `"accountedFor"` rows **apart and without their stored `reason`**. 🔴 **`"duplicate"` keys are looked
  up too but are never excluded from the count**: their คาบ may sit at the *wrong* head count (stored
  5/3 ⇒ 200 ฿ against the file's 9/0 ⇒ 400 ฿), so the screen must not say *"ไม่เขียนทั้งคู่"* — believing
  that and keying it by hand is 200 + 400 = 600 ฿ for one 400 ฿ คาบ — while the exclusion stays keyed
  on `kind === "session"` so that same existence buys nothing. 🔴 **That predicate is
  `problemIsCleared` and it has one home** — the count and the table both call it. Written twice, they
  disagreed about that one cell for a whole review round: the row was **counted as blocking and
  displayed as resolved**, so a period whose only problem was such a row read *"1 คาบ"* on `/payslips`
  and **`ไม่มีแถวค้าง`** on the screen it links to — 200 ฿ against 400 ฿ on an Aqua Fit whose head
  count the file disputes, with the queue row the only artefact that said so. ⚠️ **`"closedSlip"` cannot tell
  "never paid" from "already paid, stale row"**, so its exit says to check the slip's figure first: a
  recompute reads **today's** config, and Core Strength 200 → 250 turns a 3,050 ฿ transfer into a
  3,150 ฿ slip with nothing recording the gap;
- a **stale reason** can be stranded on an `unchanged` + closed key, and `closedSlipOutcome` leaves it
  there deliberately. It needs a row recorded **while the `ClassSession` already existed**: delete a
  `TrainerAlias`, re-upload (the key needs no alias, so it is unchanged), get a *"ไม่รู้จักเทรนเนอร์"* row
  on an already-paid คาบ, then restore the alias ⇒ the key is a write again and `unchanged`, so the row
  is left alone saying a trainer is unknown who is not. Same shape through a `"duplicate"` later removed
  from the file. 🔑 **Re-inserting instead would be worse**: it would put an affirmative
  *"ยังไม่ถูกจ่าย"* on a คาบ that **was** paid — a false claim about money beats a stale one. Cost of the
  stale row is a stuck count in an already-closed month, **no baht in either direction**. Exits: reopen
  the slip and re-upload, or 066;
- ⚠️ **editing `normalizeTrainer` now re-keys TWO tables**, this one and `ClassSession.sourceKey` — it
  orphans every `"session"`/`"duplicate"` row exactly as it re-keys every คาบ;
- a คาบ keyed **by hand** at `/classes` has `sourceKey = null`, so nothing links it to its problem row
  (design §6b recommends writing the key there; that is card 065's screen and 066's policy).

⇒ a blocker count stuck at a constant is a count people learn to ignore, which costs the whole gate
its meaning. Nothing is auto-deleted in the meantime: a TTL would be this card's own bug on a timer.

⚠️ **The transaction is reviewed, not pinned** — no test in this repo reaches a database
([../ops/gate-tiers-and-pins.md](../ops/gate-tiers-and-pins.md)) — and **nothing calls
`applyGymmoImport` yet**: the upload screen is ใบ 063 item 4. 🔑 `/classes` **does** list these rows
since ใบ 065, so the `/payslips` link now lands on the reasons it promises; `readProblemStates` is the
same reason the table stays empty until a row is genuinely unaccounted for. ⚠️ **The table is every
month while the `/payslips` count is one งวด** — `listClassImportProblems` is not period-scoped because
a row's `date` can be `null` and such a row belongs to no month anybody can name; the heading says so
rather than leaving two near-identical numbers one click apart to be inferred.
