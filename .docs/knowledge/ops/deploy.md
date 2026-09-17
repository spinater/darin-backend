---
sources:
  - docker-compose.yml
  - Dockerfile
  - .github/workflows/deploy-dev.yml
  - nginx/local.conf
---

# Deploy & environment

## ปลายทางเดียว: `https://darin.rocketlabth.com` — **ขึ้นอยู่แล้วและวิ่งอยู่จริง**

เครื่อง **157.85.104.171** (ตัวเดียวกับ groove-clinic และ franchise-management — คนละ compose
project คนละ vhost) · ตรวจสดเมื่อ 2026-09-17: `/login` ตอบ 200 `<title>Darin Payroll</title>`

| ของ | ค่า |
|---|---|
| vhost | `/root/app/nginx/conf.d/darin.rocketlabth.com.conf` (**นอกรีโปนี้**) |
| upstream | `127.0.0.1:30100` |
| working copy บนเครื่อง | `/root/app/lim/darin-backend` |
| ช่วงพอร์ตที่จองไว้ให้แอปนี้ | **30100–30199** (30100 = web) — ผังอยู่ที่ `/root/app/nginx/README.md` |
| db | ไม่ publish port เลย — ถึงได้เฉพาะจากใน compose network |
| edge | คอนเทนเนอร์ `edge-nginx` (nginx:alpine, `network_mode: host`) · `conf.d` bind-mount แบบ ro |

🔴 **`darin-dev.rocketlabth.com` ไม่ใช้แล้ว** (linus 2026-09-17) — ชื่อนั้นมี DNS ชี้มาที่ origin
แต่ไม่เคยมี vhost ⇒ ตกไปที่ server block แรกตามลำดับไฟล์ (`api-franchise…`) แล้วโผล่หน้า
**Franchise Management** · ห้ามเข้าใจว่า darin เคย deploy ผิดที่ — มันไม่เคยถูก deploy ไปที่ชื่อนั้นเลย
· **ปิดรูนั้นแล้ววันเดียวกัน**: เครื่องมี `conf.d/00-default-catchall.conf` (80 → `return 444`,
443 → `ssl_reject_handshake on`) ⇒ Host ที่ไม่มีใครรับจะไม่ไปโผล่แอปของคนอื่นอีก
(ก่อนหน้านั้นใครชี้โดเมนอะไรมาที่ IP นี้ ก็ได้ UI ของ franchise ฟรี ๆ) · DNS ของ `darin-dev`
ยังค้างอยู่ที่ Cloudflare รอลบ — ใบ [002](../../../tasks/todo-human/002-deploy-host-setup.md) ข้อ 6

## กระบวนการ

**push develop = dev deploy ลงแล้ว** — `.github/workflows/deploy-dev.yml` ยิงตอน `push: branches: [develop]`
แล้ว ssh เข้าเครื่องไปเรียกสคริปต์ที่อยู่ **นอกรีโป** (`git pull` + `docker compose up -d --build`)
ลำดับคือ **เกตเขียว → commit → push → ยืนยันว่า deploy ลงจริง** (CLAUDE.md §6)

⚠️ **ยังไม่ครบสายจนกว่าจะปิดใบ [002](../../../tasks/todo-human/002-deploy-host-setup.md)** — วันนี้
ยังไม่มี `/root/app/deploy-darin.sh`, ไม่มีกุญแจใน `authorized_keys`, ไม่มี secret `DEPLOY_SSH_KEY`
⇒ workflow ยิงแล้วล้มที่ ssh · **ของที่วิ่งอยู่ตอนนี้ถูก deploy ด้วยมือ**
⚠️ **`verify.sh` ยังไม่อยู่ใน CI** ⇒ เกตบนเครื่องคือเกตเดียวที่มี

## กับดักที่กัดจริง

- 🔴 **`name: darin` ใน `docker-compose.yml` ห้ามหาย** — compose หาชื่อโปรเจกต์ตามลำดับ
  `-p` > `COMPOSE_PROJECT_NAME` > `name:` > **ชื่อไดเรกทอรี** · working copy บนเครื่องคือ
  `/root/app/lim/darin-backend` และ `.env` ไม่มี `COMPOSE_PROJECT_NAME` (วัด 2026-09-17)
  ⇒ บรรทัดนี้หายเมื่อไร รอบ deploy ถัดไปรันเป็นโปรเจกต์ `darin-backend` สร้าง volume
  `darin-backend_pgdata` ใหม่ แล้ว seed ลง**ฐานเปล่า** ขณะที่ `darin_pgdata` ของจริงค้างอยู่
  · อาการที่เห็นก่อนคือ bind `127.0.0.1:30100` ไม่ได้เพราะ `darin-web` ตัวเก่ายังถือพอร์ตอยู่
  — และวิธีแก้ที่คนมักคว้าก่อน ("ดับตัวเก่าแล้วขึ้นใหม่") พาไปลงฐานเปล่าพอดี
  · **ของจริงวันนี้:** `docker compose ls` → `darin` · `docker volume ls` → `darin_pgdata`
  · เช็คก่อน deploy ทุกครั้งที่ไฟล์นี้ถูกแก้: `docker compose config --format json | jq .name`
- 🔴 **`OWNER_PASSWORD` ต้องถูกส่งเข้า service `migrate`** — `prisma/seed.ts` อ่านตัวนี้ และ
  `.env.example`/`README.md` บอกให้ตั้ง · ถ้าไม่ส่งเข้า container ค่าที่ตั้งไว้จะเงียบหาย
  แล้ว seed สุ่มรหัสให้แทน โดยไม่มีอะไรแดง
- 🔴 **working copy บนเครื่องยังอยู่คนละ branch กับ develop** (วัด 2026-09-17:
  `feat/sync-progress-ui` + `docker-compose.yml` แก้ค้าง) ⇒ `git pull --ff-only` จะล้ม
  · **2 คอมมิตที่เคยไม่ได้ push ตอนนี้อยู่บน origin แล้ว** และเนื้อ `mem_limit`/`memswap_limit`
  เข้ารีโปแล้ว ⇒ `git checkout -- docker-compose.yml` บนเครื่องปลอดภัยแล้ว (ก่อนหน้านี้ไม่ใช่)
  **ยังต้องเคลียร์ข้อนี้ก่อนเปิด deploy อัตโนมัติ**
- 🔴 **"HEAD บนเซิร์ฟเวอร์ตรง" ไม่ได้แปลว่า deploy แล้ว** — `git pull` จบก่อน `docker compose up -d --build`
  เสมอ ⇒ ต้องดูสามอย่าง: HEAD ตรง · ไม่มี `docker compose up` ค้าง · คอนเทนเนอร์ web เพิ่งขึ้นใหม่
  และเปิดหน้าได้ (คอมมิตที่ไม่แตะของที่เข้าอิมเมจ ⇒ image id เดิม ⇒ ไม่ restart คือถูกต้อง)
- 🔴 **`migrate` ใช้ `prisma db push` ไม่ใช่ migration ที่มีประวัติ** ⇒ schema ที่เปลี่ยนแบบทำลายข้อมูล
  ถูก push ลงฐานจริงโดยไม่มีไฟล์ให้ย้อน — ถือว่าการแก้ schema คือการแก้ที่กลับไม่ได้ สำรองก่อนเสมอ
- **โซน `rocketlabth.com` อยู่หลัง Cloudflare** — `/root/app/nginx/README.md` ระบุว่า SSL mode
  **Flexible** (ก.ค. 2026) ⇒ CF ต่อ origin ทาง **port 80** เสมอ · vhost ของ darin จึง redirect เฉพาะ
  visitor ที่มาแบบ http จริง (ดูจาก `X-Forwarded-Proto`) ไม่งั้นจะ redirect วนไม่รู้จบ
  · origin มี cert Let's Encrypt และมี block 443 พร้อมอยู่แล้ว ถ้าวันหนึ่งย้ายโซนเป็น Full (strict)
- **ตั้งชื่อ vhost ใหม่ให้ลึกแค่ 2 ชั้นเสมอ** — Universal SSL ของ CF ครอบ wildcard ชั้นเดียว
- **`POSTGRES_PASSWORD` ไม่มีค่า default** — compose ไม่ขึ้นเลยถ้าไม่ตั้ง (ตั้งใจ)
- **ห้ามอ่านค่าจาก `.env` มาประกอบคำสั่งบนโฮสต์** — ความลับจะไปโผล่ใน shell log · ยิง endpoint
  ที่ใช้รหัสให้รันจากในคอนเทนเนอร์ที่ถือ env นั้นอยู่แล้ว: `docker compose exec -T app sh -c '…'`
- **ห้ามแก้ nginx conf จากรีโปนี้** — `nginx/local.conf` เป็นของจำลองสำหรับเครื่อง dev เท่านั้น
