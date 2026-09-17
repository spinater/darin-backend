# เปิด deploy อัตโนมัติให้ darin.rocketlabth.com (ของที่เหลืออยู่บนเครื่อง)

- status: todo-human
- commit:

- 🚫 **บล็อกที่คน ไม่ใช่ที่โค้ด** — ทุกข้อข้างล่างอยู่ **นอกรีโป**: ต้องมี root บนเครื่อง
  157.85.104.171 และสิทธิ์ตั้ง secret ใน GitHub repo `spinater/darin-backend`
  · agent เข้าไปอ่านเครื่องได้ (มี permission rule ให้แล้ว) แต่ **เขียนไม่ได้** — classifier
  บล็อก `Remote Shell Writes` ⇒ สั่งให้ agent ทำแทนไม่ได้ ต้องเป็นมือคน

## สถานะวันนี้ (วัดเอง 2026-09-17)

**แอปขึ้นเครื่องแล้วและวิ่งอยู่** ที่ `https://darin.rocketlabth.com` (`<title>Darin Payroll</title>`)
— vhost `/root/app/nginx/conf.d/darin.rocketlabth.com.conf` → `127.0.0.1:30100`,
working copy `/root/app/lim/darin-backend` · **แต่มันถูก deploy ด้วยมือ ไม่ได้มาจาก CI**

## ต้องทำ

1. 🔴 **เคลียร์สภาพ working copy ก่อนอย่างอื่นทั้งหมด** — ตอนนี้มันอยู่บน branch
   `feat/sync-progress-ui` ไม่ใช่ `develop` และถือของที่ **ไม่เคย push** อยู่:
   - `edf0a11` feat: บอกความคืบหน้า/เวลาที่เหลือตอน sync
   - `106cbe8` chore: agent rules + knowledge layer + verify gate (กติกา **คนละชุด**
     กับที่ใบ 001 พอร์ตมาจาก groove-clinic — ต้องตัดสินว่าจะเอาชุดไหน หรือรวมกันยังไง)
   - `docker-compose.yml` แก้ค้างยังไม่ commit: ใส่ `mem_limit`/`memswap_limit` ให้ db กับ web
     อ้างเหตุการณ์ 2026-08-14 ("กันคอนเทนเนอร์เดียวลากทั้งเครื่องค้าง") — **ของจริงที่ควรเข้ารีโป**
   ⇒ push branch นั้นขึ้น origin ก่อนกันหาย แล้วค่อยตัดสินเรื่อง merge ·
   ⚠️ อย่าเพิ่งเปิด deploy อัตโนมัติจนกว่าข้อนี้จบ: สคริปต์ deploy จะ `git pull --ff-only`
   บน branch ที่ diverge ⇒ ล้ม และการ "แก้ให้ผ่าน" แบบผิดวิธีจะกลืนงานสองคอมมิตนั้นหาย
2. **`/root/app/deploy-darin.sh`** (อยู่ **นอก** working copy — `git pull` เขียนทับสคริปต์ตัวเองกลางคันไม่ได้):
   `cd /root/app/lim/darin-backend && git pull --ff-only && docker compose up -d --build`
3. **กุญแจ**: สร้างคู่ ed25519 ใหม่ (อย่าใช้ซ้ำกับของ groove) แล้วใส่ public key ลง
   `/root/.ssh/authorized_keys` โดย **ล็อกด้วย** `restrict,command="/root/app/deploy-darin.sh"`
   ⇒ secret หลุดก็สั่งได้แค่ redeploy ไม่ได้ shell
4. **GitHub secret**: `DEPLOY_SSH_KEY` = private key ของคู่ข้อ 3 (repo `spinater/darin-backend`)
5. **`.env` บนเครื่อง**: ยืนยันว่ามี `APP_PORT=30100` (ผังพอร์ตของเครื่องจอง 30100–30199 ให้แอปนี้
   — ดู `/root/app/nginx/README.md`) · `POSTGRES_PASSWORD` · `GOOGLE_SHEET_LINK`

## ค้างอยู่อีกสองเรื่องบนเครื่อง (คนละเรื่องกับ deploy แต่เจอพร้อมกัน)

6. **ลบ DNS `darin-dev.rocketlabth.com` ที่ Cloudflare** — เลิกใช้แล้ว (linus 2026-09-17)
7. ~~**ปิดรู catch-all ของ edge nginx**~~ ✅ **ทำแล้ว 2026-09-17** —
   `/root/app/nginx/conf.d/00-default-catchall.conf` (80 → `return 444` · 443 →
   `ssl_reject_handshake on`) · `nginx -t` ผ่าน · reload แล้ว
   **วัดหลัง reload ทั้งจาก origin และผ่าน Cloudflare:**

   | Host | ก่อน | หลัง |
   |---|---|---|
   | `darin-dev.rocketlabth.com` | 200 Franchise Management | origin ปิดการเชื่อมต่อ · CF ตอบ 520 |
   | ชื่อที่ไม่มีใครรับ (ทดสอบด้วยชื่อมั่ว) | 200 Franchise Management | origin ปิดการเชื่อมต่อ |
   | `darin.rocketlabth.com` | 200 Darin Payroll | **เท่าเดิม** |
   | `franchise` / `api-franchise` | 200 Franchise Management | **เท่าเดิม** |
   | `groove-dev` · `dockerhand` | ปกติ | **เท่าเดิม** |

   ⚠️ **ห้ามมีบล็อกอื่นประกาศ `default_server` ซ้ำบนพอร์ตเดียวกัน** — nginx จะไม่ยอมโหลด
   · เหตุผลเต็มอยู่ในหัวไฟล์นั้น (ไฟล์อยู่นอกรีโป ⇒ อ่านที่เครื่อง)

## Notes

- ตรวจว่า deploy ลงจริงอย่างไร: [.docs/knowledge/ops/deploy.md](../../.docs/knowledge/ops/deploy.md)
  หัวข้อ "HEAD ตรงไม่ได้แปลว่า deploy แล้ว"
- พอทำครบแล้ว ย้ายใบนี้กลับด้วย `bash scripts/task-move.sh 002 --answered` แล้วปิดที่ `done/`
