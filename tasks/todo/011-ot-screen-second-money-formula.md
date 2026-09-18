# `/ot` computes OT money a second time — §2 rule 2

- status: todo
- commit:

## Goal

`app/ot/page.tsx` renders a `เป็นเงิน` column computed as `otHours(r.hours) * rate` — a **second
formula for the same money**, which §2 rule 2 forbids outright: `computePayslip` in `lib/payroll.ts`
is the only thing that turns raw input into an amount.

Task 009 fixed the *loud* half of this (a missing `ot.ratePerHour` key no longer makes the screen
invent 40 ฿/h while the engine throws, and the displayed numbers no longer print
`27.99999999999997`). It deliberately did **not** touch the column itself, because whether that
column should exist is a product call, not an agent's.

## The decision this card needs

The counter staff use `/ot` to check a fingerprint-scan import against what the payslip will pay.
Two ways to keep that honest, and they are not equivalent:

1. **Delete the `เป็นเงิน` column.** `/ot` shows hours only; the payslip is the single place that
   says what an hour is worth. Satisfies §2 rule 2 exactly. Cost: the staff lose the at-a-glance
   check and must open a payslip to see the money.
2. **Keep the column, one formula.** Export the OT amount from the engine layer as a pure helper
   that both `computePayslip` and the screen call, so there is one formula with two callers rather
   than two formulas. Cost: a new seam in `lib/payroll.ts`, and the screen still shows a number
   before the payroll run exists.

🚫 Do not pick one without asking linus — it changes what the staff see on a screen they use daily.

## The same defect exists on a second screen

`app/classes/page.tsx:31-32` is finding 4 again, verbatim:
`Number(cfg.find((c) => c.key === "class.minAttendees")?.value ?? 3)` and `?? 0.5` — a screen
inventing a threshold the engine's `num()` refuses to invent, so `/classes` would silently show one
number while a payroll run dies on the missing key. Fix it in whichever direction this card settles
on, so the two screens do not end up with different answers to the same question.

Task 009 already did this half for `/ot` (both `??` fallbacks replaced by `num()`), so there is a
worked precedent to copy.

## What the task 009 third review added to this card

`code-reviewer` confirmed the double-rounding fix is correct **per row** and then found the part it
does not fix — which only option 2 above can close:

- **Per-row rounding does not sum to the payslip.** Each output rounds once, so §2 rule 5 is
  satisfied, but 20 rows of `money(0.3333… × 40)` = 13.33 sum to **266.60** against the engine's
  `money(6.666… × 40)` = **266.67**. They agree per row, not in aggregate — on a screen whose whole
  job is being added up. Nobody is shown a wrong sum today only because the table has no total row.
- **The pin is not a fence.** The test task 009 added lives in `lib/payroll.test.ts` and asserts
  `computePayslip`, which was never wrong. Nothing in the gate would catch someone re-wrapping
  `otExcess` in `money()` tomorrow — the screen's arithmetic is untested by construction (stage 4
  renders no components; see task 015).
- **`app/ot/page.tsx` renders the raw float** in the ชั่วโมง column (`9.333333333333334`) beside a
  2-dp OT column — pre-existing, same neighbourhood.

## Screen copy, same file, `uxui-designer`'s call

Task 017 stopped `/design-review` being a merge gate, so these were not forced through it and are
recorded here instead of being churned into task 009:

- `invalidHours` is **uncapped** — a scanner variant writing `9:20` literally makes every line
  invalid, so one month's paste renders hundreds of bullets and pushes the import count off screen.
  A "first 20 + และอีก N บรรทัด" cap is the obvious answer. (Note the deliberate asymmetry: the
  `unmatched` list stays uncapped and deduplicated, because one misspelt username is one fix that
  recovers a whole month.)
- The failure line says `บรรทัดก่อนหน้าบันทึกแล้ว ตรวจบรรทัดนั้น` even when `imported === 0` or the
  failing row is unknown.
- `WarningCard` re-states `text-amber-800`, which `.card-warn` already sets.

## Notes

- Found by `payroll-auditor` during the task 009 review (finding 2), ranked Major; the `/classes`
  occurrence was found by `backend-dev` during the 009 fix pass.
- Worked example from that audit: a paste writing 9.7 h on 3 days renders `ชม. OT
  0.6999999999999993` / `เป็นเงิน 27.99999999999997` per row while the payslip pays
  `money(0.7 × 40)` = 28.00 × 3 = 84.00 ฿ — the screen meant to verify the payslip disagrees with it.
- §2.4 of `darin-payroll-system.md` is the rule: `OT = Σ max(0, hours − 9) × 40`, threshold and
  rate both configurable.
