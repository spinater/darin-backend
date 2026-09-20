# The seed re-creates a rate the owner deliberately deleted — on every deploy, paying silently

- status: todo
- commit:

## Goal

`/admin/config` now promises, in amber under the rate matrix
(`app/admin/config/_components/rate-table.tsx`, task 036):

> ช่องว่าง = **ยังไม่มีเรท** → คาบของกิจกรรมนั้นจะไม่ถูกคิดเงินและขึ้นเตือนในสลิป

and `lib/config-form.ts:87` implements it: a blank rate box **deletes** the `TeachRate` row.

`prisma/seed.ts` then puts it back:

```ts
for (const [activity, byRank] of Object.entries(RATES))
  for (const [rank, rate] of Object.entries(byRank))
    await db.teachRate.upsert({
      where: { activity_rank: { activity, rank } },
      update: {},        // protects an EDITED value
      create: { activity, rank, rate },   // …but re-creates a DELETED one
    });
```

and the seed runs on **every deploy** — `docker-compose.yml`'s `migrate` service →
`Dockerfile:31` → `prisma db push && bun run prisma/seed.ts`.

**Worked example.** The owner decides PT-rank staff no longer teach `pt` and blanks the pt×PT box.
The warning appears exactly as promised, and for the rest of that month the slips say so. The next
`git push origin develop` re-creates pt×PT at **200 ฿**, and a PT trainer with 40 คาบ is paid
40 × 200 = **8,000 ฿** the owner had removed — with `warnings: []`, because a rate now exists again.

🔴 `update: {}` is the trap. It looks like "never overwrite the owner", and it is — for a value that
was *changed*. It does nothing for a value that was *deleted*, because `upsert` cannot tell "this row
was removed on purpose" from "this row has never existed". That is the same shape as
[task 036](../done/036-addactivity-seeds-rate-zero-so-the-warning-can-never-fire.md) itself: a number nobody
typed, arriving where the engine reads it as a choice.

## Decision (architect lane, 2026-09-19)

> `prisma/seed.ts` plants the reference fixture **exactly once** — on a database it can prove it is
> initialising — and on every run after that it writes nothing, deletes nothing, and prints what it
> withheld; the single exception is the `CONFIG_DEFAULTS` **key set**, which is schema, not data,
> and is asserted on every run because its absence makes the product **throw** rather than show
> less.

The test, applied to every seeded table, is about consequence: *if this row is missing, does the
product throw, or does it merely show less?* Throw ⇒ code owns it and the seed asserts it. Shows
less ⇒ the owner owns it and the seed never touches it again. Only `PayrollConfig` answers "throw":
`num()` throws on a missing key, `/ot` and `/classes` call it **at page render**, and
`/admin/config` renders only rows that already exist ⇒ a missing key has no input box and **no
human can create it through the product**. Its *keys* are the schema of config; its *values* stay
create-only, so CLAUDE.md §2 rule 3 ("`CONFIG_DEFAULTS` is used at seed time only") holds literally.
`note` is refreshed on every run because it renders as a `<span>`, never an input — there is no
owner edit of it to overwrite.

🔴 **The seed has no delete path, ever.** A `PayrollConfig` key removed from the repo leaves its
row alone. Do not "reconcile the database to the code".

And do **not** "fix" the original bug by deleting the rate seeding: a fresh database has to come up
with a working matrix, and `prisma/seed.ts` is the only thing that gives it one.

### How the run knows which database it is on

> initialise ⇔ **no `SeedMark` row** AND **`Staff.count() === 0`** — both read before any write.

| Situation | Mode | What is written |
|---|---|---|
| deploy host: real rows, no mark | `adopt` | fixture withheld · all 18 config keys already exist ⇒ **no reference data written**, plus the 18 `note` refreshes every mode makes (code-owned, no `updatedAt`, no `value` in that update) · then the mark. Footprint in reference data: **one row in one new table** |
| genuinely fresh: first deploy, the gate's throwaway Postgres, a recreated volume | `initialize` | full fixture · then the mark, **last** |
| every run after either | `already-initialized` | config-key top-up only |

🔴 **The `Staff.count() === 0` conjunct stays permanently.** On its own, "no mark" means "fresh" —
which would ship this card's fix *as* this card's bug, once, on the only database with real money
in it. It is a sound witness because the seed itself creates seven staff and the product has no
delete-staff path (`toggleActive` deactivates; `TeachSession.staffId` is `onDelete: Restrict`).
Deleting it later silently re-opens the hole for any database restored from a pre-mark backup.

The mark is written **last**, after every fixture write, so a first boot that crashes halfway
leaves no mark and the next run re-attempts the whole fixture. That is also why the
`upsert … update: {}` forms stay: on the planting branch they are no longer load-bearing, but they
are what makes the retry idempotent. Deleting them as "dead code now" re-opens it.

🔴 **"No mark ⇒ the retry re-attempts everything" is only true because of a second guard, added in
review.** The next run's decision is `Staff.count()`, not the mark — so a crash *part-way through
the staff rows* used to leave the one state no retry could repair: the count reads 1–6, the next
run says `adopt`, and the rest of the fixture is withheld forever. Two costs inside that window,
both real: three trainers with no `Staff` row and no `TrainerAlias` (their sheet rows resolve to
`staffId: null` ⇒ the review queue ⇒ จิ้บ's 40 คาบ × 200 ฿ = **8,000 ฿ on no payslip**, this card's
own figure through the other door), and an owner row holding a generated password that was never
printed, so **nobody can log in to `/admin/config`** to repair either. The `Staff` + `TrainerAlias`
block is therefore **one `db.$transaction`**, written after every other fixture table, with
`hashPassword` hoisted out and awaited before it — the count can then only read 0 (rolled back ⇒
whole fixture re-attempted) or 7 (committed over a complete fixture ⇒ the retry adopts and nothing
is missing).

| crash point | `Staff.count()` on retry | result |
|---|---|---|
| anywhere before the staff block | 0 | `initialize` again, whole fixture re-attempted (idempotent upserts) |
| inside the staff transaction | 0 (rolled back) | same |
| after commit, before the mark | 7 | `adopt` — and the fixture is already complete |

⚠️ **One window is left, it is named rather than hidden, and it is not closable here.** A crash
between that commit and the `console.log` that prints the generated owner password leaves a
credential nobody ever saw; the next run reads `adopt` and will not print it. Printing *before* the
commit would hand out a password for a run that may roll back. The repair is operational — pass
`OWNER_PASSWORD` to `migrate` and the window costs nothing. The `SeedMark` doc-comment and
[deploy.md](../../.docs/knowledge/ops/deploy.md) say this in place of the flat "the retry is
idempotent" they used to claim.

The design rejected a transaction here because it would wrap two `hashPassword` calls against
Prisma's 5 s interactive default. Hoisting the hash out is what removed the objection: scrypt needs
no database, and what is left inside is 13 upserts — the same budget `app/admin/config/page.tsx`
already carries ~65 round-trips inside. No `timeout` is passed, so 5 s stays Prisma's default and
not a number this code asserts.

🔴 **The mark is written with `createMany … skipDuplicates`, not `create`.** Two `migrate`
containers overlap here as a matter of routine — a push to `develop` deploys, and §6 asks for a
push per commit. Both read `marked: false` before either writes, both reach the mark, and the loser
of a bare `create` takes P2002 ⇒ non-zero exit ⇒ `app` never starts
(`depends_on: … service_completed_successfully`). Measured, not hypothetical: the first counter-test
round recorded exactly that stack. It also makes the "exit 0 on every policy branch" guarantee
**structural** rather than dependent on `seedMode` staying correct.

**Schema change (§2 rule 8) — what is lost if this push is wrong: nothing.** `model SeedMark` is
purely additive: a new table, no FK, no column added to or retyped on an existing model, no new
unique constraint over existing data, no row rewritten. Plain `prisma db push` (no
`--accept-data-loss`) applies it. The risk is **behavioural, not destructive**, and it lands
entirely on the first run after the change.

🔴 **No policy branch may exit non-zero.** `docker-compose.yml` gives `app`
`depends_on: migrate: condition: service_completed_successfully` ⇒ a seed that refuses to start
takes the whole site down on deploy. The policy is enforced by **withholding writes and saying so**,
never by failing.

### Three corrections to this card's original Scope

- **`ColorRule` is not seeded at all** — the Scope above was wrong to list it. Its only writer is
  `addColor` in `app/admin/config/page.tsx`. Do **not** start seeding it here: that would contradict
  a card whose subject is "the seed asserts too much", and colour→meaning is a business fact nobody
  in the repo has. It has its own card,
  [043](043-nothing-seeds-colorrule-so-a-fresh-database-pays-every-colour.md) — a fresh database has
  zero `ColorRule` rows, `lib/sync.ts` resolves every colour to `undefined`, and
  `_components/sheet-mapping.tsx` states the consequence (*"ไม่งั้นระบบจะจ่ายให้ทุกสี"*).
- **`TrainerAlias` and `SheetSource` are overwritten on every deploy today** — `update: { staffId }`
  and `update: { activity, colMap }`, not `update: {}` ⇒ they are worse than the rate case, not a
  sibling of it, and they belong in this card: same file, same rule, one commit.
- **A fourth bug, in the `where:` clause of the `SheetSource` upsert, is the strongest argument for
  the rule.** `spreadsheetId` is owner-editable and the seed computes its own from
  `GOOGLE_SHEET_LINK` or the literal `"SET_ME_IN_ADMIN"`. The moment the owner corrects a
  spreadsheet id the lookup **misses** and `upsert` takes `create`: a **second `SheetSource` row for
  the same `sheetName`**, `active: true`, carrying the stale id. Then — env link empty ⇒ the
  duplicate carries `SET_ME_IN_ADMIN` and `lib/sync.ts` fetches per distinct id inside
  `Promise.all`, so one rejection **takes the whole sync down for every sheet**; env link set but
  different ⇒ both ids fetch and both write `TeachSession` under different `sourceId`s
  (`@@unique([sourceId, rowIndex, colIndex])` does not span sources) ⇒ **the same คาบ paid twice**,
  with the grid→source match by sheet name, which both rows now share. Closed for free by the rule:
  on an in-use database the seed writes no `SheetSource` at all.
  ⚠️ **Closed, not narrowed — but two residuals are not this card's**: `@@unique([spreadsheetId,
  sheetName])` still *permits* the pair for any future writer, and a database already carrying one
  keeps it forever. Both are
  [047](047-sheetsource-unique-key-permits-two-rows-for-one-sheet-name.md) (a one-way schema call ⇒
  architect), with the one-off pre-deploy check in
  [todo-human/002](../todo-human/002-deploy-host-setup.md).

### What is tested, and what is not

- **Layer 1, pinned** — `lib/seed-policy.test.ts` (new row in `scripts/junit-pins.txt`). The
  load-bearing arm is `seedMode({ marked: false, staffCount: 7 }) === "adopt"`: that single case is
  the deploy-host bootstrap. The report builder's **omission** of any "missing rates" line is pinned
  too, by whole-array comparison — pin the omission, or a later helpfully added line stays green.
- **Layer 2, the gate** — `scripts/check-code.sh`'s db stage runs the real seed **twice**, and
  between the two runs it **breaks the two rows that cost money** with `psql` in the throwaway
  container: `DELETE` the `pt × PT` `TeachRate`, `UPDATE "PayrollConfig" SET value='8' WHERE
  key='comm.pt.selfClosed'` (both must touch exactly one row, or the stage is already red). After
  the second run it requires `seed: mode=already-initialized created=0` in the log **and reads both
  rows back** — rate still absent, value still `8`.
  🔴 **The grep alone was not enough, and that is measured, not argued.** `created=<n>` is a counter
  a developer increments by hand at seven `writes++` sites, so two regressions report `created=0`
  honestly: an `update`-shaped one (`data: { note }` → `data: { value, note }`) and a re-creating
  write added outside `plantFixture` that forgets its `writes++`. Both were run as mutants; both
  passed the grep; the two `psql` reads are what killed them.
- **Layer 3, counter-tests rather than a test file** — `scripts/counter-test.sh save …` → break →
  run the gate → `restore` (§6 rule 8 — never `git checkout`). **Seven rounds, each red at the
  assertion it was aimed at**, logs kept in `.scratch/`:

  | Mutant | What went red | Log |
  |---|---|---|
  | force `initialize` (`marked:false, staffCount:0` in `main()`) | the grep branch — *"the seed's second run did not report …"*, second run reporting `seed: mode=initialize created=44` | `040-countertest-D1-forced-initialize.log` |
  | `note` refresh widened to `data: { value, note }` | the `PayrollConfig` read-back: *"set to 8 before the run, now '10'"* — **after** the grep passed on `created=0` | `040-countertest-C1-config-value-overwritten.log` |
  | a `teachRate.upsert` loop outside `plantFixture`, uncounted | the `TeachRate` read-back: *"re-created the teach rate pt × PT … (1 row(s) back)"* — again **after** `created=0` passed, and with the seed printing `teach rates NOT re-asserted` in the same run | `040-countertest-C2-rate-recreated.log` |
  | assertion pointed at a key that does not exist | *"psql returned no row, so nothing was asserted"* — the empty-result arm | `040-countertest-failclosed-empty-result.log` |
  | `psql` pointed at a container that does not exist | *"psql did not answer on the throwaway postgres"* — the no-connection arm | `040-countertest-failclosed-no-connection.log` |
  | `$SEED2_LOG` deleted before the grep | the grep branch, with its own fallback line *"(no 'seed: mode=' line at all …)"* | `040-countertest-failclosed-missing-log.log` |
  | `CONFIG_DEFAULTS["comm.pt.selfClosed"]` set to `"8"` — the gate's own mutant value | the new pre-`UPDATE` guard: *"CONFIG_DEFAULTS[…] is now '8', the same value this gate writes as its mutant"*, between the rate-delete arm and the `UPDATE` | `040-countertest-A2-default-equals-mutant.log` |

  ⚠️ **The last round's red had to be read past five louder ones.** Moving that default also breaks
  the five engine tests that pin 10% — *correct* noise, which a future card would fix along with the
  default, and which is exactly why the hole was invisible: with those fixtures updated, nothing but
  this guard would be red and the config read-back would go on writing `'8'` and reading `'8'` back
  forever. The log shows the db stage still running after `bun test` failed, the rate-delete arm
  passing, and the guard firing at `scripts/check-code.sh:233-241` **before** the `UPDATE`.

  🔑 **The first round of this card could not reach the grep at all**: the forced-`initialize`
  mutant made the seed *throw* P2002 on the bare `db.seedMark.create()`, so `db_stage` returned at
  the run itself and `check-code.sh`'s failure branch was still unexecuted code
  (`.scratch/040-countertest.log`). Fixing that `create` — the deploy-outage bug — is what let the
  branch run for the first time.
- **`prisma/seed.ts` itself has no test, deliberately.** No test in this repo can assert a *stored
  row*: `bun test` runs before the throwaway Postgres exists and with no `DATABASE_URL`, and task
  015 is the DB-test lane. What stands in for it is that the seed is **executed** by the db stage on
  every gate run, and after this change twice, with its own summary line as the assertion. Honest
  ceiling: the `adopt` path — the host's first post-fix deploy — is proven by layer 1 and by review
  only.

### One deviation from the architect design, recorded

The design's `seedReport(mode, gaps, createdKeys)` cannot produce its own last line. `created=<n>`
has to count **fixture writes**, not config keys, or layer 2's third mutant survives: on the second
gate run no config key is created either way, so a fixture write moved out of the `if` would still
report `created=0`. The implemented signature therefore takes a fourth argument — the number of
writes the run made **that are able to create a row** (config-key inserts + every fixture upsert
executed + the mark). On the one path where an upsert can execute without creating anything — a
retry after a first boot that crashed before the mark — it over-counts on purpose: the number exists
to be zero or not zero, and a retry must not read as a no-op.

⚠️ The deploy pipeline has **never reached the host** ([018](018-deploy-docs-claim-a-pipeline-that-never-ran.md),
[002](../todo-human/002-deploy-host-setup.md)), so this has not fired in production yet. That is a
reason to fix it *before* the pipeline is armed, not a reason to defer it — the day the ssh key lands
is the day a deploy starts rewriting owner decisions.

### Follow-up cards this opens (opened 2026-09-20, not folded in)

Four of them exist because this card **withholds** writes it used to make, and the fifth because
the review found a residual the fix does not cover:

- [043](043-nothing-seeds-colorrule-so-a-fresh-database-pays-every-colour.md) — nothing seeds
  `ColorRule`, so a fresh database resolves every colour to `undefined` and pays cancelled คาบ.
- [044](044-admin-config-renders-only-rows-that-exist-so-a-missing-key-has-no-box.md) —
  `/admin/config` should render `CONFIG_DEFAULTS ∪ rows`, so a missing key has a box. This card's
  `CONFIG_DEFAULTS` exception exists *because* it does not.
- [045](045-a-config-value-nobody-reviewed-never-reaches-the-banner.md) — a config value that
  arrived from `CONFIG_DEFAULTS` at deploy time and nobody has reviewed should reach the dashboard
  banner.
- [046](046-no-screen-can-add-a-class-price-or-a-sheet-source.md) — no screen can add a
  `ClassPrice` or a `SheetSource`, which is the entire cost of withholding those two tables.
- [047](047-sheetsource-unique-key-permits-two-rows-for-one-sheet-name.md) — the `SheetSource`
  unique key still permits two rows for one sheet name (architect; one-way schema call).

## Who reviews this

`prisma/seed.ts` writes `TeachRate` ⇒ CLAUDE.md §9's path list ⇒ **`code-reviewer` +
`payroll-auditor`**, with `architect` first for the policy choice above. Not the `claude-tekton` lane.

## Notes

- Found by `payroll-auditor` on the task 036 review, 2026-09-19 (finding 3). The mechanism is
  **pre-existing** and unchanged by that diff — what 036 changed is that the screen now *promises*
  the opposite in writing, so the contradiction became visible.
- It is also the last remaining answer to "is there any path left that creates a `TeachRate` row with
  a number nobody typed?", which is the question task 036 was opened to close. 036 closed the screen;
  this closes the deploy.
