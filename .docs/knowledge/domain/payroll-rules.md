---
sources:
  - lib/payroll.ts
  - lib/config-keys.ts
  - lib/payroll-run.ts
  - prisma/schema.prisma
  # Rule 4 asserts this file still carries the engine's reference answer for a >2-decimal hours
  # value (13.33 · qty 0.33 · 266.67 over 20 days) ⇒ deleting or rewriting that test must land here
  # as STALE, not pass green under a card that keeps quoting the figure.
  - lib/payroll.test.ts
  # Rule 4 documents this file's `num()` rule for reading `ot.thresholdHours`/`ot.ratePerHour`
  # outside the engine — the only claim this card still makes about the file, since task 011
  # deleted the `เป็นเงิน` column it used to also document.
  - app/ot/page.tsx
  # Rule 4 makes the same `num()` claim here about `class.minAttendees`/`class.halfRatio`, and
  # states what the table shows now that task 011 deleted `มูลค่า` ⇒ re-adding a `?? 3` fallback (or
  # a derived column) must go STALE instead of leaving the card advertising a ratio the engine no
  # longer agrees with.
  - app/classes/page.tsx
---

# กติกาเงินเดือน — ที่มาของตัวเลขและเส้นที่ห้ามข้าม

อ่านการ์ดนี้ก่อนแตะอะไรที่คำนวณเงิน · เนื้อ requirement ฉบับเต็มอยู่ที่
[REQUIREMENTS.md](../../../REQUIREMENTS.md) (§ ที่อ้างในโค้ดคือ § ของไฟล์นั้น)

## เส้นที่ห้ามข้าม (invariants)

1. **ทุกเรท/เกณฑ์/% อยู่ที่ `lib/config-keys.ts` ที่เดียว — ห้าม literal ในสูตร**
   ค่าใน `CONFIG_DEFAULTS` ใช้ **ตอน seed เท่านั้น**; runtime อ่านจากตาราง `PayrollConfig` เสมอ
   ⇒ เจ้าของแก้เรทเองได้จากหน้า `/admin/config` โดยไม่ต้อง deploy
2. **`computePayslip` เป็น pure function** — ไม่แตะ DB ไม่อ่าน env ไม่อ่านนาฬิกา
   ⇒ เทสทุกใบใน `lib/payroll.test.ts` เป็นการเทียบตัวเลขตรง ๆ ไม่ต้องมีฐานข้อมูล · **ห้ามย้าย
   การอ่าน config เข้ามาในนี้** ตัวเรียก (`lib/payroll-run.ts`) เป็นคนโหลดมาส่งให้
3. 🔴 **สิ่งที่ตัดสินไม่ได้ต้องเข้า `warnings` ห้ามกลายเป็น 0 เงียบ ๆ**
   คาบสอนของชื่อที่ยังไม่รู้จัก · เรทที่ยังไม่ถูกตั้ง · ยอดที่ไม่มีคนรับส่วนแบ่ง — ทั้งหมดต้องขึ้น
   หน้าจอให้คนเห็น · **นี่คือข้อที่แพงที่สุดถ้าพัง**: เงินที่หายไปเงียบ ๆ ไม่มีใครทักจนกว่าจะถึงวันจ่าย

   **How that is kept true end-to-end (task 009).** Until 009, `runPayroll` destructured `warnings`
   out and dropped it — the invariant held inside the engine and was violated one line later:
   - **`PayslipWarning`** (`prisma/schema.prisma`) persists them: `payslipId` + `seq` + `message`,
     `@@unique([payslipId, seq])`, `onDelete: Cascade`. `seq` is the engine's emission order,
     because a table has no implicit one.
   - **A table, not a `String[]` column** — §2 rule 8. Adding a `sourceKind`/`sourceId` later is an
     additive nullable column on a table, but on a `String[]` it means a drop +
     `--accept-data-loss`, and warnings on `approved`/`paid` slips are **not recomputable**.
   - **Written in the same transaction as the lines**, one interactive `$transaction` **per staff
     member** (never one around the loop — the 5 s timeout would roll back the whole period), in
     the order upsert → `deleteMany` lines → `deleteMany` warnings → `createMany` both. Not a
     nested write: Prisma does not guarantee a nested `deleteMany` runs before a nested
     `createMany`.
   - **Rewritten wholesale on every recompute**, exactly like `PayslipLine`. Dropping the unique
     "because the insert is failing" converts a loud error into duplicated warnings.
   - 🔴 **Not recomputable once the slip leaves `draft`** — `runPayroll` refuses non-draft slips,
     so whatever warnings a slip carries at approval time are final.
   - **Deliberately not a workflow**: no `severity`, no `acknowledgedAt`/`resolvedBy`, no
     `/admin/warnings` inbox. This is a display of what the engine could not decide, not a
     decision. Do not add one without a card that says why.
   - **Rendered above the amounts** on both payslip screens, never below, and never collapsed —
     `app/admin/config/page.tsx` already promises the user in Thai that unmatched work
     "ขึ้นเตือนในสลิป".
   - The same shape elsewhere has **different lifetimes and therefore different homes**: the OT
     paste's rejected lines live one submission (returned by the action, `lib/ot-import.ts` —
     `unmatched` for a username nobody has, `invalidHours` for an hours field that is not a finite
     number), and a sheet whose grid did not arrive lives one sync run (`SyncResult.missingGrid`).
     Neither belongs in `PayslipWarning`.
   - 🔴 **`invalidHours` exists because `NaN` is not a loud failure.** `OtEntry.hours` is a `Float`
     ⇒ `double precision`, which **accepts `NaN`**; one bad character would write it, and §2.4's
     `Math.max(0, NaN − threshold)` turns that staff member's `otPay`, `net` and whole month into
     `NaN`. Rejecting it at the parser makes the outcome the same whatever the driver does.
     ⇒ **every write path into `OtEntry.hours` carries that guard, not just the paste.** The one-row
     add form on `/ot` rejects a non-string or non-finite field in its own action and reports it
     (`?err=hours`); `type="number" required` is a client hint and a server action is a plain HTTP
     endpoint, where an absent field is `Number(null) === 0` — a recorded 12.5 h overwritten by a
     zero, which is this rule failing in the other direction.
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
   `app/payslips/page.tsx:58` still **sum** already-rounded `Payslip.net` values inside the page.
   No rate or threshold is applied, so it is not a second answer to *what is this worth* — but it is
   arithmetic on baht in `app/**`, and it has the shape this rule tells you to distrust: an
   unrounded aggregate of already-rounded parts. Carded as task **019**; do not close it here by
   inventing a formula.

   **Why the deleted columns were dangerous, for the record.** `/ot` once fed a *rounded*
   intermediate into its own multiplication — `money(money(h − threshold) × rate)` — while the
   engine rounds only the final amount. A fingerprint export writes 9:20 as `9.333333333333334`: the
   engine pays `money(0.3333… × 40)` = **13.33**, the screen showed `money(0.33 × 40)` = **13.20**;
   over 20 such days, 266.67 ฿ paid against 264.00 ฿ shown — invisible to a spot check because clean
   2-dp hours agree either way. `lib/payroll.test.ts` still carries the engine's answer for this exact
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

- **ค่าสอน** — `teachRates[activity][rank]`; rank คือ `ST`/`CT`/`PT`
- **คลาสกลุ่ม** — คนเข้าจริง ≥ `class.minAttendees` ได้เต็ม · 1..min-1 คูณ `class.halfRatio` · 0 คนไม่จ่าย
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
but not in the behaviour, and `lib/payroll.test.ts` ran the same 21 tests before and after.
From now on `prettier --check` is the first stage of `scripts/check-code.sh`, so a hand-formatted
edit to these files goes red before `tsc` even starts — see [../ops/gates.md](../ops/gates.md).
