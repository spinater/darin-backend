# A class warning cannot name its own row — `ClassSessionInput` drops the date

- status: todo
- commit:

## Goal

Task 025 stopped `noShow > booked` paying 0 ฿ in silence: the class now pushes a warning naming the
class, both head counts, the negative result and the price. **Both review lanes then raised the same
gap independently** (`code-reviewer` finding 3, `payroll-auditor` finding 1): the warning cannot name
*which* row, because the engine is never given the date.

`ClassSessionInput` (`lib/payroll.ts:18-23`) carries `className · price · booked · noShow` — no
`date` — while `SessionInput` on the line above it **does** (`{ date: Date; activity: string }`).
`lib/payroll-run.ts:144-151` has `c.date` in hand from the query and drops it during the map.

⚠️ **Measured, not assumed** (`payroll-auditor`, 2026-09-18): a trainer who teaches Aqua Fit 15× in
one period with two rows keyed `booked 2 / noShow 5` gets **two byte-identical warnings** on her
payslip. The admin cannot tell from the slip which two dates of fifteen to fix, and the exposure
that hangs on finding **both** is 800 ฿.

Mitigated but not closed: `/classes?period=` lists date · class · trainer · booked · noShow and
renders `{r.booked - r.noShow}` (`app/classes/page.tsx:193`), so both rows show a negative
`เข้าจริง` and are findable **by scanning the whole period**. A warning that needs a second screen
and a manual scan to act on is one step short of §2 rule 4's intent.

## Scope

- Add `date` to `ClassSessionInput` and pass `c.date` at `lib/payroll-run.ts:149`.
  🔑 **`computePayslip` stays pure (§2 rule 2)** — the date is *passed in*, never read from a clock.
- Lead the negative-attendance warning with the date so the row is identifiable from the slip alone.
- Check every other consumer of `ClassSessionInput` before widening it (the graph: `graphify affected
  "ClassSessionInput"`), and check whether the existing class payslip line should show the date too —
  decide deliberately, do not let it ride along unnoticed.
- A test pinning that **two identically-broken rows produce two distinguishable warnings**. Task 025
  pins that they produce *two* (`toHaveLength(2)`); this card is what makes the two tell apart.

## Notes

- 🔴 **This card is the one that splits `lib/payroll.test.ts`** (`code-reviewer`, 2026-09-18). Task
  025 left it at **433 lines** — 17 under the §4 450 warn — and spent 32 lines on three tests, so the
  test this card adds almost certainly crosses it. Split along the `describe` boundaries that already
  exist (`lib/payroll/{teach,class,commission,ot}.test.ts`), move the shared fixtures at
  `lib/payroll.test.ts:5-45` (`config`, `teachRates`, `trainer`, `run`, `ptSale`) into one sibling
  helper, and **budget for the §7 consequence in the same change**: the `lib/payroll.test.ts` row in
  `scripts/junit-pins.txt` is replaced by one row per new file summing to the total, and the gate
  goes red mid-split **on purpose**. `lib/payroll.ts` itself is 269 lines and needs no barrel — keep
  that decision out of this one.
- No baht figure moves in this card — it is warning content only. That is exactly why it was split
  out of 025 rather than bolted on: 025's diff was proven amount-neutral over 126 cases and stayed
  that way.
- **Latent, related, deliberately not bundled:** there is no DB `CHECK (noShow <= booked)`. Today
  `app/classes/page.tsx` is the *only* writer of `ClassSession` (verified by the auditor across
  `lib/`, `app/`, `prisma/`, `scripts/`; `lib/sync.ts` writes only `teachSession` and `sheetRowRaw`),
  so the door guard plus the engine warning are sufficient. A seed script or a second page writing
  `ClassSession` is what reopens the hole — and a constraint is a schema change, i.e. one-way under
  §2 rule 8. Weigh it there, not here.
- Also pre-existing and **not** this card's: a 0-attendee or negative row enters `byClass` as
  `qty + 1, amount + 0`, so 15 Aqua Fit rows with 14 full read `rate 373.33` on the slip. Identical
  for a spec-normal 0-attendee class ⇒ it belongs to whoever revisits the class line's rate column.
