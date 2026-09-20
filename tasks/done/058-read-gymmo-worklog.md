# Read the Gymmo worklog export — and map its names onto this database

- status: done
- commit: 113c5ee (reader) · 901e8bb (naming seam)
- follows [050 §8.2](../todo/050-two-rules-that-clear-ninety-percent-of-the-queue.md) ·
  [055](../todo-human/055-scope-change-replace-gymmo-not-just-payroll.md)

linus 2026-09-20: *"ส่วนค่าสอนคลาสจะคำนวณจากไฟล์ที่ได้จาก Gymmo"*

🔴 **This card was written after the fact.** Both commits shipped citing `(ใบ 058)` while no
058 file existed — a §6 rule 1 break of my own making. Writing it now rather than leaving two
commits pointing at nothing; the record below is what the commits actually contain, not a plan.

---

## 1. What shipped

| File | What it is | Tests |
|---|---|---|
| `lib/gymmo.ts` | pure reader: cells → rows. No DB, no money, no clock. | 16, pinned |
| `lib/gymmo-map.ts` | naming seam: sheet name → `Staff`, class name → `ClassPrice` | 15, pinned |

Verified against the real Jan–Sep export: **6 sheets, 259 rows, 0 unreadable**, PT 198 / Class 61.
The wider 3,211-row file also read with 0 unreadable rows.

## 2. Three decisions that are not obvious from the code

1. **The date is stored as UTC midnight and the clock is kept separately.** The export carries no
   timezone, and payroll buckets by month ⇒ inventing a timezone would move sessions across month
   boundaries for no gain.
2. **`31 SEP` is rejected, not rolled.** `Date.UTC` would silently turn it into 1 Oct. A row that
   cannot be read goes to `problems[]`; it is never dropped and never guessed (§2 rule 4).
3. **`attendedOf()` does not clamp negatives.** Clamping would hide the row from the task-025
   guard in `lib/payroll.ts`, which is the thing that exists to catch exactly that.

`attendeesRaw` is kept verbatim because a real row reads `เอรา,อลัน เอรา,อลัน` — a comma inside a
name, so the field cannot be split on commas without losing data.

## 3. 🔑 The finding that changed the plan — the 5,000 quota already exists

`lib/payroll.ts:202`:

```ts
const classPay = money(Math.max(0, classValue - staff.classCredit));
```

`Staff.classCredit` **is** the quota linus described. No new rule, no engine change — setting
`Staff.classCredit = 5000` is the whole implementation. Proven end-to-end afterwards: August,
ธันยา มูลละคร, 24 sessions → gross 8,050 − 5,000 = **3,050**, and the real 08/2026 payslip says
`Class credit 5,000 → 3,050.00`. Prices came from linus, the attendance rule from existing config,
the quota from his explanation — all before August data was opened, so this is not a fitted number.
([060](../todo-human/060-class-pay-proven-and-finance-export.md))

## 4. No case folding anywhere — on purpose

Task 036 made name comparison trimmed-exact. A second normalizer puts one decision in two homes,
and a quiet wrong match pays the wrong person. So a spelling that differs only by case is an
**alias row**, not a clever comparison — `GYMMO_CLASS_ALIASES` holds four of them today.
An exact name wins over an alias, so adding a real `ClassPrice` row retires its alias by existing.

## 5. 🔴 What this card did NOT do

- **Nothing is written to the database.** Both files are pure; no `ClassSession` row has ever been
  created from a Gymmo export. That is the next card.
- **Idempotency is unsolved and it is a money risk.** `ClassSession` has no unique key beyond `id`
  ⇒ importing the same worklog twice would pay twice. Fixing it needs a schema change
  (§2 rule 8: irreversible, `prisma db push`, no down path) ⇒ it needs its own card and the
  `payroll-auditor` lane, not a quiet addition here.
- **`Staff.classCredit` is still 0** — the quota is implemented and switched off.
