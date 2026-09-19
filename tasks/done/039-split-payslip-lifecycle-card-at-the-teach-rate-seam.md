# Three knowledge cards are pinned at exactly the §5 warn line, one of them by widening its lines

- status: done
- commit: a8faa9e

## Goal

After tasks 034 and 036, three domain cards sit at **exactly 170 lines** — §5's warn, with the hard
cap at 200:

| card | lines |
|---|---|
| `.docs/knowledge/domain/payslip-lifecycle.md` | 170 |
| `.docs/knowledge/domain/payroll-rules.md` | 170 |
| `.docs/knowledge/domain/money-input-guards.md` | 170 |

That is not three coincidences. It is what "fit the edit under the warn" produces, and the next
sentence any of them needs warns.

🔴 **`payslip-lifecycle.md` did not stay at 170 by staying small — it stayed at 170 by getting
wider.** On `develop` before task 034 it had **zero** prose lines over 112 columns (longest: 107).
It now has **30**, the longest at **137**. The content grew about a quarter more than the line count
admits, so the line budget stopped measuring the thing it exists to measure. §5's remedy for a card
at the cap is *"split, not a bigger cap"*, and a card that widens its lines has taken the bigger cap
by another route.

## Scope

**Split `payslip-lifecycle.md` at the teach-rate seam, and reflow what stays.**

The natural boundary is the material tasks 034 and 036 added, which is one subject and not the
payslip's lifecycle: how a `TeachRate` row becomes the lookup `computePayslip` reads, why that fold
is a `Map` and lives in `lib/payroll.ts`, why the activity **name** is a separate fact from the
activity's **rate**, and why `TeachActivity` has no FK. Suggested new card:
`.docs/knowledge/domain/teach-rate-lookup.md`.

§5 is explicit that a split must **shrink `sources:` with it** — a card that moves its prose but
keeps the parent's whole source list goes stale just as often. So:

- the new card takes `lib/payroll.ts`, `lib/activities.ts`, `lib/activities.test.ts` and
  `prisma/schema.prisma`;
- `payslip-lifecycle.md` keeps `lib/payroll-run.ts`, `lib/payroll-run.test.ts`,
  `app/payslips/page.tsx`, `app/payslips/[id]/page.tsx` and whatever else its remaining prose
  actually claims — re-read them rather than subtracting mechanically;
- a row in [.docs/knowledge/index.md](../../.docs/knowledge/index.md) for the new card (the gate
  checks that direction).

**Then reflow the lines that were widened** back to the width the rest of `.docs/**` uses. Do this
*after* the split, because reflowing first pushes the card past 170 — which is the honest signal and
exactly why the split has to come first.

While the other two are open: `payroll-rules.md` and `money-input-guards.md` are at 170 with no
widening problem, so they need headroom rather than surgery. Check whether either has a section that
has outgrown the card the same way before adding anything to them.

## Done — split landed with task 036 (2026-09-19)

`.docs/knowledge/domain/teach-rate-lookup.md` now owns the two sections tasks 034 and 036 added
(`buildTeachRates` as a `Map`, and "an activity is a name; a rate is a separate fact"), with
`lib/payroll.ts` · `lib/activities.ts` · `lib/activity-names.ts` · `lib/activities.test.ts` ·
`prisma/schema.prisma` · `app/admin/config/page.tsx` as its `sources:`. `payslip-lifecycle.md` keeps
the run loop and the two payslip screens and dropped exactly those sources.

- **170 → 115** (`payslip-lifecycle.md`) and **87** for the new card. Both well under the §5 warn,
  with room for the next lesson instead of one line of it.
- **The widening is undone too, which was the actual complaint**: the moved prose was reflowed to
  100 columns. `payslip-lifecycle.md` is back to 2 lines over 100 (max 107, its pre-034 shape) and
  the new card has 3 (max 101), against the 30 lines up to 137 columns that finding 3 measured.
- Index row added. `check-knowledge: OK — warn 0 · 7 cards`, `check-links: OK`.
- `payroll-rules.md` (170, 22 lines over 100) and `money-input-guards.md` (170) were **not** touched:
  neither was widened by 034/036 and neither has an obvious seam. They stay as this card describes —
  at the warn, needing headroom before the next sentence lands in either.

## Notes

- Found by `code-reviewer` on the task 036 review, 2026-09-19 (finding 3). It also verified the
  thing worth knowing: **no lesson was quietly deleted to make room.** It diffed
  `payslip-lifecycle.md` word for word — the `__proto__` / `Object.prototype` chain, the reason
  `buildTeachRates` lives in `lib/payroll.ts`, the "not also blocked in `addActivity`" ruling and the
  task-034 provenance are all still present. The only text removed was the sentence describing task
  036 as still open, correctly replaced by the fix.
- Related but **not the same card**: [037](037-split-payroll-test-and-pin-the-zero-vs-missing-rate-boundary.md)
  splits `lib/payroll.test.ts` for the §4 ceiling and carries the junit-pin argument. This one is §5
  and prose. They can ship in either order; neither blocks the other.
- ⚠️ This is a prose card, so nothing here changes a baht figure and it does not need the
  `payroll-auditor` lane. `code-reviewer` alone, per §9.
