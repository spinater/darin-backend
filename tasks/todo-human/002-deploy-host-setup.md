# ตั้งค่าเครื่องคลาวด์ให้ deploy อัตโนมัติได้ (darin-dev.rocketlabth.com)

- status: todo-human
- commit:

- 🚫 **บล็อกที่คน ไม่ใช่ที่โค้ด** — ทุกข้อข้างล่างอยู่ **นอกรีโป**: ต้องมี root บนเครื่อง
  157.85.104.171, สิทธิ์แก้ DNS โซน `rocketlabth.com`, และสิทธิ์ตั้ง secret ใน GitHub repo
  `spinater/darin-backend` · agent ทำให้จบเองไม่ได้ไม่ว่าจะเก่งแค่ไหน

## Goal

ให้ `push origin develop` แล้ว deploy ลงเครื่องเองตาม `.github/workflows/deploy-dev.yml`
ซึ่งคอมมิตนี้เพิ่มเข้ามาแล้ว แต่ตอนนี้มันจะล้มเพราะฝั่งเครื่องยังไม่มีอะไรรออยู่

## ต้องทำบนเครื่อง (ทำแบบเดียวกับ groove-clinic เป๊ะ — ของที่มีอยู่แล้วใช้ซ้ำได้)

1. **DNS**: ✅ **มีแล้ว** (วัดจากภายนอก 2026-09-17: `darin-dev.rocketlabth.com` ตอบ HTTP 200)
   ⚠️ **แต่มันตอบด้วยแอปอื่น** — หน้าที่ได้คือ `Franchise Management` (`franchise.rocketlabth.com`)
   🔑 **ไม่ใช่โดเมนชนกัน**: nginx เลือก server block จากเฮดเดอร์ `Host` · ไม่มี block ไหนชื่อ
   `darin-dev` ⇒ ตกไปที่ `default_server` ซึ่งบนเครื่องนั้นคือ Franchise ⇒ **สิ่งที่ขาดคือข้อ 4**
   (ตัวโดเมนเองถูกต้องแล้ว · ชื่อลึก 2 ชั้นตรงเงื่อนไข Universal SSL ของ CF)
2. **working copy**: `git clone` รีโปนี้ไว้ที่ `/root/app/lim/darin-payroll-system` branch `develop`
3. **`.env` ของเครื่องจริง** (ไม่เข้า git): `POSTGRES_PASSWORD` (สุ่ม), `APP_PORT=30300`,
   `GOOGLE_SHEET_LINK`, และ `OWNER_PASSWORD` ถ้าไม่อยากให้สุ่ม
4. **vhost** ← **นี่คือชิ้นที่ขาดอยู่จริง ๆ วันนี้**:
   `/root/app/nginx/conf.d/darin-dev.rocketlabth.com.conf` · ก๊อปได้ตรง ๆ:

   ```nginx
   server {
       listen 80;
       server_name darin-dev.rocketlabth.com;   # ← ชื่อนี้คือสิ่งเดียวที่กัน request ไม่ให้ตกไป default_server

       location / {
           proxy_pass http://127.0.0.1:30300;
           proxy_http_version 1.1;
           proxy_buffering off;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           # CF เป็น Flexible ⇒ origin เห็น http เสมอ · ต้องบอกแอปว่าฝั่งเบราว์เซอร์เป็น https
           proxy_set_header X-Forwarded-Proto https;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

   แล้ว `nginx -t && nginx -s reload` (หรือ reload คอนเทนเนอร์ edge ตามที่เครื่องนั้นใช้)
   ⚠️ **เช็กก่อนว่า `30300` ว่างจริงบนเครื่องนั้น** — เลขนี้เลือกมาให้ไม่ชนชุด 3020x ของ groove
   แต่ยังไม่มีใครยืนยันจากในเครื่อง (ผมเข้าไปดูไม่ได้)
5. **`/root/app/deploy-darin.sh`** (นอกรีโป — `git pull` เขียนทับสคริปต์ตัวเองกลางคันไม่ได้):
   `cd /root/app/lim/darin-payroll-system && git pull --ff-only && docker compose up -d --build`
6. **กุญแจ**: สร้างคู่ ed25519 ใหม่ (อย่าใช้ซ้ำกับของ groove) แล้วใส่ public key ลง
   `/root/.ssh/authorized_keys` โดย **ล็อกด้วย** `restrict,command="/root/app/deploy-darin.sh"`
   ⇒ secret หลุดก็สั่งได้แค่ redeploy ไม่ได้ shell
7. **GitHub secret**: `DEPLOY_SSH_KEY` = private key ของคู่ข้อ 6 (repo `spinater/darin-backend`)

## Notes

- host key ที่ workflow ปักหมุดไว้เป็นของเครื่องเดียวกับ groove ⇒ ไม่ต้องเปลี่ยน
- ตรวจว่าลงจริงอย่างไร: ดู [.docs/knowledge/ops/deploy.md](../../.docs/knowledge/ops/deploy.md)
  หัวข้อ "HEAD ตรงไม่ได้แปลว่า deploy แล้ว"
- พอทำครบแล้ว ย้ายใบนี้กลับด้วย `bash scripts/task-move.sh 002 --answered` แล้วปิดที่ `done/`
