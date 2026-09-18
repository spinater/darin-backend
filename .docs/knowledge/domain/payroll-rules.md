---
sources:
  - lib/payroll.ts
  - lib/config-keys.ts
  - lib/payroll-run.ts
  - prisma/schema.prisma
  # Rule 4 below documents this screen's rounding contract and its `num()` rule ⇒ the day task 011
  # changes or deletes the `เป็นเงิน` column, §5's staleness gate must point at this card.
  - app/ot/page.tsx
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

   **`money()` is exported (task 009 review).** A screen that *previews* a figure the payslip also
   prints must round with this same function — `/ot` showed `ชม. OT 0.6999999999999993` and
   `เป็นเงิน 27.99999999999997` beside a payslip that had rounded, on the screen the counter staff
   use to check one against the other. The export is for **rounding**, not a licence to compute
   money elsewhere: rule 2 above still stands, and whether `/ot` should print a baht column at all
   is task **011**.

   🔴 **The export is also how this rule gets broken — it was, in 009's own first fix pass.** `/ot`
   rounded the OT *hours* and fed that into the baht multiplication: `money(money(h − threshold) ×
   rate)`. Both money gates found it independently. A fingerprint export writes 9:20 as
   `9.333333333333334` ⇒ the engine pays `money(0.3333… × 40)` = **13.33** while the screen showed
   `money(0.33 × 40)` = **13.20**; over 20 such days, 266.67 ฿ paid against 264.00 ฿ shown, on the
   one screen whose job is checking the import against the payslip. It runs the other way too
   (9:10 → engine 6.67, screen 6.80), and with clean 2-dp hours the two agree — which is why a spot
   check would not catch it.
   ⇒ **`money()` wraps an output, never an input.** Keep the raw excess for arithmetic and round
   each printed figure once.

   ⚠️ **Not pinned — the correction the third review round forced on this card.** `lib/payroll.test.ts`
   writes down the **engine's** answer for a >2-decimal hours value (13.33 · qty 0.33 · 266.67 over
   20 days), and that is all it does: it asserts `computePayslip`, whose OT block never carried the
   defect, so it would have gone green against the pre-fix tree. It is a **reference figure**, so a
   future disagreement is provable — **not** a regression test of the screen. Re-introducing
   `money(Math.max(0, h - threshold))` in `app/ot/page.tsx` today leaves `bun test` green and puts
   `/ot` back at 13.20 against 266.67 paid. Fencing it needs a testable seam outside the component
   (task **011**, which also decides whether the column lives) and a lane that can render one
   (task **015**).

   **Reading a rate outside the engine follows rule 1 exactly** — `num(cfg, key)`, never
   `Number(...?.value ?? 40)`. `/ot` invented 40 ฿/h when `ot.ratePerHour` was missing while
   `computePayslip` threw on the same key, so the screen looked right while the run died: one
   screen inventing a rate the engine refuses to invent. Both sides now fail the same way.
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
