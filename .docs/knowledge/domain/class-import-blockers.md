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
  Invisible today, but the hour 065 renders the queue it is a screen asserting that paid money is
  unpaid — so 065 must render every `"session"` row through the **same** `readClosedByStaff` check the
  count uses and must never print the stored `reason` raw (written into card 065);
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
`applyGymmoImport` yet**: the upload screen is ใบ 063 item 4, and `/classes` renders none of this until
[065](../../../tasks/todo/065-deleting-an-imported-class-session-is-undone-by-the-next-import.md), so
the `/payslips` warning currently links to a screen that does not yet list the rows.
