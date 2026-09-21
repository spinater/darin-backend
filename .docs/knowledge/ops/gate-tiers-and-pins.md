---
sources:
  # The two-tier decision itself: the `core_gates` / `gate_selftests` arrays and the `git status` +
  # two-ref `git diff` that chooses between them. Re-merging the tiers, or dropping the skip notice
  # from the `verify:` summary line, must land here as STALE.
  - scripts/verify.sh
  # The selftest that reads the stage list out of the real `verify.sh` — the reason this card can
  # claim the summary line tells the truth about what it skipped.
  - scripts/tests/check-verify-summary-selftest.sh
  # Stage 4 runs `bun test` before the throwaway postgres exists, with no `DATABASE_URL`. That
  # ordering is the whole "no test here reaches a database" conclusion below.
  - scripts/check-code.sh
  # The pin layer's own module, and the pin file whose every row this card explains.
  - scripts/lib/check-code-junit.sh
  - scripts/junit-pins.txt
---

# สองชั้นของเกต กับชั้นหมุด junit — เกตตัวไหนรันเมื่อไร และหมุดหนึ่งตัวซื้ออะไร

Split out of [gates.md](gates.md) at task 023, which had reached 189/200 lines. That card answers
**which gate watches what**; this one answers **when each gate runs** and **what a junit pin is
worth**. Everything this repo claims about `scripts/verify.sh`'s own machinery and about
`scripts/junit-pins.txt` lives here.

## ใบ 017 — สองชั้น: ด่านที่รันทุกรอบ กับ selftest ที่รันเมื่อแตะ `scripts/**`

วัดก่อนตัด (§7 "measure first", 2026-09-18): เกตทั้งก้อน **81 วินาที** · ในนั้น **~41 วินาที**
คือ selftest 15 ใบ · ด่านเนื้อหาทั้งแปดใบรวมกัน **2.3 วินาที** · `check-code.sh` **5.2 วินาที**
· เทสโดเมนทั้ง 63 ใบ (รวมเงิน) **244 มิลลิวินาที**

🔑 **ราคาไม่ได้อยู่ที่เทสของสินค้า มันอยู่ที่เทสของสคริปต์เกต** ⇒ ชั้นที่เลื่อนออกไปคือ selftest
ไม่ใช่ coverage: `check-code.sh` และทุกข้อใน §2 ไม่ถูกแตะเลยในใบนี้ (§7 ข้อ 4 — จ่ายด้วยเครื่อง
และ I/O ก่อน ค่อยจ่ายด้วย coverage)

- **`core_gates`** รันทุกรอบ · **`gate_selftests`** รันเมื่อ `scripts/**` ขยับ
- `verify.sh` ตัดสินเองด้วย `git status` **และ** `git diff` เทียบ **สอง ref** (`develop` กับ
  `origin/develop`) · **ไม่ fetch** — เกตต้องรันได้ตอนไม่มีเน็ต · ทิศที่พลาดแล้วเงียบคือ
  "สคริปต์เกตที่แก้แล้วยังไม่ commit" ซึ่ง `git diff <ref>...HEAD` มองไม่เห็น ⇒ ต้องมี `status` ด้วย
- **ข้ามแล้วต้องดัง** — บรรทัด `verify: ` บอกเองว่าข้าม selftest ไปกี่ใบและบังคับรันยังไง
  (`VERIFY_GATES=1` เปิด · `VERIFY_GATES=0` ปิด) · นี่คือเหตุผลเดียวที่การข้ามแบบอัตโนมัติยอมได้
- `check-shell-source.sh` **อยู่ชั้นที่รันทุกรอบ** แม้ selftest ของมันจะเลื่อน — มันคือเงื่อนไขที่
  ผลของด่านอื่นวางอยู่บน และมันใช้ 0.7 วินาที · ส่วน selftest ของมันตอบแค่ว่า "ด่านนั้นยังทำงานไหม"
  ซึ่งเปลี่ยนไม่ได้ตอน `scripts/**` ไม่ขยับ
- `scripts/tests/check-verify-summary-selftest.sh` อ่านรายชื่อด่าน **ออกจาก `verify.sh` ตัวจริง**
  ⇒ มันอ่านทั้งสองอาร์เรย์ และตั้ง `VERIFY_GATES=1` ให้สนามจำลองรันครบทั้งลิสต์

## The junit pin layer — and why no test in this repo can touch a database (task 009)

`scripts/lib/check-code-junit.sh` + `scripts/junit-pins.txt`: every test file must be **run** and
must run **exactly** the pinned number of tests. Current rows and what each is worth are in that
file's own header; task 009 raised `lib/payroll.test.ts` 21 → **24** and added
`lib/ot-import.test.ts` at **6** and `lib/next-errors.test.ts` at **6**; task 013 raised
`lib/payroll.test.ts` to **26** and added `lib/payroll-run.test.ts` at **4** (5 → 4 inside that
same round: two scope tests merged into one whole-object comparison pinning strictly more — a
merge, not a removal), and item 4 of the same card added `lib/form-number.test.ts` at **11** and
`lib/config-form.test.ts` at **7** and raised `lib/ot-import.test.ts` 6 → **7**; its review round
then raised all three again — `lib/form-number.test.ts` → **13**, `lib/config-form.test.ts` → **12**
and `lib/payroll.test.ts` 26 → **30**; task 025 then took `lib/payroll.test.ts` 30 → **33**.
**ใบ 058** added `lib/gymmo.test.ts` at **16** — the reader for the Gymmo trainer-worklog export.
Sixteen is what it takes to pin the two things that fail *quietly* in a worklog reader: a date that
parses into the **wrong month** (`31 SEP` rolls to 1 OCT under `Date.UTC`, moving a session across
the boundary payroll buckets by), and a row that is **dropped instead of reported** — a session
nobody gets paid for, the §2 rule 4 silent zero. Three of the sixteen are a `test.each` over the
three unreadable columns (date · type · counts) asserting the row is *reported*, not skipped; one
pins `Attendees` staying verbatim, because a real row reads `เอรา,อลัน เอรา,อลัน` and splitting on
the comma invents people (task 049 §8.3); one pins that `attendedOf` does **not** clamp a negative,
because clamping hides the row from the task 025 guard in `lib/payroll.ts` that warns on it.

และ `lib/gymmo-map.test.ts` at **15** — the naming seam between that export and this database.
The arm that earns its keep is **"an exact name wins over an alias"**: it is what lets a real
`ClassPrice` row named as Gymmo spells it retire an alias *by existing*, so the table cannot rot
into a graveyard nobody dares delete from. Two more pin the direction of failure — a class with no
price and an alias pointing at a price that does not exist are both **refused with a reason**, never
guessed, because a guessed class name pays the wrong ราคา silently. One pins that the alias targets
are distinct, so no two Gymmo names can quietly collapse onto one priced class. And three pin
`(Deleted)`: Gymmo marks a trainer who has left by appending it to the sheet name, and their past
คาบ are still owed — dropping that sheet is the §2 rule 4 silent zero wearing a different hat.

**ใบ 064** moved three rows at once — `lib/gymmo.test.ts` **16 → 19**, `lib/gymmo-import.test.ts`
**20 → 22**, and a new `lib/class-problems.test.ts` at **9** (its fix round added the last of each:
16→18→19 and 6→9). 🔑 **No pin was lowered**, and the
reason that is worth saying is that the card *re-shaped* assertions wholesale: `GymmoParse.problems`
became `GymmoReadProblem[]`, so every `expect(problems[0]).toContain(...)` became a field read. The pin
counts `tests - skipped`, so re-shaping cannot move it — only added arms can, which is exactly the
property that lets a refactor of this size be reviewed on its diff instead of on its numbers.
The arm to protect in the new file is **"a session key is byte-identical to `gymmoSourceKey`"**:
clearing a problem is a keyed `deleteMany` over the `sourceKey`s the import writes, so one byte of
drift leaves a fixed คาบ queued for ever and `/payslips` blocking a clean period — the card shipping
and doing nothing. Counter-tested on a clean tree (`restore`'s sha256 compare passing, `git status`
byte-identical afterwards): re-deriving that key instead of calling `gymmoSourceKey` turns **8** arms
red across the two files, named in the pin row. ⚠️ The transaction that does the clearing is **reviewed, not pinned**, for the
structural reason below (no test here reaches a database), which is also why
`applyGymmoImport`'s `!writes.length && !problems.length` guard has to be read by eye.

**ใบ 065** raised `lib/payroll/class.test.ts` **6 → 7** and added `lib/gymmo-hand-keyed.test.ts` at
**5**, then `lib/class-problems-copy.test.ts` at **7** and `lib/gymmo-import.test.ts` **22 → 24**
across its five review rounds (22 test files → 24).
🔑 **That last file is the lesson of the round**: the same defect BLOCKed twice — an exit instruction
keyed on too little state, telling the admin to re-import a คาบ already in the database — and both
times it was reachable only by reading, because the strings lived in a `.tsx`. Moving them to a pure
`(kind, state)` grid is what made a pin possible at all; one arm walks every cell. The arm worth naming is the `|`-collision one: `2026-08-04|"s-o|c-core"|"x"`
and `2026-08-04|"s-o"|"c-core|x"` are different triples with one joined key, so a joined key reports a
duplicate คาบ that does not exist and a human deletes a real row — the ใบ 035 bug class on a new key.
Counter-tested, all three breaks named in the pin rows.

🔴 **The fix round's lesson about pins, worth more than the three numbers: a pin cannot see an
assertion getting weaker.** Raising `lib/gymmo-import.test.ts` 20 → 22 was honest, and in the same
round two `toEqual`s were quietly downgraded to `toMatchObject` — so the file ran two *more* tests
while **no arm in the repo would fail if a field were added to `GymmoProblem`**, and the only other
thing standing between that table and a baht column (ใบ 064 T12) is a doc comment. `code-reviewer`
caught it; the whole-object comparison is back, on the unmatched-class problem. ⇒ when a pin rises in
the same commit that re-shapes assertions, the diff is the evidence and the number is not.

⚠️ **`scripts/counter-test.sh restore` is one-shot: it consumes the store.** A second `restore`
against the same `save` prints `ไม่มีคลังของสายนี้` and **changes nothing**, so a `tail -1` that looks
like success will let the next mutant stack on an unrestored tree — which is how ใบ 064's first round
produced two kill counts whose "and nothing else" specificity was never proven by the sha256 compare
`restore` does. **One `save` per mutant.** A card is open against the script for the trap itself; the
protocol does not depend on it: `git status` clean → `save` → mutate → `bun test` → `restore` →
`git diff --stat` empty, and record the **failing test names**, not a count.

What each raise bought:

| Pin | Raise | What it is worth |
| --- | --- | --- |
| `lib/payroll.test.ts` | 21 → 23 | two §2-rule-4 cases — a membership sale attributed to a non-`closer`, and an unknown `sale.kind`; each asserts a warning **and** a zero commission |
| `lib/payroll.test.ts` | 23 → 24 | the OT >2-decimal case: 9:20 arrives as `9.333333333333334`, the engine pays 13.33 and 266.67 over 20 days (§2 rule 5, round once) — now `lib/payroll/ot.test.ts` (ใบ 037), whose pin comment names the card quoting those figures: `money-on-screen.md` since ใบ 042, `payroll-rules.md` before it |
| `lib/ot-import.test.ts` | new at 5 | usernames from a fingerprint paste that match nobody reach the screen instead of the floor |
| `lib/ot-import.test.ts` | 5 → 6 | `invalidHours` — a non-finite hours value is rejected by the parser, because `OtEntry.hours` is a `Float` ⇒ `double precision`, which **accepts `NaN`** |
| `lib/next-errors.test.ts` | new at 6 | telling a thrown `redirect()` apart from a real error, so the `/ot` action's `catch` cannot swallow navigation |
| `lib/payroll.test.ts` | 24 → 26 | task 013 item 3 — an inactive staff member's slip **warns and changes no figure**; the second test compares the whole result against the same input with `active: true`, so a later "pay them 0" is red |
| `lib/payroll-run.test.ts` | new at 4 | task 013 items 1 and 3 as *predicates*: the non-draft guard's wording and refuse-by-default shape, the two refusals staying distinguishable **in the returned `skipped` list** (no screen renders them — the `compute` action discards `runPayroll`'s return, and what the admin sees is the state-derived `closedCount` box and the `— (ไม่ได้คำนวณใหม่)` marker), and the six-arm staff scope including the leaver arms. **Not** the lock itself — the `count === 0` branch needs two concurrent sessions — and **not** that the leaver arms return a row, which needs a real Postgres; see the row below |
| `lib/form-number.test.ts` | new at 11 | the one predicate every form field that becomes money goes through — absent, blank, a `File` part, `"1e999"` and a negative value each refused, plus `isBlank` keeping a `File` **out** of the "not given" bucket instead of letting it take the field's default |
| `lib/config-form.test.ts` | new at 7 | `/admin/config`'s bulk save parsed **all-or-nothing** before its first write: a blank rate still deletes that rate, a blank salary refuses, and one bad field refuses the whole save — which is exactly what the screen promises the admin ("ยังไม่ได้บันทึกอะไรเลยสักช่อง") |
| `lib/ot-import.test.ts` | 6 → 7 | the **negative** hours value the `isFinite` check let through — it is finite, so it stored and then paid nothing through `Math.max(0, -5 − threshold)`. Pinned because the form had just started refusing it and the paste is the path OT actually arrives by |
| `lib/form-number.test.ts` | 11 → 13 | `int` and `max`. Measured against this schema: Postgres `integer` **truncates** `2.5` to `2` rather than refusing it (`booked`, `baseSalary`, `ClassPrice.price` all), and an out-of-range value throws **at the write**, mid-loop. Both are now refused before the first write |
| `lib/config-form.test.ts` | 7 → 12 | `cfg\|…` joining the parse — the largest hole of the five, since those boxes are plain text with no `required` and a cleared one stored `""`; plus the `Int` ceiling, the fraction that used to be pinned as *valid*, and a `staff\|…` field the form does not render (which used to throw mid-loop) |
| `lib/payroll.test.ts` | 26 → 30 | `num()` throwing on a blank or non-finite config value, pinned at the engine rather than at the form — including the 20,000 ฿ self-closed bill that paid **0 ฿** instead of 2,000 ฿ with `warnings: []` when `comm.pt.selfClosed` was cleared |
| `lib/payroll.test.ts` | 30 → 33 | task 025 — a **negative** attendance (`noShow > booked`, which stored before `/classes` refused the pair) warns with the class and the two counts **in order** instead of folding into the engine's `<= 0` arm for 0 ฿ with `warnings: []`; the opposite boundary, an attendance of exactly 0, which must **not** warn; and one warning **per row**, since `byClass` merges the payslip lines by class name and a "dedupe the warnings" tidy-up would otherwise stay green. 🔑 The money half asserts the class **line**, not `classPay` — `Math.max(0, … − classCredit)` clamps the latter, so a row that *subtracted* 400 ฿ would still read 0 |
| `lib/payroll.test.ts` | 33 → 34 | task 034 — an activity named `__proto__`, configured at a **real** rate, must not be inherited by any other activity: an unconfigured one still warns and stays unpaid. 🔑 Written against that worst case on purpose — a lookup that merely returned `undefined` for the missing activity would pass while the *write* was still polluting the process, which is why the source-level half is pinned next door |
| `lib/payroll-run.test.ts` | 4 → 6 | task 034 — `buildTeachRates` was extracted out of `runPayroll` (into `lib/payroll.ts`, beside the type it builds, so the engine's own money tests never import `lib/db.ts`) so the rate map could be asserted without a database. One test pins that the fold never reaches `Object.prototype` (`Object.hasOwn(Object.prototype, "ST")`, and a fresh `{}` too — that is how the damage was felt), one that several ranks of one activity merge rather than overwrite |
| `lib/staff-form.test.ts` | new at 9 | ใบ 027 — nine arms over the **four** refusals `parseNewStaff` can return: the three identity fields, which `addStaff` used to answer with a bare `return` (revalidate, clear the form, say nothing), plus task 013's money flag. They pin the **order** — name → username → password → the money fields — so two bad fields always report the same one; the password boundary at `MIN_PASSWORD_LEN` with the password left **untrimmed** (a padded one must hash exactly as posted, or the staff member cannot log in with what they were handed); and task 013's money arm unmoved — blank ⇒ 0, unreadable ⇒ refuse, asserted on **both** fields, since they are read by two separate lines and pinning one leaves a tidy-up of the other green. 🔑 The fifth flag, the duplicate username, is **not** pinned: `P2002` comes from the unique index, so it needs a real Postgres, which no `bun test` here has |
| `lib/activities.test.ts` | new at 5 | task 036 — the activity-name union, pinned where it is pure (`mergeActivityNames`). What it buys is that **an activity can exist without a rate**: `addActivity` used to create three `TeachRate` rows at `rate: 0`, so `rate == null` in the engine was unreachable for a screen-added activity and a 12-session ST trainer was paid **0 ฿ with `warnings: []`**. The load-bearing arm is the *empty registry* one — a name with a rate row, a sheet source or one historical session must still render, so no rate can vanish from the matrix because a registry row is missing. 🔑 The money boundary itself (a rate of `0` vs a missing rate) is **not** here: it is the engine's, and task 037 owns it in the engine suite — this file must not grow a second copy |
| `lib/seed-policy.test.ts` | new at 8 | task 040 — what `prisma/seed.ts` may assert about the database in front of it. The load-bearing arm is `seedMode({marked: false, staffCount: 7}) === "adopt"`: reading "no seed mark" as "fresh database" would plant the reference fixture over the deploy host, i.e. ship the card's own bug once, on the only database with real money in it. Seven more: the empty-database arm, the mark beating the witness in **both** directions, a whole-object compare of `plantsFixture`/`recordsMark` across all three modes, and four on the report builder — including 🔴 the **omission**, that no mode may list a missing `TeachRate` cell. Pinned by whole-array comparison, because an added line is green against every membership assertion. ⚠️ What it does **not** prove is that the seed withheld anything; that is the row below |
| `lib/gymmo-import.test.ts` | new at 20 | task 063 — the write plan that turns a Gymmo export into `ClassSession` rows. The load-bearing arm is the **`sourceKey` collision pair**: a sheet name and a class name are both free text, so a `sheet|date|time|class` join merges two genuinely different คาบ into one key, and the consequence is not a wrong screen but a คาบ that vanishes or a payment that doubles (the ใบ 035 bug class, measured against the real join in the test itself). Beside it: the key is asserted by **`JSON.parse` round-trip**, not by its spelling, because decodability is what injectivity actually rests on; two rows of one file with the same key send **both** to `problems` and write neither; a negative attendance is written **verbatim**, which is what keeps task 025's engine warning reachable; a `(Deleted)` suffix — which Gymmo **appends to the sheet name of a trainer who leaves** — must not produce a new key, or a leaver's nine months of คาบ re-import as `create` and are paid twice; and the last arm carries 24 synthetic August คาบ through `computePayslip` to **3,050 ฿**. ⚠️ Synthetic, and the class **mix** in it is invented, so it cannot fail for the reason the real run is most likely to: an unpriced or un-aliased class in ธันยา's actual August would land in `problems`, the real class value would come in under 8,050, and every assertion here would still be green ⇒ this pin proves the import→engine seam, **not** ใบ 063 §4 |
| `lib/payroll/slip.test.ts` | 3 → 5 | task 063 — the engine had **no test at all** for `baseSalary: 0`, which this change newly depends on (the seed now plants two trainers at 0 because nobody has said what they are paid). A 0 base emits no line, so the slip was silent about a number nobody had configured: `net 0.00`, `warnings: []`. The second arm pins the **predicate** (`role === "trainer"`), which a `!base`-only version passes while warning on every owner slip |
| — (no pin: not a `bun test`) | stage 5 runs the seed **twice**, around two broken rows | task 040's layer 2, and the only place "plants once" is asserted against a real database. Between the two runs `db_stage` **deletes** the `pt × PT` `TeachRate` and **sets** `comm.pt.selfClosed` to `8` with `psql` in the throwaway container; after the second run it requires `seed: mode=already-initialized created=0` in the log **and reads both rows back** — the rate still absent, the value still `8`. The grep alone is not enough and measuring that was the point: `created=<n>` is a counter a developer increments by hand at seven `writes++` sites, so an `update`-shaped regression (`data: { note }` → `data: { value, note }`, the most tempting tidy-up in the file) and a re-creating write that forgets its `writes++` both report `created=0` honestly — **both were run as mutants and both pass the grep**; the two `psql` reads are what kill them. Every step fails **closed**: a `psql` that cannot reach the container, a query that errors, an empty result, and a missing log are each a red, all four proven by counter-test — and since the round-2 review a fifth: the value is **read before** the `UPDATE` and must not already be `8`, because the read-back only discriminates while `CONFIG_DEFAULTS["comm.pt.selfClosed"]` is something else. Edit that default to `8` in a later card without the guard and the assertion writes `8`, reads `8`, and passes green over the very regression it was added for. It is **not** a junit report and deliberately not one — a second report inside `db_stage` slips past the layer-2 corpus filter (the table below) |
| `lib/payroll.test.ts` → six rows under `lib/payroll/` | 34 → **6 · 6 · 14 · 3 · 3 · 4** | task 037 — the first **split** in this table, and so the first entry that is not a raise. The file had reached 468 lines against §4's 500 (`git show HEAD:lib/payroll.test.ts | wc -l`; the 037 card's title says 469), and the test the card adds was the one that had to pay for it. The six files are `teach` (§1.2) · `class` (§1.4) · `commission` (§1.5 · §1.6 · §2.2) · `ot` (§2.4) · `slip` (§1.7 and the inactive-staff pair) · `config-guards` (`num()`), with the shared `computePayslip` input builder in `lib/payroll/fixtures.ts`. **+2** of the 36 are new: the `rate == null` boundary — a rate configured at exactly `0` pays 0 with `warnings: []` and still emits its teach line, a *missing* rate warns and emits none |

**Every row but one is a raise**; only a lowering needs a reason in the task card, and task 037 is
the shape that lowering takes when nothing was lost. A split **must** go red, but only halfway: the old row's file
stops being run at all (`check-code: FAIL — … ไม่ได้ถูกรัน`), and that is the whole of the red.
🔴 **The new files arrive unpinned and the gate does not notice.**
`scripts/lib/check-code-junit.sh` walks the rows of `junit-pins.txt` and looks each one up in the
junit report; there is **no reverse sweep** from the test corpus back to the pin file, so a test file
that ran with no row of its own is invisible to it. A split that adds five rows for six files is
green, with one file's count unpinned for good.
🔑 What makes a split honest rather than a quiet write-down is the **sum**: 6 + 6 + 14 + 3 + 3 + 4 =
**36**, against the 34 that moved plus the 2 the card added. A split whose rows sum to *less* than
the row they replace is a coverage removal wearing a refactor's clothes, and §7's rule applies to it
unchanged — the reason goes in the task card, never "to make the gate green".

⚠️ **A pin is worth exactly what its test asserts — read the 23 → 24 row before quoting one as
proof.** It asserts `computePayslip`, whose OT block never had the defect (that was in
`app/ot/page.tsx`), so it would have gone green against the pre-fix tree: it writes the engine's
figure down **outside** the screen, making a future disagreement provable, but it does not fence
the screen. Pinning a screen needs a seam outside the component (task 011) and a lane that can
render one (task 015).

🔴 **Structural finding, not a task-local one: stage 4 has no database.** `check-code.sh` runs
`bun test` *before* `db_stage` creates the throwaway postgres, and with no `DATABASE_URL` in the
environment.

⚠️ **Corrected at task 013 — importing `lib/db.ts` from a test does *not* fail.** [gates.md](gates.md)
used to say any test transitively importing it "fails at import time". Measured with
`DATABASE_URL` unset and `.env` suppressed: the import succeeds and only the first **query** throws, because Prisma 7 +
`@prisma/adapter-pg` connect lazily. `lib/payroll-run.test.ts` imports `lib/payroll-run.ts` → `./db`
and is green in stage 4. ⇒ **a pure helper does not need its own DB-free module to be testable**;
what is unreachable is an *assertion about stored rows*, which is the conclusion below and is
unchanged. Do not re-derive the old claim from task 009's or 015's wording.

| attempt | why it fails |
|---|---|
| a DB-backed `*.test.ts` | the query runs in stage 4 with no DB ⇒ red |
| `test.skipIf(!process.env.DATABASE_URL)` | the pin counts `tests - skipped`; an env-conditional count makes the pin meaningless, and layer 2 rejects it |
| a second junit report inside `db_stage` | slips past the layer-2 corpus filter into an **unpinned** report — a gate that can vanish in silence, the exact class §7 exists to prevent |

⇒ **Consequence to plan around, not to work around:** domain logic that must be tested has to be
reachable without *querying* — importing is fine (above). That is why task 009 extracted `lib/ot-import.ts` as a pure
function instead of testing the server action, and why 009 has **no** test proving warnings reach
the database — stage 5's `prisma db push` + seed proves the schema, and nothing proves the write.
Closing that needs a **second pinned `bun test` pass inside `db_stage`** after push+seed, with
`check-code-junit.sh` extended to read a second junit file — task
[015](../../../tasks/todo/015-db-test-lane.md).
