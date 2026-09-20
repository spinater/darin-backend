# `/admin/config` renders only rows that exist, so a missing config key has no box

- status: todo
- commit:

## Goal

`/admin/config` builds the config form from `db.payrollConfig.findMany()` — the **rows**, not the
key set. A key that has no row therefore has no input, and no human can create it through the
product. Two things then hold at once:

- `num()` (`lib/config-keys.ts`) **throws** on a missing key, and `/ot` and `/classes` call it at
  page render ⇒ the screen that would let someone fix it is not the screen that breaks.
- The only repair is a `PayrollConfig` insert typed by hand against the live database, which is the
  kind of manual money-table surgery
  [029](../todo-human/029-sweep-rows-keyed-before-the-guards.md) exists to keep off the table.

This is exactly why [task 040](../done/040-seed-recreates-a-rate-the-owner-deliberately-deleted.md) had to
carve the `CONFIG_DEFAULTS` **key set** out as an exception to "the seed writes reference data
once": the seed asserts the keys on every run *because the product cannot*. The exception is sound,
but it is a workaround for this card.

## Scope

Render `CONFIG_DEFAULTS ∪ rows`, so a key the repo knows about always has a box:

- A key with no row renders as an **empty** box, not as its default — the default is a value nobody
  at this branch typed, and rendering it as if it were configured is the defect class task 036 and
  task 040 both closed one layer up.
- Saving that box **creates** the row. `lib/config-form.ts` refuses a blank numeric field today, so
  the empty state stays loud rather than saving 0.
- A row whose key is **not** in `CONFIG_DEFAULTS` must still render (the seed has no delete path —
  a key removed from the repo keeps its row, deliberately), so the union is a union in both
  directions, not a filter.

## Notes

- Opened out of the task 040 review round, 2026-09-20 (architect design §11 b).
- Sibling: [045](045-a-config-value-nobody-reviewed-never-reaches-the-banner.md) — this card gives a
  missing key a box; 045 is about a key whose value arrived from `CONFIG_DEFAULTS` and nobody has
  looked at it.
- Once this ships, the 040 exception could in principle be narrowed. **Do not narrow it in this
  card** — the exception is what keeps a live `/ot` from throwing during the deploy that ships the
  fix, and the two changes must not be in flight together.
