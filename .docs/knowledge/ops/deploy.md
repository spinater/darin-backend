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

## กระบวนการ

**push develop = dev deploy ลงแล้ว** — `.github/workflows/deploy-dev.yml` ยิงตอน `push: branches: [develop]`
แล้ว ssh เข้าเครื่องไปเรียกสคริปต์ที่อยู่ **นอกรีโป** (`git pull` + `docker compose up -d --build`)
ลำดับคือ **เกตเขียว → commit → push → ยืนยันว่า deploy ลงจริง** (CLAUDE.md §6)

⚠️ **ยังไม่ครบสายจนกว่าจะปิดใบ [002](../../../tasks/todo-human/002-deploy-host-setup.md)** — วันนี้
ยังไม่มี `/root/app/deploy-darin.sh`, ไม่มีกุญแจใน `authorized_keys`, ไม่มี secret `DEPLOY_SSH_KEY`
⇒ workflow ยิงแล้วล้มที่ ssh · **ของที่วิ่งอยู่ตอนนี้ถูก deploy ด้วยมือ**
⚠️ **`verify.sh` ยังไม่อยู่ใน CI** ⇒ เกตบนเครื่องคือเกตเดียวที่มี

## กับดักที่กัดจริง

- 🔴 **working copy บนเครื่องอยู่คนละ branch กับ develop** (วัด 2026-09-17: `feat/sync-progress-ui`
  และมี **2 คอมมิตที่ไม่เคย push** + `docker-compose.yml` แก้ค้างไว้ที่ใส่ `mem_limit`) ⇒ สคริปต์
  deploy ที่ `git pull --ff-only` จะล้มทันที และการ "แก้ให้ผ่าน" แบบผิดวิธีจะกลืนงานนั้นหาย
  **ต้องเคลียร์เรื่องนี้ก่อนเปิด deploy อัตโนมัติ**
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
