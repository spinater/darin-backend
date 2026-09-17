# Tasks

One markdown file per task. Move it, don't delete it.

- `todo/` — open work. Filename: `NNN-short-slug.md` (e.g. `002-requirement-merge.md`).
- `done/` — shipped work. Move the file here when the commit lands; add the commit SHA at the top.
- `todo-human/` — **บล็อกที่คน ไม่ใช่ที่โค้ด** (task 136). ใบที่ agent หยิบไปทำให้จบไม่ได้
  ไม่ว่าจะเก่งแค่ไหน เพราะมันรอสิ่งที่อยู่นอกรีโป: คำตอบเชิงนโยบาย/ธุรกิจที่เจ้าของต้องตัดสิน ·
  secret หรือ config ของเครื่องจริง · ของจากโลกจริง (ข้อมูลคลินิก รูป การวัดหน้างาน) ·
  หรือคำสั่งที่เจ้าของสั่ง "พับไว้" ไว้เอง
  **ไม่ใช่ที่ทิ้งงานยาก** — ใหญ่ ยาก หลายขั้น ยังอยู่ `todo/` · ย้ายเข้าที่นี่ได้ต่อเมื่อ
  **ยกประโยคในใบมาอ้างได้** ว่าใครต้องตอบอะไร · พอคนตอบแล้ว ย้ายกลับ `todo/` ทันที

## Task file shape

```md
# <title>

- status: todo | todo-human | done
- commit: <SHA once shipped>

## Goal
what & why, in a line or two.

## Notes
decisions, gotchas, follow-ups.
```

⚠️ **หัวใบต้องไม่อ้างสถานะที่บ้านของมันขัดอยู่ — `check-links.sh` ชั้นที่สี่บังคับ** (task 249)

- token แรกของ `- status:` ที่**บังเอิญเป็นชื่อบ้าน** ต้องเป็นชื่อบ้านที่ไฟล์อยู่จริง ·
  หางหลัง token เขียนอะไรก็ได้ (`**ship แล้ว** (วันที่) — …` ไม่ได้อ้างบ้าน ⇒ ไม่ถูกตรวจ)
- บรรทัดขึ้นต้น **`- 🚫`** = ประกาศว่าบล็อกที่คน ⇒ อยู่ได้เฉพาะ `todo-human/`
  · พอปลดบล็อกแล้ว **ลดชั้นเป็น `- (เดิม) 🚫 …` ไม่ใช่ลบทิ้ง** — ข้อความบล็อกคือบันทึกว่าเคยติดอะไร
- `task-move.sh` เขียน token ให้เอง (เก็บหางไว้ครบ) แล้ว**เตือนสิ่งที่มันตัดสินแทนคนไม่ได้**
  ⇒ เจอเตือนแล้วเกตแดง = ต้องแก้หัวใบ ไม่ใช่บั๊กของเครื่องมือ

เกิดจริง 2026-09-07: 11 ใบถูกย้ายกลับ `todo/` เพราะ linus ตอบครบแล้ว แต่หัวใบยังเขียนว่ารอคำตอบ
⇒ สายถัดมาอ่านคิวแล้วสรุปว่า **เหลืองานทำได้ใบเดียว** ทั้งที่ว่าง 12 ใบ

## Rules (see [CLAUDE.md §6](../CLAUDE.md))

1. Track every task as a file here; `todo/` → `done/` on ship (`todo-human/` เมื่อบล็อกที่คน).
   **ย้ายด้วย `bash scripts/task-move.sh NNN` เสมอ ทั้งสามบ้าน** — ไม่ใช่ `git mv` มือ:
   มันกวาดลิงก์ที่ชี้มาหาใบนี้ **ทั้งสามรูป** (`tasks/todo/…` · `../todo/…` · ชื่อเปล่าในไดเรกทอรี
   เดียวกัน) รวมทั้ง**ลิงก์ขาออกของใบเองที่พังเพราะเปลี่ยนไดเรกทอรี** แล้วรัน `check-links.sh` ให้

   | แฟล็ก | ทาง | ใช้เมื่อ |
   |---|---|---|
   | (เปล่า) | `todo` → `done` | ใบ ship แล้ว |
   | `--reopen` | `done` → `todo` | เปิดใบเก่ากลับมา |
   | `--human` | `todo` → `todo-human` | บล็อกที่คน (task 231 — ก่อนหน้านี้ต้องย้ายมือ) |
   | `--answered` | `todo-human` → `todo` | คนตอบแล้ว ย้ายกลับทันที |

   ⚠️ แฟล็กที่ **พิมพ์ผิด** หรืออาร์กิวเมนต์เกิน = `exit 2` ไม่ใช่ปล่อยผ่านเป็นค่า default —
   ก่อนใบ 231 `task-move.sh NNN --humen` ย้ายใบที่ยังไม่เสร็จเข้า `done/` แล้วจบด้วย
   `check-links: OK` (ผลที่ผิดสนิทแต่หน้าตาเหมือนความสำเร็จ)
2. Docs + knowledge cards updated in the same commit as the change.
3. `bash scripts/verify.sh` must be green before a task moves to `done/`.
4. One feature, one commit, message ends `(task NNN)`.
