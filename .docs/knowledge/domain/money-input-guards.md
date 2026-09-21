---
sources:
  # The predicate itself and the pin that keeps it honest.
  - lib/form-number.ts
  - lib/form-number.test.ts
  # The bulk config form's all-or-nothing parse — the one numeric guard with real logic in it.
  - lib/config-form.ts
  - lib/config-form.test.ts
  # The add-staff parse — the same shape, on the one form that creates a staff member (task 027).
  - lib/staff-form.ts
  - lib/staff-form.test.ts
  # `num()` is the read-time half of the same guard — it must throw on a blank, and the card says so.
  - lib/config-keys.ts
  # The five actions this card claims are guarded. Re-introducing a bare `Number(formData.get(x))`
  # in any of them must land here as STALE rather than pass under a card still promising the guard.
  - app/ot/page.tsx
  - app/sales/page.tsx
  - app/classes/page.tsx
  - app/admin/config/page.tsx
  # The fingerprint paste shares the same predicate — dropping it back to a bare `Number()` /
  # `isFinite` re-opens the negative-hours door on the path OT actually arrives by.
  - lib/ot-import.ts
---

# Numbers arriving from a form — the guard every money field goes through

Read this before adding a form field that becomes a baht figure, an hours figure or a head count.
The engine's own rules are in [payroll-rules.md](payroll-rules.md); this card is about the edge
**before** the engine, where a figure is read off an HTTP request and written to the database.

## The defect, stated once (task 013 item 4)

`type="number" min={0} required` is a **client** hint. A server action is a plain HTTP endpoint, so
the field arrives as anything or not at all — and `Number()` answers every one of those quietly:

| What arrives | `Number()` says | What that costs |
| --- | --- | --- |
| nothing (field absent) | `0` | an `update` overwrites a recorded 12.5 h with a zero nobody is told about |
| `""` / `"   "` | `0` | same silent zero, from a field the user cleared |
| a `File` part (any multipart body can send one) | `NaN` | `Float` is `double precision`, which **accepts `NaN`** |
| `"1e999"` | `Infinity` | ditto |
| `"-5"` | `-5` | stores and then computes to nothing (`Math.max(0, -5 − threshold)`) |

🔴 **`NaN` does not stop at the one row.** It reaches `net`, the stored `Payslip.net`, and then the
`reduce` behind "รวมทั้งงวด" on `/payslips` — so one bad field blanks the period total for **every**
staff member on the screen, not just the one it was typed for. That is CLAUDE.md §2 rule 4 failing
in its most expensive direction: quiet, and noticed at payday.

## The guard

`lib/form-number.ts`, two exports, both pure:

- **`finiteNumber(raw, opts?)` → `number | null`.** `null` for a non-string (absent, or a `File`),
  for blank, for a non-finite value, for anything below `opts.min` (**default 0** — every field
  guarded today is hours, a head count or baht), for a fraction when `int` is set, and for anything
  above `opts.max`. 🔴 **`int` and `max` are not tidiness.** Measured on a throwaway postgres with
  this schema: `1200.5 → 1200` · `1201.5 → 1201` · `2.5 → 2` · `15000.5 → 15000` · **`0.4 → 0`**.
  Postgres `integer` **truncates toward zero** — it does not round and it does not refuse — so a
  price typed as `1200.50` quietly loses 50 satang and one typed as `0.4` quietly becomes free. An
  overflow does the opposite: `99999999999` throws *"Value out of range for the type"* **at the
  write**, mid-loop, after the earlier rows have already committed.
  `INT_COLUMN_MAX` (2,147,483,647) is exported beside it — a column bound, not a rate, so §2 rule 3
  does not apply, but it is named rather than inlined. A *sensible* ceiling for a salary or a price
  is a different, spec-level question and is carded.
- **`isBlank(raw)` → `boolean`.** "Not given" — absent **or** empty. 🔑 A `File` part is **not**
  blank: it was given and is unreadable, so it must be refused rather than take the default for an
  empty field. That is the distinction the old `String(formData.get(x) ?? "")` got backwards —
  `"[object File]"` is truthy, so it was treated as a value, and `Number()` then made it `NaN`.

The pair exists so a `null` is never ambiguous: the caller decides whether a *blank* field has a
documented meaning, and every other `null` is a refusal.

## The actions, and what each refuses

| Action | Fields | Blank means | Flag |
| --- | --- | --- | --- |
| `/ot` `add` | `hours` | refused | `err=hours` |
| `/ot` `paste` | `hours`, per line | line skipped (blank line / header) | `invalidHours` box |
| `/sales` `add` | `netPrice` | refused | `err=netPrice` |
| `/sales` `add` | `listPrice` | "sold at list price" ⇒ `null`, and fine | `err=listPrice` |
| `/classes` `add` | `booked` | refused | `err=booked` |
| `/classes` `add` | `noShow` | 0 — what `?? 0` and `defaultValue={0}` already said | `err=noShow` |
| `/classes` `add` | `noShow` **vs** `booked` | — (a *pair*, not a field) | `err=noShowOverBooked` |
| `/admin/config` `addStaff` | `baseSalary`, `classCredit` | 0, the documented default | `err=newstaff` |
| `/admin/config` `addStaff` | `name`, `username` (trimmed), `password` | refused, one flag each — a `File` part too, never `"[object File]"` | `err=newstaffName` · `err=newstaffUser` · `err=newstaffPass` |
| `/admin/config` `addStaff` | `username` **vs** the rows already there | — (the `@unique` index, caught as `P2002`) | `err=newstaffDup` |
| `/admin/config` `addActivity` | `activity` (trimmed), and the same name **vs** every one already visible | refused — it used to `return` in silence, the box cleared and nothing said the activity was not added (task 034, the same shape task 027 took out of `addStaff`); a name already in the union is refused too, and the action writes one `TeachActivity` row and **no** `TeachRate` row (task 036) | `err=activityEmpty` · `err=activityDup` |
| `/admin/config` `save` | every `cfg` box — every rate, threshold and percentage the engine has | refused | `err=cfg` |
| `/admin/config` `save` | every teach rate, class price and staff salary field of the bulk form | a **rate** blank deletes that rate; every other blank is refused | `err=rate` · `err=class` · `err=staff` |

🔑 **The paste path is on the same predicate** (`lib/ot-import.ts` → `invalidHours`, one bullet per
line, no new surface needed). It has to be: the one-row form refusing `-5` while the paste imported
it left the door open on the path OT actually arrives by, and `-5` is the quiet one — finite, so it
stores, and `Math.max(0, -5 − threshold)` then pays nothing.

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

🔴 **The `cfg` boxes were the largest hole of the five, and they are plain text inputs with no
`required`.** Clearing one stored `""`, and `num()` answered `Number("") === 0`. Measured through
`computePayslip`: a cleared `comm.pt.selfClosed` pays **0 ฿** instead of 2,000 ฿ on a 20,000 ฿
self-closed bill · a cleared `incentive.threshold` makes `total >= 0` true for everyone, so §1.6's
retroactive 12% fires for every trainer every month · a cleared `ot.ratePerHour` zeroes OT. All with
`warnings: []`. Both halves are closed: this parse refuses the write, and **`num()` in
`lib/config-keys.ts` now throws on a blank or non-finite value** so the read fails loudly too — a
value can also arrive by seed or by hand in the database.

## The error surface — copy it, do not invent a third dialect

Established at `/ot` (task 009) and `/payslips` (task 013 item 1), and now the same on all four:

1. the action `redirect`s back to the same page with `?err=<flag>`;
2. the flag is a **flag, not a message** — nothing from the URL is rendered, the Thai copy lives in
   the page file (§2.5) ⇒ a crafted link cannot put words on an admin's screen;
3. the notice names the field **and** says nothing was saved — a bill or a คาบ that somebody
   believes is keyed in is the failure this screen can hide;
4. a successful write redirects to the **clean** URL, so a stale notice cannot outlive its cause.

🔴 **Point 4 binds every action on the page that writes, not just the guarded one.** One screen has
one `?err=` slot, so an action that only `revalidatePath`s leaves whatever flag is in the address
bar standing over the thing it just saved. The expensive instance was `addStaff`: refused → admin
fixes the field → submits again → the `create` **succeeds** while `?err=newstaff` still renders
"ยังไม่ได้เพิ่มพนักงานคนนี้" ⇒ the person is added twice, the alias follows the newer row, and the
orphan draws its `baseSalary` in every run with no sessions to make it look wrong. `addActivity`,
`addAlias`, `addColor`, `toggleActive` and both `del` actions carry the same redirect for the same
reason.

`/admin/config` keeps its copy in `_components/` (`save-notice`, `add-staff-form`, `add-activity-form`)
rather than the page: 462 lines against the §4 ceiling of 500 when the first moved, and the rate matrix
followed as `rate-table.tsx` at task 036.

## The one guard that is not a field — `noShow` vs `booked` (task 025)

Every row in the table above refuses a **field**. This one refuses a **pair**: `booked: 2,
noShow: 5` passes both field guards — each is a non-negative integer — and stores, and the engine
then reads `attended = −3`, a case §1.4 does not define.

🔑 **Both ends were fixed, and only one of them is the deliverable.** The engine is the end that
matters: rows keyed before this guard existed are already in the table, and `computePayslip` used to
fold them into its `<= 0` arm for **0 ฿ with `warnings: []`** — the invisible zero, ~800 ฿ off one
slip for four such rows. It now warns, naming the class and the numbers, and still pays nothing —
paying anything would mean guessing which of the two counts is wrong, and the guesses pay
differently (200 ฿ vs 400 ฿ on that row); see [payroll-rules.md](payroll-rules.md) rule 3. This door
only stops the next one being typed, where the person who typed it is still looking at the numbers
— it can never repair what is stored, so **a guard here is not a reason to let the engine decide
quietly**.

## What is deliberately *not* guarded here

- **A per-key ceiling for a config value.** Nothing stops `comm.pt.selfClosed` being set to `900`
  (a 900% commission) or `payday.base` to `77`. That needs a spec table beside `CONFIG_DEFAULTS`,
  one row per key, and is carded — guessing the maxima here would put the spec in the guard.
- **A non-numeric config key.** All 18 keys in `CONFIG_DEFAULTS` are non-negative numbers today, and
  the `cfg` rule assumes it. A key that is a name, a flag or a date needs its own branch in
  `lib/config-form.ts` **before** it is added, or the first owner who edits it is refused.
