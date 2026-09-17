# พอร์ตกติกาการพัฒนาทั้งชุดจาก groove-clinic มาใช้ที่รีโปนี้

- status: done
- commit: 0dc5226

## Goal

linus (2026-09-17): ให้ darin-payroll-system ใช้ rule ในการ development เหมือน groove-clinic
ทุกอย่าง **เปลี่ยนแค่ภาษาโปรแกรม** (TypeScript/Bun/Prisma แทน Rust/axum/sqlx) และ deploy
เป็น docker บน **เครื่องคลาวด์ตัวเดียวกัน** ที่ `darin-dev.rocketlabth.com`

## ทำอะไรไปบ้าง

- `CLAUDE.md` — rulebook §1–§11 ทั้งชุด (เลข § ตรงกับของ groove-clinic เพื่อให้การ์ด/agent อ้างข้ามกันได้)
- `scripts/` — พอร์ตเกตทั้งหมดที่ไม่ผูกกับภาษา + selftest ของแต่ละใบ · ทางเข้าเดียวคือ `scripts/verify.sh`
- `scripts/check-code.sh` เขียนใหม่ฝั่ง TS: `tsc --noEmit` → `prisma validate` → `bun test` + หมุด junit
  → postgres ใช้แล้วทิ้ง + `prisma db push` + seed
- `scripts/check-bun-pin.sh` + selftest — ของใหม่ที่ groove ไม่มี: หมุดเวอร์ชันมีสองบ้าน
  (`scripts/lib/bun-image.sh` กับ `Dockerfile`) และเกตนี้บังคับให้ตรงกัน
- `.claude/` — settings, hook, sub-agent ทั้งชุด (โมเดลต่อ agent ตามตาราง §9)
- `.docs/knowledge/` — index + การ์ด ops/deploy · ops/gates · domain/payroll-rules
- `tasks/` — สามบ้าน (`todo` `todo-human` `done`) + `scripts/task-move.sh`
- deploy: `.github/workflows/deploy-dev.yml` (push develop → ssh → compose up --build),
  `nginx/local.conf`, และ compose ที่ publish พอร์ตบน **loopback เท่านั้น**

## ที่ **ไม่ได้** พอร์ตมา — และทำไม (อย่าอ่านว่า "ลืม")

`check-sql-coverage.sh` · `check-txn-discharge.sh` · `check-authz.sh` · `cargo fmt`
— สามใบแรกตัดสินจากรูปของ Rust/sqlx ที่ไม่มีอยู่ในรีโปนี้ · ใบที่สี่รอ [003](003-formatter-gate.md)
ช่องที่เปิดอยู่จริงบันทึกไว้ที่ [.docs/knowledge/ops/gates.md](../../.docs/knowledge/ops/gates.md)
