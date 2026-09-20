# No screen can add a `ClassPrice` or a `SheetSource` — which is what makes withholding them cost

- status: todo
- commit:

## Goal

[Task 040](../done/040-seed-recreates-a-rate-the-owner-deliberately-deleted.md) stopped `prisma/seed.ts`
re-asserting the reference fixture on a database it did not create. For most tables that costs
nothing, because the owner can create the row at `/admin/config`. For **two** it costs something,
and 040 accepted the cost explicitly:

| Table | Who can create a row today |
|---|---|
| `ClassPrice` | **nobody** — `/admin/config` edits the price of a class that exists, and there is no add form |
| `SheetSource` | **nobody** — the screen re-points and re-maps an existing sheet; a new sheet has no path |

So a 14th class added in a later release, or a fifth sheet the counter staff start keeping, will
**not** reach the live database on deploy any more. 040's own reasoning for accepting that: absent
is *loud* (the class cannot be selected, and `seedReport` prints
`seed: in CLASSES but not in the database (no screen can add these): …` on every deploy), whereas
resurrected is *silent and pays*. That trade is right, and this card is the other half of it: the
loud state is supposed to be **temporary**, and today there is nothing to click when you see it.

## Scope

- An add form for `ClassPrice` at `/admin/config` (name + price). Both fields go through
  `lib/config-form.ts`'s number guard — a blank price must refuse, never save 0 (§2 rule 4 and
  task 013 item 4).
- An add form for `SheetSource` (spreadsheet id, sheet name, activity, `colMap`, `headerRows`).
  ⚠️ `colMap` is a `Json` column with seven positions, one of which (`trainer`) is legitimately
  `null` — design the input before writing it; a raw JSON textarea on a money-bearing table is not
  an answer.
- `requireRole()` on the page and on every action (CLAUDE.md auth rule — no gate watches this).
- ⚠️ Read [047](047-sheetsource-unique-key-permits-two-rows-for-one-sheet-name.md) **first**: adding
  a `SheetSource` by hand is the same door the duplicate-sheet defect comes through, and the unique
  key may move before this form is built.

## Notes

- Opened out of the task 040 review round, 2026-09-20 (architect design §11 d).
- Not urgent: today's 13 classes and 4 sheets are all planted, and the deploy log names any gap on
  every run. It becomes urgent the first time a release adds a class.
