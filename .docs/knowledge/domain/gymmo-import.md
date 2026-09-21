---
sources:
  # 🔴 `normalizeTrainer` is **inside the `sourceKey`** as of the fix round, so a change to it re-keys
  # every stored row and needs a backfill — it is a source of this card, not an implementation detail.
  - lib/normalize.ts
  # The reader and the naming seam (task 058) — the two pure files this path starts from. Their
  # conventions are quoted here (UTC midnight + separate `timeText`, no case folding, `(Deleted)`),
  # so softening either must land this card STALE.
  - lib/gymmo.ts
  - lib/gymmo-map.ts
  # The planner: `gymmoSourceKey`, the duplicate rule, the diff. Every decision on this path.
  - lib/gymmo-import.ts
  # The I/O half — the one transaction, and the hand-keyed-row count that no constraint can catch.
  - lib/gymmo-import-run.ts
  # The pin on all of it, including the collision pair and the 3,050 arm.
  - lib/gymmo-import.test.ts
  # `ClassSession.sourceKey String? @unique` — the schema half of "importing twice cannot pay twice".
  - prisma/schema.prisma
---

# Importing Gymmo คาบ — why a row has an identity

Four files, and only the last one writes: `lib/gymmo.ts` reads cells into rows · `lib/gymmo-map.ts`
answers *which staff, which price* · `lib/gymmo-import.ts` decides *what may be written* ·
`lib/gymmo-import-run.ts` writes it (058, then **063**). Read
[payroll-rules.md](payroll-rules.md) rule 3 first — the whole path is an application of it.

The engine was never changed for any of this: `Staff.classCredit` and `computePayslip`'s class block
already did the money (058 §3) ⇒ this card is about **identity and refusals**, not baht.

## 🔴 `ClassSession.sourceKey` — the column that stops a second upload paying twice

Before task 063 a `ClassSession` had no key but `id`, so uploading the same worklog twice doubled
every คาบ **with nothing going red** — noticed at payday, months later, by nobody who could still fix
it (§2 rule 4). The column is `sourceKey String? @unique`, and four decisions are frozen in it:

- **It is the identity of a row of a file**: trainer + date + `timeText` + the **raw** class name.
- 🔴 **The trainer half is keyed through the same normalizer that decides *who this is*** —
  `normalizeTrainer(readTrainerSheet(name).name)` — and both review lanes found a double-pay path
  here. Gymmo **mutates a leaver's sheet name** (`(Deleted)`; the Jan–Sep export already carries one)
  and an account can be re-typed (`PT ธันยา มูลละคร`, a double space). `matchTrainer` forgives all of
  it, so **resolution succeeds and nothing reaches `problems`** — while a narrower key gives every row
  a fresh identity, `diffGymmoPlan` reads `create`, and the คาบ already imported are paid a second time
  with `warnings: []`. Measured: any one of those spellings re-creates all 24 of ธันยา's August คาบ ⇒
  class value 8,050 → 16,100, `classPay` **3,050 ฿ → 11,100 ฿ in one month**, and again for every
  other still-`draft` month in the file. §2 rule 6: identity may not use a narrower rule than
  resolution. Two people who normalize equal are already paid into each other by `matchTrainer` (and
  cannot both hold a `TrainerAlias`, whose `alias` is the primary key) ⇒ no new risk.
  ⇒ ⚠️ **the stored key is not a display name** (`ธันยามูลละคร`), and **changing `normalizeTrainer`
  re-keys every stored row** — free today, a backfill after the first real import.
- **A class name is keyed RAW.** Gymmo does not *decorate* it the way it decorates a leaver's sheet —
  but ⚠️ it can still **rename** one: `GYMMO_CLASS_ALIASES` carries `HIIT ROX` →
  `LESMILLS CEREMONY HYROX` because linus renamed the class and Gymmo has not caught up. The day it
  does, every historical คาบ of that class re-keys (4 a month at 400 ฿, paid twice for a trainer over
  the credit) and the signal is `importedInRangeNotInFile` below. Keying the *resolved* name is still
  wrong: `matchClassName` prefers an exact `ClassPrice` name over an alias, so adding a price row
  spelled as Gymmo spells it re-keys the whole history under a resolved-name key, while under the raw
  key it changes `classId` only and lands as a plain `update` on the one row.
- **`booked`/`noShow` are NOT in it.** Gymmo lets staff correct attendance afterwards ⇒ the same
  session arriving with a new count must **update** the row.
- ⛔ **`date + classId + staffId` was rejected** — the date is UTC midnight with the clock kept apart,
  and one trainer really does teach the same class twice in a day ⇒ that key swallows one คาบ.
- **`null` for a คาบ keyed by hand at `/classes`** — it is the identity of no file row, and PostgreSQL
  exempts nulls from `@unique` (see point 1 of the three below).

🔴 **The encoding is `JSON.stringify` of the 4-tuple, never `a|b|c|d`.** A joined key is injective
only while no part can contain the separator, and a sheet name and a class name are both free text
typed by staff. [teach-rate-lookup.md](teach-rate-lookup.md) records the same bug class one module
over — an activity name containing `|` overwriting a *different* activity's rate
([035](../../../tasks/todo/035-activity-name-with-a-pipe-overwrites-another-rate.md)) — and here the
consequence is worse than a wrong screen: one คาบ vanishes or one payment doubles. A reachable pair
that a `|` join merges, pinned in `lib/gymmo-import.test.ts`:

```
sheet `โอ|2026-08-01|07:15|Aqua Fit` · 2026-09-02 · 09:00 · `Body Pump`
sheet `โอ`                           · 2026-08-01 · 07:15 · `Aqua Fit|2026-09-02|09:00|Body Pump`
```

JSON is injective because it is **decodable** — `JSON.parse(key)` returns the exact tuple — and that
round-trip is what the first test asserts, not the string's shape.

## What reaches the screen instead of being decided

`planGymmoImport` is **pure** (no DB, no clock, no env — same rule and same reason as
`lib/ot-import.ts`: `bun test` has no database). It returns `writes` · `problems` · `ptRows`, and
refuses in exactly three ways, none of which fails the file (§2 rule 6 — the run still completes):

🔑 **It takes the reader's whole `GymmoParse`, not `parse.rows`.** `parseGymmoGrids` rejects rows of its
own (an unreadable date, an unknown `Type`) — also rows that never became a คาบ, and a caller handed
`rows` alone would drop them, showing a complete import over an unpaid session. They are converted to
the same `{ where, reason }` shape and come **first**, so one list carries every rejected row.

| Case | What happens |
|---|---|
| trainer or class unmatched | one `problem` per row carrying **`lib/gymmo-map.ts`'s own Thai sentence**, rendered as it is — not re-translated |
| 🔴 two rows of one file with the **same** `sourceKey` | **both** to `problems`, **neither** written — a last-write-wins would silently pick one of two head counts |
| `kind === "pt"` | excluded and **counted** in `ptRows`. Not a problem: a PT row is a 1-on-1 session and arrives through `lib/sync.ts`. The count is what proves the export was fully accounted for |

**Nothing is clamped.** `booked` and `noShow` are written verbatim, negative attendance included —
the task-025 guard in `lib/payroll.ts` is the thing that must see it, and "repairing" it here hides
the row from the only check that exists ([payroll-rules.md](payroll-rules.md) rule 3).

## The write: one transaction, and the two counts that matter

`applyGymmoImport` diffs the plan against what is stored (`diffGymmoPlan`, pure, so "a second import
changes nothing" is pinned without a database) and writes **one `createMany` plus one `update` per
genuinely changed row**, in one `$transaction`. Not an `upsert` per row: a nine-month export is
hundreds of คาบ against Prisma's 5 s interactive budget. A row whose six columns are identical is **not
written at all** — that is ใบ 063 §4, not an optimisation. Safety rests on the unique index, not on the
read: two racing imports both plan a create and `skipDuplicates` absorbs the loser.

`applyGymmoImport` returns `problems` beside the counts — `OtImportState`'s decision in
`lib/ot-import.ts`: they are decided before the write and must survive it, or the preview was the only
screen that ever showed them. 📌 **Since ใบ 064 they also outlive the request**: the same transaction
writes them to `ClassImportProblem` and clears the keys that now import cleanly, and `/payslips` counts
what is left. All of that — the three key shapes, the delete-then-insert scope, the count's exclusion
rule and what has **no** clearing path — are [class-import-queue.md](class-import-queue.md) (the table and the write) and [class-import-blockers.md](class-import-blockers.md) (the count).
⚠️ Two consequences land back on this card: `GymmoParse.problems` is now `GymmoReadProblem[]`
(`{sheetName, rowText, reason}`) rather than rendered sentences, because a stored problem has to be
keyed; and **changing `normalizeTrainer` now re-keys two tables, not one**.

## Three things the preview must show before anybody confirms

None can be refused by a constraint, and each one is money:

1. 🔴 **`handKeyedInRange`** — a คาบ keyed by hand and the same คาบ imported are **two rows**.
   `sourceKey` is null for the hand-keyed one, a null is exempt from `@unique`, and `computePayslip`
   pays both. The import cannot tell a duplicate from a different session, so it counts them.
2. **`importedInRangeNotInFile`** — the mirror: rows in the range already imported whose key this file
   does **not** carry. 0 on a first import and 0 on a re-upload; a whole month appearing here is the
   only screen-side signal that a `sourceKey` has moved (a trainer or a class renamed in Gymmo), which
   otherwise reads as "N new คาบ" beside N orphans nobody sees. 🔑 **Counted directly with
   `sourceKey notIn planKeys`, never as `imported − matched`**: the minuend is confined to the range
   while `readExisting` matches keys with no date filter, so 12 rows hand-edited to a date outside the
   range cancelled 12 in-range orphans — `100 − 100 = 0` over ~4,800 ฿ about to be duplicated.
3. 🔴 **`closedPeriods`** — periods this upload writes into whose `Payslip` is `approved` or `paid`.
   `runPayroll` refuses to recompute a non-draft slip (task 013) so nothing wrong is *paid*; the
   failure is the opposite and it is silent. A missing 25 Aug คาบ uploaded on 10 Sep onto an approved
   08/2026 slip is reported as `created: 1`, and the next August run skips that slip **with a reason no
   screen renders** ([payslip-lifecycle.md](payslip-lifecycle.md)) — 400 ฿ in the database, in nobody's
   slip, for ever. It is **re-read inside the transaction and returned on `GymmoImportResult` too**, so
   a screen cannot lose it by forgetting and a slip approved between preview and confirm still reports.
   It **reports rather than refuses**: the คาบ was taught, no screen reopens a slip (card 013 item 2 is
   open with linus), and a refusal would leave the คาบ recordable nowhere — the non-draft lock already
   means no baht moves either way.

⚠️ **No role check lives in either module.** `requireAdmin()` belongs to the page and the server
action, as with `syncSources()` and `runPayroll()` — and no gate watches that
([../ops/gates.md](../ops/gates.md)).

## The data this path needs, and what is still unanswered

Split out at the fix round (this card hit 195/200): the six `TrainerAlias` rows, the five class
prices, the `baseSalary`/`classCredit` pair and the three questions nobody has answered are
[gymmo-import-data.md](gymmo-import-data.md), whose one source is `prisma/seed.ts`. Read it before
adding a row to that fixture; read this one before touching a key or a write. **What is not proven
yet** lives there too, and the short version is: **nothing calls either module** — there is no upload
screen (ใบ 063 item 4), so no role check exists to review — and **no test here touches a database**, so
the transaction itself is reviewed rather than pinned
([../ops/gate-tiers-and-pins.md](../ops/gate-tiers-and-pins.md)).

