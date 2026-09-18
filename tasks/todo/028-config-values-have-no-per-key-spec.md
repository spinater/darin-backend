# A config value only has to be a non-negative number — nothing says which number is plausible

- status: todo
- commit:

## Goal

Task 013 item 4 closed the hole where a `PayrollConfig` value could be **blank, non-finite or
negative** and still become money (a cleared `comm.pt.selfClosed` paid 0 ฿ on a 20,000 ฿ bill with
no warning; a cleared `incentive.threshold` fired the retroactive rate for everyone, every month).
What ships is a **blanket** rule: non-blank, finite, ≥ 0, fractions allowed.

That is the floor, not the ceiling. The keys are not uniform:

| Shape | Keys | A typo looks like |
|---|---|---|
| a ratio, `0 < x <= 1` | `class.halfRatio`, the `comm.*` rates, `incentive.rate` | `12` instead of `0.12` — **100×** the intended commission, and it passes today |
| baht | `ot.ratePerHour`, `incentive.threshold` | a digit too many |
| a head count | `class.minAttendees` | `0`, which makes every class full-price |
| a day of month | `payday.*` | `32` |

Every one of those passes the blanket rule and lands in a payslip.

## Scope

- A spec table beside `CONFIG_DEFAULTS` in `lib/config-keys.ts` — per key: min, max, and whether a
  fraction is allowed — read by **both** the write path (`lib/config-form.ts`, which today applies
  only the blanket rule) and `num()` / `pct()` at read time.
- 🔑 It must stay **configurable, not hardcoded** (§2 rule 3): the spec bounds what a value may be,
  it never supplies one. A key with no spec entry keeps today's blanket rule rather than being
  silently exempt.
- The screen has to say which key was refused and what shape it wanted, in Thai.

### Also here: the `Float` money columns have no ceiling

Task 013 item 4 gave the `Int`-backed fields a `max` (the column limit). The `Float` ones —
`OtEntry.hours`, `Sale.netPrice`, `Sale.listPrice` — still take anything finite, so `1e307` passes,
and `hours * rate` then overflows to `Infinity`, which blanks the **period total for every staff
member** in `/payslips`'s `reduce` — the same blast radius the guards were built for. It takes a
deliberate absurd entry rather than a plausible typo, and the row renders visibly, so it is not a
blocker — but the fix is the same missing thing as the rest of this card: what is a *plausible*
maximum for a sale price or a day's hours is a spec question, not a guard question.

### Also here: `num()` still accepts a negative

Task 013 item 4 made `num()` refuse a **blank** and a **non-finite** value, and the write path now
refuses a negative — but the read side would still take `-5` for any key, so a value that arrived by
seed or by hand is read back silently. It is the same missing thing: a per-key `min`. Fixing it
without the spec table would mean guessing which keys may be negative, which is why it waits here
rather than shipping with the guards.

## Notes

- Carded out of task 013 item 4's review round (2026-09-18) so that change stayed one change.
- `payroll-auditor`'s measurement is what makes the ratio row real: the `cfg|…` inputs are plain
  text fields, so anything typeable reaches the engine.
- Related: `.docs/knowledge/domain/money-input-guards.md` · task 023 (those cards are at the warn
  line, so this one's documentation may need the split to land first).
