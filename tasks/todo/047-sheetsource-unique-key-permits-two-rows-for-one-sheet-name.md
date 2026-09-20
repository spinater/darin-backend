# `SheetSource`'s unique key permits two rows for one sheet name, and the same คาบ is paid twice

- status: todo
- commit:

## Goal

`SheetSource` is keyed `@@unique([spreadsheetId, sheetName])`. Two rows may therefore share a
`sheetName` as long as their `spreadsheetId` differs — and nothing downstream is built for that:

- `lib/sync.ts` fetches **per distinct spreadsheet id** and syncs every `active` source.
- `TeachSession`'s `@@unique([sourceId, rowIndex, colIndex])` does **not** span sources, so the same
  cell of the same sheet, reached through two `SheetSource` rows, becomes **two** `TeachSession`
  rows.
- Both are `status: "ok"` with a real `staffId`, so the payslip pays both: จิ้บ's 40 คาบ × 200 ฿
  becomes **16,000 ฿ instead of 8,000 ฿**, with `warnings: []`.
- `fixtureGaps()` in `prisma/seed.ts` matches on `sheetName` alone, so it reports **no gap** — and
  nothing else in the repo looks at all.

The route that used to create such a pair is closed.
[Task 040](../done/040-seed-recreates-a-rate-the-owner-deliberately-deleted.md) closed it: the seed's
`SheetSource` upsert keyed on a `spreadsheetId` it computed itself, so the moment the owner
corrected the id at `/admin/config` the lookup missed and the upsert took `create`. That upsert now
runs only under `plantsFixture`, i.e. on a database with zero staff, where an owner-corrected id
cannot exist. **Closed, not narrowed** — both review lanes checked it.

What remains is the schema, and one database:

1. The key still *permits* the pair, so any future writer (the add form in
   [046](046-no-screen-can-add-a-class-price-or-a-sheet-source.md), a hand-typed row, a restore)
   re-opens it with no error.
2. **A database that already carries such a pair keeps it forever.** Nothing deletes one, and the
   seed will never touch `SheetSource` again.

## Decision needed (architect, §2 rule 8)

Whether the key becomes `@@unique([sheetName])` is a **one-way call**: `prisma db push` has no
migration history and no down path, and a unique constraint added over existing data **fails the
push** if a duplicate is present — which on the deploy host means `migrate` exits non-zero and
`app` never starts (`depends_on: … service_completed_successfully`). So the order matters:

1. check the live database for duplicates **first** (below), and resolve them by hand;
2. only then decide the key.

Alternatives to weigh rather than assume: unique on `sheetName`; unique on `[spreadsheetId,
sheetName]` plus a *partial* unique on `sheetName` where `active`; or leaving the key and detecting
the pair loudly at sync time. The engine's grid→source match is by sheet name, which is the fact
that makes name collision the harmful one.

## Notes

- Opened out of the task 040 review round, 2026-09-20 (`payroll-auditor` finding 4, judged a
  residual rather than part of 040).
- The one-off pre-deploy check is recorded in
  [tasks/todo-human/002-deploy-host-setup.md](../todo-human/002-deploy-host-setup.md):
  `SELECT "sheetName" FROM "SheetSource" GROUP BY 1 HAVING count(*) > 1` must return no rows.
- §9 routing: schema decision ⇒ `architect` first, then `code-reviewer` + `payroll-auditor`
  (the diff moves `prisma/schema.prisma` and the money is a doubled คาบ). Not the `claude-tekton`
  lane.
