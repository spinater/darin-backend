# Knowledge Cards — Darin Payroll System

แผนที่ context ของโปรเจกต์ อ่าน card ของพื้นที่ที่จะแตะ**ก่อน**ไล่อ่านโค้ด/เอกสาร
Card ยาว 40–120 บรรทัด (**เตือนที่ 170 · เพดาน 200** — `scripts/check-knowledge.sh`; ชนเพดานแล้วให้ **แตกการ์ด** ไม่ใช่ขยายเพดาน)

กติกา: commit ใดแตะไฟล์ใน `sources:` ของ card ไหน ต้องอัปเดต card นั้นใน commit เดียวกัน (CLAUDE.md §5)

> 🔑 **ไฟล์นี้เองก็มีเกตเฝ้า** — `check-knowledge.sh` บังคับว่า **การ์ดทุกใบใต้ `.docs/knowledge/`
> ต้องมีแถวในตารางข้างล่างนี้** · ทิศกลับ (แถวที่ชี้ไฟล์ที่ไม่มีอยู่) เป็นงานของ
> `scripts/check-links.sh` มาตั้งแต่ต้น ⇒ ไม่ทำสำเนาที่นี่ (§4: คำตัดสินเดียวมีบ้านเดียว)

> 📇 **รีโปนี้พอร์ตกติกามาจาก groove-clinic ทั้งชุดที่ใบ 001** — ต่างกันที่ **ภาษาโปรแกรม**
> (TypeScript/Bun/Prisma แทน Rust/axum/sqlx) เท่านั้น · เกตที่เป็นของ Rust โดยเฉพาะ
> (`cargo fmt` · sql-coverage · txn-discharge · authz) ไม่ได้พอร์ตมา และของที่มาแทนคือ
> `scripts/check-code.sh` ฝั่ง TS กับ `scripts/check-bun-pin.sh` — เหตุผลอยู่ในการ์ด
> [ops/gates.md](ops/gates.md)
>
> 📌 **Update (task 003): the formatter gate is back** — `cargo fmt --check` now has its TS
> counterpart as the `format` stage of `scripts/check-code.sh` (`prettier --check`, config in
> `.prettierrc`, scope `*.ts` / `*.tsx` only — **never Markdown**, because the `.md` in this repo is
> Thai prose, CLAUDE.md §2.5). The three gates still missing are sql-coverage, txn-discharge and
> authz. Details in [ops/gates.md](ops/gates.md).

## Ops cards

| Card | ครอบคลุม |
|---|---|
| [ops/deploy.md](ops/deploy.md) | ปลายทาง (`darin.rocketlabth.com`), compose, CI, กับดักที่กัดจริง |
| [ops/gates.md](ops/gates.md) | เกตทั้งชุดของรีโปนี้: ใครเฝ้าอะไร · อะไรไม่ได้พอร์ตมาและทำไม |
| [ops/junit-pin-history.md](ops/junit-pin-history.md) | ประวัติหมุด junit (แยกจากการ์ดข้างล่างที่ใบ 068): หมุดแต่ละตัวขึ้นมาเพราะอะไรและซื้ออะไรมา · `scripts/junit-pins.txt` เป็นเจ้าของตัวเลข การ์ดนี้เป็นเจ้าของเหตุผล |
| [ops/gate-tiers-and-pins.md](ops/gate-tiers-and-pins.md) | สองชั้นของเกต (ใบ 017): ด่านไหนรันทุกรอบ · selftest รันเมื่อไร · ชั้นหมุด junit กับข้อสรุปว่าไม่มีเทสใบไหนถึงฐานข้อมูล |

## Domain cards

| Card | ครอบคลุม |
|---|---|
| [domain/payroll-rules.md](domain/payroll-rules.md) | สูตรค่าสอน/คอม/OT/incentive · ที่มาของตัวเลข · จุดที่ห้าม hardcode |
| [domain/money-on-screen.md](domain/money-on-screen.md) | ฝั่งหน้าจอของกติกาปัดเศษ (แยกจากการ์ดบนที่ใบ 042): หน้าจอ *แสดง* ยอดที่เก็บไว้ได้ แต่ห้าม *คำนวณ* · อ่านเรทนอกเอนจินด้วย `num()` · residue ใบ 019 ที่ยังเหลือ |
| [domain/payslip-lifecycle.md](domain/payslip-lifecycle.md) | วงจรชีวิตของสลิป: `PayslipWarning` · ล็อก `Payslip.status` สองฝั่ง · ใครเข้ารอบ (leaver arms) · อะไรถูกคิดใหม่ |
| [domain/teach-rate-lookup.md](domain/teach-rate-lookup.md) | หาเรทค่าสอนยังไง: `buildTeachRates` เป็น `Map` · ชื่อกิจกรรมกับเรทเป็นคนละเรื่อง · ทำไม `__proto__` กับเรท 0 เคยจ่ายเงียบ |
| [domain/form-refusals.md](domain/form-refusals.md) | ฝั่ง policy ของการ์ดข้างล่าง (แยกที่ใบ 068): action ไหนปฏิเสธช่องไหน · ช่องว่างแปลว่าอะไรในแต่ละที่ · `?err=` ที่ใช้ร่วมกัน · สองด่านที่เป็น *คู่* ไม่ใช่ช่องเดียว |
| [domain/money-input-guards.md](domain/money-input-guards.md) | ตัวเลขที่มาจากฟอร์ม: `finiteNumber`/`isBlank` · 5 action ที่ปฏิเสธก่อนเขียน · รูปแบบ `?err=` ที่ใช้ร่วมกัน |
| [domain/gymmo-import.md](domain/gymmo-import.md) | กลไกนำคาบจากไฟล์ Gymmo ลง `ClassSession`: `sourceKey` เข้ารหัสแบบชนกันไม่ได้และ normalize ชื่อครูเหมือนชั้นที่จับคู่ · แถวซ้ำในไฟล์เดียวกัน · สามอย่างที่หน้ายืนยันต้องโชว์ก่อนเขียน |
| [domain/gymmo-import-preview.md](domain/gymmo-import-preview.md) | สามสัญญาณที่หน้ายืนยันต้องโชว์ก่อนเขียน (แยกจากการ์ดบนที่ใบ 068): คาบที่คีย์เองแล้วไฟล์จะซ้ำ · คาบที่นำเข้าแล้วแต่ไฟล์ไม่มี · งวดที่สลิปปิดแล้ว |
| [domain/class-import-queue.md](domain/class-import-queue.md) | ที่อยู่ของแถว Gymmo ที่ไม่ได้กลายเป็นคาบ: `ClassImportProblem` · คีย์สามทรงแยกกันด้วยจำนวนสมาชิก · ลบ-แล้ว-ใส่ในทรานแซกชันเดียวกับคาบ (ตัวนับแยกไปการ์ดข้างล่าง) |
| [domain/class-import-blockers.md](domain/class-import-blockers.md) | ตัวเลขที่กั้นการคิดเงินเดือน: `runBlockers` สองตัวเลขไม่รวมกัน · กฎการยกเว้นของตัวนับ · แถวที่ไม่มีทางหายเอง และแถวที่นับหายแต่เหตุผลยังค้าง |
| [domain/gymmo-import-data.md](domain/gymmo-import-data.md) | ข้อมูลที่เส้นทางนั้นต้องมีในฐาน: alias 6 แถว · ราคาคลาส 5 แถว · คู่ ฐานเงินเดือน/เครดิตสอนคลาส · และอะไรที่ยังไม่ได้พิสูจน์ |
