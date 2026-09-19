# `addActivity` seeds every rank at rate 0, so a new activity can never warn — it pays 0 ฿ silently

- status: todo
- commit:

## Goal

`addActivity` creates a `TeachRate` row for **all three ranks at rate `0`** when an admin adds an
activity (`app/admin/config/page.tsx:137-142`):

```ts
for (const rank of RANKS)
  await db.teachRate.upsert({
    where: { activity_rank: { activity, rank } },
    update: {},
    create: { activity, rank, rate: 0 },
  });
```

So the activity is **never "unconfigured"**, and CLAUDE.md §2 rule 4's warning — the one thing that
makes an unset rate visible — cannot fire for anything added through the screen.

**Worked example** (verified by `payroll-auditor` on 2026-09-19, with the reference figures from the
seeded matrix):

1. an admin adds `boxing` through "เพิ่มกิจกรรมใหม่". Three rows land at `rate 0`;
2. an **ST** trainer teaches **12** `boxing` sessions in September;
3. `teachRates.get("boxing")?.get("ST")` returns `0`, not `undefined` ⇒ `rate == null` at
   `lib/payroll.ts:122` is **false** ⇒ the payslip reads
   `ค่าสอน boxing · 12 คาบ · 0 ฿/คาบ · 0 ฿`, `teachPay 0`, `warnings: []`;
4. at the ST rate the seeded `pt` row carries (400 ฿) that trainer is **4,800 ฿ short and nothing on
   the slip says so**.

Contrast `yoga`, which has no rows at all and warns correctly (pinned at `lib/payroll.test.ts:78`).
The difference is not the money — it is whether anyone finds out.

## Why a stored `0` cannot simply be read as "not set"

Because the screen already gives `0` a *different, deliberate* meaning. The bulk save **deletes** a
rate when its box is left blank (`lib/config-form.ts:87`, and the amber note under the table says so)
⇒ a `0` that an owner typed means **"chosen: this rank does not get paid for this activity"**, and
`addActivity` is the one place in the repo that stores an *unchosen* `0`. Making the engine treat `0`
as missing would silently overrule the owner's choice in the other direction.

REQUIREMENTS.md §1.2 and §4 item 3 both describe the rate matrix as fully editable with new
activities addable, which is what makes the seeded-zero row look harmless: the screen shows the new
row immediately and the number in it looks like a value, not a placeholder.

## Scope — a decision first, then the patch

🔴 **`architect` picks between these two before anything is written** — it is a schema question, and
CLAUDE.md §2 rule 8 makes a schema change one-way (`prisma db push`, no down path, back up first):

- **`addActivity` stops writing rate rows at all.** Then "no row" means "not set" everywhere and the
  §2 rule 4 warning does its job. Cost: the config page derives its activity list *from the rate rows*
  (`app/admin/config/page.tsx:44` — `[...new Set([...rates.map(r => r.activity), "yoga"])]`), so the
  listing mechanism has to move somewhere else (an `Activity` table, or a distinct list unioned from
  the sessions actually recorded). Note the hardcoded `"yoga"` on that line is itself a §2 rule 7
  smell to resolve in the same breath.
- **`TeachRate.rate` becomes nullable**, so "never set" (`null`) and "set to 0" are distinguishable in
  the column. Cost: a schema change on a money table, every read of `rate` retyped, and `prisma db
  push` with no migration history.

Whichever wins, the acceptance test is the same and belongs in the engine's suite: an activity that
exists with **no chosen rate** for a rank must warn `ไม่มีเรทค่าสอน …` and pay nothing, while an
activity whose rate an owner deliberately set to `0` must pay `0` **without** a warning and still
emit its line. (That second half is also task 037's boundary pair — coordinate, do not write it twice.)

Also worth fixing while the action is open: `upsert … update: {}` means re-adding an existing activity
reports nothing at all. That is idempotent rather than a refusal, but the screen says nothing either
way and the notice surface now exists (`app/admin/config/_components/add-activity-form.tsx`).

## Who reviews this

Money path and probably the schema ⇒ CLAUDE.md §9's path list ⇒ **`code-reviewer` + `payroll-auditor`**,
with `architect` *before* implementation for the choice above. Not the `claude-tekton` lane: §9 keeps
money and schema out of it, and the whole card is one undecided question.

## Notes

- Found by `payroll-auditor` (Major) during the task 034 review, 2026-09-19. **Pre-existing on
  `develop`** and in no line task 034's diff moved — but it silences the exact warning task 034 just
  restored, which is why it is carded immediately rather than "next time someone touches that screen".
- Related, same failure, different road: [task 035](035-activity-name-with-a-pipe-overwrites-another-rate.md)
  (a `|` in the name overwrites another activity's rate with 0).
- A thing task 034 bought that its own card does not claim, recorded so nobody re-derives it: the
  `Map` also closed the **rank** dimension. Under the old object fold a rank string that is a
  prototype key returned a *function* (`teachRates["pt"]?.["toString"]`), `rate == null` was false,
  and `money(qty * fn)` made `teachPay`, `net` and every `Payslip` total for that staff member `NaN`.
  Ranks come from the closed `RANKS` list today, so it was latent; it is now structurally gone.
