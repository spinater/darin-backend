# Nothing seeds `ColorRule`, so a fresh database pays every colour

- status: todo
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

[Task 040](../done/040-seed-recreates-a-rate-the-owner-deliberately-deleted.md) is the card that stopped the
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
