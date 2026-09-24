# A three-digit year in the sheet falls between both normalisation arms — and the คาบ is paid as 0 ฿

- status: todo
- commit:

## Goal

ใบ 082 closed the implausible-year hole on the five **form** paths. It did not touch the path the
data actually arrives by. `lib/parser.ts` normalises a sheet year with two arms and nothing between
them:

```
lib/parser.ts:39   const DATE_RE = /(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/;
lib/parser.ts:77       let y = +m[3];
lib/parser.ts:78       if (y < 100) y += 2000;
lib/parser.ts:79       if (y > 2400) y -= 543;   // เผื่อกรอกเป็น พ.ศ.
```

`DATE_RE` accepts **2 to 4** digits, so a three-digit year is reachable, and a three-digit year is
neither `< 100` nor `> 2400`:

| sheet cell | `y` after both arms | stored |
|---|---|---|
| `5/6/26` | 2026 | ✅ |
| `5/6/2569` | 2026 (พ.ศ.) | ✅ |
| `5/6/226` | **226** | `Date.UTC(226, 5, 5)` — year 226 |
| `5/6/569` | **569** | year 569 |

🔴 `Date.UTC` does **not** rescue it: its two-digit remap covers `0..99` only, so `226` stays `226`
(re-measured 2026-09-24, and it is the same rule `lib/date-window.ts`'s header warns about from the
other side).

## What it costs

`lib/parser.ts:209` writes that date into the session and the row continues down the ordinary path —
`status: "ok"`, trainer already resolved. So:

- it is **not** `needs_review` and its `staffId` is **not** null ⇒ `NEEDS_ATTENTION`
  (`lib/payroll-run.ts:9`) never matches it and `/sync/review` never lists it;
- `periodRange("2026-06")` never matches it either ⇒ it reaches **no** payslip.

**Worked example** (§1.2, ว่ายน้ำ = 250 ฿ ทุกระดับ): ประพัฒน์'s คาบ of 5 มิ.ย. 2026 typed in the sheet
as `5/6/226` is paid **0 ฿ instead of 250 ฿**, with `warnings: []`, no queue row and nothing on any
screen. Twelve such คาบ in a month is 3,000 ฿. This is ใบ 082's own headline failure reached
**without a human ever touching a date field** — and on the highest-volume path in the product.

## Scope

- `withinWindow` / `dateWindow` (`lib/date-window.ts`) are already the right predicate and already
  configured. `lib/sync.ts` already loads config, so the caller exists.
- 🔴 **The answer here is `needs_review` with a reason, not a refusal.** A form can refuse because a
  human is standing in front of it; a sync cannot — §2 rule 6 says a row that cannot be matched
  goes to the review queue **and the run still completes**. Dropping or refusing the row would be
  the same silent-zero failure in a new coat.
- Decide where the check belongs: inside `parseSheet`'s `dmy` arm (closest to the defect, but the
  parser is pure and has no config) or at the `lib/sync.ts` caller that already has `Config`.
  The second is the shape ใบ 082 used for exactly this reason — say which and why in the card.
- ⚠️ A third arm in the normalisation (`if (y < 1000) …`) is **not** the fix on its own: guessing
  what `226` meant is the class of guess §2 rule 4 exists to stop. It may be a *warning* that names
  the cell, never a silent correction.
- Test + junit pin raise in the same change (§7). `lib/parser.test.ts` is pinned at 13 with 3 skips.

## Notes

- Found by `payroll-auditor` in the ใบ 082 review (2026-09-24). 🔑 **What was measured and what was
  traced by reading are kept apart on purpose.** *Measured:* the arithmetic — `y = 226` survives both
  arms, and `Date.UTC(226, …)` keeps 226 because its two-digit remap covers `0..99` only. *Traced by
  reading, not run:* the end state — `status: "ok"` with a resolved trainer, therefore in no queue
  (`lib/payroll-run.ts:9`) and no period — was followed through `lib/parser.ts:209` by eye. **Nobody
  ran a sync against a fixture**, so the 250 ฿ is what that path implies, not something anybody
  watched happen.
- ⇒ **the first job of this card is to reproduce it end to end.** If the end state differs, the two
  "does not close" lines ใบ 082 added (in its own `## Decision` and in
  [`date-window.md`](../../.docs/knowledge/domain/date-window.md)) are what must be corrected with it.
- It is **pre-existing** — ใบ 082 neither caused nor worsened it; what ใบ 082 owed was an honest
  "does not close" line, which it now carries.
- ⚠️ **The sheet parser is not the only unguarded write of a date.** `payroll-auditor` noted in the
  ใบ 082 round-3 audit that the **Gymmo upload** path writes `ClassSession.date` without passing
  through `withinWindow` either (`lib/gymmo-import.ts` builds the write plan, `lib/gymmo-import-run.ts`
  executes it). ใบ 082 closed the five *form* paths and named only the sheet parser as what it does
  not close, so that list is short by one. Whoever takes this card should decide whether the two
  import paths are one job or two — they share the predicate and the "must not refuse, must queue"
  constraint below, which argues for one.
- Related: [082](082-calendarDate-accepts-a-year-that-cannot-be-real.md) (the same defect on the
  five form paths, closed) · [088](088-three-money-screens-have-a-period-they-cannot-change.md) ·
  [016](016-sync-summary-reads-as-success.md) · [030](030-class-warning-cannot-name-its-row.md)
