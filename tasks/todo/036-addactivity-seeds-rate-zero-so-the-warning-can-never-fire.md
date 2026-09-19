# `addActivity` seeds every rank at rate 0, so a new activity can never warn — it pays 0 ฿ silently

- status: todo
- commit:

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

## Who reviews this

Money path and probably the schema ⇒ CLAUDE.md §9's path list ⇒ **`code-reviewer` + `payroll-auditor`**,
with `architect` *before* implementation for the choice above. Not the `claude-tekton` lane: §9 keeps
money and schema out of it, and the whole card is one undecided question.

## Notes

- Found by `payroll-auditor` (Major) during the task 034 review, 2026-09-19. **Pre-existing on
  `develop`** and in no line task 034's diff moved — but it silences the exact warning task 034 just
  restored, which is why it is carded immediately rather than "next time someone touches that screen".
- Related, same failure, different road: [task 035](035-activity-name-with-a-pipe-overwrites-another-rate.md)
  (a `|` in the name overwrites another activity's rate with 0).
- A thing task 034 bought that its own card does not claim, recorded so nobody re-derives it: the
  `Map` also closed the **rank** dimension. Under the old object fold a rank string that is a
  prototype key returned a *function* (`teachRates["pt"]?.["toString"]`), `rate == null` was false,
  and `money(qty * fn)` made `teachPay`, `net` and every `Payslip` total for that staff member `NaN`.
  Ranks come from the closed `RANKS` list today, so it was latent; it is now structurally gone.
