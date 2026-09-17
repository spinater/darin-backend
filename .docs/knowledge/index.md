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

## Ops cards

| Card | ครอบคลุม |
|---|---|
| [ops/deploy.md](ops/deploy.md) | ปลายทาง (`darin.rocketlabth.com`), compose, CI, กับดักที่กัดจริง |
| [ops/gates.md](ops/gates.md) | เกตทั้งชุดของรีโปนี้: ใครเฝ้าอะไร · อะไรไม่ได้พอร์ตมาและทำไม |

## Domain cards

| Card | ครอบคลุม |
|---|---|
| [domain/payroll-rules.md](domain/payroll-rules.md) | สูตรค่าสอน/คอม/OT/incentive · ที่มาของตัวเลข · จุดที่ห้าม hardcode |
