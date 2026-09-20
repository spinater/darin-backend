---
sources:
  - docker-compose.yml
  - Dockerfile
  - .github/workflows/deploy-dev.yml
  - nginx/local.conf
  # What the `migrate` service actually runs. Task 040 made its behaviour depend on the database it
  # finds, and the three modes below are claims about this file — a seed that starts writing on a
  # database it did not create must land here as STALE, not pass under a card still promising
  # "fixture withheld". The decision itself and its money half: `.docs/knowledge/domain/teach-rate-lookup.md`.
  - prisma/seed.ts
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

## What `migrate` does to a database that is already in use (task 040)

`migrate` is `prisma db push && bun run prisma/seed.ts`, and it runs on **every** deploy. Until task
040 the seed re-asserted the whole reference fixture each time, so a deploy silently undid owner
decisions — a deleted teach rate came back and paid, a re-pointed `TrainerAlias` was pushed back, a
corrected `spreadsheetId` produced a **second** `SheetSource` row for the same sheet name. The seed
now decides **once, before any write**, which of three databases it is looking at:

| Evidence | Mode | What it writes |
|---|---|---|
| no `SeedMark` row · `Staff.count() === 0` | `initialize` | the full fixture, then the mark **last** |
| no `SeedMark` row · staff exist | `adopt` | the mark, and no reference data — this host, exactly once |
| `SeedMark` row exists | `already-initialized` | missing `CONFIG_DEFAULTS` keys only |

- **This host's first post-fix deploy is `adopt`**: `db push` creates `SeedMark` empty, the staff
  rows are already there, all 18 config keys already exist ⇒ **no reference data written · 18
  `note` refreshes · one new row**. The `note` refresh is an `UPDATE` over every
  `CONFIG_DEFAULTS` key and runs in **every** mode: `note` is code-owned (it renders as a `<span>`,
  never an input, so there is no owner edit of it to overwrite), `PayrollConfig` has no
  `updatedAt`, and no `value` is in that update. It is not "zero writes", and this card is about
  being exact on what a deploy writes to a live database.
  Net footprint in reference data on the live database: **one row in one new table.**
- 🔴 **No branch of this policy may exit non-zero.** `app` has
  `depends_on: migrate: condition: service_completed_successfully` ⇒ a seed that refuses to start
  takes the **whole site** down on deploy. The policy is enforced by withholding writes and printing
  what it withheld, never by failing. (A real `db push` mismatch must still fail loudly — do not
  give `main()` a blanket `.catch()` to "make this safe".)
- **Read the deploy log for the last line**: `seed: mode=<mode> created=<n>`. `created=0` on a
  redeploy is the correct and expected reading. The same line is what `scripts/check-code.sh` greps
  out of a **second** seed run on the throwaway Postgres every gate round.
- ⚠️ **`OWNER_PASSWORD` now only matters on an `initialize` run** — the owner row is planted on that
  branch alone, so a value passed to `migrate` on any later deploy is read and ignored.
- 🔴 **A crashed first boot is re-attempted, with one hole that is not closable.** Whether the next
  run re-plants is decided by `Staff.count()`, not by the mark, so the `Staff` + `TrainerAlias`
  block is one `db.$transaction`, written after every other fixture table: the count reads **0**
  (nothing committed ⇒ the whole fixture is re-attempted over upserts on unique keys) or **7**
  (committed over a complete fixture ⇒ the retry adopts, and nothing is missing). What survives is
  a crash **between that commit and the line that prints the generated owner password**: the owner
  row then exists holding a credential nobody ever saw, the next run reads `adopt` and will not
  print it, and nobody can log in to `/admin/config`. Printing before the commit would hand out a
  password for a run that may roll back, so the fix is operational, not structural — **pass
  `OWNER_PASSWORD` to `migrate`** and the window costs nothing. The database is `prisma db push`
  with no down path (§2 rule 8), so the repair for a boot that lands in it is a restore, not a
  re-run.
- ⚠️ **`SeedMark.mode` can read `adopted` on a database this seed actually planted** — the same
  crash window seen from the audit trail: the run that planted the fixture died before writing the
  mark, and the next run counts 7 staff and records `adopted`. The column is informational (nothing
  reads it), but do not take it as evidence that the fixture arrived from somewhere else.

## เครื่องของ linus (local) — **คนละ compose project กับบนเซิร์ฟเวอร์** (วัด 2026-09-20)

ข้อนี้ไม่เคยถูกบันทึก และมันขัดกับสิ่งที่หัวข้อ "กับดัก" ข้างล่างบอกให้เช็ค:

| | บนเซิร์ฟเวอร์ | บนเครื่อง linus |
|---|---|---|
| compose project | `darin` (จาก `name:`) | **`darin-local`** (รันด้วย `-p darin-local`) |
| คอนเทนเนอร์ | `darin-web` · `darin-pg` | `darin-local-app-1` · `darin-local-db-1` |
| volume | `darin_pgdata` | **`darin-local_pgdata`** — เป็น volume darin ตัวเดียวบนเครื่องนี้ |
| พอร์ต | `127.0.0.1:30100` | `127.0.0.1:30300` |

🔴 **`docker compose up -d` เปล่า ๆ ในรีโปนี้บนเครื่อง linus = สแตกที่สองที่ฐานว่างเปล่า** —
`name: darin` จะชนะ แล้วสร้าง `darin_pgdata` ใหม่ ขณะที่ข้อมูลจริงค้างอยู่ใน
`darin-local_pgdata` โดยไม่มีอะไรแดง ⇒ **บนเครื่อง local ต้องใส่ `-p darin-local` เสมอ**
(บนเซิร์ฟเวอร์ห้ามใส่ — ที่นั่น `darin` คือของจริง)

⚠️ **แอปที่รันอยู่บนเครื่อง linus สร้างเมื่อ 2026-09-17** ⇒ มันไม่มีอะไรที่คอมมิตหลังจากวันนั้น
ถ้ามีใครเปิดดูแล้วบอกว่า "หน้าจอยังเป็นแบบเดิม" นั่นคือเหตุผล ไม่ใช่โค้ดไม่ทำงาน

## ✅ อิมเมจ build ผ่านที่ HEAD — พิสูจน์แล้วครั้งแรก (2026-09-20)

§7 ของ `CLAUDE.md` เขียนไว้ว่า **ไม่มีเกตไหน build `Dockerfile`** ⇒ "เกตเขียว" ไม่เคยแปลว่า
อิมเมจขึ้นได้ · วัดเองรอบนี้: `docker build --target runner .` ที่ b0a6cf0 → **สำเร็จ 414MB**
ทั้ง `bunx --bun prisma generate` และ `bunx next build` ผ่านในอิมเมจจริง

⚠️ `docker compose build` **ล้มก่อนถึง build** ถ้าเชลล์อ่าน `.env` ไม่ได้ — compose interpolate
ทั้งไฟล์ก่อน รวม `POSTGRES_PASSWORD:?` ของ service `db` ที่ไม่ได้จะ build ด้วยซ้ำ
⇒ ถ้าอยากพิสูจน์แค่ว่าอิมเมจขึ้นได้ ใช้ `docker build` ตรง ๆ ไม่ต้องผ่าน compose

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
