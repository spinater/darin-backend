---
sources:
  - lib/payroll.ts
  - lib/config-keys.ts
  # `lib/payroll.test.ts` was split into `lib/payroll/*.test.ts` at task 037; these are the **three**
  # halves this card quotes. Rule 4's one-rounding rule is pinned in the first; rule 3's
  # inactive-staff pair in the second; rule 3's task-025 negative-attendance trio — the 400/200 ฿
  # pair and the exactly-0 boundary — in the third. Dropping any of them from this list is how a
  # rewritten test leaves the card green and wrong. ⚠️ The **figures** that first file carries
  # (13.33 · qty 0.33 · 266.67 over 20 days) are quoted by [money-on-screen.md](money-on-screen.md)
  # since task 042, which lists it for that reason — this card no longer restates them.
  - lib/payroll/ot.test.ts
  - lib/payroll/slip.test.ts
  - lib/payroll/class.test.ts
  # Rule 3's `invalidHours` bullet rests on ONE schema fact: `OtEntry.hours` is a `Float` ⇒
  # `double precision`, which accepts `NaN` — the whole reason `finiteNumber` exists ⇒ retyping
  # it (`Decimal`, a check constraint) must go STALE here, not leave a guard justified by a
  # hazard that is gone. This file's lock and `PayslipWarning` halves: [payslip-lifecycle.md](payslip-lifecycle.md).
  - prisma/schema.prisma
---

# กติกาเงินเดือน — ที่มาของตัวเลขและเส้นที่ห้ามข้าม

อ่านการ์ดนี้ก่อนแตะอะไรที่คำนวณเงิน · เนื้อ requirement ฉบับเต็มอยู่ที่
[REQUIREMENTS.md](../../../REQUIREMENTS.md) (§ ที่อ้างในโค้ดคือ § ของไฟล์นั้น)

## เส้นที่ห้ามข้าม (invariants)

1. **ทุกเรท/เกณฑ์/% อยู่ที่ `lib/config-keys.ts` ที่เดียว — ห้าม literal ในสูตร**
   ค่าใน `CONFIG_DEFAULTS` ใช้ **ตอน seed เท่านั้น**; runtime อ่านจากตาราง `PayrollConfig` เสมอ
   ⇒ เจ้าของแก้เรทเองได้จากหน้า `/admin/config` โดยไม่ต้อง deploy · ใบ 040: seed เขียน *ค่า* ครั้งเดียวตลอดอายุฐาน ไม่เคยลบ ([teach-rate-lookup.md](teach-rate-lookup.md)) · 🔴 **ใบ 013 item 4: `num()` ต้อง
   throw เมื่อค่าว่าง/ไม่ finite** — เดิมเช็คแค่ `Number.isNaN` ⇒ `""` อ่านเป็น **0** เงียบ ๆ (วัดจริง: ล้าง
   `comm.pt.selfClosed` = คอม **0 ฿** แทน 2,000 ฿ บนบิล 20,000 ฿ · ล้าง `incentive.threshold` = 12%
   ย้อนหลังเข้าทุกคนทุกเดือน · ทั้งคู่ `warnings: []`) · ฝั่งเขียน: [money-input-guards.md](money-input-guards.md)
2. **`computePayslip` เป็น pure function** — ไม่แตะ DB ไม่อ่าน env ไม่อ่านนาฬิกา
   ⇒ เทสทุกใบใน `lib/payroll/*.test.ts` เป็นการเทียบตัวเลขตรง ๆ ไม่ต้องมีฐานข้อมูล · **ห้ามย้าย
   การอ่าน config เข้ามาในนี้** ตัวเรียก (`lib/payroll-run.ts`) เป็นคนโหลดมาส่งให้
   · that caller's own rules — who it selects, what it locks, what a recompute rebuilds — are in
   [payslip-lifecycle.md](payslip-lifecycle.md), which is the card that sources it.
3. 🔴 **สิ่งที่ตัดสินไม่ได้ต้องเข้า `warnings` ห้ามกลายเป็น 0 เงียบ ๆ**
   คาบสอนของชื่อที่ยังไม่รู้จัก · เรทที่ยังไม่ถูกตั้ง · ยอดที่ไม่มีคนรับส่วนแบ่ง — ทั้งหมดต้องขึ้น
   หน้าจอให้คนเห็น · **นี่คือข้อที่แพงที่สุดถ้าพัง**: เงินที่หายไปเงียบ ๆ ไม่มีใครทักจนกว่าจะถึงวันจ่าย

   - **How that invariant is kept true end-to-end — `PayslipWarning`'s persistence, the status lock, who a
     run selects, and what a recompute rebuilds — moved to [payslip-lifecycle.md](payslip-lifecycle.md) at
     task 023** (this card had reached 198/200). Nothing was shortened in the move.
   - 🔴 **A คาบ that never reached `ClassSession` cannot be warned about at all (ใบ 064)** — no
     `PayslipWarning` exists for a row the engine was never handed ⇒ it is queued in
     `ClassImportProblem` and counted before the run: [class-import-queue.md](class-import-queue.md).
   - **A deactivated staff member is warned about, never zeroed or skipped (task 013).**
     `StaffInput.active` moves **no amount**: paying 0 "because they are inactive" is the silent zero
     this rule forbids, and inventing a daily rate is a literal in a formula (rule 1). Nothing is
     pro-rated for anybody — that is the owner's call, carded as
     [021](../../../tasks/todo-human/021-leaver-base-salary-proration.md). Pinned in
     `lib/payroll/slip.test.ts` by the pair task 013 added (the engine suite's 24 → 26 raise), whose
     own junit pin is **3** — `scripts/junit-pins.txt` is the authority — and the second of the two compares
     the whole result against the same input with `active: true`, so a later "pay them 0" goes red. Who a run
     selects, and the warning's exact wording, are in [payslip-lifecycle.md](payslip-lifecycle.md).
   - **A negative attendance (`noShow > booked`) warns — it is not paid 0 in silence (task 025).**
     `attended = booked − noShow` used to fall into the class formula's `<= 0` arm ⇒ **0 ฿ with
     `warnings: []`** (measured: `{price:400, booked:2, noShow:5}` → `classPay 0`; four such rows in a
     month is 800 ฿ gone with nothing on the slip to look at). It still **pays nothing**, and the
     reason is that the row is *unreadable* — **not** that a rate is missing: paying anything means
     guessing which of the two counts is wrong, and the guesses pay differently. On that same row a
     transposed pair (`booked 5 / noShow 2`) is 3 attended and pays **400 ฿**, while a `noShow`
     mistyped alone (`booked 2 / noShow 0`) is 2 attended and pays **200 ฿** ⇒ §2 rule 4, the คาบ
     goes to `warnings` naming the class, both counts, the negative result and the price, and the
     human picks. **The boundary is the sign and nothing else**: an attendance of exactly 0 is the
     ordinary case §1.4 covers and must **not** warn. Three tests (now `lib/payroll/class.test.ts`)
     took the engine suite 30 → **33** — both directions, plus one warning **per row** (`byClass`
     merges the *lines* by class name; the warnings deliberately do not follow). The door that
     refuses this pair before it ever stores: [pair-guards.md](pair-guards.md)
    ⇒ 🔴 **the repair the warning names depends on where the คาบ came from (ใบ 065)**, which is why
    `ClassSessionInput` carries `sourceKey` — read there and nowhere else, and it moves no amount. A
    hand-keyed row is deleted and re-keyed at `/classes`; telling a reader to do that to an
    **imported** row is what doubles the pay, because the next upload no longer sees that
    `sourceKey` in the table and plans it as a `create` — on 4 Aug 18:00 Core Strength (**200 ฿**,
    §1.4's price table) that is 200 hand-keyed + 200 re-created for one 200 ฿ คาบ. Pinned by one arm in `lib/payroll/class.test.ts` (**6 → 7**) that asserts **both**
    directions, since a message that always says *ลบแล้วคีย์ใหม่* is green against either half alone
    ⇒ **the Gymmo import writes both counts verbatim and clamps neither** (task 063): "repairing" a
    negative on the way in would hide the row from this very warning —
    [gymmo-import.md](gymmo-import.md)
  - **A trainer whose `baseSalary` is 0 is warned about (task 063).** `if (base) lines.push(...)`
    emits **no line** for a 0 base, and an absent line is the weakest signal a slip has: measured on
    real data, a trainer nobody had configured taught 5 คาบ with 0 attendees and got `net 0.00` with
    `warnings: []`. The predicate is `role === "trainer"` and not `!base` — the seeded `owner` row is
    0 on purpose, and warning on every owner slip would teach people to ignore the line. It moves no
    money and adds no line; the warning names ฐานเงินเดือน, mentions เครดิตสอนคลาส as its pair, and
    points at `/admin/config`. Pinned in `lib/payroll/slip.test.ts` (**3 → 5**: the warning, and the
    role predicate, which a `!base`-only version passes). ⚠️ It deliberately does **not** judge a
    `classCredit` sitting on a 0 base — that is whether a smaller base carries a smaller obligation,
    open with linus at [062](../../../tasks/todo-human/062-teaching-credit-is-an-obligation-not-a-deduction.md) §5
   - 🔴 **`invalidHours` exists because `NaN` is not a loud failure.** `OtEntry.hours` is a `Float`
     ⇒ `double precision`, which **accepts `NaN`**; one bad character would write it, and §2.4's
     `Math.max(0, NaN − threshold)` turns that staff member's `otPay`, `net` and whole month into
     `NaN`. Rejecting it at the parser makes the outcome the same whatever the driver does.
     ⇒ **every write path into `OtEntry.hours` carries that guard, not just the paste** — task 013
     put the one-row form, the paste parser and four more money-writing actions on one predicate,
     `finiteNumber` (`lib/form-number.ts`), which also refuses a **negative** value (`-5` stored, then
     paid nothing). The predicate is [money-input-guards.md](money-input-guards.md); the per-site rules
     and the shared `?err=` surface are [form-refusals.md](form-refusals.md), and the paste's four
     buckets are [ot-paste-import.md](ot-paste-import.md) since ใบ 083.
4. **ปัดเศษที่เดียว** — `money()` ปัดทศนิยม 2 ตำแหน่ง · ห้ามปัดกลางทางแล้วปัดซ้ำ
   ⇒ สลิปคือที่เดียวที่ **คำนวณ** เงิน · หน้าจอ **แสดง** ยอดที่เก็บไว้/ตั้งค่าไว้ได้ แต่ห้ามคิดเองสักตัว
   และเรท/เกณฑ์ที่อ่านนอกเอนจินต้องอ่านด้วย `num()` ตามข้อ 1 — กติกาฝั่งหน้าจอทั้งชุด (ใบ 011 ·
   residue ใบ 019 · เหตุผลว่าคอลัมน์ที่ลบทิ้งอันตรายตรงไหน) แยกไปที่
   [money-on-screen.md](money-on-screen.md) ตอนใบ 042
5. **ชื่อในชีตคือกุญแจของการจับคู่** — `lib/normalize.ts` ยุบการสะกดที่ต่างกันให้เหลือคนเดียว
   (21 การสะกด → 5 คน ในชีต PT จริง) ⇒ แก้ตัวยุบเมื่อไร **ต้องรันเทสของ `lib/parser.test.ts` ซ้ำ**

## โครงของยอดหนึ่งใบ

`base` (เงินเดือนฐาน) + `teachPay` (ค่าสอนรายคาบตาม rank) + `classPay` (คลาสกลุ่ม) +
`commission` (คอมขาย + incentive) + `otPay` = `net` · ทุกก้อนแตกเป็น `lines[]` ที่ผู้ใช้เห็นได้

- **ค่าสอน** — `teachRates.get(activity)?.get(rank)`; rank คือ `ST`/`CT`/`PT`
  - 🔴 **A `Map`, never an object literal (task 034).** The activity name is data an admin types
    (§2 rule 7), so an object literal let the name `__proto__` put the rate on `Object.prototype`
    for the whole process, and every other activity inherited it ⇒ an unconfigured rate stopped
    warning and paid 0 ฿ silently, against rule 3. The fold is `buildTeachRates`, in `lib/payroll.ts`
    beside the type it builds so the engine's tests need no `lib/db.ts`. ⚠️ It closes the
    *prototype-key* class only — and **task 036 closed the other half of the same silent 0 ฿**: an activity is a **name**
    (`TeachActivity` · `lib/activities.ts` · never a number) with **no rate row until an owner types one**, so `rate == null`
    is reachable at last for one added through the screen — `addActivity` used to seed all three ranks at `0`. A `|` in the
    name is still open (task 035) · [payslip-lifecycle.md](payslip-lifecycle.md) carries the chain.
- **คลาสกลุ่ม** — คนเข้าจริง ≥ `class.minAttendees` ได้เต็ม · 1..min-1 คูณ `class.halfRatio` · 0 คนไม่จ่าย · **negative = pays nothing and warns** (rule 3, task 025)
- **คอมขาย** — แตกตาม *ใครปิด* และ *ใครส่งลีด* (`comm.pt.selfClosed` · `leadTrainer` · `leadReferrer`
  · `counterSelf`) ⇒ บิลใบเดียวจ่ายได้หลายคน ผ่าน `attributions`
- **incentive** — ยอด PT ที่ปิดเอง ≥ `incentive.threshold` ในเดือนนั้น ⇒ คิด `incentive.rate`
  **ย้อนหลังทั้งเดือน** ไม่ใช่เฉพาะส่วนที่เกิน
- **OT** — ชั่วโมงเกิน `ot.thresholdHours` ต่อวัน × `ot.ratePerHour`
- **ไม่มีคอม**: ต่ออายุคอร์ส (`courseExt.*`) และ freeze (`freeze.price`)

## วันจ่าย

`payday.base` = วันจ่ายเงินเดือนฐาน · `payday.variable` = วันจ่ายค่าสอน+คอม+OT **ของเดือนก่อน**
⇒ งวดของสองก้อนนี้ไม่ตรงกันโดยตั้งใจ — อย่า "แก้" ให้ตรงกันเองโดยไม่ถามเจ้าของ

## Formatting (task 003)

`lib/payroll.ts` and `lib/payroll-run.ts` went through the first `prettier --write` pass when the
formatter gate opened. **Shape only — no rule, rate or branch changed**; the pass is in the diff
but not in the behaviour, and the engine suite (then `lib/payroll.test.ts`) ran the same 21 tests.
From now on `prettier --check` is the first stage of `scripts/check-code.sh`, so a hand-formatted
edit to these files goes red before `tsc` even starts — see [../ops/gates.md](../ops/gates.md).

## ใบ 082 — two keys that are not a rate

`CONFIG_DEFAULTS` gained `date.earliestYear` and `date.futureDays`. Neither is read by
`computePayslip` and neither appears in any formula: they bound the **dates a form will accept**, a
guard in front of the engine rather than a term inside it ([date-window.md](date-window.md)). They
are in `CONFIG_DEFAULTS` for §2 rule 3's reason all the same — the alternative was a literal year in
a guard — and they are numbers, so `num()` reads them unchanged and the key set stays all-numeric.
