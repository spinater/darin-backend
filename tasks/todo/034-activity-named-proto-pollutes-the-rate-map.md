# An activity named `__proto__` turns a missing teach rate into a silent 0 ฿

- status: todo
- commit:

## Goal

`lib/payroll-run.ts:121` builds the rate map with a plain object literal:

```ts
const teachRates: Record<string, Record<string, number>> = {};
for (const r of rates) (teachRates[r.activity] ??= {})[r.rank] = r.rate;
```

`r.activity` is whatever `addActivity` wrote. That action (`app/admin/config/page.tsx:130-139`)
accepts **any** non-empty string from the "เพิ่มกิจกรรม" box and creates a `TeachRate` row at 0 for
each of the three ranks. For `activity === "__proto__"`:

1. `teachRates["__proto__"]` is `Object.prototype`, which is **not nullish**, so `??=` assigns nothing;
2. `(Object.prototype)["PT"] = 0` — the rate is written onto `Object.prototype` itself, for all
   three ranks;
3. the engine's lookup `teachRates[activity]?.[staff.rank]` (`lib/payroll.ts:107`) then misses on the
   activity's own object and **inherits** the polluted value — for every activity, every trainer;
4. `rate == null` is now false, so the §2 rule 4 branch at `lib/payroll.ts:108-114` never fires.

## Why this one matters more than its likelihood suggests

🔴 **It converts a warning into a silent zero, at the exact point CLAUDE.md §2 rule 4 is about.**
Today a rank with no configured rate produces
`ไม่มีเรทค่าสอน <activity> × <rank> — N คาบยังไม่ถูกคิดเงิน` and the money is visibly unpaid. After
pollution the same case produces a **0 ฿ line with `warnings: []`** — money that disappears quietly,
which the rulebook calls the most expensive failure this system has. It is the same shape as the
cleared-`comm.pt.selfClosed` case already recorded in
[money-input-guards.md](../../.docs/knowledge/domain/money-input-guards.md).

Reach is low and consequence is high and durable:

- **Reach** — an authenticated admin has to type `__proto__` into the activity box. Nobody does this
  by accident; it is a trap, not an incident waiting to happen.
- **Consequence** — `Object.prototype` is polluted for the **whole server process**, so it outlives
  the request and affects every payroll run until the process restarts, *and* the `TeachRate` rows
  bring it back on the next boot. The payslips it produces look ordinary.

## Scope

- Make the map not inherit: a `Map`, or `Object.create(null)`, or classify the activity name against
  a closed set before it is used as a key. 🔑 `lib/config-form.ts:88` (`RULES[kind]`) is the repo's
  existing answer to this shape — classify into a closed set first, then index — and task 027 used
  `Object.hasOwn` for the two `?err=` lookups. Pick one deliberately; do not add a fourth idiom.
- Decide whether the **name** is also guarded at the write (`addActivity`), or only the read. The
  read is the one that moves money, so it is the one that must be fixed; guarding the write as well
  is a second decision, not a free extra.
- While that action is open: `addActivity` still refuses an empty name with a bare
  `if (!activity) return;` — the same silent refusal [task 027](../done/027-addstaff-fails-silently.md) just
  removed from `addStaff` one screen over, and the notice surface it needs already exists.

## Who reviews this

`lib/payroll-run.ts` is on CLAUDE.md §9's path list ⇒ **`code-reviewer` + `payroll-auditor`**, not
one lane. And it does **not** go to the `claude-tekton` lane: choosing between a `Map`, a
null-prototype object and a name guard is a decision, not a transcription (§9).

## Notes

- Found by `code-reviewer` during the task 027 re-review (2026-09-19), while sweeping `app/**` and
  `lib/**` for other lookups shaped like the one task 027 fixed. **Pre-existing** — not introduced by
  that change, and in a file that diff never touched, which is why it did not block it.
- The same sweep cleared four other variable-keyed lookups as safe, with reasons worth not
  re-deriving: `lib/config-form.ts:88` (classified into a closed set first),
  `app/payslips/[id]/page.tsx:70` (`group` is written in exactly one place, from five literals —
  note `?? g` would **not** save it, since a prototype key is not nullish), and
  `lib/config-keys.ts:52` (`Object.fromEntries` defines own properties, so even a `PayrollConfig`
  row keyed `__proto__` lands as an own key).
