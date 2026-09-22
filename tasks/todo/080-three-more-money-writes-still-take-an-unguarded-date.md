# Three more money writes still take an unguarded date — and one of them is worse than OT

- status: todo
- commit:

## Goal

ใบ 072 gave `/ot`'s one-row form the round-trip date guard and exported `calendarDate` so the
predicate has one home. **Three other actions that write money still build a `Date` the old way:**

| Site | Writes | Guarded neighbours in the same action |
| --- | --- | --- |
| `app/sales/page.tsx:80` | `db.sale.create` | `netPrice`, `listPrice` — both guarded, six lines above |
| `app/classes/page.tsx:87` | `db.classSession.create` | `booked`, `noShow`, **and the `noShow > booked` pair** — all guarded above |
| `app/sync/review/page.tsx:164` | `db.teachSession.update` | — |

All three are `new Date(<client text> + "T00:00:00Z")`, so `2026-06-31` stores as `2026-07-01`:
the row lands in the next payroll period, silently (§2 rule 4). Each is now a **two-line fix**,
because ใบ 072 already exported the predicate and already settled the Thai copy.

## Why these are not "the same as OT, times three"

`payroll-auditor` priced each against the spec, and two of them cost **more than the money that
moved** — which is the part that would be missed by treating this as a mechanical sweep.

### 1. `app/sales/page.tsx` — §1.6's threshold is retroactive, so one shifted bill re-rates the month

A trainer closes **32,000 ฿** of self-closed PT in June, owed `32,000 × 12% = 3,840 ฿`. One bill of
8,000 ฿ is typed `2026-06-31` and stores as 1 July. June's self-closed total drops to 24,000, the
30,000 threshold is missed, and June pays `24,000 × 10% = 2,400 ฿`.

⇒ **the trainer is short 1,440 ฿**, nearly four times the 400 ฿ of commission that actually moved
— `warnings: []`, on a payslip that looks ordinary.

### 2. `app/classes/page.tsx` — §1.4's credit floors at 0, so a shifted คาบ can be destroyed twice

`classPay = max(0, classValue − classCredit)` deducts from the **month's total**. A trainer with
`classCredit` 2,000 and a real June `classValue` of 2,200 is paid 200. Move one 200 ฿ Core Strength
คาบ to 1 July: June becomes `max(0, 2,000 − 2,000) = 0`, and July's own 2,000 credit absorbs the
arriving 200 as well.

⇒ **200 ฿ paid becomes 0 ฿, and the 200 never reappears in July either.**

### 3. `app/sync/review/page.tsx` — the highest-probability typo site in the app, and it is irreversible

This is the one screen where a human **retypes a date by hand precisely because the sheet's was
unreadable**. A reviewer fixing a June ว่ายน้ำ คาบ types `2026-06-31`; the คาบ is stamped 1 July at
250 ฿, leaves June, and is written `status: "ok", reviewed: true`.

⇒ out of the review queue, out of June's payslip query, and **`reviewed: true` means no later sync
will ever repair it**. 250 ฿ in the wrong month, permanently, with the queue showing clean.

## Also in this card — a silent `return` on the same action

`app/sync/review/page.tsx:153` is a bare `if (!dateStr || !staffId) return;` — a silent refusal on a
money path with no flag, against that file's own comment eight lines earlier insisting the refusal
must be loud. No baht is lost today (the row stays visible in the queue), so it is a §2 rule 4
*shape* rather than a loss — but it is in the action the guard above is going into, and fixing it
there costs nothing.

## Scope

- Copy `app/ot/page.tsx`'s guard and its notice block verbatim per action — **do not invent a
  second dialect** of either. The `?err=` flag is `date` on every screen for the same reason the
  copy is the same sentence: one refusal, one wording, however many surfaces.
- `app/sync/review/page.tsx` already has a `withErr(back, …)` helper — use it rather than adding a
  redirect shape that screen does not have.
- ⚠️ **`/sales` and `/classes` must keep their existing guard order intact.** ใบ 072 put the date
  *before* the hours on `/ot` because one `?err=` slot fits in the URL; decide the same question per
  screen rather than assuming, and write the answer down where the next reader will find it.
- Tests + junit pin raises in the same change (§7). `calendarDate` itself is already pinned by
  ใบ 072 — what is unpinned here is the **wiring**, and `bun test` has no DB, so say plainly what is
  reviewed rather than pinned and name `tasks/todo/015-db-test-lane.md`.
- Knowledge cards: `.docs/knowledge/domain/form-refusals.md` enumerates these actions and will go
  STALE. It is at **146** against the 170 warn after ใบ 072; three more rows fit, and if they do not,
  the next boundary is named in `tasks/done/073-split-form-refusals-knowledge-card.md`.

## Notes

- Found by `payroll-auditor` in the ใบ 072 audit, explicitly as siblings out of that card's scope.
  Every baht figure above is that audit's, computed against the seeded config
  (`incentive.threshold` 30,000 · `incentive.rate` 12 · `comm.pt.selfClosed` 10).
- 🔴 **Do not fold ใบ 079 into this card.** That one is the same *family* — a date-ish string nobody
  validated — but it is the period key rather than a row's day, its fix is in `lib/payroll-run.ts`,
  and it needs the stored data checked before the guard is tightened.
- Related: [072](072-the-one-row-ot-form-still-stores-a-rolled-over-date.md) ·
  [014](../done/014-ot-import-atomicity.md) · [079](079-periodRange-accepts-aliases-for-one-month-and-payslips-are-keyed-by-the-string.md)
