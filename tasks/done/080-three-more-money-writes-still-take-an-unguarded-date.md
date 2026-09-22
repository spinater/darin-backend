# Three more money writes still take an unguarded date — and one of them is worse than OT

- status: done
- commit: a7eac0b

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

## What shipped

Three guards, four new flags, one added redirect — and `calendarDate` is now the single home for
this predicate across every money write that takes a day from a form.

| Site | Guard | Order it went in at | Flags added |
| --- | --- | --- | --- |
| `app/sales/page.tsx` `add` | `calendarDate(… .trim())` | **before** `netPrice`/`listPrice` | `err=date` |
| `app/classes/page.tsx` `add` | same | **before** `booked`/`noShow`/the pair | `err=date` |
| `app/sync/review/page.tsx` `resolve` | same | **before** the trainer check and the row-state assertion | `err=date` · `err=need` · `err=stale` |

The ordering argument is written out once, in `/sales`'s `add` (one `?err=` slot ⇒ order decides
which problem is reported first; the date decides which *month* the row is in, and on `/sales` and
`/classes` that re-rates or destroys money beyond the row itself). `/classes` and `/sync/review`
point at it and add only what is particular to them.

**The Thai copy is `/ot`'s sentence, example and flag — with each screen's own noun** (บิลนี้ ·
คาบนี้), because a box reading as copied from another screen, beside two that do not, is the third
dialect the rule exists to prevent. `/sync/review`'s says one thing more, and only about what is
particular to it: ยืนยัน writes `reviewed: true`, so a typo there is never repaired by a later sync.

### The two silent `return`s — both made loud

1. `if (!dateStr || !staffId) return;` → split in two, `err=need` for either field blank (neither
   control carries `required`, so this is the *ordinary* click, not an edge case).
2. `if (row.status !== "needs_review" && row.staffId !== null) return;` → `err=stale`. **Verdict:
   loud.** The brief left this one open; the argument that decided it is that the state is
   reachable **without a crafted post** — `resolve` is itself what takes a row out of
   `NEEDS_ATTENTION`, so a second tab (or a second admin) opened before that write still renders
   the row with its ยืนยัน button. That is the same concurrency the `err=closed` re-check ten lines
   above exists for, and consistency inside one action is worth more than the one flag it costs.
   The assertion is unchanged; only the silence went.

🔴 **The assertion has a hole, it is pre-existing, and this card does not close it** — found by
`code-reviewer` and re-verified independently in review. The predicate is not `NEEDS_ATTENTION`,
and one cell of the difference writes although it is in no queue:

| `status` / `staffId` | refused? | in `NEEDS_ATTENTION`? |
| --- | --- | --- |
| `needs_review` / `null` · `needs_review` / set · `ok` / `null` | no | **yes** — correct, these are the queue |
| `ok` / set | yes | no |
| `ignored` / set | yes | no |
| **`ignored` / `null`** | **no** | **no** ⇐ writes though it is not in the queue |

`ignore` writes `status: "ignored", reviewed: true` and **never sets `staffId`**, so a trainer-less
queue row a human has just ข้าม lands exactly there: tab A takes the คาบ off pay (the whole point of
ใบ 070), tab B rendered earlier still shows ยืนยัน, and B's click puts it back on pay at 250 ฿
**permanently**, because `reviewed: true` stops every later sync from touching it. Carded
separately — ⚠️ and the obvious "simplification" of dropping `&& row.staffId !== null` is **wrong**:
it would refuse the legitimate `{status: "ok", staffId: null}` arm the queue is made of. The comment
in `resolve` names the cell rather than claiming the assertion covers it.

### Also fixed, because the flags made it false

`resolve` had **no redirect at all** — it re-rendered whatever URL the browser was on, so an
`?err=` from an earlier refusal stood over the next *successful* ยืนยัน. That is point 4 of the
shared error surface (`form-refusals.md`) and it binds every action on a page that writes.
`redirect(back)` at the end. ⚠️ `bulkIgnore` on the same screen is still in that state on its
success path — **not** fixed here (a bulk submit carries no `back` field, so its clean target is a
decision, not a copy).

**Two things that redirect dragged in with it, both fixed in review:**

1. **`back` is client-supplied and now reaches `redirect()` on the common path**, where before it
   was only on the `err=closed` refusal. No baht is at risk (Next's server-action origin check, and
   the caller is `requireAdmin()`), but the widening is this card's, so the value is pinned to this
   screen: anything not `startsWith("/sync/review")` falls back to the page's own computed
   `backHref`. A `startsWith`, not a pattern — the allowed set is one prefix.
2. **The redirect dropped `?page=`** — a regression this card introduced, since before it `resolve`
   had no redirect and the reviewer simply stayed where they were. `backHref` comes from
   `hrefFor()`, which carries no page; only `qs()` does. With `PAGE_SIZE = 50`, a first-sync queue
   made every ยืนยัน / ข้าม / เอากลับเข้าคิว a re-navigation back to page 1. The hidden `back` input
   now carries `qs(page)` beyond page 1, which fixes the three refusal redirects at the same time.

## Tests and the pin — **no raise, and none was earned**

`calendarDate` is pinned at 13 by ใบ 072 and none of its behaviour moved. Everything this card adds
is **wiring inside server actions**: guard order, which `?err=` a `redirect` carries, whether the
notice renders. `bun test` has no database, so there is nothing here that can honestly be pinned —
the same wall the ใบ 072 row ends on for `app/ot/page.tsx`. The lane that would close it is
[015-db-test-lane.md](../todo/015-db-test-lane.md).

⇒ **reviewed rather than tested**, recorded as a no-pin row in
`.docs/knowledge/ops/junit-pin-history.md`. A raise here could only have been bought with a test
invented to justify it.

## Notes

- **The sweep asked for turned up one thing, and it is not in this card.** `app/sales/page.tsx`
  builds its month range inline from `?period=` — `new Date(\`${period}-01T00:00:00Z\`)`, three
  times — instead of calling `periodRange()` as `/ot`, `/classes` and every other period screen do.
  A junk `?period=` therefore reaches Prisma as `Invalid Date` rather than being refused. It is a
  **read**, not a money write, so no baht moves; but it is the same family as
  [079](../todo/079-periodRange-accepts-aliases-for-one-month-and-payslips-are-keyed-by-the-string.md) and
  its fix (call `periodRange`) depends on what 079 decides that function should refuse ⇒ left
  alone deliberately, named here so 079 can pick it up. No other client-derived `Date` exists in
  the three actions: `grep -rn "new Date(" app/` was read in full.
- **A third silent `return` is still there**: `if (!row) return;` at the top of `resolve`, for an id
  whose row is gone. `/classes`'s `del` answers the identical case with `err=gone`. Not fixed —
  unlike the two in scope it is a different decision (does the reviewer need to be told the row
  vanished, or is silence right when there is nothing left to act on?), and widening the diff to
  four flags in an action nobody has reviewed yet is how a card stops being reviewable.
- **The baht arithmetic has exactly one home: `form-refusals.md`'s ใบ 080 table.** It was briefly
  in three places — that table, `/sales`'s comment and `/classes`'s — and every figure in it is
  arithmetic over `incentive.threshold`, the commission rates and `classCredit`, which are
  `PayrollConfig` rows and not constants (§2 rule 3) ⇒ three copies that go wrong **silently** the
  first time one of those keys moves. The comments keep the **ordering argument** (that is the
  decision, and it belongs where the next reader lands) and point at the card for the figures —
  §5's own direction, read the card then the code. The worked numbers stay in *this* card too,
  because a task card is a dated record of what was priced and against which seeded config, not a
  live claim about today's rates.
- **`.docs/knowledge/domain/form-refusals.md` is at 192/200** after this card (146 before; 180
  before the review round, which added the `err=stale` hole above and the two redirect notes). That
  is **8 lines of headroom** against the hard cap, so the next card to touch this file splits it
  first or it will be the one to hit 200. It is
  in §5's warn band and the split ใบ 073 already named is now due: the **paste-import four-bucket
  table** (ใบ 014's `unmatched`/`invalidHours`/`invalidDates`/the skip, sourcing `lib/ot-import.ts`
  and `app/ot/**`) against the per-field refusal table this card grows. Said rather than crammed,
  per the brief — and per the gate's own advice it wants to be **its own commit**, not folded in
  here. `sheet-colour-rules.md` went 170 → 175 for one frontmatter pointer and is in the same band.
- Found by `payroll-auditor` in the ใบ 072 audit, explicitly as siblings out of that card's scope.
  Every baht figure above is that audit's, computed against the seeded config
  (`incentive.threshold` 30,000 · `incentive.rate` 12 · `comm.pt.selfClosed` 10).
- 🔴 **Do not fold ใบ 079 into this card.** That one is the same *family* — a date-ish string nobody
  validated — but it is the period key rather than a row's day, its fix is in `lib/payroll-run.ts`,
  and it needs the stored data checked before the guard is tightened.
- Related: [072](072-the-one-row-ot-form-still-stores-a-rolled-over-date.md) ·
  [014](014-ot-import-atomicity.md) · [079](../todo/079-periodRange-accepts-aliases-for-one-month-and-payslips-are-keyed-by-the-string.md)
