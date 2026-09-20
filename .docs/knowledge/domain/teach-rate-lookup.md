---
sources:
  # `buildTeachRates` and the `teachRates` type live here, and the `rate == null` branch this card is
  # about is `computePayslip`'s ⇒ moving the builder, or softening that branch, must land here STALE.
  - lib/payroll.ts
  # The union that decides which activities exist at all, and the pure fold under it. Folding
  # "exists" and "has a rate" back together re-opens the 0 ฿ this card exists to describe.
  - lib/activities.ts
  - lib/activity-names.ts
  # The pin on that fold — including the empty-registry arm, the one that proves a priced activity
  # cannot vanish from the matrix.
  - lib/activities.test.ts
  # `TeachActivity` (names only, no FK, **never a number**) and `TeachRate`'s
  # `@@unique([activity, rank])`. A numeric column on the registry, or an FK onto
  # `TeachSession.activity`, must land here as STALE rather than pass under a card still calling it
  # a name table.
  - prisma/schema.prisma
  # The one screen that creates an activity and the one that prices it — the amber note's two halves
  # (blank = no rate ⇒ warns · `0` = chosen ⇒ pays 0 with a line) are this card's contract on screen.
  - app/admin/config/page.tsx
  # The deploy-time half of the same money (task 040): the seed used to re-create a `TeachRate` row
  # the owner had deleted, on every deploy, and `lib/seed-policy.ts` holds the decision that stopped
  # it. A seed that starts asserting the rate matrix again must land here as STALE.
  - prisma/seed.ts
  - lib/seed-policy.ts
  # The pin on that decision — `seedMode` and the report builder are pure, so the three
  # modes are fixed without a database. A rewritten arm must land here as STALE too.
  - lib/seed-policy.test.ts
---

# How a teach rate is found — and why a name is not a rate

Split out of [payslip-lifecycle.md](payslip-lifecycle.md) at task 039: that card is about the run
loop around a payslip, this one is about the single lookup `computePayslip` performs for `ค่าสอน`,
and the two defects that made it pay **0 ฿ without saying so**. Read it before touching
`lib/payroll.ts`'s `teachRates` parameter, `lib/activities.ts`, or "เพิ่มกิจกรรมใหม่".

The rule underneath both halves is [payroll-rules.md](payroll-rules.md) rule 3 — what the engine
cannot decide reaches the screen, never a silent zero.

## What the run hands the engine — `buildTeachRates` (task 034)

`runPayroll` loads every `TeachRate` row and folds it into the nested lookup `computePayslip` reads.
That fold is **`buildTeachRates`, exported and pure**, and it builds a `Map` of `Map`s. It lives in
**`lib/payroll.ts`**, not in the run loop: it builds `computePayslip`'s own input type, and keeping
it out of the db-importing module is what lets the engine's test suite build a real rate map without
pulling `lib/db.ts` (which constructs a `PrismaClient` at module load) into the tests that pin baht.
`lib/payroll-run.test.ts` still exercises it: `runPayroll` is its only caller.

🔴 **The `Map` is a domain guard, not a style choice.** An activity name is data an admin types into
"เพิ่มกิจกรรมใหม่" (§2 rule 7), so there is no closed set to classify it against, and an object
literal carries `Object.prototype` with it. The name `__proto__` broke both ends: the fold's
`(rates[activity] ??= {})[rank] = rate` found the *inherited* object, which is not nullish, so the
rate landed on `Object.prototype` itself — for the whole server process, outliving the request and
returning on the next boot from the rows still in the table — and every *other* activity then
inherited it, so the engine's `rate == null` was false and the [payroll-rules.md](payroll-rules.md)
rule 3 warning never fired. The line that said `ไม่มีเรทค่าสอน …` became a 0 ฿ line
with `warnings: []`.

`__proto__` is therefore **not** also blocked in `addActivity`: as a key of *this* map it is inert,
and a second place knowing about it would be one decision in two homes. What `addActivity` gained
instead is out-loud refusals — for an empty name (034) and for one that already exists (036).

🔴 **Read that as scoped to the prototype-key class, not as "the activity name is safe".** Both
review lanes on task 034 found a second road to the same silent zero, and one is still open: a name
containing `|` collides with the bulk-save field encoding `rate|<activity>|<rank>` and overwrites a
*different* activity's rate with 0 (task 035).

## An activity is a name; a rate is a separate fact (task 036)

`addActivity` used to create a `TeachRate` row for **all three ranks at `rate: 0`**, purely so the
new activity would appear in the matrix — which the page derived from the rate rows. So a
screen-added activity was never "unconfigured": `teachRates.get(a)?.get("ST")` answered `0`, not
`undefined`, `rate == null` was **false**, and a trainer with 12 such คาบ was paid **0 ฿ with
`warnings: []`** — rule 3 defeated at the one branch that enforces it.

- **`TeachActivity` holds names and nothing else, and nothing FKs onto it.** A numeric column there
  would belong in `TeachRate` (§2 rule 3); an FK would make `lib/sync.ts`'s per-cell `activity:
  source.activity` throw on a name nobody registered — against §2 rule 6, which says unmatched rows
  queue for review *and the run still completes*.
- **The listing is a union, so the registry only ever *adds*** (`lib/activities.ts`): registry ∪
  distinct `TeachRate` ∪ distinct `SheetSource` ∪ distinct `TeachSession`. An activity with a rate,
  a sheet or one historical session renders even if its registry row is missing ⇒ **no rate can
  become invisible** because a name was not registered, and the table stays off the money path. It
  also dissolved the page's hardcoded `"yoga"` into the `SheetSource` arm (§2 rule 7). Names compare
  **trimmed-exact, no case folding**: `Boxing` and `boxing` are two activities, the unpriced one
  warning loudly rather than inheriting the other's rate.
- 🔴 **Existing `0` rows were not migrated or reinterpreted.** A stored `0` still means *the owner
  chose not to pay that rank* — pays 0, shows a line, no warning. The ambiguous set is frozen and
  can only shrink, and both readings pay the same baht, so nothing is underpaid while the question
  waits ([029](../../../tasks/todo-human/029-sweep-rows-keyed-before-the-guards.md) ·
  [038](../../../tasks/todo-human/038-what-adding-an-activity-is-for.md)).
- ⚠️ **Not fixed here**: `app/page.tsx`'s banner flags an activity only when **no** rank has a rate,
  so `pt` priced for PT but not ST still passes it (the slip warns); and the `0`-vs-missing engine
  boundary is task 037's pin, not this card's.

## A deleted rate stays deleted — across deploys too (task 040)

`lib/config-form.ts` deletes the `TeachRate` row when the box is blanked, and the amber note under
the matrix promises exactly that. `prisma/seed.ts` then put it back: it runs on **every** deploy
(compose service `migrate` → `prisma db push && bun run prisma/seed.ts`), and `upsert … update: {}`
protects a value that was *edited* while doing nothing for one that was *deleted* — `upsert` cannot
tell "removed on purpose" from "never existed". Worked shape: a blanked `pt × PT` came back at
**200 ฿** and paid a PT trainer with 40 คาบ **8,000 ฿** with `warnings: []`. Same defect class as
task 036 one layer out — a number nobody typed, arriving where the engine reads it as a choice —
and the screen had just started promising the opposite in writing.

The seed now plants the reference fixture **only on a database it can prove it is initialising**:
`no SeedMark row` **and** `Staff.count() === 0`, both read before any write (`lib/seed-policy.ts`,
pure so the decision is pinned without a database). Otherwise it withholds everything and says so —
`seed: teach rates NOT re-asserted — the rate matrix has belonged to the owner since first boot`.

- **The one exception is the `CONFIG_DEFAULTS` key set**, and the test that earns it is *if this row
  is missing, does the product throw or merely show less?* `num()` throws on a missing key at page
  render and `/admin/config` renders a box only for a row that exists ⇒ no human can create it
  through the product. Its **keys** are schema; its **value** is still written once and never again,
  so rule 1 of [payroll-rules.md](payroll-rules.md) holds literally.
- 🔴 **The seed has no delete path, ever.** A key removed from the repo leaves its row alone; never
  "reconcile the database to the code".
- ⚠️ **Not closed here:** a `CONFIG_DEFAULTS` value that arrived at deploy time has still been
  reviewed by nobody at this branch —
  [045](../../../tasks/todo/045-a-config-value-nobody-reviewed-never-reaches-the-banner.md), because
  it needs a per-key "reviewed" fact that does not exist. The asymmetry that makes it wait: that value was typed by a developer in a reviewed
  commit, whereas a re-created `TeachRate` contradicts a decision the owner made *after* it.

The ops half — the three modes, the footprint on the host's first post-fix deploy, why no branch of
this policy may exit non-zero, and the one crash window a retry cannot repair — is
[../ops/deploy.md](../ops/deploy.md).
