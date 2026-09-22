---
sources:
  # The fold, the closed `meaning` set, and the neutral-background decision.
  - lib/color-rules.ts
  # The pin on all of it — the fold is the only pure half.
  - lib/color-rules.test.ts
  # ใบ 070 moved the colour refusals here from form-refusals.md; this is where addColor lives.
  - app/admin/config/_actions.ts
  # …and the screen the second set of refusals belongs to.
  - app/sync/review/page.tsx
  # The reader: the one place a colour turns into `ignored` / `needs_review`, and the place an
  # unknown colour becomes silence.
  - lib/sync.ts
---

# กฎสีในชีต — สีที่ไม่มีใครรับรองคือสีที่ระบบจ่ายให้

The counter staff cancel a คาบ by colouring its cell. `ColorRule` (hex → `pay` | `skip` | `review`)
is how that becomes money, and this card owns **what happens when the colour is not in the table**.
Task **043**.

## The gap, and which way it errs

`syncSources()` loads the whole table into a `Map` once per run and looks each cell's `bgColor` up:

```ts
const rule = p.bgColor ? colorRules.get(p.bgColor.toLowerCase()) : undefined;
if (rule === "skip") status = "ignored";
else if (rule === "review" && status === "ok") status = "needs_review";
```

🔴 **`undefined` is not a branch.** A colour with no rule falls through both arms and the row is
stored `status: "ok"` with **`warnings: []`** — nothing about it is undecided as far as the engine
can tell, so no `PayslipWarning`, no review queue, no screen. On a database nobody has configured
the map is empty and that is **every coloured row**. The cost is a whole colour's worth of คาบ per
month, in the direction of paying **too much**, noticed at payday if at all — CLAUDE.md §2 rule 4's
most expensive shape.

⚠️ Both the other blocker numbers on `/` and `/payslips` report pay that will come out **short**.
This one is the only one that reports it coming out **long**, which is why its copy says so instead
of borrowing theirs.

## Why nothing here guesses — and why seeding is not the answer

- **Defaulting an unknown colour to `needs_review`** puts the entire first sync in the review queue.
  A queue that is 100% noise on day one is a queue everyone learns to click through, and then the
  colour that *did* mean "ยกเลิก" is clicked through with it.
- **Defaulting to `skip`** withholds pay on a guess. Wrong in the direction a trainer notices,
  which is worse, not better.
- **Seeding the table** would contradict [task 040](../../../tasks/done/040-seed-recreates-a-rate-the-owner-deliberately-deleted.md)
  — the card that stopped the seed asserting reference data over an owner's decisions — and, more
  simply, **which hex means "cancelled" is a fact nobody in this repo has.** It lives with the
  counter staff. A wrong colour pays or withholds exactly like a wrong rate.

⇒ the gap is **reported**, never closed by code. `lib/color-rules.ts` names the colours on คาบ this
payroll would pay that nobody has vouched for, with a count each, and the owner answers each once.

## The fold (`colorGaps`) — three decisions worth knowing

1. **`pay` retires a colour on its own; `skip`/`review` retire it only once the rows follow.** Most
   colours mean nothing in particular, and the queue reaches zero because "จ่ายปกติ" agrees with
   rows that are already `ok`. ⚠️ A `meaning` outside `COLOR_MEANINGS` counts as **unruled**, not as
   an answer — `lib/sync.ts` branches on `=== "skip"`/`=== "review"` and falls through to paying, so
   the report must say what the sync does, not what the row claims. `addColor` refuses to store one.
2. **Case is not part of a colour.** Google returns `#B6D7A8`, `addColor` stores lowercase, and
   `syncSources()` lowercases both sides before its lookup. This fold folds both sides too, or the
   same colour is listed as unruled right beside its own rule.
3. **An uncoloured cell is never reported.** `rgbToHex()` in `lib/sheets.ts` renders an unstyled
   cell as `#ffffff`, and the xlsx path renders a deliberately white fill as `#ffffff` too — **the
   same bytes**, so a white signal is not filtered out here, it is not in the data to be found.
   White is the background of almost every row on every sheet (`NEUTRAL_BG`).
   🔴 **`addColor` therefore refuses to store a rule for `#ffffff`.** Such a rule cannot be aimed:
   `skip` on white turns *every uncoloured row on every sheet* `ignored` at the next sync — a month
   of ~320 payable คาบ out of every slip, down to `baseSalary`, `warnings: []`, and no queue to show
   for it. It is the largest blast radius any one row in this database has.

Sorted loudest first. 🔑 **What "loudest" counts is `pending`, not the raw total, and a colour does
not leave this list when it is answered — it leaves when the rows follow.** Both are
[colour-gap-states.md](colour-gap-states.md), which owns everything after the owner answers.

## What is not proven

`bun test` here reaches no database ([../ops/gate-tiers-and-pins.md](../ops/gate-tiers-and-pins.md)),
so the period window, the `status: "ok"` / `staffId` filter and the `groupBy` are **reviewed, not
asserted**.

⚠️ **`reviewedSessions` now has a consumer, and it is untested for the same reason.** ใบ 070 turned
that count into a link — `/sync/review?hex=<hex>`, whose listing mirrors `colorGapsSeen()`'s filter
(`status: "ok"` · `staffId: { not: null }` · the hex, case-insensitively · every period). The fold
that produces the number is pinned; **the query behind the link is not**, and neither is the fact
that the two agree. Both are database work, so they wait on
[015](../../../tasks/todo/015-db-test-lane.md) like the rest of this section.

🔴 **One blind spot, and it is in the data rather than in the fold:** a **hand-reviewed** row that is
later *recoloured* in the sheet. `syncSources()` re-opens a `reviewed: true` row only when its
**text** changes, so it `continue`s past the colour and the database keeps the old `bgColor` — the
new colour exists only at sync time, in `p.bgColor`, one line above the `continue`. This is the one
case where the event would have seen more than the state, and the ว่ายน้ำ sheet is entirely inside
it (every row there is hand-reviewed by construction). Carded as
[069](../../../tasks/todo/069-a-recoloured-reviewed-row-is-invisible-to-every-screen.md); the repair
is in `lib/sync.ts`, so it is money-path work and does not belong here.

The fold is pinned at 14 and counter-tested (2026-09-21), one mutant at a time per
[067](../../../tasks/todo/067-counter-test-restore-is-one-shot-and-that-breaks-its-own-evidence.md):
`if (meaning === "pay")` → `if (meaning)` (round 1's exact defect) **3 fail** · dropping the `review`
asymmetry from `pending` **2 fail** · dropping `|| reviewedSessions > 0` (round 3's exact defect)
**1 fail**. ⚠️ A fourth, `pending > 0` → `>= 0`, is **subsumed** on this fold (the `||` already admits
every entry) and is recorded as retired in ใบ 043 rather than left in the list.

⚠️ **`addColor` still validates nothing about the hex's *shape*** — `"ฟ้า"` is accepted and stored as
a rule that can never match a cell. The two refusals ใบ 043 did add (a `meaning` outside the closed
set · `#ffffff`) are on the *meaning* and on the *one hex that is unaimable*, not on the format.
Out of scope for 043; it belongs with the form-refusal work in [form-refusals.md](form-refusals.md),
which also owns the claim that `addColor` lowercases what it stores.

⚠️ **No screen can delete a `ColorRule`** — the same gap [041](../../../tasks/todo/041-no-way-to-remove-a-registered-activity.md)
has for activities. A colour ruled wrongly can be re-ruled, so nothing is unrepairable; a rule for
`#ffffff` created before ใบ 043's refusal could not be removed from any screen, and none exists.

## The refusals of the two colour screens (moved here from [form-refusals.md](form-refusals.md) at ใบ 070)

They keep that card's surface — a **flag**, not a message; a clean-URL redirect; **loud**, never a
silent `return`. Here is *which* value each refuses, and why the money says so.

### ใบ 043 — `addColor` gained a second entry point **and its first two refusals**

`/admin/config` renders one `<form action={addColor}>` per colour in the gap list: hidden hex, a
`meaning` dropdown with **no default** ([colour-gap-states.md](colour-gap-states.md)). ⚠️ `addColor`
/`addAlias` moved to `app/admin/config/_actions.ts` (the page had hit the 450-line warn), each
re-asserting `requireAdmin()` because a server action is its own entry point · `note` is written only
when the field is present (`formData.has`) — the quick form carries none and `?? ""` blanked the
rule's reason. The two **refusals**, both silent-*overpay* guards:

- **`meaning` must be in `COLOR_MEANINGS`** → `?err=colorMeaning`. `lib/sync.ts` branches on
  `=== "skip"`/`=== "review"` and falls through everything else ⇒ `""` or a typo stores a rule that
  pays every คาบ of that colour while the owner believes they answered. 🔑 The dropdown's empty
  placeholder and this refusal are a **pair**: without it the placeholder's `""` would be stored.
- **`#ffffff` is refused outright** → `?err=colorNeutral`. An unstyled cell and a deliberate white
  fill are the same bytes ⇒ the rule cannot be aimed: `skip` on white takes a month of ~320 payable
  คาบ out of every slip. The only guard here refusing a value no wording could make safe.
🔴 **Both are loud**; they shipped silent and both review lanes called it — a refusal the owner does
not see leaves them believing a rule is in force, ใบ 043's own defect through the form (same reason
as ใบ 034's `addActivity` and ใบ 027's `addStaff`). ⚠️ Their copy is a **separate** map
(`COLOR_REASONS` in `save-notice.tsx`), because the four `REASONS` say *"ยังไม่ได้บันทึกอะไรเลยสักช่อง"*
— true of a form of several dozen fields, a fault rather than a refusal about a one-field form.
⚠️ The empty-hex `return` stays silent, made unreachable by `required` rather than given a third
flag — a missing value, not one that would have paid. 🔴 **Still no guard on the hex's *shape* at
this end**: `"ฟ้า"` is stored as a rule no cell can match (pre-existing). ⚠️ `addColor` revalidates
through `revalidateColorGaps()` (`lib/revalidate.ts`) since ใบ 070 — the same list the ข้าม below uses.

## `/sync/review` — refusals on the first screen that takes money *off* a slip (ใบ 070)

The older ข้าม needed none — its rows were `needs_review`, which `runPayroll` never paid. The `?hex=`
listing holds `status: "ok"` rows **being paid**, so the same button is a money action.

| Refusal | Shape | Flag |
|---|---|---|
| `?hex=` not `^#[0-9a-f]{6}$`, or `#ffffff` — `isReportableHex` | no listing at all; a notice replaces it | — (nothing was submitted) |
| no rule for that colour, or ruled `pay` | same, pointing at `/admin/config` | — |
| ข้าม / เอากลับเข้าคิว on a คาบ in a period whose slip left `draft` | refused per row, dropped from a bulk submit | `?err=closed` |

🔴 The hex guard **is** the `#ffffff` refusal above, one screen along: refusing to *store* a white rule
buys nothing while a second screen will *aim* at white. Its shape half is not cosmetic either — `mode:
"insensitive"` compiles to `ILIKE`, where `%` and `_` are **wildcards**.

🔴 `?err=closed` is the one refusal about money **already gone**: `runPayroll` will not recompute a
non-`draft` slip, so ข้าม there takes nothing back and only switches off the report still saying the
colour is being paid (9,500 ฿ measured). ⚠️ The row stays **listed** as `งวดปิดแล้ว` with no button,
and the check re-runs **inside** the action — a tab opened before the approval posts to an action
that never re-rendered the page.
