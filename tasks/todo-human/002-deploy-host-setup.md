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

## วัดซ้ำ 2026-09-22 — ตัวเลขที่ตอบคำถามที่ค้างมาจากรอบก่อน

รอบที่แล้วปิดใบ 014/073/072/080 แล้วถามค้างไว้ว่า *"8 คอมมิตตั้งแต่ f809282 ถึง 6fc9ca7 deploy ลงจริงไหม"*
**คำตอบคือไม่ — และไม่ใช่แค่ 8 ใบนั้น**:

| วัดอะไร | ค่า |
|---|---|
| HEAD บนเครื่อง (`/root/app/lim/darin-backend`) | `106cbe8` ลงวันที่ **2026-07-29** |
| HEAD ของ `develop` วันนี้ | `a0f2549` (2026-09-22) |
| ห่างกัน | **107 คอมมิต** |
| คอนเทนเนอร์ | `db` กับ `app` `Up 4 days` — ไม่มีอะไร build ใหม่ |
| เว็บ | ตอบ `307` ปกติ ⇒ **ของที่คนเห็นอยู่คือโค้ดเดือนกรกฎาคม** |

⇒ ข้อ 1 ข้างล่างยังเป็นสาเหตุเดิมทุกตัวอักษร (เครื่องอยู่คนละ branch + CI ยังไม่มี `DEPLOY_SSH_KEY`)
🔴 **`git push origin develop` สำเร็จไม่ได้แปลว่า deploy ลง** — CLAUDE.md §6 เขียนไว้ว่า
*"push-to-develop = dev deploy is already live"* ซึ่ง **ไม่จริงบนเครื่องนี้มาสองเดือนแล้ว**
⚠️ agent แก้เองไม่ได้ (classifier บล็อก Remote Shell Writes) และไม่ควรแก้ด้วย: `docker compose up -d
--build` จากสภาพนี้จะพา 107 คอมมิตของ schema ผ่าน `prisma db push` ซึ่ง §2 rule 8 บอกว่าย้อนไม่ได้

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

## Back up `pgdata` before the first working deploy (added 2026-09-18, task 009)

The `migrate` service in `docker-compose.yml` runs `prisma db push` automatically on every
`docker compose up -d --build`, against the persistent `pgdata` volume. §2 rule 8: that has no
migration files and no down path.

Nothing has been at risk so far **because this workflow has never once run** — the repo still has no
`DEPLOY_SSH_KEY` secret, so every push to `develop` fails at the ssh step and the host's database has
never been touched by CI. The day the secret is added, that stops being true in the same minute.

- Take a dump of `pgdata` **before** the first deploy that actually lands, not after.
- Measured on the host 2026-09-18: 21 payslips, all `draft`. Small enough that a dump costs seconds.
- Task 009's own schema change is additive only (`CREATE TABLE PayslipWarning` + FK + one unique
  index, no `ALTER`/`DROP`), so it needs no `--accept-data-loss` and loses nothing — the backup is
  for the general case, not for that commit.
- 🔴 Task 009 also has a **required post-deploy step**: run payroll once per open period so the 21
  existing draft payslips get their warnings backfilled. Do it before approving anything.

## One-off check on the live database before the first landing deploy (added 2026-09-20, task 040)

Two `SheetSource` rows sharing one `sheetName` (different `spreadsheetId`) make `lib/sync.ts` write
the same คาบ twice under two `sourceId`s — 40 คาบ paid as 16,000 ฿ instead of 8,000 ฿, both rows
`status: "ok"`, `warnings: []`, and nothing in the repo looks for the pair. The route that created
one is closed as of task 040, but a database that already carries a pair keeps it forever.

```sql
SELECT "sheetName" FROM "SheetSource" GROUP BY 1 HAVING count(*) > 1;
```

- Run it **from inside the container that already holds the credentials** —
  `docker compose exec -T db psql …` — never by composing a command from `.env` on the host
  (CLAUDE.md §6, "Secrets during testing").
- Expected: **no rows.** Anything returned is resolved by hand (decide which id is current, and
  what happens to the `TeachSession` rows under the stale one) *before* the deploy, and before
  [047](../todo/047-sheetsource-unique-key-permits-two-rows-for-one-sheet-name.md) can consider a
  unique key on `sheetName` — a unique constraint added over an existing duplicate **fails the
  `db push`**, which fails `migrate`, which stops `app` from starting at all.

## Notes

- ตรวจว่า deploy ลงจริงอย่างไร: [.docs/knowledge/ops/deploy.md](../../.docs/knowledge/ops/deploy.md)
  หัวข้อ "HEAD ตรงไม่ได้แปลว่า deploy แล้ว"
- พอทำครบแล้ว ย้ายใบนี้กลับด้วย `bash scripts/task-move.sh 002 --answered` แล้วปิดที่ `done/`
