# A staff member who leaves mid-period is charged a full month of base salary

- status: todo-human
- commit:

- 🚫 **Blocked on linus:** when someone resigns or is deactivated part-way through a period, does
  their payslip carry the **whole** `baseSalary` for that period, or a share of it? If a share:
  **by what** — calendar days worked ÷ days in the month, working days, or something the shop
  already does by hand today? Nobody may pick this default for him: it moves a real baht figure on
  a real person's last payslip, in the direction that is never checked because the person has
  already gone.

## Goal

Task 013 item 3 made a deactivated staff member's payslip **exist** — before it, a leaver's whole
month of teaching, commission and OT could disappear from the run with no slip, no warning and no
entry in the review queue, and the period total on `/payslips` was short by exactly that while
looking internally consistent (`payroll-auditor`, 2026-09-18, priced one ordinary case at
**16,760 ฿**: 32 ST sessions = 12,800 · one self-closed 30,000 package over the §1.6 threshold =
3,600 · 3 days × 12 h OT = 360).

What that fix does **not** decide is the base. `computePayslip` sets `base = staff.baseSalary` for
everyone; the engine has no pro-rating for anybody, joiner or leaver. So a trainer who worked
20 days of July and left is currently paid July's full base. The figure is **not silent** — the slip
carries the Thai warning that the person is deactivated, that the base is charged for the whole
period without pro-rating, and that it must be checked before approval — but "an admin might catch
it" is a warning, not a rule.

## What ships once he answers

- If **full month**: nothing in the engine changes. Record the decision in
  `.docs/knowledge/domain/payroll-rules.md` so the next lane stops treating it as an open hole, and
  soften the warning to state the policy instead of flagging a risk — the warning's exact Thai
  string moved to `.docs/knowledge/domain/payslip-lifecycle.md` at task 023.
- If **pro-rated**: the divisor and the numerator are both his answer, and they become
  `lib/config-keys.ts` entries read from `PayrollConfig` at runtime — never literals in a formula
  (§2 rule 3). `computePayslip` stays pure: its caller loads the leave date and passes it in, which
  means `Staff` needs the date the person stopped working (today `active` is a boolean with no
  date — `app/admin/config/page.tsx`'s toggle flips it and keeps no record of when). That is a
  schema change ⇒ §2 rule 8 applies: `prisma db push` has no down path, so back up first.

## Notes

- The same question decides the **joiner** case, which nobody has hit yet: someone hired on the
  20th is currently paid the whole month's base too. Ask both at once.
- Related: task 013 item 2 (`paid → draft` on a slip already paid) is the other money policy
  waiting on him, and both land on the same screen. Worth asking in one message.
- Do **not** move this card back to `todo/` until the quoted question above has an answer that can
  be quoted back — an agent guessing here is exactly the failure this folder exists to prevent.

## The over-pay case — added after the round-2 audit (2026-09-18)

Task 013's fix made every way a period can still be owed select the person: teach sessions, class
sessions, sale attributions, OT entries. `payroll-auditor` then pointed out the mirror of the
under-pay case that opened this card, and it is now the **reachable** one, so the question above has
to price both directions:

- **An arm can fire on activity worth 0 ฿ and still mint a full-month slip.** A trainer who left on
  30 April, `baseSalary` 10,000, whose only July row is a `freeze` sale he closed: §3 of
  `darin-payroll-system.md` says freeze earns no commission for anybody, so the run mints him a
  **10,000 ฿ July payslip of which 0 ฿ is earned**. Same shape via a class session with `booked: 0`
  (attended 0 ⇒ pays nothing) or an OT entry under the §2.4 threshold.
- It is **loud**, not silent — the deactivation warning fires, the name reaches the `/payslips`
  banner and `WarningCard` sits above the amounts — which is what §2 rule 4 asks for. But note the
  engine's own precedent for an undecidable amount points the other way: a missing teach rate warns
  and pays **nothing** for those sessions rather than guessing. Here it guesses "full month".
- **An over-payment to someone who has already left is not recoverable.** That asymmetry is why
  this needs an answer rather than a default.

**Two things that ship with the answer, if it is "full month":**

1. `app/ot/page.tsx`'s paste import reads `db.staff.findMany()` with no `active` filter (correct for
   task 009's unmatched-username surface) and `parseOtPaste` accepts `hours` of `"0"`. So a stale
   fingerprint roster still holding ex-employees writes `OtEntry` rows for them, and the new
   activity arm then mints a full-base slip for a month they never worked. Containment: skip
   `active: false` staff on import and surface them the way `unmatched` already is.
2. **The residual of the original hole.** Someone whose entire period pay is `baseSalary` — admin or
   counter, no teaching, no class, no sale, no OT row — and who is deactivated before the run
   matches no arm and still gets nothing, silently. The engine cannot do better today: `Staff.active`
   is a bare boolean with **no date**, so "left last month" and "left in 2024" are indistinguishable,
   and selecting every inactive person would mint slips for 2024 leavers. A `deactivatedAt` column is
   what closes it — a schema change, so §2 rule 8 applies.
