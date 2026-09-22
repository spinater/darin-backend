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
---

# ด่านของแต่ละ action — อันไหนปฏิเสธอะไร และมันบอกคนยังไง

Split out of [money-input-guards.md](money-input-guards.md) at ใบ 068 (it had reached 189/200).
That card owns **the predicate**: what `finiteNumber`/`isBlank` refuse and why `Number()` cannot be
trusted on an HTTP boundary. This one owns **the policy on top of it** — which action guards which
field, what a *blank* means in each one, and the shared `?err=` surface they all report through.
It is the half that grows: every new form adds a row, not a rule.

Read the predicate first; nothing here re-states it.

`/classes`'s two **pair** guards left at ใบ 073 (this card had reached 167/200) — the ones that
compare a value against a second value rather than validating one field, and where the refusal is
itself a money decision: [pair-guards.md](pair-guards.md).

## The actions, and what each refuses

| Action | Fields | Blank means | Flag |
| --- | --- | --- | --- |
| `/ot` `add` | `hours` | refused | `err=hours` |
| `/ot` `paste` | `hours`, `date` and the username — per line | **only a wholly blank line is skipped** (`!line.trim()`, ใบ 014); a blank hours cell is refused, not dropped, and a line with hours but **no** identity field reaches `unmatched` rather than the floor | `unmatched` · `invalidHours` · `invalidDates` boxes |
| `/sales` `add` | `netPrice` | refused | `err=netPrice` |
| `/sales` `add` | `listPrice` | "sold at list price" ⇒ `null`, and fine | `err=listPrice` |
| `/classes` `add` | `booked` | refused | `err=booked` |
| `/classes` `add` | `noShow` | 0 — what `?? 0` and `defaultValue={0}` already said | `err=noShow` |
| `/classes` `add` | `noShow` **vs** `booked` | — (a *pair*, not a field ⇒ [pair-guards.md](pair-guards.md)) | `err=noShowOverBooked` |
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

🔴 **ใบ 014 — the paste refuses in two layers.** Its write is `deleteMany` + `createMany` inside one
`db.$transaction` ⇒ **all-or-nothing**: `imported` is `rows.length` or `0`, never between, and the
error copy names no failing row because none exists. A transaction is only an improvement if every
*per-line* problem is refused **before** it — one typo at line 85 of 220 would otherwise roll back the
other 219 where it used to strand 84 committed ⇒ four buckets, not two:

| Bucket | The line has | Why it is not just "it fails at the write" |
| --- | --- | --- |
| `unmatched` | a username nobody owns (a header row lands here, and so does a line with **no** username, as `(บรรทัดไม่มีชื่อผู้ใช้)`) | deduped by the normalized key — one fix recovers a whole month |
| `invalidHours` | an hours cell that is non-finite, negative, **or empty/absent** | the empty cell was in *no* bucket before ใบ 014: a fingerprint export writes `somchai<TAB>2026-07-01<TAB>` for a missed scan-out, so the paste reported "นำเข้าแล้ว 219 รายการ" with zero warnings while that person's OT was short |
| `invalidDates` | a date that is not a real calendar day | 🔴 the quiet half: `new Date("2026-06-31")` answers **`2026-07-01`**, no `NaN` anywhere, so that day's OT is counted in the **next month's period**. Validated by round-trip (`toISOString().slice(0,10)` must equal the text), which also pins the `YYYY-MM-DD` shape |
| `rows` | everything else, deduped by `staffId + date`, **last line wins**, position preserved | `@@unique([staffId, date])` would make `createMany` throw on a repeat and roll back the paste; last-wins is what the old upsert-per-row loop did in silence |

⚠️ What can still fail the write is then **infrastructure only**, which is what makes one flat Thai
line honest instead of a guess. No `bun test` proves the rollback (no DB) — `tasks/todo/015-db-test-lane.md`.

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

## ใบ 043 / ใบ 070 — the colour refusals moved out

`addColor`'s two refusals (`?err=colorMeaning` · `?err=colorNeutral`) and `/sync/review`'s three
(the unaimable `?hex=`, the unruled colour, `?err=closed`) are **one topic with its own home**:
[sheet-colour-rules.md](sheet-colour-rules.md). They left this card at ใบ 070, when adding the third
screen's worth pushed it to the 200-line cap — and `app/admin/config/_actions.ts` left `sources:`
with them, since that card already watches it. 🔑 They obey everything above unchanged: a flag not a
message, the redirect to a clean URL, and **loud, never a silent `return`**.
