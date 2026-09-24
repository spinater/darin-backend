---
sources:
  # The two states, `pending`, and the two queries that feed the screens.
  - lib/color-rules.ts
  # The one home for "which queues block a run" — this gap is its third member.
  - lib/run-blockers.ts
  # The one renderer all three screens share.
  - app/_components/color-swatches.tsx
  # The exit those swatches link at — the `?hex=` listing, and the way back (ใบ 070).
  # ⚠️ ใบ 080 changed `resolve` (a `date` guard, and its two silent `return`s made loud) and
  # **moved nothing on this card**: the `?hex=` listing, the swatch links and the two states are
  # unchanged, and ยืนยัน still writes `reviewed: true` — which is exactly why a typo there is
  # permanent, the reason that guard exists. Owner of the new flags:
  # [form-refusals.md](form-refusals.md).
  - app/sync/review/page.tsx
  # The lock that keeps that exit from being a one-way loss, and the one path list both writers use.
  - lib/closed-slips.ts
  - lib/revalidate.ts
  # Where the owner answers, and the action behind it (split out of `page.tsx` at ใบ 043).
  - app/admin/config/_components/sheet-mapping.tsx
  - app/admin/config/_actions.ts
---

# สีที่ตอบแล้วยังไม่เท่ากับสีที่แก้แล้ว — สองสถานะของช่องว่างกฎสี

The other half of [sheet-colour-rules.md](sheet-colour-rules.md), which owns the rule itself, why
nothing here seeds or guesses, and the fold's own decisions. This card owns **what happens after the
owner answers**, and why the report does not go quiet at that moment. Task **043**.

## 🔴 An *answered* colour is not a *fixed* one — the second half of the module

`ColorRule` is applied **at sync time only**, and `syncSources()` skips a hand-reviewed row before it
ever reaches the lookup:

```ts
if (prev?.reviewed) { … res.skippedReviewed++; continue; }   // lib/sync.ts
```

So writing the rule does not move the คาบ already in the database. The ว่ายน้ำ sheet is the worst
case because **every** row there is `reviewed: true` by construction (`prisma/seed.ts` gives it
`trainer: null`, so `lib/parser.ts` forces `needs_review` and a human clears each one): 12 คาบ at
250 ฿ answered "ไม่จ่าย" stay `status: "ok"` through every future sync and are paid — **3,000 ฿** for
คาบ the owner has just declared cancelled.

⇒ **a colour leaves this list when the rows agree with its rule, not when the rule exists.** Two
states, styled and worded apart on all three screens:

| State | Means | The repair |
|---|---|---|
| `unruled` | no rule, or a `meaning` outside the closed set | answer it at `/admin/config` |
| `unapplied` | ruled `skip`/`review`, payable คาบ still **disagree** with it | **re-sync** — except the `reviewedSessions`, which no sync will ever re-evaluate: those are cleared by hand at **`/sync/review?hex=…`**, the link the swatch itself carries (ใบ 070) |

🔴 **The *bare* `/sync/review` is not the exit, and saying it was is the mistake both review lanes
caught at ใบ 043.** Its listing is `NEEDS_ATTENTION` = `status: "needs_review"` **or**
(`status: "ok"` and `staffId: null`); a hand-reviewed คาบ is `status: "ok"` *with* a trainer and
matches neither arm. The `ignore` action that would repair it was on that page all along — only the
listing excluded it.

✅ **ใบ 070 added the listing that holds it: `/sync/review?hex=<hex>`** — `payableWithColorWhere()`
in `lib/color-rules.ts`, which mirrors `colorGapsSeen()`'s filter (`status: "ok"` ·
`staffId: { not: null }` · the hex, case-insensitively · **every period, no date window**) and
returns **`null`** for anything that may not be aimed at rows at all. The owner arrives by clicking a
swatch, so a page holding fewer rows than the swatch counted would read as rows having gone missing.
It is not narrowed to `reviewed: true` either — a non-reviewed row *is* repaired by a re-sync, but
hiding it would break that equality, so it is listed and marked `sync ครั้งหน้าจัดให้เอง` instead.

⚠️ **The equality is exact only for the `/admin/config` swatch**, which counts `sessions` with
`colorGapsSeen`. `/` and `/payslips` count with `colorGapsInPeriod`, so the page is a **superset** of
what their swatch said — more rows, never fewer; the page leads with `ทุกงวด ไม่ใช่เฉพาะงวดที่กดมา`
for that reason. Carrying the period into the link would hide exactly the rows an owner most needs
(a `skip` colour whose คาบ sit in last month).

### The four things that make it safe — each one a `payroll-auditor` BLOCK

1. 🔴 **The listing exists only for `skip` and `review`.** With no rule, or `pay`, there is nothing
   this screen may tell anybody to do, and fifty checkboxes under an unanswered colour would be the
   default-to-`skip` `lib/color-rules.ts` refuses, reached through a URL instead of the engine.
2. 🔴 **One sentence per rule, and the buttons follow it** (`_components/color-notice.tsx`):
   `skip` ⇒ ข้าม per row **and** in bulk · `review` ⇒ ข้าม per row only, because the rule asked for a
   *look* and never said "do not pay". ว่ายน้ำ is ruled `review`, so a fixed "กดข้ามตามกฎสี" would
   have withheld 40 × 250 = 10,000 ฿ the rule never asked to withhold.
3. 🔴 **ข้าม-only, with the date box and ยืนยัน removed.** These rows are already inside computed
   slips, unlike the queue's. ยืนยัน on a row a sync would have repaired for free writes
   `reviewed: true` and **strands it for ever** (50 × 400 = 20,000 ฿ measured); editing the date of a
   คาบ in a paid period adds it to the open one without removing it from the closed one — paid twice.
4. 🔴 **A คาบ whose period's slip has left `draft` is listed, named `งวดปิดแล้ว`, and has no button**
   (`lib/closed-slips.ts`), re-checked inside the action. `runPayroll` will not recompute such a
   slip, so ข้าม there takes **nothing** back and only switches off the report still saying the
   colour is being paid: 9,500 ฿ measured, which is ใบ 043's own failure through the repair.

🔑 **And the click has a way back and a trace.** `?ignored=1[&period=]` lists what people removed by
hand, each row with `เอากลับเข้าคิว` (→ `needs_review`, `reviewed: false`, so the next sync re-applies
the colour rule), and `runBlockers().handIgnored` puts the per-period count on `/` and `/payslips` —
**beside** the queues, never summed with them, because those are คาบ not paid *yet* and this is คาบ
that will not be paid *at all, because somebody said so*. A recomputed slip says nothing about it.

🔑 **Both writers revalidate through `revalidateColorGaps()`** (`lib/revalidate.ts`) — `addColor` and
the ข้าม share one path list, because the swatch is now the entry point and an owner who clicks and
goes back must not meet the number they just changed (§2 rule 4 through a stale client cache).

🔴 Re-ruling the colour to `pay` is **still** the wrong exit and all three screens still say so.
The difference is that the copy now names a right one instead of telling the owner to wait.

🔑 **`pending`, not `sessions`, is the number the screens lead with** — the คาบ that *openly*
disagree. Under `skip` that is every payable row (a human clearing one said "pay", the colour says
"do not"; which wins is [066](../../../tasks/todo-human/066-may-a-human-dismiss-an-import-problem.md)
and [069](../../../tasks/todo/069-a-recoloured-reviewed-row-is-invisible-to-every-screen.md)'s
question, not this fold's). Under `review` a hand-cleared row is not in open conflict, because a
human being there is what the rule asked for.

🔴 **But `pending === 0` never retires a colour, and believing it did was this card's third
blocker.** `reviewed: true` records that somebody resolved the row's **parse** problem — it is not
evidence that anybody looked at its **colour**. `/sync/review` did not render `bgColor` at all until
ใบ 070, and the one note that carried it (`สีในชีตต้องให้คนตรวจ (#hex)`, written by `lib/sync.ts`) is
overwritten with
`"คนตรวจยืนยันแล้ว"` the moment the row is resolved. There is no `TeachSession.reviewedAt` and no
`ColorRule.updatedAt`, so "reviewed *because of* this rule" cannot be told from "reviewed a year
earlier about a missing trainer name".

ว่ายน้ำ is why that is the guaranteed path rather than a corner: `prisma/seed.ts` gives the sheet
`trainer: null`, so every payable swim คาบ is hand-cleared by construction. Retiring on
`pending === 0` meant the honest answer **ให้คนตรวจ** silenced all three screens in the same page
load, over 40 × 250 = **10,000 ฿** nobody had looked at — the first blocker through a new door. ⇒ such
a colour is still emitted, at `pending: 0`, and the swatch says what is actually known:
*"n คาบถูกตรวจด้วยมือไว้ก่อนที่หน้าคิวจะแสดงสี"* — neutral, not red, because the repair is a second
look rather than an ข้าม, and it links at the same `?hex=` view.

⚠️ **ใบ 070 put a `bgColor` column on the queue, and that does not retire this paragraph.** A
reviewer can be shown the colour from now on; the rows this count is about were cleared before the
column existed, and with no `reviewedAt` there is still nothing to date a review against a rule.

⚠️ **Emptying the list on a genuinely completed review needs `reviewedAt` + `ColorRule.updatedAt`
and a comparison** — schema, and §2 rule 8 makes that one-way ⇒ its own card, not this one. Until
then the fold errs in the direction §2 rule 4 names as the cheaper one.

🔑 `pay` is the only answer that can retire a colour by itself, because it is the only one that
*agrees* with what the rows already are. A report that went quiet on the owner's correct answer
would buy silence instead of a fix — the failure this card exists to prevent, entered through the
screen instead of through the engine. (`payroll-auditor` BLOCKed the first version for exactly this.)

## Where it is read

| Screen | Query | Why that scope |
|---|---|---|
| `/` and `/payslips` | `colorGapsInPeriod` — **`runPayroll`'s own filter**: `status: "ok"` · the period window · `staffId: { not: null }` | the count on each swatch is presented as money about to go out, and is the only thing the owner has to rank 28–41 colours by ⇒ it must be the number that will be paid. A row with no trainer is paid to nobody. ⚠️ An **undated** row is therefore in no period here — it is payable by no run either; it surfaces in the row below |
| `/admin/config` | `colorGapsSeen` — the same filter, no date window | the owner is ruling on a **colour**; answered once, it is answered for every period |

`runBlockers()` carries it as `colorGaps` — a **list, not a count**, and it is never summed into the other two —
they are rows to repair, this is a question nobody has answered, and the answer is per colour.
`ColorSwatches` (`app/_components/color-swatches.tsx`) renders it identically on all three screens:
swatch + hex + count. 🔑 The inline `background` there is the only hex this project writes outside
`app/globals.css`, and it is not a design decision — it is the datum. A swatch that approximates the
cell's colour is a swatch nobody can match against their own sheet.

On `/admin/config` each unruled colour is its **own one-click form** (hidden hex + the same
`meaning` dropdown + save), because an owner asked to retype a hex they were just shown answers
fewer of them.

📌 **ใบ 082 touched `app/sync/review/page.tsx` and changed nothing on this card's surface.** Its
`resolve` gained a second date guard (`err=dateRange`) and the page's five refusal notices moved to
`_components/refusal-notice.tsx` for §4's ceiling. The colour listings, the two states above and the
`?ignored=1` return path are untouched — the guard and its flag are
[form-refusals.md](form-refusals.md)'s, the window itself [date-window.md](date-window.md)'s.
