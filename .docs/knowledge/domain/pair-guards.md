---
sources:
  # Both guards are server actions in this file: `add`'s `noShow > booked` (task 025) and `del`'s
  # read-back of `sourceKey` against `confirm=imported` (ใบ 065). Dropping either redirect, or
  # letting `del` write without the read-back, must land here as STALE.
  - app/classes/page.tsx
  # ใบ 065's two-step lives half in this component: the disclosure posts `confirm=imported` and the
  # ordinary delete `<form>` must NOT carry that field — that asymmetry is half of why the guard
  # holds. [money-on-screen.md](money-on-screen.md) sources this file for a different claim (nothing
  # on that table is derived); both are true and both go stale together.
  - app/classes/_components/session-table.tsx
  # One fact only: `computePayslip` **warns** on a stored `attended < 0` and still pays nothing, and
  # the 200 ฿ / 400 ฿ guesses quoted below are its own. [payroll-rules.md](payroll-rules.md) rule 3
  # owns that arm and sources this file and `lib/payroll/class.test.ts` for it; it is listed here
  # too because "both ends were fixed" below is false the moment the arm goes, and the loud STALE
  # is cheaper than the silent falsehood (§4's direction-of-error, applied to `sources:`).
  - lib/payroll.ts
---

# The two guards on `/classes` that one field cannot make

Split out of [form-refusals.md](form-refusals.md) at ใบ 073 (it had reached 167/200). That card owns
**the per-action refusals** — which action guards which field, what a *blank* means in each one, and
the shared `?err=` surface every action reports through. This one owns the two guards on `/classes`
that compare a value against a **second** value — the other head count, or the row already stored —
and where the refusal is itself a money decision rather than the end of one.

Both obey that card's error surface unchanged: a flag not a message, nothing written, and the
redirect to the clean URL. Read it first; nothing here re-states it.

⚠️ **Since ใบ 080 the `date` guard runs ahead of both of these** (`err=date`, `calendarDate`, the
predicate `/ot` and `/sales` share) — one `?err=` slot, and a คาบ in the wrong month costs more
than a คาบ with the wrong head counts, because §1.4's credit is deducted from the **month's**
total. That row and its ordering argument are [form-refusals.md](form-refusals.md)'s; what is
unchanged here is everything below — the pair is still checked after each field is sane on its own.

⚠️ `lib/payroll.ts` is on `sources:` for one claim only, so this card goes STALE on money commits it
otherwise has nothing to say about. **Clear that STALE with a dated one-liner, never a paragraph** —
[money-on-screen.md](money-on-screen.md) reached 122 lines by accumulating exactly those notes, and
at this length there is room to be disciplined instead.

## ใบ 025 — `noShow` vs `booked`, the pair both field guards pass

Nearly every row in [form-refusals.md](form-refusals.md)'s action table refuses a **field**; the
rows that instead weigh a value against a **second** value are split by where the prose is
load-bearing. `addStaff`'s `username` **vs** the rows already stored (`err=newstaffDup`) is not
here either: it travels with the P2002/TOCTOU argument — the one refusal the parse cannot make —
which left for [config-form-parses.md](config-form-parses.md) at ใบ 083, while the flag itself stays
in [form-refusals.md](form-refusals.md)'s table. This card owns the two on `/classes`, where the refusal is itself a money decision. The first
of them
refuses a **pair**: `booked: 2, noShow: 5` passes both field guards — each is a non-negative
integer — and stores, and the engine then reads `attended = −3`, a case §1.4 does not define.

🔑 **Both ends were fixed, and only one of them is the deliverable.** The engine is the end that
matters: rows keyed before this guard existed are already in the table, and `computePayslip` used to
fold them into its `<= 0` arm for **0 ฿ with `warnings: []`** — the invisible zero, ~800 ฿ off one
slip for four such rows. It now warns, naming the class and the numbers, and still pays nothing —
paying anything would mean guessing which of the two counts is wrong, and the guesses pay
differently (200 ฿ vs 400 ฿ on that row); see [payroll-rules.md](payroll-rules.md) rule 3. This door
only stops the next one being typed, where the person who typed it is still looking at the numbers
— it can never repair what is stored, so **a guard here is not a reason to let the engine decide
quietly**.

## ใบ 065 — `/classes` grew a second pair guard, on `del` rather than on a field

`del` now reads the row back and **refuses a non-null `sourceKey` unless the post carries
`confirm=imported`**: an imported คาบ deleted here is re-created by the next upload and paid twice
(200 + 200 for one 200 ฿ Core Strength). Same surface as everything on that card —
`?err=imported`, a flag not a message, nothing written — plus `?err=gone` for a row already deleted
from another tab, which
the read-back makes reachable. 🔑 **The table hides the button and the action refuses it**, because a
hidden button is copy, not a guard: a stale tab still holds the `<form>`.

🔴 **A default, not a prohibition — and the difference is money in both directions.** The re-creation
argument holds only while the **file still carries that key**; correct a time or a class name in Gymmo
and the old row is orphaned instead, never re-created. This action is the repo's only
`classSession.delete`, so refusing outright left such a row unrepairable anywhere in the product
(ธันยา's August: class value 8,050 → 8,250 ⇒ `classPay` **3,050 → 3,250 ฿ every run, for ever**). The
explicit post from the table's disclosure carries `confirm=imported`; the ordinary delete `<form>`
does not, so one click can never do it. **The only guard on this screen a human may deliberately
pass** — every other one refuses outright — because it is the only one where refusing also loses.
