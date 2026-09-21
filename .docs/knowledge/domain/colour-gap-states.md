---
sources:
  # The two states, `pending`, and the two queries that feed the screens.
  - lib/color-rules.ts
  # The one home for "which queues block a run" — this gap is its third member.
  - lib/run-blockers.ts
  # The one renderer all three screens share.
  - app/_components/color-swatches.tsx
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
| `unapplied` | ruled `skip`/`review`, payable คาบ still **disagree** with it | **re-sync** — except the `reviewedSessions`, which no sync will ever re-evaluate and which **no screen in this app can repair today** ([070](../../../tasks/todo/070-no-screen-can-skip-a-hand-reviewed-payable-session.md)) |

🔴 **`/sync/review` is not the exit, and saying it was is the mistake both review lanes caught.** Its
listing is `NEEDS_ATTENTION` = `status: "needs_review"` **or** (`status: "ok"` and `staffId: null`);
a hand-reviewed คาบ is `status: "ok"` *with* a trainer and matches neither arm. The `ignore` action
that would repair it exists on that page — only the listing excludes it. Until 070 lands, the copy
says so rather than sending the owner to a screen where the rows are not, because the only action
that *would* clear such an entry is re-ruling the colour to `pay`, i.e. declaring a cancelled colour
payable for ever. ⚠️ That is the one working button on the screen, so the copy also says not to use
it — the trap removed from the dropdown, re-entered one level up.

🔑 **`pending`, not `sessions`, is the number the screens lead with** — the คาบ that *openly*
disagree. Under `skip` that is every payable row (a human clearing one said "pay", the colour says
"do not"; which wins is [066](../../../tasks/todo-human/066-may-a-human-dismiss-an-import-problem.md)
and [069](../../../tasks/todo/069-a-recoloured-reviewed-row-is-invisible-to-every-screen.md)'s
question, not this fold's). Under `review` a hand-cleared row is not in open conflict, because a
human being there is what the rule asked for.

🔴 **But `pending === 0` never retires a colour, and believing it did was this card's third
blocker.** `reviewed: true` records that somebody resolved the row's **parse** problem — it is not
evidence that anybody looked at its **colour**. `/sync/review` never renders `bgColor`, and the one
note that did carry it (`สีในชีตต้องให้คนตรวจ (#hex)`, written by `lib/sync.ts`) is overwritten with
`"คนตรวจยืนยันแล้ว"` the moment the row is resolved. There is no `TeachSession.reviewedAt` and no
`ColorRule.updatedAt`, so "reviewed *because of* this rule" cannot be told from "reviewed a year
earlier about a missing trainer name".

ว่ายน้ำ is why that is the guaranteed path rather than a corner: `prisma/seed.ts` gives the sheet
`trainer: null`, so every payable swim คาบ is hand-cleared by construction. Retiring on
`pending === 0` meant the honest answer **ให้คนตรวจ** silenced all three screens in the same page
load, over 40 × 250 = **10,000 ฿** nobody had looked at — the first blocker through a new door. ⇒ such
a colour is still emitted, at `pending: 0`, and the swatch says what is actually known:
*"n คาบถูกตรวจด้วยมือไว้ โดยหน้าคิวรอตรวจไม่เคยแสดงสีให้คนตรวจเห็น"* — neutral, not red, because the
repair is [070](../../../tasks/todo/070-no-screen-can-skip-a-hand-reviewed-payable-session.md)'s
re-queue rather than an ข้าม.

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
