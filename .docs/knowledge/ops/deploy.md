---
sources:
  - docker-compose.yml
  - Dockerfile
  - .github/workflows/deploy-dev.yml
  - nginx/local.conf
---

# Deploy & environment (dev)

## ปลายทางเดียวตอนนี้: `https://darin-dev.rocketlabth.com`

เครื่องเดียวกับ groove-clinic — **157.85.104.171** · คนละ compose project คนละ vhost
edge nginx ของเครื่อง (`/root/app/nginx`, **นอกรีโปนี้**) เป็นตัวพร็อกซี · working copy ที่ compose
รันอยู่จริงคือ `/root/app/lim/darin-payroll-system`

| ของ | ค่า |
|---|---|
| vhost | `darin-dev.rocketlabth.com` (ลึก 2 ชั้น — Universal SSL ของ CF ครอบ wildcard ชั้นเดียว) |
| พอร์ตที่ publish | `127.0.0.1:30300` → `app:3000` (ตั้งด้วย `APP_PORT` ใน `.env` ของเครื่อง) |
| db | **ไม่ publish port เลย** — เข้าถึงได้เฉพาะจากใน compose network |
| service | `db` (Postgres 18) · `migrate` (รันครั้งเดียวแล้วจบ) · `app` (Next.js standalone บน Node) |

## กระบวนการ

**push develop = dev deploy ลงแล้ว** — `.github/workflows/deploy-dev.yml` ยิงตอน `push: branches: [develop]`
แล้ว ssh เข้าเครื่องคลาวด์ไป `git pull` + `docker compose up -d --build`
ลำดับคือ **เกตเขียว → commit → push → ยืนยันว่า deploy ลงจริง** (CLAUDE.md §6)

⚠️ **`verify.sh` ยังไม่อยู่ใน CI** — develop วันนี้ deploy โดยไม่มีเกตขวางหน้า ⇒ **เกตบนเครื่องคือเกตเดียวที่มี**

## กับดักที่กัดจริง

- 🔴 **"HEAD บนเซิร์ฟเวอร์ตรง" ไม่ได้แปลว่า deploy แล้ว** — `git pull` จบก่อน `docker compose up -d --build`
  เสมอ ⇒ HEAD ตรงได้ตั้งแต่ตอนที่คอนเทนเนอร์ยังเป็นตัวเก่าและ build ยังวิ่งอยู่ · ต้องดูสามอย่าง:
  `git rev-parse --short HEAD` ตรง · ไม่มี `docker compose up` ค้างอยู่ · `app` เพิ่งขึ้นใหม่และเปิดหน้าได้
  (ยกเว้นคอมมิตที่ไม่แตะของที่เข้าอิมเมจ ⇒ image id เดิม ⇒ ไม่ restart คือถูกต้อง)
- 🔴 **`migrate` ใช้ `prisma db push` ไม่ใช่ migration ที่มีประวัติ** — schema ที่เปลี่ยนแบบทำลายข้อมูล
  จะถูก push ลงฐานจริงโดยไม่มีไฟล์ให้ย้อน · ตราบใดที่ยังเป็น `db push` ให้ถือว่า **การแก้ schema
  คือการแก้ที่กลับไม่ได้** และสำรองก่อนเสมอ (ใบที่จะย้ายไป `prisma migrate` ยังไม่ถูกเปิด)
- 🔴 **Cloudflare อยู่หน้า origin แบบ Flexible SSL** (โซน `rocketlabth.com` ทั้งโซน) ⇒ **origin เห็น
  request เป็น http เสมอ** · ห้ามรันสคริปต์เปิด TLS ที่ origin กับโดเมนโซนนี้ — มันทำให้เกิด redirect loop
  · คุกกี้ session ตั้ง `secure` เมื่อ `NODE_ENV=production` (`lib/auth.ts`) ซึ่ง **ใช้ได้ผ่านโดเมนจริง**
  เพราะเบราว์เซอร์คุยกับ CF เป็น https — แต่ยิงเข้า origin ตรง ๆ ด้วย http แล้ว **ล็อกอินไม่ติดโดยไม่มี
  ข้อความอธิบายสักบรรทัด** ⇒ ทดสอบผ่านโดเมนเสมอ
- **ห้ามแก้ nginx conf จากรีโปนี้** — `nginx/local.conf` เป็นของจำลองสำหรับเครื่อง dev เท่านั้น
- **`POSTGRES_PASSWORD` ไม่มีค่า default** — compose จะไม่ขึ้นเลยถ้าไม่ตั้ง (ตั้งใจ)
- **ห้ามอ่านค่าจาก `.env` มาประกอบคำสั่งบนโฮสต์** (`grep … .env | curl …`) — ความลับจะไปโผล่ใน shell log
  · ต้องยิง endpoint ที่ใช้รหัสให้รันจากในคอนเทนเนอร์ที่ถือ env นั้นอยู่แล้ว:
  `docker compose exec -T app sh -c '…'`

## สิ่งที่ยังต้องมีคนลงมือบนเครื่อง (ไม่ใช่งานของ agent)

ดู [tasks/todo-human/002-deploy-host-setup.md](../../../tasks/todo-human/002-deploy-host-setup.md) —
DNS · vhost · `/root/app/deploy-darin.sh` · `authorized_keys` ที่ล็อกด้วย `restrict,command="…"` ·
secret `DEPLOY_SSH_KEY` ใน GitHub · `.env` ของเครื่องจริง
