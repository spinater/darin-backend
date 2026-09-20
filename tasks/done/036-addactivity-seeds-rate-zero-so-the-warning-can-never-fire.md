# `addActivity` seeds every rank at rate 0, so a new activity can never warn — it pays 0 ฿ silently

- status: done
- commit: a8faa9e

## Goal

`addActivity` creates a `TeachRate` row for **all three ranks at rate `0`** when an admin adds an
activity (`app/admin/config/page.tsx:137-142`):

```ts
for (const rank of RANKS)
  await db.teachRate.upsert({
    where: { activity_rank: { activity, rank } },
    update: {},
    create: { activity, rank, rate: 0 },
  });
```

So the activity is **never "unconfigured"**, and CLAUDE.md §2 rule 4's warning — the one thing that
makes an unset rate visible — cannot fire for anything added through the screen.

**Worked example** (verified by `payroll-auditor` on 2026-09-19, with the reference figures from the
seeded matrix):

1. an admin adds `boxing` through "เพิ่มกิจกรรมใหม่". Three rows land at `rate 0`;
2. an **ST** trainer teaches **12** `boxing` sessions in September;
3. `teachRates.get("boxing")?.get("ST")` returns `0`, not `undefined` ⇒ `rate == null` at
   `lib/payroll.ts:122` is **false** ⇒ the payslip reads
   `ค่าสอน boxing · 12 คาบ · 0 ฿/คาบ · 0 ฿`, `teachPay 0`, `warnings: []`;
4. at the ST rate the seeded `pt` row carries (400 ฿) that trainer is **4,800 ฿ short and nothing on
   the slip says so**.

Contrast `yoga`, which has no rows at all and warns correctly (pinned at `lib/payroll.test.ts:78`).
The difference is not the money — it is whether anyone finds out.

## Why a stored `0` cannot simply be read as "not set"

Because the screen already gives `0` a *different, deliberate* meaning. The bulk save **deletes** a
rate when its box is left blank (`lib/config-form.ts:87`, and the amber note under the table says so)
⇒ a `0` that an owner typed means **"chosen: this rank does not get paid for this activity"**, and
`addActivity` is the one place in the repo that stores an *unchosen* `0`. Making the engine treat `0`
as missing would silently overrule the owner's choice in the other direction.

REQUIREMENTS.md §1.2 and §4 item 3 both describe the rate matrix as fully editable with new
activities addable, which is what makes the seeded-zero row look harmless: the screen shows the new
row immediately and the number in it looks like a value, not a placeholder.

## Scope — a decision first, then the patch

🔴 **`architect` picks between these two before anything is written** — it is a schema question, and
CLAUDE.md §2 rule 8 makes a schema change one-way (`prisma db push`, no down path, back up first):

- **`addActivity` stops writing rate rows at all.** Then "no row" means "not set" everywhere and the
  §2 rule 4 warning does its job. Cost: the config page derives its activity list *from the rate rows*
  (`app/admin/config/page.tsx:44` — `[...new Set([...rates.map(r => r.activity), "yoga"])]`), so the
  listing mechanism has to move somewhere else (an `Activity` table, or a distinct list unioned from
  the sessions actually recorded). Note the hardcoded `"yoga"` on that line is itself a §2 rule 7
  smell to resolve in the same breath.
- **`TeachRate.rate` becomes nullable**, so "never set" (`null`) and "set to 0" are distinguishable in
  the column. Cost: a schema change on a money table, every read of `rate` retyped, and `prisma db
  push` with no migration history.

Whichever wins, the acceptance test is the same and belongs in the engine's suite: an activity that
exists with **no chosen rate** for a rank must warn `ไม่มีเรทค่าสอน …` and pay nothing, while an
activity whose rate an owner deliberately set to `0` must pay `0` **without** a warning and still
emit its line. (That second half is also task 037's boundary pair — coordinate, do not write it twice.)

Also worth fixing while the action is open: `upsert … update: {}` means re-adding an existing activity
reports nothing at all. That is idempotent rather than a refusal, but the screen says nothing either
way and the notice surface now exists (`app/admin/config/_components/add-activity-form.tsx`).

## Decision taken — **A, with a `TeachActivity` name registry** (`architect`, 2026-09-19)

**B (`TeachRate.rate` nullable) is rejected, and the deciding argument is what the repair looks like
when the choice turns out wrong.** `rate Int` → `rate Int?` is a `DROP NOT NULL`, which Prisma treats
as non-destructive, so it applies silently on the next deploy (`Dockerfile:31` runs `prisma db push`
with **no** `--accept-data-loss`). The trap is the reverse direction: the day anyone wants the column
back to `Int`, the only mechanical repair is `UPDATE "TeachRate" SET rate = 0 WHERE rate IS NULL`,
which turns every *unset* rate into a *deliberate* zero on live rows — permanently destroying exactly
the distinction this card was opened to create (§2 rule 8: say what is destroyed if it is wrong).

B also does not buy what the card assumed:

1. The `null` carries no money meaning. `buildTeachRates` would either put it into the money lookup
   type (`Map<string, Map<string, number | null>>` — an open invitation to the `?? 0` that task 037
   names as the one-character way to reintroduce this exact bug) or skip null rows, which produces a
   map **identical to A's**. If skipping is right, the null was only ever a listing device stored in a
   money column.
2. It does not solve the listing problem either. `lib/config-form.ts:87` deletes the row when a box is
   blanked, so under B an activity still vanishes from the matrix after a bulk save — unless
   blank-means-delete becomes blank-means-null, which is a behaviour change to the documented amber
   note, on the money form, colliding with task 035's field-encoding fix.
3. `app/page.tsx:36`'s `!rates.some(r => r.activity === a)` keeps lying under B (a row exists, at
   null), so the dashboard warning stays broken until someone edits a predicate in a second file.

**A's wrong-path costs a list of names.** `CREATE TABLE` is additive: no column on `TeachRate`,
`TeachSession` or `Payslip` is touched, and `lib/payroll.ts` is **not modified at all** — which is the
proof the design adds no second path to an amount (§2 rule 2) and no literal rate (§2 rule 3).

### The schema

```prisma
model TeachActivity {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
}
```

- Named `TeachActivity`, not `Activity` — it is the 1-on-1 teaching dimension (the `TeachRate` /
  `TeachSession` family), not the group-class one (`ClassPrice`).
- `name` is the join key the spec already names (`REQUIREMENTS.md:121`, `SheetSource.activity` →
  *"ใช้ join TeachRate"*). Compared **trimmed-exact: no case folding, no normalizer.**
  `lib/normalize.ts` is for trainer names; a second normalizer here would be one decision in two
  homes (§4). `Boxing` and `boxing` therefore make two rows, and the mismatched one **warns loudly**
  rather than paying wrong.
- `id` exists although `name` is unique, for exactly one reason: it gives task 035 a stable opaque key
  so its better option (`rate|<id>` instead of `rate|<activity>|<rank>`) becomes cheap. **036 does not
  change the field encoding.**
- 🔴 **No FK** from `TeachRate.activity` or `TeachSession.activity` to this table. This is the
  tempting "elegant" version and it is the dangerous one: `lib/sync.ts:215` writes
  `activity: source.activity` on every synced cell, so an FK turns a data-quality problem into a throw
  on the sync path — against §2 rule 6, which says unmatched rows go to the review queue *and the
  payroll run still completes*. It would also make `db push` against the live volume conditional on
  every existing row satisfying the constraint.
- **No `active` flag, no `note`, and never a number.** If this table ever grows a numeric column the
  design was wrong — that column belongs in `TeachRate` under §2 rule 3.

### The listing mechanism — a union in which the registry only ever *adds*

```
activities = TeachActivity.name ∪ distinct TeachRate.activity
                                ∪ distinct SheetSource.activity
                                ∪ distinct TeachSession.activity
```

This is the fail-safe direction and it is what keeps the table non-load-bearing for money: an activity
with a rate row, a sheet, or one historical session renders in the matrix **even if the registry is
empty or dropped**. No rate can become invisible because a registry row is missing.

The hardcoded `"yoga"` at `app/admin/config/page.tsx:45` **dissolves into the `SheetSource` arm** —
seed creates the yoga sheet source while deliberately not seeding its rate (`REQUIREMENTS.md` §7
item 10, still open). So the literal is replaced by the place activities are actually defined, and a
fifth sheet added later appears by itself instead of needing a second literal (§2 rule 7).

### Change order (§3)

1. **spec** — `REQUIREMENTS.md`: `TeachActivity` in the §3 data model block (Thai — this file is
   client-facing, §2.5's exception), and one line on the §6 `/admin/config` row saying what
   "เพิ่มกิจกรรม" does now: registers a name with **no rate**, so it shows as `ยังไม่ตั้ง` and its
   sessions warn until priced. **Leave §7 item 10 open.**
2. **schema** — `prisma/schema.prisma`, beside `TeachRate` under the `config (ห้าม hardcode)` banner.
3. **seed** — `prisma/seed.ts`: backfill from the names the file already owns,
   `Object.keys(RATES) ∪ SOURCES.map(s => s.activity)` = `pt, pilates, swim, yoga`, as
   `upsert … update: {}` — idempotent, never overwrites.
4. **lib** — new `lib/activities.ts` (~60 lines, no split, no barrel):
   `mergeActivityNames(...lists): string[]` is **pure** (trim · drop empty · dedupe · sort) and is the
   part that carries a decision, so it is the part that gets tests — exactly as `buildTeachRates` is
   pure-and-pinned while `runPayroll` is not. `listActivities()` runs the four queries and folds them
   through it. Add the pin row to `scripts/junit-pins.txt` **and** the matching row to
   `.docs/knowledge/ops/gate-tiers-and-pins.md` in the same change (§7).
   `lib/payroll.ts` · `lib/payroll-run.ts` · `lib/config-form.ts` · `lib/config-keys.ts`:
   **unchanged**. `rate == null` stays exactly as written — after this card it is finally *reachable*
   for a screen-added activity, which is the whole point.
5. **app** — `app/admin/config/page.tsx`: delete line 45, add `listActivities()` to the existing
   `Promise.all` (no extra round trip), and rewrite `addActivity` to create **one** `TeachActivity` row
   and **zero** `TeachRate` rows.
6. **app** — `_components/add-activity-form.tsx`: a second flag beside `ACTIVITY_EMPTY` for "already
   exists". Two `===` comparisons, **not** an object lookup — that is what keeps task 027's
   `Object.hasOwn` question from reappearing. Extend the amber note under the matrix
   (`page.tsx:304-306`) to say both halves: blank = ยังไม่มีเรท ⇒ warns · `0` = ตั้งใจไม่จ่ายสำหรับระดับนี้
   ⇒ pays 0 with a line and no warning.
7. **app** — `app/page.tsx`: **no change.** Verify the claim instead of editing the predicate.
8. **docs** — the four cards below. 9. **verify** — expect the deferred selftest tier to **run**,
   because `scripts/junit-pins.txt` is under `scripts/**` (§7). That is ~41s, not a fault.

### The `upsert … update: {}` no-op **is** in scope — it stops existing as a code path

Under this design `addActivity` creates one row against a `@unique name`, so re-adding an existing
activity becomes a collision that must be answered. There is no "do nothing quietly" branch left to
defer, and leaving it silent would knowingly ship the same shape tasks 027 and 034 removed from the
two actions beside it on the same screen.

🔑 It needs **both** a pre-check and a caught `P2002`, and the comment must say why they are not
redundant: the pre-check reads the **union** (`pt` exists in `TeachRate` and `SheetSource` but not in
the registry, so the unique index alone cannot see it) and gives the honest message; the index is the
real guard, because a pre-check alone is the TOCTOU race `addStaff` already documents
(`page.tsx:186-189`).

### Existing rows already at `0` — **not reinterpreted, not migrated**

A stored `0` keeps meaning after this card exactly what it means today: the owner chose not to pay
that rank for that activity ⇒ pays 0, shows a line, no warning. The fix is strictly forward-looking:
it stops *new* ambiguous zeros being created, so the ambiguous set is frozen and can only shrink.

**Why that is safe, stated rather than assumed: re-reading a legacy `0` as "unset" would move no
money.** Both readings pay 0 ฿ for those sessions; the only difference is whether a warning and a line
appear. So nothing is underpaid while the question waits — which is why this card does not take it.
The retrospective sweep is queued at [029](../todo-human/029-sweep-rows-keyed-before-the-guards.md)
(it needs host access) and the business question at
[038](../todo-human/038-what-adding-an-activity-is-for.md).
🔴 **A one-way `UPDATE`/`DELETE` on the live money table to "clean up" zeros is out of scope** and
would be the single most expensive thing anyone could fold in here.

### Accepted side effect, recorded so it is not discovered

Today, blanking all three boxes makes an activity disappear from the matrix — the rows are deleted and
the list is derived from them. After this card the registry keeps the name, so a mis-typed activity
stays as three `ยังไม่ตั้ง` boxes. That costs **clutter only**: no rate, no sessions, no warning, no
baht. Do **not** build a delete in this card; it is worth one follow-up card
("ลบกิจกรรมที่ไม่มีเรทและไม่มีคาบ") so the loss of that accidental removal path is recorded.

### Traps `architect` expects

1. **`?? 0`** anywhere on the new path re-creates the bug green. Task 037 arm 2 is the pin that will
   catch it; until 037 lands this is a review item, not a gate.
2. **The FK temptation** — rejected above, and expect it to be proposed anyway.
3. **`app/admin/config/page.tsx` is 443 lines** against warn-450 / cap-500. This diff is roughly
   neutral, but the pre-decided §4 split is `_components/rate-table.tsx` (the matrix section) first,
   then `_components/staff-table.tsx`. Do **not** invent a `"use server"` action module — there is
   none in this repo and that is a pattern decision, not a line-count remedy.
4. **The knowledge-card squeeze** — `payroll-rules.md` is at the §5 warn (170) and
   `money-input-guards.md` at 168. Plan those two edits as **replacements**, not additions.
5. **`listActivities()` adds a `groupBy` over `TeachSession`**, the largest table, unfiltered, on a
   `force-dynamic` page. Fine at this scale and it joins the existing `Promise.all`, but it is the one
   new cost in the design, named here rather than discovered later.
6. **Cheap card order is 036 → 035 → 037.** If 037 lands first, its `0`-vs-missing arm must not be
   rewritten by 036.

### What is *not* in 036

Task 035's name validation and field encoding · task 037's engine assertions and test split · the
per-rank blind spot in `app/page.tsx:36` (it flags an activity only when **no** rank has a rate, so
`pt` with a PT rate and no ST rate still passes the dashboard — pre-existing, covered on the slip by
the engine warning, worth its own card) · `RANKS` being a hardcoded literal at `page.tsx:21` while
§6 also promises "เพิ่มระดับ" (related to task 031 — do not let this card grow a `Rank` table).

### The two review lanes — run 2026-09-19

| Lane | Verdict |
|---|---|
| `code-reviewer` | **BLOCK**, narrow — two markdown-structure defects, no finding in the code |
| `payroll-auditor` | **APPROVE-WITH-NITS** |

**Both blockers were real, verified with `cat -A` rather than taken on report, and are fixed.** The
serious one was in the §3 "spec" step: the new Thai paragraph was inserted **inside** the screens
table in `REQUIREMENTS.md`, so GFM lazy continuation glued the row
`| /me | Trainer | … **ห้ามเห็นเงิน** |` onto the end of it as literal pipes. The row that rendered
wrong was the one saying a trainer must never see money, in the document the client reads, and it
rendered correctly before this diff. The second: a stray blank line dropped the new junit-pin row out
of the pin table in `gate-tiers-and-pins.md`.

**The money trace came back clean from both lanes, checked by reading rather than by the gate** —
which matters unusually much here, see the counter-test note below. Verified between them:
`addActivity` writes no number on any path including the `P2002` arm · both `redirect()` calls sit
outside the `try`, so `NEXT_REDIRECT` cannot be swallowed · the pre-check and the unique index are
genuinely not redundant · `prisma/seed.ts` gives yoga a **name and no rate**, leaving
`REQUIREMENTS.md` §7 item 10 open and both yoga warnings firing · `git diff develop` on
`lib/payroll.ts`, `lib/payroll-run.ts`, `lib/config-form.ts`, `lib/config-keys.ts` and `app/page.tsx`
is **empty** · no arm of the union can subtract, so a configured rate cannot become invisible · a
deliberate `0` still pays 0 with its line and no warning. The card's worked example now reads: ST
trainer, 12 `boxing` คาบ → **no teach line**, `teachPay 0`, and
`ไม่มีเรทค่าสอน boxing × ST — 12 คาบยังไม่ถูกคิดเงิน` on the slip, the `/payslips` badge and the
dashboard — where before it was a `0 ฿/คาบ` line with `warnings: []` and the 4,800 ฿ gap invisible.

**Fixed in this commit, beyond the two blockers:**

1. **`mergeActivityNames` moved to its own db-free `lib/activity-names.ts`**, re-exported by
   `lib/activities.ts` (§4 barrel). Both lanes caught the same thing: the pinned fold was dragging
   `lib/db.ts` — which constructs a `PrismaClient` at module load — into `bun test`, the exact
   coupling task 034 moved `buildTeachRates` out of `payroll-run.ts` to avoid, and this card's own
   knowledge card restates that rationale. It passed today only because `PrismaPg` does not validate
   the connection string at construction, which is a property of the adapter version, not of us.
2. **The defect narrative was written out nine times again** — the same shape task 034's review
   flagged, with `lib/activities.ts` carrying 31 lines of doc comment on a 9-line function. Cut back
   to one sentence plus a pointer at the schema, the action, the page and the component; the full
   account stays in the knowledge card.
3. **Task 039's card split shipped in the same round**, because adding `lib/activity-names.ts` to
   `payslip-lifecycle.md`'s `sources:` pushed that card to 173 against the §5 warn of 170. The card
   is now 115 and the teach-rate material lives in `teach-rate-lookup.md` at 87, reflowed back to
   100 columns — which also undoes the *widening* finding 3 objected to (30 lines up to 137 columns).

**Not fixed here — carded, with the reason each one is not this card's:**

- [040](040-seed-recreates-a-rate-the-owner-deliberately-deleted.md) — 🔴 the one the auditor found
  that this diff *created a promise against*: the new amber note says a blank rate box means "no
  rate, and the คาบ warn", and `lib/config-form.ts` duly deletes the row — then `prisma/seed.ts`'s
  `upsert … update: {}` **re-creates it on every deploy**. An owner who removes pt×PT gets it back at
  200 ฿ on the next push, paying a PT trainer with 40 คาบ **8,000 ฿** they had removed, with
  `warnings: []`. `update: {}` protects an *edited* value and does nothing for a *deleted* one. It is
  the last remaining answer to "what still writes a rate nobody typed", and it needs `architect`
  (seed-vs-owner-state is the same policy family as §2 rule 3's "seed time only").
- [041](../todo/041-no-way-to-remove-a-registered-activity.md) — the accepted side effect, now with the
  auditor's capacity half: a registered name can never be removed, and each one adds three
  `deleteMany` calls to the bulk save's single 5 s transaction. Clutter and a loud `P2028` at worst,
  never a wrong amount.
- **Task 035's symptom changed and its card was updated in this commit.** With the seeded zeros gone,
  a registered `pt|PT` renders *blank* boxes, so the field-encoding collision now runs
  `deleteMany({activity:"pt",rank:"PT"})` instead of upserting 0 — the net direction is an
  improvement (a deleted rate *warns*), but 8,000 ฿ still moves and the mechanism is now a `DELETE`
  on the live money table.
- **Task 029 gained a whitespace row**: `mergeActivityNames` trims for display while
  `buildTeachRates` and the box's `defaultValue` key on the raw column, so a padded legacy
  `TeachRate.activity` would merge into the trimmed row and become un-editable while still paying.
  Latent — no writer produces one today — and only the live-data sweep can say whether one exists.
- `activityExists()` reading the whole union to answer a yes/no is deliberate and recorded in the
  code: four filtered probes would be cheaper but would put "which places count as existing" in a
  second home.

🔴 **The counter-test result is the most important sentence here, and it was volunteered by the
implementer rather than found by me.** Restoring the three `rate: 0` writes leaves `tsc` clean,
`bun test` at 0 fail and `verify.sh` **ALL GREEN**. No test lane here reaches a server action —
`bun test` has no database (task 015) — so of this change's money behaviour the automated coverage is
exactly one thing: the union cannot lose a name. The `0`-vs-missing boundary is unpinned until
**task 037** lands its engine pair, so 037 should not slip behind 035 in the queue. Everything else
on this screen is held by review, and this card is the record that it was reviewed rather than gated.

## Who reviews this

Money path and probably the schema ⇒ CLAUDE.md §9's path list ⇒ **`code-reviewer` + `payroll-auditor`**,
with `architect` *before* implementation for the choice above. Not the `claude-tekton` lane: §9 keeps
money and schema out of it, and the whole card is one undecided question.

## Notes

- Found by `payroll-auditor` (Major) during the task 034 review, 2026-09-19. **Pre-existing on
  `develop`** and in no line task 034's diff moved — but it silences the exact warning task 034 just
  restored, which is why it is carded immediately rather than "next time someone touches that screen".
- Related, same failure, different road: [task 035](../todo/035-activity-name-with-a-pipe-overwrites-another-rate.md)
  (a `|` in the name overwrites another activity's rate with 0).
- A thing task 034 bought that its own card does not claim, recorded so nobody re-derives it: the
  `Map` also closed the **rank** dimension. Under the old object fold a rank string that is a
  prototype key returned a *function* (`teachRates["pt"]?.["toString"]`), `rate == null` was false,
  and `money(qty * fn)` made `teachPay`, `net` and every `Payslip` total for that staff member `NaN`.
  Ranks come from the closed `RANKS` list today, so it was latent; it is now structurally gone.

## Progress — implemented 2026-09-19 on `task-036-teach-activity-registry` (not committed, not moved)

Design **A** built as ruled. `lib/payroll.ts`, `lib/payroll-run.ts`, `lib/config-form.ts` and
`lib/config-keys.ts` are **untouched** — `rate == null` is unchanged and merely reachable now. No
`?? 0`, `|| 0` or `!rate` anywhere on the new path; nothing in `lib/activities.ts` is a number at all.
No FK onto `TeachActivity`, no `UPDATE`/`DELETE` against any existing `TeachRate` row.

**What moved, in the §3 order**

1. `REQUIREMENTS.md` — `TeachActivity` in the §3 data-model block, and a paragraph under the §6 table
   saying "เพิ่มกิจกรรม" registers a *name* with no rate (Thai; client-facing file). §7 item 10 left open.
2. `prisma/schema.prisma` — `model TeachActivity { id · name @unique · createdAt }` under the
   `config (ห้าม hardcode)` banner, with the no-FK / no-number reasoning in its doc comment.
3. `prisma/seed.ts` — backfill `Object.keys(RATES) ∪ SOURCES.map(s => s.activity)` = `pt, pilates,
   swim, yoga` via `upsert … update: {}`. `yoga` gets a **name and still no rate**, which is the pair
   the rule-4 warning exists for.
4. `lib/activities.ts` (new, 93 lines, no split) — pure `mergeActivityNames(...lists)` (trim · drop
   empty · dedupe through a **`Set`** · plain `.sort()`), `listActivities()` folding the four arms, and
   `activityExists()` for the pre-check. `lib/activities.test.ts` (new) — 5 tests, pinned at **5** in
   `scripts/junit-pins.txt` with the matching row in `.docs/knowledge/ops/gate-tiers-and-pins.md`.
5. `app/admin/config/page.tsx` — the hardcoded `"yoga"` line is gone, `listActivities()` joined the
   existing `Promise.all`, and `addActivity` writes **one** `TeachActivity` row and **zero** rate rows,
   behind a union pre-check **and** a caught `P2002`.
6. `_components/add-activity-form.tsx` — `ACTIVITY_DUP` beside `ACTIVITY_EMPTY`, two `===` comparisons
   (no lookup table ⇒ no `Object.hasOwn` question), plus a line under the form saying what an add now
   produces. The amber note moved with the matrix into the new `_components/rate-table.tsx` and states
   **both** halves: blank = ยังไม่มีเรท ⇒ warns · `0` = ตั้งใจไม่จ่าย ⇒ pays 0 with a line, no warning.
7. `app/page.tsx` — **verified, not edited.** `!rates.some(r => r.activity === a)` is true again for a
   screen-added activity because no rate row exists, so the dashboard banner works under A. (It was
   also broken by the seeded zeros; nobody had noticed.) The per-rank blind spot is unchanged and
   stays out of scope.
8. Four cards updated in the same change: `domain/payroll-rules.md` · `domain/payslip-lifecycle.md` ·
   `domain/money-input-guards.md` · `ops/gate-tiers-and-pins.md`. `check-knowledge: OK — warn 0`.

**Gate** — `bash scripts/verify.sh` → `verify: ALL GREEN`, with the deferred selftest tier **running**
(`scripts/junit-pins.txt` moved), 16 stages, ~71 s. `bun test`: 116 pass · 3 skip · 0 fail across 11
files. Stage 5 pushed the new model onto the throwaway postgres and seeded it.

### Counter-test (`scripts/counter-test.sh save … → break → restore`, never `git checkout`)

🔴 **The interesting break is green, and that is the finding.** Re-adding the three `rate: 0` writes to
`addActivity` — the exact defect this card removes, on top of everything else this change builds —
leaves **`tsc` clean, `bun test` 0 fail and `verify.sh` ALL GREEN**. Nothing automated watches that
write path: there is no test lane that can reach a server action (`gate-tiers-and-pins.md`: stage 4 has
no database, task 015 is the card that would change it), and `check-knowledge` cannot see it because a
dirty source and a dirty card are both `+Infinity`. ⇒ **the money behaviour of this screen is held by
review alone.** That is the honest state of it, and it is the strongest argument for the two §9 lanes
on this diff.

What the new pin *does* bite, proved by three separate breaks of `mergeActivityNames`:

| break | red |
| --- | --- |
| an object literal used as the set (the task-034 shape) | 1 test — the prototype-key arm |
| `.toLowerCase()` folded into the dedupe | 2 tests — trimmed-exact, and the prototype-key arm |
| only the registry arm read (the "`TeachActivity` *is* the list" shortcut) | 4 of 5 — including the empty-registry arm, i.e. a rate disappearing from the matrix |

Restored with `counter-test.sh restore` — 2/2 files, hashes matched what `save` recorded.

### Decisions the design had not already made

1. **`activityExists()` is a third export of `lib/activities.ts`**, not an inline `listActivities()
   .includes(...)` in the action, so the trimmed-exact comparison and the "why both guards" reasoning
   have one home. Four queries run on the add path; at this scale that is cheaper than a second
   definition of the union.
2. **Both guards redirect with the same `activityDup` flag.** A pre-check hit and a lost `P2002` race
   are the same answer to the admin's question; two flags would be two Thai strings for one fact.
3. **Ordering stays the plain code-unit `.sort()`** the page already used. Presentational only, no
   amount depends on it, and `localeCompare` would be an unasked behaviour change (the sort-locale gate
   came out at task 017, so nothing would have flagged it either way).
4. **`lib/activities.ts` + its test are sourced by `payslip-lifecycle.md`**, not by `payroll-rules.md`:
   that card's front matter already owns the `rate == null` chain, and it had the 30 lines of headroom
   the squeeze needed. Both Thai-heavy cards were brought back to exactly **170** by rewriting, not by
   deleting a lesson — `payroll-rules.md`'s teach bullet and two paragraphs were reflowed, and
   `payslip-lifecycle.md`'s task-034 section was tightened as its 036 section was added.
5. **One factual fix taken in passing:** `payroll-rules.md` said `lib/payroll.test.ts`'s junit pin was
   `33`; `scripts/junit-pins.txt` has said `34` since task 034.
6. **`scripts/junit-pins.txt` rows must cite `ใบ NNN` literally** — `# task 036 · …` is refused by
   `check-code-junit.sh`, and while the row is red **19 of the junit selftest's own scenarios fail**
   because their "a clean tree is green" baseline is not. Worth knowing before reading that output as
   19 new bugs. The prose in the row is English (§2.5); only the citation token is Thai.
7. **The page split was needed**: `page.tsx` reached ~470 with this diff, so the pre-decided
   `_components/rate-table.tsx` was taken (page now **432**, component **71**). `staff-table.tsx` was
   not needed and was left alone.

### Not done, deliberately

- No delete path for a registered name (the accepted side effect the design records) — still worth its
  own card, "ลบกิจกรรมที่ไม่มีเรทและไม่มีคาบ".
- No engine test for the `0`-vs-missing boundary: that is task 037's, in the engine suite, and writing
  it here would be the duplicate both cards warn about.
- Not committed, not pushed, card not moved to `done/` — `code-reviewer` + `payroll-auditor` still owe
  this diff a pass (§9: it touches `prisma/schema.prisma` and a page that writes `TeachRate`).
