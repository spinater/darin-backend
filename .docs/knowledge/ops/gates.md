---
sources:
  - scripts/verify.sh
  - scripts/check-code.sh
  - scripts/check-bun-pin.sh
  - scripts/lib/bun-image.sh
  - scripts/junit-pins.txt
---

# เกตของรีโปนี้ — ใครเฝ้าอะไร และอะไร *ไม่ได้* ถูกเฝ้า

ทางเข้าเดียวคือ `bash scripts/verify.sh` (CLAUDE.md §7) · ลำดับ stage ไม่ได้เรียงตามความสำคัญ
แต่เรียงตาม **เงื่อนไขของกันและกัน**: ด่านที่ตอบว่า "ผลของด่านอื่นเชื่อได้ไหม" ต้องจบก่อนเสมอ

## พอร์ตมาจาก groove-clinic ทั้งก้อน (ใบ 001)

| ด่าน | เฝ้าอะไร |
|---|---|
| `scripts/check-shell-source.sh` | สคริปต์ที่ `.` ไฟล์ของรีโปโดยไม่อ่าน `rc` — ถ้าไฟล์ที่ source พัง มันจะ **เดินต่อจนจบ exit 0 พร้อมแต้มที่น้อยลง** ⇒ เงื่อนไขที่ทำให้ selftest ทุกใบพูดความจริงได้ |
| `scripts/check-path-bytes.sh` | จุดเรียก git ที่กิน stdout แต่ไม่มี `-z` — `core.quotePath` ทำให้พาธไม่ใช่ ASCII ถูก quote ⇒ ลูปข้ามไฟล์นั้นเงียบ ๆ **ก่อนตัวนับของตัวเองจะขยับ** (รีโปนี้ชื่อไฟล์/เนื้อไฟล์เป็นไทยเยอะ ⇒ ไม่ใช่ฉากสมมติ) |
| `scripts/check-sort-locale.sh` | `sort` ที่ไม่ประกาศ locale — uutils ใต้ `en_US.UTF-8` ให้เครื่องหมายวรรคตอนน้ำหนักศูนย์ ⇒ `sort -u` ยุบชื่อที่ต่างกันจริง |
| `scripts/check-text-bytes.sh` | ไฟล์ที่ตั้งใจให้เป็น text แต่ไบต์อ่านว่า binary ⇒ เกตอื่น **ข้ามมันทั้งหมดโดยไม่มีใครรู้** |
| `scripts/check-file-length.sh` | §4 เพดาน 500 บรรทัด · ขอบเขตอยู่บ้านเดียวที่ `scripts/lib/file-length-scope.sh` ซึ่ง hook ของ Claude อ่านตัวเดียวกัน |
| `scripts/check-links.sh` | ลิงก์ md ที่เน่า · ใบงานที่มีสองบ้าน · หัวใบที่อ้างสถานะขัดกับบ้านของตัวเอง |
| `scripts/check-card-paths.sh` | พาธในเครื่องหมาย backtick **ทุกไฟล์ที่ git ถือ** ที่ไม่มีรากจริง |
| `scripts/check-knowledge.sh` | §5 — การ์ดที่ `sources:` ขยับแล้วการ์ดไม่ขยับตาม (STALE) · เพดานการ์ด · การ์ดที่ไม่มีแถวใน index |
| selftest ของแต่ละด่าน | **เกตของเกต** — ด่านที่โกหกได้ ทำให้ผลของด่านอื่นในรอบเดียวกันไม่มีความหมาย |

## ที่ต่างจาก groove-clinic — และเหตุผล

**ต่างเพราะภาษาโปรแกรม ไม่ใช่เพราะมาตรฐานคนละชุด** (linus 2026-09-17: เอากติกาเดิมทุกข้อ เปลี่ยนแค่ภาษา)

| groove-clinic | ที่นี่ | ทำไม |
|---|---|---|
| `check-code.sh` = cargo fmt + clippy + test + tsc/bun | `check-code.sh` = tsc + prisma validate + bun test + db push/seed | ไม่มี Rust ในรีโปนี้ |
| `scripts/lib/rust-image.sh` (หมุด Rust 1.98) | `scripts/lib/bun-image.sh` + `scripts/check-bun-pin.sh` | เหตุผลของการปักหมุดเหมือนเดิมทุกตัวอักษร — เปลี่ยนแค่ว่าปักหมุดอะไร · และที่นี่ **มีเกตเทียบสองบ้าน** (lib กับ `Dockerfile`) ซึ่ง groove ไม่มี |
| `check-sql-coverage.sh` (trigger/constraint ต้องมีเทส) | — | schema ที่นี่เป็น Prisma + `db push` ไม่มีไฟล์ migration ให้กวาดชื่อ constraint · **ช่องนี้เปิดอยู่จริง ไม่ได้ปิดไปด้วยเหตุผล** |
| `check-txn-discharge.sh` (ทุก txn ปิดทางเดียว) | — | เป็นของ sqlx โดยเฉพาะ (`Drop` แค่ *คิว* ROLLBACK) — Prisma `$transaction` ไม่มีรูปนั้น |
| `check-authz.sh` (route ที่เกิดนอก ScreenRouter) | — | ที่นี่สิทธิ์เช็คด้วย `requireRole()` ในแต่ละหน้า/action · **ยังไม่มีเกตไหนเฝ้าว่าหน้าที่เกิดใหม่เรียกมันจริง** |
| `cargo fmt` เป็นมาตรฐานของทรี | — | ยังไม่มี formatter ที่ปักหมุดในรีโปนี้ |

## 🔴 ช่องที่รู้ตัวว่าเปิดอยู่ — อย่าอ่านตารางข้างบนว่า "ครบแล้ว"

1. **ไม่มี formatter gate** — ทรีจะ drift ไปเรื่อย ๆ จนวันที่มีคนพิมพ์ `prettier` ครั้งแรกแล้วลาก
   ไฟล์ทั้งรีโปเข้าคอมมิตของคนที่บังเอิญพิมพ์ (เกิดจริงที่ groove-clinic: 333 ไฟล์) ⇒ ใบ 003
2. **ไม่มีเกตฝั่งสิทธิ์** — หน้าใหม่ที่ลืมเรียก `requireRole()` วันนี้ไม่มีอะไรแดง
3. **`check-code.sh` ไม่ได้ build `Dockerfile`** — ตัวที่ build จริงคือตอน deploy เท่านั้น
   ⇒ ห้ามเขียนที่ไหนว่า "เกตเขียว = อิมเมจ build ผ่าน"
4. **`verify.sh` ยังไม่อยู่ใน CI** — push develop แล้ว deploy เลยโดยไม่มีเกตขวาง
