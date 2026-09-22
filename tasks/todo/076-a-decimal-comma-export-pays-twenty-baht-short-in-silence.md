# A decimal-comma export pays short, silently — `parseOtPaste` drops the 4th field

- status: todo
- commit:

## Goal

`lib/ot-import.ts` splits each line and destructures **three** fields:

```ts
const [user, date, hours] = line.split(/\t|,/).map((x) => x?.trim());
```

A fourth field is discarded with nothing said. A fingerprint export written with a **decimal comma**
— a normal thing in a Thai locale — writes `somchai,2026-07-01,11,5` for 11.5 hours. That parses as
`hours = "11"`, which is a perfectly good number, so it passes `finiteNumber`, reaches `rows`, and
stores.

Priced by `payroll-auditor`: `max(0, 11 − 9) × 40 = 80 ฿` paid where `max(0, 11.5 − 9) × 40 =
100 ฿` was owed. **20 ฿ short per row, every row, with no warning and no bad-looking value on the
screen** — the number that lands is plausible, which is what makes this worse than a value that
fails.

## Why it is not part of task 014

It behaved identically before 014 and the diff neither widens nor narrows it — `payroll-auditor`
raised it "only so it is on the record". 014 already changed a predicate after its review gate had
answered once; doing it twice in one card is the pattern task 013 round 1 recorded as how a defect
gets in.

## Scope

- Decide what a 4th field **means** before writing code. Two readings and they pay differently:
  a decimal comma (`11,5` = 11.5) versus a genuinely malformed line. Guessing here picks somebody's
  pay rate.
- Whatever is decided, the shape that must not survive is *silence*: an unexpected extra field is
  either understood or it goes to a bucket on screen (§2 rule 4). `invalidHours` already exists and
  already renders.
- ⚠️ The tab separator does not have this problem, and a real export may mix both. Check what the
  actual scanner writes before assuming — `.docs/knowledge/` and a real paste beat reasoning here.
- Test + junit pin raise in the same change (§7).

## Notes

- Found by `payroll-auditor` during the task 014 round-2 audit, on a pre-existing line the diff did
  not touch.
- Related: [014](../done/014-ot-import-atomicity.md) (the three buckets this would feed) ·
  [072](../done/072-the-one-row-ot-form-still-stores-a-rolled-over-date.md) (the other silent-but-plausible
  value on the same screen).
