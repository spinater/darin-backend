---
sources:
  - lib/payroll.ts
  - lib/config-keys.ts
  # `lib/payroll.test.ts` was split into `lib/payroll/*.test.ts` at task 037; these are the **three**
  # halves this card quotes. Rule 4's reference answer for a >2-decimal hours value (13.33 · qty 0.33
  # · 266.67 over 20 days) is in the first; rule 3's inactive-staff pair in the second; rule 3's
  # task-025 negative-attendance trio — the 400/200 ฿ pair and the exactly-0 boundary — in the third.
  # Dropping any of them from this list is how a rewritten test leaves the card green and wrong.
  - lib/payroll/ot.test.ts
  - lib/payroll/slip.test.ts
  - lib/payroll/class.test.ts
  # Rule 4 documents this file's `num()` rule for reading `ot.thresholdHours`/`ot.ratePerHour`
  # outside the engine — the only claim this card still makes about the file, since task 011
  # deleted the `เป็นเงิน` column it used to also document.
  - app/ot/page.tsx
  # Rule 4 makes the same `num()` claim here about `class.minAttendees`/`class.halfRatio`, and
  # states what the table shows now that task 011 deleted `มูลค่า` ⇒ re-adding a `?? 3` fallback (or
  # a derived column) must go STALE instead of leaving the card advertising a ratio the engine no
  # longer agrees with.
  - app/classes/page.tsx
  # Rule 3's `invalidHours` bullet rests on ONE schema fact: `OtEntry.hours` is a `Float` ⇒
  # `double precision`, which accepts `NaN` — the whole reason `finiteNumber` exists ⇒ retyping
  # it (`Decimal`, a check constraint) must go STALE here, not leave a guard justified by a
  # hazard that is gone. This file's lock and `PayslipWarning` halves: [payslip-lifecycle.md](payslip-lifecycle.md).
  - prisma/schema.prisma
  # Rule 4's named residue: this screen still *sums* already-rounded `Payslip.net` in the page
  # (task 019). Closing 019 must land here rather than leave the card naming a hazard that is gone.
  # The screen's other half — `setStatus` as the second half of the status lock — belongs to
  # [payslip-lifecycle.md](payslip-lifecycle.md), which lists this file for that claim.
  - app/payslips/page.tsx
  # The other half of that residue — `/` sums `Payslip.net` in the page too, and was sourced by no
  # card at all until task 023 ⇒ closing 019 in one file only must not go unnoticed here.
  - app/page.tsx
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
     refuses this pair before it ever stores: [money-input-guards.md](money-input-guards.md)
   - 🔴 **`invalidHours` exists because `NaN` is not a loud failure.** `OtEntry.hours` is a `Float`
     ⇒ `double precision`, which **accepts `NaN`**; one bad character would write it, and §2.4's
     `Math.max(0, NaN − threshold)` turns that staff member's `otPay`, `net` and whole month into
     `NaN`. Rejecting it at the parser makes the outcome the same whatever the driver does.
     ⇒ **every write path into `OtEntry.hours` carries that guard, not just the paste** — task 013
     put the one-row form, the paste parser and four more money-writing actions on one predicate,
     `finiteNumber` (`lib/form-number.ts`), which also refuses a **negative** value (`-5` stored, then
     paid nothing). Per-site rules and the shared `?err=` surface: [money-input-guards.md](money-input-guards.md).
4. **ปัดเศษที่เดียว** — `money()` ปัดทศนิยม 2 ตำแหน่ง · ห้ามปัดกลางทางแล้วปัดซ้ำ

   **No screen computes money (task 011 — linus's ruling, option 1).** `/ot` and `/classes` used to
   preview a baht column (`เป็นเงิน`, `มูลค่า`) built from a second formula living outside
   `lib/payroll.ts` — a straight rule-2 violation. Task 011 deleted both columns rather than give the
   duplication a shared seam: `/ot` now shows `ชั่วโมง`/`ชม. OT` as hours (a **display-only** 2 dp
   formatter, never `money()` — hours are not baht), and `/classes`'s table is
   `วันที่`/`คลาส`/`ผู้สอน`/`จอง`/`no-show`/`เข้าจริง` plus the delete column, with no derived amount
   left in it. `money()` stays exported from `lib/payroll.ts` but as of 011 has **no caller outside
   that file**.

   🔑 **The line is *computed* vs *displayed*, not "no baht on screen".** The payslip is the only
   place a baht figure is **computed**. Any screen may **display a stored or configured amount
   unchanged** — `Payslip.net`, `Sale.netPrice`, `ClassPrice.price`, a rate out of `PayrollConfig` —
   and may **not derive one** (no rate, threshold or percentage applied anywhere in `app/**`). Read
   the wrong half of this and you either strip a read-only figure the counter staff need (`/` shows
   `ยอดขายในงวด`/`รวมจ่ายสุทธิ`, `/payslips` a period total, `/sales` `netPrice`, `/admin/config` the
   rates and ฐานเงินเดือน, `/classes`'s add-form `<option>` the stored `({c.price})`) or you "fix" a
   total by computing something new, which is the actual violation.

   **The one residue, named so it is not re-discovered as a scandal:** `app/page.tsx:43` and
   `app/payslips/page.tsx:70` still **sum** already-rounded `Payslip.net` values inside the page.
   No rate or threshold is applied, so it is not a second answer to *what is this worth* — but it is
   arithmetic on baht in `app/**`, and it has the shape this rule tells you to distrust: an
   unrounded aggregate of already-rounded parts. Carded as task **019**; do not close it here by
   inventing a formula.

   **Why the deleted columns were dangerous, for the record.** `/ot` once fed a *rounded*
   intermediate into its own multiplication — `money(money(h − threshold) × rate)` — while the
   engine rounds only the final amount. A fingerprint export writes 9:20 as `9.333333333333334`: the
   engine pays `money(0.3333… × 40)` = **13.33**, the screen showed `money(0.33 × 40)` = **13.20**;
   over 20 such days, 266.67 ฿ paid against 264.00 ฿ shown — invisible to a spot check because clean
   2-dp hours agree either way. `lib/payroll/ot.test.ts` still carries the engine's answer for this exact
   case (13.33 · qty 0.33 · 266.67 over 20 days) as a **reference figure** — it asserts
   `computePayslip`, whose OT block was never wrong, so it proves a future disagreement rather than
   fencing a screen; there is no screen arithmetic left to fence. A baht preview proposed again
   anywhere must call `lib/payroll.ts`'s formula, never re-derive it (option 2 on the 011 card).

   **Reading a rate/threshold outside the engine follows rule 1 exactly** — `num(cfg, key)`, never
   `Number(...?.value ?? 40)`. Both `/ot` (`ot.thresholdHours`, `ot.ratePerHour`) and `/classes`
   (`class.minAttendees`, `class.halfRatio`) read their explanatory `<p>` text this way: `num()`
   throws when a key is missing, so the screen's copy fails the same way the payroll run does,
   instead of a screen inventing a value and looking right while the run dies on it.
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
