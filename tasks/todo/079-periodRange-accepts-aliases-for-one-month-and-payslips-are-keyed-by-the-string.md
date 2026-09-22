# `periodRange` accepts several spellings of one month, and `Payslip` is keyed by the spelling

- status: todo
- commit:

## Goal

`lib/payroll-run.ts:13` validates a period by `Number()` and a 1–12 month check:

```ts
const [y, m] = period.split("-").map(Number);
if (!y || !m || m < 1 || m > 12) throw new Error(`งวดไม่ถูกต้อง: ${period} (ต้องเป็น YYYY-MM)`);
return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
```

`Date.UTC` **truncates a fractional year and month**, and `Number` accepts every JavaScript numeric
literal. Measured on this runtime:

```
2026-06     -> 2026-06-01 .. 2026-07-01
2026-6      -> 2026-06-01 .. 2026-07-01     ← unpadded: the one that happens by accident
"2026-06 "  -> 2026-06-01 .. 2026-07-01     ← a trailing space does it too
2026.5-06   -> 2026-06-01 .. 2026-07-01
2026-06.9   -> 2026-06-01 .. 2026-07-01
1e3-07      -> 1000-07-01 .. 1000-08-01
0x7e2-07    -> 2018-07-01 .. 2018-08-01
2026-13     -> throws (the existing guard)
06-2026     -> throws
```

🔑 **`2026-6` is the one that matters.** The hex and exponent forms need someone crafting a POST;
an unpadded month or a trailing space is what a hand-typed URL, a copied link or a spreadsheet cell
produces on an ordinary Tuesday — and it is a *different string* keying the same month.

Nothing fails at the driver. The earlier assumption on task 072 — *"a read path that fails
loudly"* — was **wrong in both halves**: it does not fail, and it is not only a read path.

## The write half is the expensive one

`app/payslips/page.tsx:47` takes `period` straight off the form and calls `runPayroll(p)`.
`runPayroll` **ranges** with the loose parse but **stores the raw string**
(`lib/payroll-run.ts:198, 224`), and `Payslip` is keyed `@@unique([staffId, period])`.

So `POST period=2026.5-07` computes over the real July 2026 data and writes a full set of payslips
under the string `"2026.5-07"`. Then:

- `/payslips?period=2026-07` reads `where: { period }` with the ordinary string and **does not see
  them**, and neither does `staffInPeriodWhere`'s `payslips: { some: { period } }` arm.
- A later ordinary run of `2026-07` **cannot overwrite them** — the unique key does not collide — so
  it writes a *second* full set for the same real month.

⇒ two complete sets of payslips for one month, each invisible to the other, both computed from the
same real data. If one set is marked `paid`, nothing in the other set knows.

The heading half is smaller but the same cause: every screen rendering `{period}` prints the raw
string, so `/ot?period=0x7e2-07` shows **`OT — งวด 0x7e2-07`** above July **2018**'s rows.

## Scope

- One guard in `periodRange` fixes every caller at once, because every caller goes through it:
  `if (!/^\d{4}-\d{2}$/.test(period)) throw …` **before** the `Number` parse. Keep the existing Thai
  message — it already says `ต้องเป็น YYYY-MM` and was telling the truth about the intent all along.
- ⚠️ **Check the stored data before tightening**, not after: `SELECT DISTINCT period FROM "Payslip"`
  (and the same for anything else keyed by a period string). Every period written so far comes from
  `toISOString().slice(0, 7)`, so the expected answer is that they all match — but a guard that
  throws on a row already in the table turns a screen into an error page, which is ใบ 029's lesson.
- Decide separately whether the rendered heading should echo the raw string at all, or the
  formatted range. That is the smaller half and can wait.
- Test + junit pin raise in the same change (§7). `periodRange` is pure, so this is cheap to pin —
  each row of the measured table above is one assertion.

## Notes

- Found by `code-reviewer` during the ใบ 072 review, correcting a claim that task's implementer and
  I had both accepted without measuring. The measurement above was re-run by hand before this card
  was opened.
- Admin-authenticated and hand-crafted ⇒ not urgent. It is on the record because it is the exact
  *"a server action is a plain HTTP endpoint"* argument `app/ot/page.tsx` makes about its own two
  fields, applied to a field nobody applied it to.
- Related: [072](072-the-one-row-ot-form-still-stores-a-rolled-over-date.md) and
  [014](../done/014-ot-import-atomicity.md) — the same class on `OtEntry.date`, where the silent
  value was a *shifted* day rather than an aliased month.
