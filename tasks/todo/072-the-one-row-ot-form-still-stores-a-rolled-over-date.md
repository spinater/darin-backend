# `/ot`'s one-row form still stores a date that silently moved to the next month

- status: todo
- commit:

## Goal

`app/ot/page.tsx`'s `add` action builds its date with no validation:

```ts
const date = new Date(String(formData.get("date")) + "T00:00:00Z");
```

and writes it straight to `db.otEntry.upsert`. `POST date=2026-06-31` stores **`2026-07-01`**.

That day's OT then lands in the **next month's payroll period** — `periodRange` is
`[2026-06-01, 2026-07-01)`, so June loses it and July gains it — and because the upsert key is
`(staffId, date)`, it **overwrites** whatever real row that person already had on 1 July. A true
record is destroyed and nothing is said (CLAUDE.md §2 rule 4).

Priced by `payroll-auditor` on the paste path, where the same bug was closed: `Nok · 2026-06-31 ·
12 h` moved `3 × 40 = 120 ฿` out of June, and the overwritten 1 July row (11 h) turned `2 × 40 =
80 ฿` into something nobody typed.

## Why this is its own card

Task 014 closed exactly this hole on the **paste** path — `lib/ot-import.ts`'s `calendarDate()`
round-trips the ISO day back out of the `Date` and refuses anything that shifted, because
`Number.isNaN(getTime())` does not catch a rollover. The one-row form 30 lines above was left
alone on purpose: it is a different server action, the defect is pre-existing, and task 013's
round 1 recorded what happens when a predicate is widened after the last review gate has answered.

The asymmetry inside one file is the thing to fix. `app/ot/page.tsx` already argues, for `hours`,
that `type="date"` is a *client* hint and a server action is a plain HTTP endpoint where "every
wrong shape is silent" — and then applies that reasoning to one of its two fields.

## Scope

- Export `calendarDate` from `lib/ot-import.ts` (it is module-private today) and use it in `add`:
  refuse a non-calendar date before the write and `redirect(… &err=date)`, the same shape `hours`
  already uses for `err=hours`.
- The notice needs its own Thai copy and must name **both** halves — "อ่านไม่ออก" alone sends the
  admin hunting a typo when the value was `2026-06-31` and looked fine. Reuse the wording task 014
  settled on for the `invalidDates` box.
- Check whether `del` and any other action on this screen take a date from the client too.
- Test + junit pin raise in the same change (§7).

## Notes

- Found by `code-reviewer` in the task 014 review round, explicitly ruled out of 014's scope as
  pre-existing and in a different action.
- Related: [014](014-ot-import-atomicity.md) (the paste path, where `calendarDate` comes from) ·
  [013](013-payslip-lifecycle-integrity.md) item 4 (the same "a server action is a plain HTTP
  endpoint" argument, applied to `Number()` fields).
