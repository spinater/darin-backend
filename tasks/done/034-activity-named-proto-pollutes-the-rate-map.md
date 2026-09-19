# An activity named `__proto__` turns a missing teach rate into a silent 0 ฿

- status: done
- commit: 9eae7c3

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
  `if (!activity) return;` — the same silent refusal [task 027](027-addstaff-fails-silently.md) just
  removed from `addStaff` one screen over, and the notice surface it needs already exists.

## Who reviews this

`lib/payroll-run.ts` is on CLAUDE.md §9's path list ⇒ **`code-reviewer` + `payroll-auditor`**, not
one lane. And it does **not** go to the `claude-tekton` lane: choosing between a `Map`, a
null-prototype object and a name guard is a decision, not a transcription (§9).

## Progress — implemented, reviewed by both lanes, shipped (2026-09-19)

The code is written and the gate is green, but **neither §9 review lane ran**: `code-reviewer` and
`payroll-auditor` were both dispatched and both died mid-read on `rate_limit` / HTTP 429
(*"monthly spend limit … session limit resets 6:30am UTC"*). A review that never ran is not a pass,
and this diff is on the money path, so nothing was committed to `develop` and nothing was pushed.

**Where the work is:** branch `task-034-proto-rate-map`, one commit, `develop` untouched.
`bash scripts/verify.sh` = ALL GREEN on it, including the gates' gates tier (`scripts/**` moved).

**Counter-test run** (§6 rule 8, via `scripts/counter-test.sh`): restoring the object-literal fold
turns both new assertions red — `Object.hasOwn(Object.prototype, "ST")` becomes true, and the
`__proto__` activity's own 999 ฿ rate is no longer paid. Restored, hashes matched at `restore`.

**The three decisions the card asked for, as taken:**

1. **`Map` of `Map`s**, not `Object.create(null)`, not `Object.hasOwn` at the read, not closed-set
   classification. Closed-set is impossible — activity names are data (§2 rule 7). `Object.hasOwn`
   at the read fixes the lookup but **not** the write, and the write is the half that pollutes
   `Object.prototype` for the whole process. `Object.create(null)` is one careless `= {}` away from
   regressing and its type is indistinguishable from a plain object. `Map` is already this file's
   idiom (`byActivity`, `byClass` two lines away) ⇒ third idiom, not a fourth.
2. **The read is fixed; the name is deliberately *not* blocked at the write.** With the `Map` the
   name is inert, and a second place knowing about `__proto__` is one decision in two homes.
   🔴 **This is the decision the pending `code-reviewer` pass was asked to challenge** — whether an
   activity literally named `__proto__` has any remaining reachable harm (rendering, the
   `activity_rank` compound unique, the rate table, payslip line labels).
3. **`addActivity`'s empty-name silent refusal is fixed** — `?err=activityEmpty`, copy in the new
   `app/admin/config/_components/add-activity-form.tsx`, one refusal ⇒ a string equality rather
   than a lookup table, so the `Object.hasOwn` guard its two neighbours need has nothing to guard.

### The two review lanes — run 2026-09-19 15:2x +07, after the spend limit reset

The first attempt died mid-read on HTTP 429 (*"monthly spend limit … resets 6:30am UTC"*) and is why
this card sat on a branch for three hours. Re-dispatched after the reset; both returned.

| Lane | Verdict |
|---|---|
| `code-reviewer` | **PASS** |
| `payroll-auditor` | **APPROVE-WITH-NITS** |

**Decision 2 was challenged and stands.** `code-reviewer` swept for the thing the card asked about —
does an activity name still have reachable harm now that only the read is fixed — and the answer for
**prototype keys** is no, with the sweep named rather than asserted: after this commit there is no
variable-keyed plain-object *write* left in `lib/**` or `app/**`. The surfaces cleared, so nobody
re-derives them, are listed in [task 035](../todo/035-activity-name-with-a-pipe-overwrites-another-rate.md).

**What the lanes found that this commit fixed:**

1. **The doc-comments overclaimed** (`code-reviewer`). "With this builder the name is inert" is true
   of the *map*, not of the *system* — and it is the most authoritative place a later reader would
   look before asking "do I need to validate an activity name?". Narrowed to *"inert as a key of this
   map"* in `lib/payroll.ts` and in `payslip-lifecycle.md`, each now pointing at the two open cards.
2. **The same paragraph was written out nine times** (`code-reviewer`). §4's one-decision-one-home
   applies to prose: the 15-line essay on the `teachRates` *type annotation* restated the builder's
   comment verbatim, including a `??=` expression that does not exist in that file. Cut to three
   lines; the long version stayed with the builder, which is where the bug was.
3. **`buildTeachRates` moved from `lib/payroll-run.ts` to `lib/payroll.ts`** (`payroll-auditor`).
   Putting it in the run loop made `lib/payroll.test.ts` import `lib/db.ts`, which constructs a
   `PrismaClient` at module load — so the engine's 34 baht assertions stopped being runnable without
   `prisma generate`, and would have failed pointing at Prisma rather than at money. ⚠️ The two lanes
   disagreed here: `code-reviewer` called it a nit and said leave it, on the grounds that the
   fixture-cannot-drift argument was worth more. That trade-off does not exist — the builder's new
   home is beside the type it builds, so the tests still use the **real** builder and simply no
   longer reach the DB layer. Taken on that basis. Pure movement, the type checker gates it, no pin
   moved, and the counter-test was **re-run after the move** (the old object fold restored in its new
   home turns both files red again: `Object.hasOwn(Object.prototype, "ST")` in
   `payroll-run.test.ts:103`, and the 999 ฿ rate in `payroll.test.ts:105`; restored, hashes matched).

**What the lanes found that is *not* this commit's to fix** — three cards opened instead:

- [035](../todo/035-activity-name-with-a-pipe-overwrites-another-rate.md) — `code-reviewer`, and the direct
  answer to this card's own question: an activity name containing `|` collides with the bulk-save
  field encoding `rate|<activity>|<rank>` and overwrites a **different** activity's rate with 0.
  Same silent zero, different road, untouched by the `Map`.
- [036](036-addactivity-seeds-rate-zero-so-the-warning-can-never-fire.md) — `payroll-auditor`,
  **Major**: `addActivity` seeds all three ranks at `rate 0`, so an activity added through the screen
  is never "unconfigured" and the §2 rule 4 warning this card just restored can never fire for it. A
  12-session ST trainer is 4,800 ฿ short with `warnings: []`. Needs `architect` first — the two ways
  out are a schema change and a listing-mechanism change.
- [037](037-split-payroll-test-and-pin-the-zero-vs-missing-rate-boundary.md) — both lanes:
  `lib/payroll.test.ts` at the §4 warn line (468 after this commit), and the `0`-vs-missing boundary
  unpinned, so `?? 0` or `if (!rate)` would reintroduce this card's own bug **green**. The split and
  the two arms go together because the split is what pays for the arms.

**Also worth not re-deriving** (`payroll-auditor`, verified by probing the old and new folds side by
side): 38 of the lookups differ between them and **every one is a prototype member**, never a number
belonging to another activity ⇒ no ordinary activity name changed by a single baht. And the `Map`
closed the **rank** dimension too, which this card never claimed: a rank string that is a prototype
key used to return a *function*, making `money(qty * fn)` — and therefore `teachPay`, `net` and every
total on that payslip — `NaN`. Latent (ranks come from the closed `RANKS` list), now structurally gone.

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
