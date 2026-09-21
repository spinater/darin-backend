---
sources:
  # The three signals themselves — `GymmoImportPreview`, `readHandKeyedSignal`, `readClosedPeriods`
  # — and the two of them that are re-read **inside** `applyGymmoImport`'s transaction, which is the
  # half of the contract a screen cannot swallow by forgetting.
  # ⚠️ [gymmo-import.md](gymmo-import.md) also lists this file, for the write. That is one file with
  # two genuinely different claims on it, not a source left behind by a split: touch the transaction
  # and both cards are stale, which is correct in both directions.
  - lib/gymmo-import-run.ts
  # Signal 1's duplicate heuristic and its pin — the `(UTC day, staffId, classId)` triple, `fileRows`,
  # and why that triple must never become an import key.
  - lib/gymmo-hand-keyed.ts
  - lib/gymmo-hand-keyed.test.ts
---

# สามอย่างที่หน้ายืนยันต้องโชว์ก่อนเขียน — และทำไมฐานข้อมูลปฏิเสธมันเองไม่ได้

Split out of [gymmo-import.md](gymmo-import.md) at ใบ 068 (it had reached 190/200). That card owns
**the key and the write** — what makes a Gymmo row an identity and what one transaction does with a
plan. This one owns **what a human has to see before pressing confirm**, which is the half that
grows: ใบ 065's five review rounds landed here, and ใบ 063 item 4 — the upload screen that will be
this card's first reader — is still open.

🔴 **Nothing here is refused by a constraint.** Each of the three is a คาบ the database will happily
write twice, or write into a month nobody will ever pay. A confirm button that shows only the three
counts (`new` · `update` · `unchanged`) is **not** this contract.

## Three things the preview must show before anybody confirms

None can be refused by a constraint, and each one is money:

1. 🔴 **`handKeyedMatches`** — a คาบ keyed by hand and the same คาบ imported are **two rows**.
   `sourceKey` is null for the hand-keyed one, a null is exempt from `@unique`, and `computePayslip`
   pays both. The import cannot tell a duplicate from a different session, so it **names the pairs**
   and the human decides. ⚠️ **ใบ 065 turned this from a count into a list**: `handKeyedInRange`
   counted the whole `[min, max]` span — nine months for a Jan–Sep upload — and *"12 hand-keyed
   คาบ"* beside *"431 new"* leaves only *confirm blind* or *abandon*. `gymmoHandKeyedMatches`
   (`lib/gymmo-hand-keyed.ts`, which carries the full reasoning) keeps the rows a planned write lands
   on, matched `(UTC day, staffId, classId)`, with `fileRows` = how many คาบ of the file share that
   triple. 🔴 **That triple is a heuristic and must never become an import key** — the ⛔ at the top
   of this card: `ClassSession` holds the day with no clock, so 07:15 and 09:00 collapse onto it.
   🔴 **The list is narrower than the count, so the residual is reported beside it**
   (`handKeyedUnmatchedInRange`): a match needs `staffId` **and** `classId` to agree, and a คาบ on
   ธันยา's sheet keyed by hand under ประพัฒน์, who actually taught it, misses the triple — 200 ฿ paid
   twice, one on each of two slips, neither wrong on its own. ⚠️ **Signal 1 is on the result too,
   re-read inside the transaction** (`readHandKeyedSignal`), for the same race as `closedPeriods`:
   a คาบ keyed by hand between preview and confirm is otherwise written twice with no record.
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

