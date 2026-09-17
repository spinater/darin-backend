# Surface `warnings` — the engine's "I could not decide" must reach the screen

- status: todo
- commit:

## Goal

🔴 **This is a live violation of CLAUDE.md §2 rule 4, in production today.** `computePayslip`
returns `{ lines, warnings, ...totals }`. `runPayroll` throws `warnings` away:

```ts
// lib/payroll-run.ts:89
const { lines, warnings, ...totals } = result;   // ← warnings destructured out, never used again
```

There is **no** `warnings` column on `Payslip` or `PayslipLine` (`prisma/schema.prisma:212-241`),
and `grep -rn warnings app/` returns **zero hits** — the payslip a staff member actually opens
(`app/payslips/[id]/page.tsx`) has no warnings block at all. `app/payslips/page.tsx` calls
`runPayroll(p)` and discards its return value before redirecting.

Meanwhile `app/admin/config/page.tsx:204` promises the opposite to the user, in Thai, on screen:
*"…จะไม่ถูกคิดเงินและขึ้นเตือนในสลิป"*. The product makes a promise the code does not keep.

Found by `uxui-designer` and `code-reviewer` during the task 008 merge review. **Pre-existing since
the first commit `cdc580e` — not a regression from that merge**, which is why it did not block the
fast-forward and gets its own card instead.

## Why this is the expensive one

§2 rule 4 exists because money that disappears quietly is not noticed until payday. Every case the
engine cannot decide — an unknown trainer, a missing rate, a sale with nobody attributed — is
currently computed, turned into a warning, and then deleted before anyone can see it. The failure
is invisible by construction: nothing is red, a payslip is just wrong.

## Scope

Follow §3 edit order — schema → domain → screens → docs → verify.

1. **Schema.** Persist warnings against the payslip they belong to. ⚠️ §2 rule 8: `prisma db push`
   has no down path — back up before pushing. Decide with `architect` whether this is a
   `String[]` column on `Payslip` or its own model; a separate model is the better bet if a warning
   ever needs to point at the row that caused it.
2. **`lib/payroll-run.ts`** — stop discarding, write them in the same transaction as the lines.
   `computePayslip` itself stays pure (§2 rule 2) — it already returns them.
3. **Screens** — `app/payslips/[id]/page.tsx` (the one staff read) and `app/payslips/page.tsx`
   (the run summary). Route through `uxui-designer` (§9); the banner classes card 010 adds to
   `app/globals.css` are the right home for the styling.
4. **Same shape, same card: `app/ot/page.tsx:55`** collects `errors` (usernames from the
   fingerprint-scan paste that matched nobody) and never surfaces them either.
5. **Also same shape: `lib/sync.ts:86`** — `if (!grid) return []` inside the `plan` builder means
   an active sheet whose grid is missing contributes nothing and says nothing. Pre-existing (the
   old code did `if (!grid) continue`), still a silent drop.
6. **Tests** — `lib/payroll.test.ts` already asserts warning paths inside the engine; add the
   assertion that they survive `runPayroll` and reach the DB. Raise the junit pin in the same
   change (§7).

## Notes

- `payroll-auditor` is the agent whose whole focus area 2 is this rule — run it on the result.
- Do not add a config default to "fix" an undecided rule. `darin-payroll-system.md` §7 lists the
  rules that are genuinely still open (Yoga rates, sheet colours, membership commission for a
  non-`closer` role); routing those to `warnings[]` is the **correct** behaviour. This card is
  about showing them, not about deciding them.
