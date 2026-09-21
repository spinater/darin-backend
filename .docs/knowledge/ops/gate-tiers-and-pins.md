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
  # The pin layer's own module — the enforcer, and the reverse-sweep hole this card names.
  # ⚠️ `scripts/junit-pins.txt` is deliberately **not** a source any more: its rows are explained by
  # [junit-pin-history.md](junit-pin-history.md) since ใบ 068, and keeping it here would make every
  # new test file stale two cards instead of one — the drift §5 asks a split to remove.
  - scripts/lib/check-code-junit.sh
---

# สองชั้นของเกต กับชั้นหมุด junit — เกตตัวไหนรันเมื่อไร และหมุดหนึ่งตัวซื้ออะไร

Split out of [gates.md](gates.md) at task 023, which had reached 189/200 lines. That card answers
**which gate watches what**; this one answers **when each gate runs** and **what a junit pin is
worth**. Everything this repo claims about `scripts/verify.sh`'s own machinery lives here; what each
individual pin bought is [junit-pin-history.md](junit-pin-history.md), split out at ใบ 068.

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
must run **exactly** the pinned number of tests. The numbers live in that file, and **what each one
bought — card by card, row by row — moved to [junit-pin-history.md](junit-pin-history.md) at ใบ 068**,
because the history is the half that grows: five review rounds of one card took this one 183 → 194
against a 200 cap, and every added line was a table row. What stays here is what a pin *is*, what it
cannot see, and why no test in this repo can reach a database.

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

**Every row but one is a raise**; only a lowering needs a reason in the task card, and task 037 is
the shape that lowering takes when nothing was lost. A split **must** go red, but only halfway: the old row's file
stops being run at all (`check-code: FAIL — … ไม่ได้ถูกรัน`), and that is the whole of the red.
🔴 **The new files arrive unpinned and the gate does not notice.**
`scripts/lib/check-code-junit.sh` walks the rows of `junit-pins.txt` and looks each one up in the
junit report; there is **no reverse sweep** from the test corpus back to the pin file, so a test file
that ran with no row of its own is invisible to it. A split that adds five rows for six files is
green, with one file's count unpinned for good.
⚠️ **A pin is worth exactly what its test asserts — read its row in
[junit-pin-history.md](junit-pin-history.md) before quoting one as proof.** Take the 23 → 24 row
there: it asserts `computePayslip`, whose OT block never had the defect (that was in
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
