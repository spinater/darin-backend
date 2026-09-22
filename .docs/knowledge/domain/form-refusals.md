---
sources:
  # The two parses with real logic in them, and the pins that keep them honest. They are here and
  # not on [money-input-guards.md](money-input-guards.md) because what they encode is per-action
  # policy — which blank means what, in which order refusals win — not the predicate itself.
  - lib/config-form.ts
  - lib/config-form.test.ts
  - lib/staff-form.ts
  - lib/staff-form.test.ts
  # The fingerprint paste is one of the actions in the table below, on the same predicate.
  - lib/ot-import.ts
  # The four screens whose actions this card enumerates. Re-introducing a bare
  # `Number(formData.get(x))`, or dropping the clean-URL redirect from any action that writes, must
  # land here as STALE rather than pass under a card still promising both.
  - app/ot/page.tsx
  - app/sales/page.tsx
  - app/classes/page.tsx
  - app/admin/config/page.tsx
  # ใบ 065's `confirm=imported` two-step: the ordinary delete form must NOT carry that field, which
  # is half of why the guard holds. [money-on-screen.md](money-on-screen.md) sources this file for a
  # different claim (nothing on that table is derived); both are true and both go stale together.
  - app/classes/_components/session-table.tsx
---

# ด่านของแต่ละ action — อันไหนปฏิเสธอะไร และมันบอกคนยังไง

Split out of [money-input-guards.md](money-input-guards.md) at ใบ 068 (it had reached 189/200).
That card owns **the predicate**: what `finiteNumber`/`isBlank` refuse and why `Number()` cannot be
trusted on an HTTP boundary. This one owns **the policy on top of it** — which action guards which
field, what a *blank* means in each one, and the shared `?err=` surface they all report through.
It is the half that grows: every new form adds a row, not a rule.

Read the predicate first; nothing here re-states it.

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

### ใบ 065 — `/classes` grew a second pair guard, on `del` rather than on a field

`del` now reads the row back and **refuses a non-null `sourceKey` unless the post carries
`confirm=imported`**: an imported คาบ deleted here is re-created by the next upload and paid twice
(200 + 200 for one 200 ฿ Core Strength). Same surface as everything above — `?err=imported`, a flag
not a message, nothing written — plus `?err=gone` for a row already deleted from another tab, which
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

### ใบ 043 / ใบ 070 — the colour refusals moved out

`addColor`'s two refusals (`?err=colorMeaning` · `?err=colorNeutral`) and `/sync/review`'s three
(the unaimable `?hex=`, the unruled colour, `?err=closed`) are **one topic with its own home**:
[sheet-colour-rules.md](sheet-colour-rules.md). They left this card at ใบ 070, when adding the third
screen's worth pushed it to the 200-line cap — and `app/admin/config/_actions.ts` left `sources:`
with them, since that card already watches it. 🔑 They obey everything above unchanged: a flag not a
message, the redirect to a clean URL, and **loud, never a silent `return`**.
