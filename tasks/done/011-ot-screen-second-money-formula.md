# `/ot` computes OT money a second time — §2 rule 2

- status: done
- commit: a5584bb

## Progress notes (2026-09-18)

linus ruled today: **option 1 — delete the money column.** No shared helper, no seam in
`lib/payroll.ts`. Implemented, not committed (that decision stays with the caller):

- `app/ot/page.tsx` — `เป็นเงิน` column and its `money(otExcess(r.hours) * rate)` cell deleted;
  `money` import removed (grepped first — no other caller in the file). `rate` and
  `ot.ratePerHour` kept: still rendered in the explanatory `<p>`, and `num()` is what keeps the
  screen failing loudly on a missing key. The rounding-hazard comment (about a multiplication that
  no longer exists) rewritten to explain the screen shows hours only. Added a display-only `hrs()`
  formatter (2 dp, not `money()`) and applied it to both `ชั่วโมง` and `ชม. OT` — the raw-float
  print (`9.333333333333334`) is gone from both columns, not just the one that used to feed the
  multiplication. The `บรรทัดก่อนหน้าบันทึกแล้ว` failure tail is now conditional on `imported > 0`.
- `app/classes/page.tsx` — same defect, same ruling: `มูลค่า` column and the `value()` helper
  deleted. The `?? 3` / `?? 0.5` fallbacks replaced with `num(classConfig, key)`, copying
  `app/ot/page.tsx`'s worked precedent. `minAtt`/`halfRatio` kept — still used by the explanatory
  `<p>`.
- `app/_components/warning-card.tsx` — added optional `max`, capping to `max` items plus a
  Thai-prose `และอีก N บรรทัด` line (never `font-mono`, even when the list is). Removed the
  duplicated `text-amber-800` from the `<ul>` (`.card-warn` already sets it); left the heading's
  `text-amber-900` alone — deliberate darker override, not a duplicate.
- `app/ot/_components/paste-form.tsx` — `invalidHours` capped at `max={20}`; `unmatched` left
  uncapped on purpose, with a comment recording why (one misspelt username recovers a whole month;
  one scanner-format variant can invalidate hundreds of hour fields at once).
- `.docs/knowledge/domain/payroll-rules.md` — rule 4 rewritten: no screen computes money now,
  `เป็นเงิน`/`มูลค่า` are both gone. The old double-rounding war story kept as "for the record"
  history since it explains *why* the ruling landed here rather than on option 2. `app/ot/page.tsx`
  kept in `sources:` — the `num()` rule still describes it — with the front-matter comment updated
  to the post-011 reason.

## Review round 2 — what the two lanes sent back (2026-09-18)

`code-reviewer`: **BLOCK** on two knowledge-card defects. `payroll-auditor`: **PASS** with six
Minors. Fixed in this round:

- 🔴 **The card's rule 4 asserted something false.** "The payslip is the single place a baht figure
  appears anywhere in this product" — bolded, in the canonical money card every agent reads before
  touching money — against `app/page.tsx:41,43`, `app/payslips/page.tsx:58`, `app/sales/page.tsx:169`,
  `app/admin/config/page.tsx`, and `app/classes/page.tsx:81` (`{c.name} ({c.price})`, on a screen the
  same paragraph claimed showed no money). Replaced with the claim the change actually earned: the
  payslip is the only place a baht figure is **computed**; any screen may display a stored or
  configured amount unchanged and may not derive one. Both failure directions are spelled out,
  because enforcing the old sentence literally either strips a read-only figure the counter staff
  need or "fixes" `/payslips`'s total by computing something new. The `/classes` table description
  was imprecise on the same line and is now the real column list.
- 🔴 **`sources:` did not cover what the card claims.** Added `app/classes/page.tsx` (in no card's
  `sources:` anywhere before this) and `lib/payroll.test.ts`, each with a reason comment. Concrete
  hole this closes: someone re-adds `?? 3` to `/classes`, the card keeps asserting `num()`, the gate
  stays green — and with `class.minAttendees = 4`, `class.halfRatio = 0.6` configured, the
  explanatory `<p>` advertises "1–3 คน = ×0.5" while the engine pays ×0.6 above 3.
- **`lib/payroll.ts`'s `money()` doc-comment contradicted the card** (auditor's top Minor, and worth
  more than its rank — it is the *primary source*, read on every mandatory pre-money pass). It still
  sanctioned screen previews by name. Rewritten: no caller outside the file as of 011, and a
  screen-side baht preview is a §2 rule 2 violation rather than a licensed use of the export.
  Worked failure it invites: an agent restores `<td>{money(otExcess(r.hours) * rate)}</td>` to `/ot`,
  the gate stays green because no test renders a component, and twenty 9:20 days show **264.00 ฿**
  on the checking screen against **266.67 ฿** paid.
- **`lib/payroll.test.ts`** — the comment above the `ชั่วโมงทศนิยมยาว` test repeated the same stale
  "`/ot` previews the same figure" claim. **Comment only; no assertion touched and the pin stays at
  24.**
- **`app/_components/warning-card.tsx`** — the cap is clamped (`Math.max(1, max)`) and one `limit`
  now drives both the slice and the count, so the non-null assertion is gone. Two reachable edges
  closed on the component that *is* the §2 rule 4 surface: `max={0}` rendered zero bullets under a
  heading still claiming a count, and a negative `max` made `slice(0, -5)` drop the **last** 5 and
  then report `n + 5` hidden — a number contradicting the list above it. Reachable the day a caller
  passes a computed budget (`max={limit - used}`).
- **`app/ot/page.tsx`** — the `!row` half of the copy finding. When `describeFailedRow` falls back to
  the generic `บันทึกข้อมูลไม่ผ่าน`, the tail no longer says `ตรวจบรรทัดนั้น` ("check that line")
  about a line nobody named; the saved/not-saved half is kept either way. Both lanes agree the branch
  is unreachable today — `lib/job-timing.ts` swallows its own failure with `.catch(() => {})`, so
  every throw reaching this catch comes from inside the loop — fixed anyway, being one conditional.

### Recorded, deliberately not fixed

- **The aggregate mismatch is demoted, not closed.** `hrs(otExcess(r.hours))` still rounds per row
  for display: twenty days of `9.333333333333334` each print `0.33`, so a staffer adding the
  `ชม. OT` column by hand reaches **6.60 h** while the payslip shows **qty 6.67 · 266.67 ฿** — an
  apparent 0.07 h that reads as **2.80 ฿ that does not exist**. Nobody is paid wrong and the table
  has no total row. This is the accepted residue of choosing option 1; only option 2 could have made
  the two agree. Do not re-open it as a money defect.
- **What the audit found in the deleted `/classes` column, which retro-justifies the ruling.**
  `value()` implemented §1.4's per-session price faithfully but **never subtracted `classCredit`**,
  which the engine applies to the total — `classPay = money(Math.max(0, classValue −
  staff.classCredit))` in `lib/payroll.ts`. A trainer with `classCredit = 5000`
  teaching 20 classes at 400 saw `มูลค่า` summing to **8,000 ฿** against a payslip paying
  **3,000 ฿**. So it was not merely a duplicate formula — it was a duplicate formula **missing a
  term**, and option 2 would have had to export the credit logic too: a per-staff, per-month quantity
  the screen has no business holding.
- **One named follow-up not built.** The auditor suggested `และอีก N บรรทัด` should also name the
  distinct usernames behind the hidden lines. Worked case: a 140-line month where bullets 1–20 are
  one scanner format for สมชาย and line 133 is ดารินทร์'s hand-typed `"10.5 ชม"`; the operator fixes
  the scanner, does not re-paste, and ดารินทร์'s 3 days of `(10.5 − 9) × 40` = **180 ฿** stay unpaid
  with nobody named on screen. Not built now because `invalidHours` items are display strings
  (`${user} ${date} → "${hours}"`, `lib/ot-import.ts:99`), so naming the set means either splitting
  that string back apart or changing `parseOtPaste`'s return shape — `lib/ot-import.ts` is on §9's
  money-path list and this is past this card's stated scope. Mitigation both lanes confirmed: invalid
  lines are never written and the write is an idempotent `upsert`, so every hidden line reappears on
  any re-paste until it is fixed.

`bunx tsc --noEmit`: clean. `bash scripts/verify.sh` (re-run after the round-2 fixes above): exit
0, `verify: ALL GREEN` (no skip notice — the selftest tier ran, since `scripts/tekton.sh` is
untracked in this tree from a different, unrelated lane). **No junit pin moved**:
`lib/payroll.test.ts` is still pinned at 24 and still runs 24 — round 2 touched a comment in it and
nothing else.

Not done: this card is **not** moved to `done/` — that stays with whoever reviews and commits.

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
