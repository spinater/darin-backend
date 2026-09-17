---
sources:
  - lib/payroll.ts
  - lib/config-keys.ts
  - lib/payroll-run.ts
  - prisma/schema.prisma
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
4. **ปัดเศษที่เดียว** — `money()` ปัดทศนิยม 2 ตำแหน่ง · ห้ามปัดกลางทางแล้วปัดซ้ำ
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
