---
sources:
  # The bulk save's parse and its pin (12) — all-or-nothing over every numeric field of the form.
  - lib/config-form.ts
  - lib/config-form.test.ts
  # `addStaff`'s parse and its pin (9) — same shape, refusals in a fixed order.
  - lib/staff-form.ts
  - lib/staff-form.test.ts
  # The read-time half of the `cfg` hole: `num()` must throw on a blank, because a value can also
  # arrive by seed or by hand in the database. [money-input-guards.md](money-input-guards.md) lists
  # this file for the predicate itself; this card lists it for that one claim.
  - lib/config-keys.ts
  # The two actions these parses sit inside, and the form that bounds the round-trip count.
  # ⚠️ **Only the parses are this card's.** Which flag each refusal carries and how the notice
  # renders are [form-refusals.md](form-refusals.md)'s, which lists this same file for that.
  - app/admin/config/page.tsx
---

# สองพาร์สที่ตรวจทั้งฟอร์มก่อนเขียนแถวแรก — `/admin/config`

Split out of [form-refusals.md](form-refusals.md) at ใบ 083 (it had reached 192/200). That card owns
**which action refuses which field and how it says so**; `/admin/config`'s rows are still in its
table and the flags below are its flags. This one owns the two refusals with **real logic behind
them** — both parse the *whole* form before the first write — and what the largest of those holes
cost in baht.

Read that card first for the `?err=` surface; nothing here re-states it.

**The bulk save is the one with real logic** ⇒ it lives in `lib/config-form.ts`
(`parseConfigNumbers`) and is tested. It parses **every** numeric field before the first write and
returns `{ ok: false, kind }` on the first bad one, because the old field-by-field loop failed
**half-written**: the fields before the bad one were already committed, leaving a config that is
part old and part new with nothing announcing which. The write loop then runs inside one
`db.$transaction`, so "ยังไม่ได้บันทึกอะไรเลยสักช่อง" is true for a DB failure too and not only for a
bad field. It is bounded by the form (~75 round-trips on a fresh database since ใบ 063 added 5 class
prices and 2 staff rows), unlike `runPayroll`, which must never wrap a whole period — that is why one
may and the other may not.
🔴 **Since task 036 this is the *only* path that writes a teach rate**: `addActivity` used to seed all three ranks at
`rate: 0` — a number nobody typed, read by screen and engine as a deliberate one — and now registers a **name** only.

🔑 **`addStaff` has real logic too** (task 027) ⇒ `lib/staff-form.ts` (`parseNewStaff`), same shape,
with the refusals in a **fixed order** — name → username → password → money, first one wins, so two
bad fields always report the same one. Its money arm is task 013's `newstaff`, unchanged; the three
identity flags replaced a bare `return` and the duplicate an unhandled **throw** — it is the one
refusal the parse cannot make: caught as **only** `P2002` on the `create` (no `findUnique` pre-check
— a TOCTOU race), everything else rethrown so a real failure still reaches `app/error.tsx` honestly.

🔴 **The `cfg` boxes were the largest hole of the doors task 013 put on one predicate** (`/ot`'s
form and its paste, `/sales`, `/classes`, and `/admin/config`'s two actions), **and they are plain
text inputs with no `required`.** Clearing one stored `""`, and `num()` answered `Number("") === 0`. Measured through
`computePayslip`: a cleared `comm.pt.selfClosed` pays **0 ฿** instead of 2,000 ฿ on a 20,000 ฿
self-closed bill · a cleared `incentive.threshold` makes `total >= 0` true for everyone, so §1.6's
retroactive 12% fires for every trainer every month · a cleared `ot.ratePerHour` zeroes OT. All with
`warnings: []`. Both halves are closed: this parse refuses the write, and **`num()` in
`lib/config-keys.ts` now throws on a blank or non-finite value** so the read fails loudly too — a
value can also arrive by seed or by hand in the database.
