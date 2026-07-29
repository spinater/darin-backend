# วางโครงสร้าง agent / rule / knowledge (OKF) ตามมาตรฐาน selfbot

- status: todo
- commit: <SHA once shipped>
- spec: —  (โครงสร้างเครื่องมือ ไม่ใช่กฎการจ่าย)
- money: no

## Goal

ให้ AI ทำงานกับ repo นี้ได้โดยไม่ต้องอ่านโค้ดทั้งไฟล์ และให้กฎที่ตั้งไว้มีตัวบังคับจริง
ไม่ใช่แค่ข้อความ — พอร์ตมาตรฐานจาก `/root/app/selfbot` แล้วปรับให้เข้ากับโปรเจกนี้
(single package, ภาษาไทยในโค้ด/UI, เงินคือของสำคัญที่สุด)

## Notes

**สิ่งที่เพิ่ม**

- `CLAUDE.md` เป็น router (`@`-import `.github/copilot-instructions.md`) ไม่ใช่เนื้อหา
- `.github/copilot-instructions.md` = กฎกลาง §1–§7 รวม §4a เพดาน 500 บรรทัด + ตารางวิธีแตกไฟล์
- `.github/instructions/{domain,app,data,knowledge}.instructions.md` — glob-scoped ด้วย `applyTo:`
- `.claude/knowledge/` — OKF v0.2 การ์ด 12 ใบ ครอบคลุมไฟล์ต้นทาง 41 ไฟล์ ใบละ 1 เจ้าของ
- `.claude/agents/` — 9 ตัว · reviewer/architect/debugger ไม่มี Edit/Write โดยตั้งใจ
- `.claude/skills/{dev-loop,verify}/SKILL.md`
- `scripts/check-file-length.ts` + `scripts/check-knowledge.ts` เข้า `bun run verify`

**การตัดสินใจที่ควรรู้**

- การ์ดอยู่ที่ `.claude/knowledge/` ไม่ใช่ `docs/knowledge/` แบบ selfbot เพราะ `docs/` ของ repo นี้
  อยู่ใน `.gitignore` (ข้อมูลลูกค้าจริง) — การ์ดใน `docs/` จะไม่ถูก git เห็น และกลไกเช็คความสดจะ
  เงียบสนิทโดยไม่มีใครรู้
- **ไม่** vendor skill `frontend-design` จาก selfbot — skill นั้นเขียนสำหรับหน้า marketing
  ("hero is a thesis", "take one aesthetic risk") ซึ่งขัดกับ UI เครื่องมือภายในที่ตั้งใจให้เรียบ
  ย้ายเฉพาะส่วนที่ใช้ได้จริง (quality floor + การเขียนคำ) ไปไว้ใน `app.instructions.md` แทน
- แทน `security-reviewer` ของ selfbot ด้วย `payroll-auditor` — ความเสี่ยงอันดับหนึ่งของโปรเจกนี้คือ
  จ่ายเงินผิดแบบเงียบๆ ไม่ใช่ถูกแฮก (single tenant, ไม่มี API สาธารณะ) เรื่อง auth/PII ยกไปเป็น
  หัวข้อบังคับใน `code-reviewer`

**bug ที่เจอตอนพอร์ต script (แก้แล้ว)**

`git status --porcelain -z` ยุบไดเรกทอรีที่ยังไม่ถูก track ให้เหลือรายการเดียว (`?? app/api/`)
ไม่ได้ไล่ไฟล์ข้างใน ทำให้ไฟล์อย่าง `app/api/sync/route.ts` หลุดจากชุด dirty แล้วไปตกที่ branch
ที่อ่าน commit ของไฟล์ที่ยังไม่เคย commit → crash · แก้ด้วย `--untracked-files=all` + fallback

**ค้างไว้**

- ยังไม่ commit — working tree มีฟีเจอร์ streaming sync progress ค้างอยู่ก่อนหน้าแล้ว
  ถ้าจะแยก commit ให้ลงฟีเจอร์นั้นก่อน แล้วค่อยลงชุดนี้ (การ์ดกับโค้ดต้องอยู่ commit เดียวกัน)
- `app/admin/config/page.tsx` อยู่ที่ 449 บรรทัด — ห่างเส้นเตือน 1 บรรทัด ฟีเจอร์ถัดไปที่แตะหน้านี้
  ควรแตกไฟล์ก่อนตามแบบใน §4a
