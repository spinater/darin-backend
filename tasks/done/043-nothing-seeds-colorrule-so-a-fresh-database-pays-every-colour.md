# Nothing seeds `ColorRule`, so a fresh database pays every colour

- status: done
- commit:

## Goal

`lib/sync.ts` reads the colour→meaning table before it writes sessions:

```ts
const colorRules = new Map((await db.colorRule.findMany()).map((c) => [c.hex.toLowerCase(), c.meaning]));
…
const rule = p.bgColor ? colorRules.get(p.bgColor.toLowerCase()) : undefined;
if (rule === "skip") status = "ignored";
else if (rule === "review" && status === "ok") status = "needs_review";
```

On a database nobody has configured, `colorRules` is **empty**, every lookup is `undefined`, and
every coloured row syncs as `status: "ok"`. The screen already states the consequence in Thai
(`app/admin/config/_components/sheet-mapping.tsx`):

> ชีตใช้สีพื้น 28–41 แบบ ถ้าสีไหนแปลว่า "ยกเลิก/ไม่จ่าย" ต้องตั้งที่นี่ **ไม่งั้นระบบจะจ่ายให้ทุกสี**

The counter staff cancel a session by colouring its cell. A cancelled คาบ that syncs as `ok` is a
คาบ that reaches a payslip — with `warnings: []`, because nothing about the row is undecided as far
as the engine can tell. That is CLAUDE.md §2 rule 4's most expensive shape, and the amount is a
whole colour's worth of sessions per month, not one row.

## Why this is a card and not a seed line

[Task 040](040-seed-recreates-a-rate-the-owner-deliberately-deleted.md) is the card that stopped the
seed asserting reference data over an owner's decisions. Seeding `ColorRule` would contradict it in
the same commit that shipped it — and worse, **colour→meaning is a business fact nobody in this
repo has**. Which hex means "cancelled" is a thing the counter staff know, and a wrong guess pays
or withholds exactly like a wrong rate. `addColor` in `app/admin/config/page.tsx` is the only writer
today and that is correct; what is missing is a way to **notice** the table is empty.

## Scope

- Decide the loud direction: most likely a banner on `app/page.tsx` (the "ต้องเคลียร์ก่อนจ่ายจริง"
  block) and/or a `SyncResult` warning when a sync met background colours it has no rule for.
  Counting **distinct unmatched colours seen this sync** is cheap — `lib/sync.ts` already has
  `p.bgColor` in hand at the line above.
- ⚠️ Do **not** default `rule === undefined` to `needs_review`: that puts the entire first sync in
  the review queue and trains everyone to click through it. The gap is to be *reported*, not
  guessed at.
- Tell the owner **which** colours are unruled, with counts — `/admin/config` already renders the
  swatches, so the missing half is the ones the sheet uses and the table does not have.

## Notes

- Opened out of the task 040 review round (`code-reviewer` finding 4, 2026-09-20). Task 040's own
  Decision section promised this card existed; it did not.
- Pre-existing: no part of this arrived with 040. What 040 changed is that the seed will now
  **never** create these rows on an in-use database, so "it will sort itself out on the next deploy"
  was never true and is now not even arguable.

## Decision (2026-09-21)

**Report, do not guess, do not seed** — the card's own direction, taken as written. The gap becomes a
list of *the colours on คาบ this payroll would pay that nobody has vouched for*, with a count each,
on the three screens where someone can act on it. `lib/sync.ts` and the engine are untouched.

🔴 **The design changed once, in review.** The first version retired a colour from the list the
moment a `ColorRule` existed for it. `payroll-auditor` BLOCKed that: `ColorRule` is applied **at sync
time only**, and `syncSources()` skips a `reviewed: true` row *before* the colour lookup, so writing
the rule does not move the คาบ already in the database. The ว่ายน้ำ sheet is 100% hand-reviewed by
construction ⇒ 12 คาบ × 250 = **3,000 ฿** paid for คาบ the owner had just answered "ไม่จ่าย", with
the only screen that said so switched off **by their own correct answer**. The fold now reports two
states and a colour leaves only when the rows agree with its rule.

| Decision | Why this way |
|---|---|
| Two states: `unruled` (nobody answered) · `unapplied` (answered, rows do not obey yet) | Different repairs — answer the colour, vs re-sync it — and the second is the one the owner believes is closed. A list that rendered them the same would read as progress |
| `pending`, not `sessions`, is the number the screens **lead with** — and it is `sessions − reviewedSessions` **for `review` only** | It counts the คาบ that *openly* disagree. Under `skip` that is every payable row (a human clearing one said "pay", the colour says "do not"; which wins is ใบ 066/069's question, not this fold's). Under `review` a hand-cleared row is not in open conflict, because a human being there is what the rule asked for |
| 🔴 But `pending === 0` **never retires a colour** — it is still emitted, with its own neutral sentence | `reviewed: true` records that somebody resolved the row's **parse** problem; it is not evidence anybody saw its **colour**. `/sync/review` never renders `bgColor`, the one note that carried it is overwritten with `"คนตรวจยืนยันแล้ว"` on resolve, and there is no `reviewedAt` to date it against the rule. On ว่ายน้ำ — every payable คาบ hand-cleared by construction — retiring on `pending === 0` meant the honest answer **ให้คนตรวจ** silenced all three screens in one page load over 40 × 250 = **10,000 ฿** nobody had looked at. ⚠️ Emptying the list on a genuinely completed review needs `reviewedAt` + `ColorRule.updatedAt` ⇒ schema, §2 rule 8 one-way, its own card |
| The `reviewedSessions` copy says **"ยังไม่มีหน้าจอไหนแก้ได้ (ใบ 070)"**, and does not link `/sync/review` | It cannot: that page lists `NEEDS_ATTENTION` = `needs_review` **or** (`ok` and `staffId: null`), and a hand-reviewed คาบ is `ok` *with* a trainer ⇒ matches neither arm. Naming a repair that does not exist sends the owner to do what they already did — the lesson this repo already paid for eight lines above the new box on `/payslips` |
| The per-colour form on an `unapplied` colour says **เปลี่ยนความหมาย**, not บันทึก | A bare "บันทึก" beside an empty dropdown reads as "this colour is unanswered", and the only selection that makes the red entry disappear is `pay` — the trap removed from the dropdown, re-entered one level up |
| Both refusals redirect with `?err=` instead of returning silently | A refusal the owner does not see leaves them believing a rule is in force — ใบ 043's own defect through the form. Same precedent as ใบ 034 `addActivity` and ใบ 027 `addStaff` |
| `addAlias`/`addColor` moved to `app/admin/config/_actions.ts` | The refusals pushed `page.tsx` past §4's 450-line warn. The §4 seam for a page is its co-located modules, and these two are the piece that is not payroll configuration and not in the bulk `save` transaction |
| `reviewedSessions` carried on every entry | `syncSources()` skips `reviewed: true` before the lookup ⇒ **no sync will ever repair those rows**. They send the owner to `/sync/review`, not to `/sync` |
| `pay` is the only answer that retires a colour by itself | It is the only one that *agrees* with rows that are already `ok`. Honouring only the existence of a rule is what the BLOCK above was |
| A `meaning` outside `COLOR_MEANINGS` counts as **unruled**, and `addColor` refuses to store one | `lib/sync.ts` tests `=== "skip"`/`=== "review"` and falls through to paying ⇒ the report must say what the sync does, not what the row claims |
| The per-colour dropdown has **no default**, and the empty value is refused | With "จ่ายปกติ" preselected, clearing a 41-colour list is one click per row and the cancel colour is retired to `pay` for ever — the card's own "queue everyone learns to click through", re-entered through the UI. The extra click costs one click; the default costs a month of คาบ |
| `addColor` refuses `#ffffff` | An unstyled cell and a deliberate white fill are the same bytes, so the rule cannot be aimed: `skip` on white turns ~320 payable คาบ `ignored` at the next sync — every slip down to `baseSalary`, `warnings: []`, no queue |
| `note` written only when the field is present | The quick form carries none; `?? ""` blanked the reason someone had written on the rule it upserts onto |
| A new pure fold `colorGaps()` in `lib/color-rules.ts`, with the two queries beside it | `bun test` reaches no database, so everything worth pinning has to be pure. The queries are reviewed, the fold is pinned at 12 |
| `#ffffff` and `null` are never reported (`NEUTRAL_BG`) | Both readers render an unstyled cell **and** a white fill as `#ffffff` ⇒ a white signal is not in the data to be found. Reporting it lights the banner on every row of every sheet for ever |
| Case folded on **both** sides | Google returns `#B6D7A8`, `addColor` stores lowercase, `syncSources()` lowercases both. Unfolded, a colour is listed beside its own rule |
| The third member of `runBlockers` is a **list**, never summed | The other two are rows to repair and both mean pay comes out *short*; this one means it comes out *long*, and each entry carries which repair it needs |
| The query mirrors `runPayroll`'s exactly — `status: "ok"` · period · `staffId: { not: null }` | The count is presented as money about to go out and is the only thing ranking 28–41 colours. A row with no trainer is paid to nobody. ⚠️ Consequence: an **undated** row is in no period here — it is payable by no run either, and `colorGapsSeen()` (no date window) is where such a colour surfaces |
| Copy names three §1.6 meanings, not one | REQUIREMENTS §1.6 lists จ่ายแล้ว / ยกเลิก / no-show / คนสอน / รอบแพ็ค. "คนสอน" pays the **wrong person** (+6,000 / −6,000 in one period, total unchanged ⇒ no total-level check catches it) and "จ่ายแล้ว" is a double-pay across two periods — an owner who knows the colour is not ยกเลิก would otherwise read the banner as not applying to them |
| One `<form>` per colour on `/admin/config` (hidden hex + the same dropdown) | An owner asked to retype a hex they were just shown answers fewer of them. No new action: it posts to the existing `addColor` |
| `lib/sync.ts` **not** touched — no `SyncResult.colorGaps` | The card says "and/or". State beats event: the DB-derived banner is true on every visit long after the sync, where a sync-time count scrolls away with the stream. ⚠️ **One case the event would see and the state cannot** — a `reviewed: true` row recoloured in the sheet: the text does not change, so the sync never writes the new `bgColor` and the database never learns the colour. Carded as **069** |

🔴 **What this card does NOT do:** it does not decide what any colour means, and it must not. Which
hex means "ยกเลิก" is a fact that lives with the counter staff — a wrong colour pays or withholds
exactly like a wrong rate, and [task 040](040-seed-recreates-a-rate-the-owner-deliberately-deleted.md)
is the card that stopped the seed asserting reference data over an owner's decisions.

## What shipped

- `lib/color-rules.ts` (new) · `lib/color-rules.test.ts` (new, pinned **14**)
- `lib/run-blockers.ts` — third member `colorGaps: ColorGap[]`
- `app/page.tsx` · `app/payslips/page.tsx` · `app/admin/config/page.tsx` ·
  `app/admin/config/_components/sheet-mapping.tsx` · `app/admin/config/_components/save-notice.tsx` ·
  `app/admin/config/_actions.ts` (new) · `app/_components/color-swatches.tsx` (new)
- knowledge: **two** new cards — `domain/sheet-colour-rules.md` (the rule, the fold) and
  `domain/colour-gap-states.md` (everything after the owner answers). Written as two from the start:
  one card carrying both halves came to 172 lines against §5's 120/170. Plus index rows and six
  cards whose `sources:` moved (`class-import-blockers` · `class-import-queue` · `form-refusals` ·
  `money-on-screen` · `payslip-lifecycle` · `teach-rate-lookup` · `ops/junit-pin-history`)
- follow-ons opened: **069** (a hand-reviewed row recoloured in the sheet is invisible to both) ·
  **070** (no screen can repair a hand-reviewed payable คาบ, so the `skip` rule has no exit)

**Counter-test (2026-09-21)**, one mutant at a time per ใบ 067, on the shipped fold:
`if (meaning === "pay")` → `if (meaning)` — round 1's exact defect — **3 fail** · dropping the
`review` asymmetry from `pending` **2 fail** · dropping `|| acc.reviewedSessions > 0` — round 3's
exact defect — **1 fail**.
⚠️ A fourth, `pending > 0` → `>= 0`, killed 1 arm on the **round-3** fold and is **subsumed** on the
shipped one — `|| acc.reviewedSessions > 0` already admits every entry, and no arm in the file feeds
a zero-`sessions` colour past the guard. Re-run today it is 0 fail, so it is recorded here as
retired rather than left in the list: **a counter-test number that cannot be reproduced reads as
proof an arm is load-bearing when it is not**, which is ใบ 067's own lesson.
(The first shape's three mutants — dropping the ruled set · dropping `.toLowerCase()` · sorting by
hex alone — were also all red, but that fold no longer exists.)

⚠️ **`scripts/counter-test.sh restore` is one-shot** — the first `restore` consumed the store and the
second and third silently did nothing, leaving two mutants stacked on the working tree. That is
exactly [card 067](../todo/067-counter-test-restore-is-one-shot-and-that-breaks-its-own-evidence.md),
observed live; the mutants were re-run one at a time with a `save` before each.

## Who reviewed this — three rounds, two BLOCKs, and what each bought

| Round | Lane | Verdict | What it changed |
|---|---|---|---|
| 1 | `code-reviewer` | PASS + 4 | the pre-selected `pay` option and the unvalidated `meaning`; the `/sync/review` blind spot became ใบ 069; the missing source answered by attributing the `addColor` claims to `form-refusals.md` |
| 1 | `payroll-auditor` | **BLOCK** | answered ≠ applied (the two states) · default answer pays · the upsert blanking the note · copy naming one of five §1.6 meanings · `staffId: null` counted as money · the `#ffffff` invitation ⇒ now a refusal |
| 2 | `payroll-auditor` | APPROVE-WITH-NITS | `review` had no terminal state ⇒ `pending` · the `/sync/review` copy named a repair that does not exist ⇒ ใบ 070 · the two refusals were silent ⇒ `?err=` |
| 2 | `code-reviewer` | **BLOCK** | independently the same `/sync/review` finding, plus: the per-colour form on an already-answered colour read as unanswered ⇒ **เปลี่ยนความหมาย** · counter-test the fold that actually shipped · `page.tsx` at the 450 warn ⇒ the `_actions.ts` split |
| 3 | `code-reviewer` | PASS + 5 | a stale function name in a doc-comment · four cross-card links pointing at the parent for claims the split moved to the child · `stranded` claiming "no screen can fix this" on an *unruled* colour, before anyone has answered · `required` on the typed hex box |
| 3 | `payroll-auditor` | **BLOCK** | it audited **its own round-2 request** and found the evidence does not exist: `reviewed: true` says nothing about a colour, so `pending === 0` may not retire one ⇒ the emit condition gained `\|\| reviewedSessions > 0` and the swatch gained the `unseen` sentence |
| 4 | `payroll-auditor` | **APPROVE** | checked the property rather than the diff — for every listed colour, every payable คาบ is named (`unruled`/`skip`: `pending = sessions` · `review`: `pending + unseen = sessions`). Two doc minors: the `ColorSwatches` header still taught the model round 3 overturned · one counter-test mutant no longer reproducible ⇒ retired, not carried forward |

🔑 **All three BLOCKs were the same class of defect: a screen going quiet while the money stayed
wrong.** Round 1 the fold retired a colour the moment it was answered; round 2 the copy named an exit
that does not exist, whose only working alternative was to rule the colour `pay`; round 3 the
`review` branch retired a colour on evidence (`reviewed: true`) that never meant what it was read to
mean. None was reachable by reading the diff — each needed someone to walk the owner's path to the
end, and round 3 needed the reviewer to doubt its own previous instruction.

## Notes — left open on purpose

- **`addColor` still validates nothing about the hex's *shape*.** `"ฟ้า"` is accepted and stored as a
  rule no cell can ever match. The new one-click path cannot produce one (it posts back a value the
  database gave it), so this is pre-existing and unchanged. It belongs with the form-refusal work.
- **No screen can delete a `ColorRule`** — same gap as [041](../todo/041-no-way-to-remove-a-registered-activity.md)
  has for activities. A colour ruled wrongly can be re-ruled, so nothing is unrepairable.
