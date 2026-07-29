# Darin Payroll

ระบบคิดเงินเดือน Darin Pool & Fitness — Bun + Next.js + Postgres
ข้อกำหนดฉบับเต็มอยู่ที่ [REQUIREMENTS.md](REQUIREMENTS.md) · กฎการจ่ายต้นฉบับ [darin-payroll-system.md](darin-payroll-system.md)

## เริ่มใช้งาน

```bash
bun install
createdb darin_payroll                       # หรือชี้ DATABASE_URL ไปที่ Postgres ที่มีอยู่
bunx --bun prisma db push
bun run prisma/seed.ts                       # ← จดรหัส owner ที่พิมพ์ออกมา (แสดงครั้งเดียว)
bun run dev                                  # http://localhost:3000
bun test                                     # 48 tests
```

> คำสั่ง `prisma` ต้องใช้ `bunx --bun` เพื่อให้โหลด `.env` เข้า `prisma.config.ts`
> ส่วนตัวแอปรันบน **Node** (Next.js เป็นคนเลือก) — โค้ดจึงห้ามใช้ `Bun.*` มี test คุมไว้แล้ว

## ต่อ Google Sheet

ระบบเลือกวิธีอ่านให้เองตามที่ตั้งไว้ใน `.env`:

**แบบที่ 1 — ไม่ต้องใช้ credential (ใช้อยู่ตอนนี้)**
ชีตแชร์แบบ "ทุกคนที่มีลิงก์ดูได้" อยู่แล้ว ระบบโหลดผ่าน export endpoint ตรง ๆ
```
GOOGLE_SHEET_LINK="https://docs.google.com/spreadsheets/d/<id>/edit"
```
ได้ครบทั้ง **date serial + สีพื้นเซลล์** · ใช้เวลา ~8 วินาทีต่อรอบ
> ⚠️ แลกมาด้วยการที่ชีต (ชื่อ+เบอร์ลูกค้า) ใครมีลิงก์ก็เปิดดูได้

**แบบที่ 2 — Service Account (แนะนำถ้าจะปิดชีตไม่ให้สาธารณะ)**
1. Google Cloud Console → เปิด **Google Sheets API** → สร้าง **Service Account** → JSON key
2. ใส่ใน `.env` แล้วระบบจะสลับไปใช้ API เอง (ได้ note ในเซลล์เพิ่มมาด้วย):
   ```
   GOOGLE_SA_EMAIL=xxx@yyy.iam.gserviceaccount.com
   GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
3. แชร์ชีตให้อีเมล service account สิทธิ์ **Viewer** แล้วปิดการแชร์สาธารณะได้

> ❌ **OAuth client ID/secret ใช้ไม่ได้กับงานนี้** — เป็น flow ที่ต้องมีคนกดยินยอมในเบราว์เซอร์
> เพื่อแลก refresh token ไม่ใช่ server-to-server · ลบ `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` ทิ้งได้

ทดสอบแบบ offline: ใส่ path ไฟล์ `.xlsx` ในหน้า `/sync`

> ⚠️ **ห้ามใช้ `.csv`** Google export CSV ทำปีหาย (serial `45405` → `"23/4"`)
> ข้อมูลคร่อม 2024–2026 จึงแยกปีไม่ออก · โค้ดใช้ `spreadsheets.get?includeGridData=true`
> ที่คืน serial + สีพื้น + note ครบ

### ความคืบหน้าตอน sync (ผู้ใช้เห็นอะไรบ้าง)

sync ใช้เวลาราว 15–20 วินาที นานเกินกว่าจะปล่อยให้หน้าจอเงียบ หน้า `/sync` จึงยิงไป
`POST /api/sync` ที่ทยอย **stream ความคืบหน้ากลับมาเป็น NDJSON บรรทัดละ event**
(`lib/sync.ts` รับ callback `onProgress`) แล้วแสดงเป็น 2 ช่วงตามงานจริง:

| ช่วง | ที่ผู้ใช้เห็น | ประมาณเวลาจาก |
|---|---|---|
| `fetch` — ดาวน์โหลดจาก Google | วงหมุน + แถบวิ่งไปมา (ยังบอก % ไม่ได้ รอเน็ตอยู่) | เวลาช่วง fetch ของรอบที่แล้ว |
| `process` — เขียนลง DB | ชื่อชีต, ชีตที่ n/ทั้งหมด, แถบ %, `x / y รายการ` | ความเร็วที่วัดได้จริงในรอบนั้นเอง |

เวลาที่บอกทุกจุดมาจากการวัดจริง ไม่มีตัวเลข hardcode:

- `SyncRun` เก็บ `fetchMs` / `processMs` / `units` ทุกรอบ → หน้า `/sync` เอารอบที่สำเร็จ
  ล่าสุดมาขึ้นว่า "รอบที่แล้วใช้เวลา … วินาที" ตั้งแต่ก่อนกด (รอบที่ error ไม่ถูกนับ
  เพราะมันจบเร็วผิดปกติแล้วจะทำให้ประมาณต่ำเกินจริง)
- `JobDuration` เก็บเวลาล่าสุดของงานหนักอื่น (`payroll`, `config-save`, `ot-import`)
  ผ่าน `timed()` ใน `lib/job-timing.ts` → `<ActionProgress>` เอาไปนับถอยหลังข้างปุ่ม

`<ActionProgress>` จะ**เงียบเองถ้างานเร็วกว่า 1.5 วินาที** และโผล่มาเองเมื่อข้อมูลโต
จนเริ่มช้า — ไม่ต้องมีใครกลับมาแก้ตัวเลขในโค้ด

ปุ่ม submit ทุกหน้าใช้ `<SubmitButton>` (`useFormStatus`) — ขึ้นวงหมุน เปลี่ยนข้อความ
และ **disable ตัวเองกันกดซ้ำ** ซึ่งสำคัญกับหน้ายอดขาย/OT ที่กดซ้ำ = ได้ข้อมูลซ้ำ

> ⚠️ ถ้าวันหลังย้าย reverse proxy หรือเปลี่ยน CDN ต้องเช็คว่ามันไม่ buffer response:
> ถ้า buffer ผู้ใช้จะเห็นวงหมุนค้างแล้วผลโผล่มาทีเดียวตอนจบ · ฝั่งเรากัน 2 ชั้นแล้วคือ
> `X-Accel-Buffering: no` + `Cache-Control: no-transform` และ `proxy_buffering off` ใน vhost

## Deploy บน server (docker compose)

```bash
cp .env.example .env      # ตั้ง POSTGRES_PASSWORD และ GOOGLE_SHEET_LINK อย่างน้อย
docker compose up -d --build
```

| service | ทำอะไร |
|---|---|
| `db` | Postgres 18 · เก็บลง volume `pgdata` · **ไม่ publish port ออกนอก** |
| `migrate` | รันครั้งเดียวตอนขึ้นระบบ: `prisma db push` + seed แล้วจบ |
| `app` | Next.js standalone บน Node · เปิดที่ `${APP_PORT:-3000}` |

`app` รอ `migrate` เสร็จก่อนเสมอ (`service_completed_successfully`) → deploy ใหม่ไม่ต้องสั่ง migrate เอง

```bash
docker compose logs -f app          # ดู log
docker compose exec db psql -U darin darin_payroll   # เข้า DB
docker compose down                 # หยุด (ข้อมูลอยู่ใน volume ไม่หาย)
```

**บัญชีผู้ใช้:** มีคนเดียวคือ `owner` — รหัสสุ่มตอน seed พิมพ์ใน log ครั้งเดียว
(กำหนดเองได้ด้วย `OWNER_PASSWORD` ใน `.env`) เปลี่ยนภายหลังที่หน้า **บัญชี**

เทรนเนอร์ **ปิดการล็อกอินไว้ทั้งหมด** — ลงข้อมูลผ่าน Google Sheet เหมือนเดิม
แต่ยังมีตัวตนในระบบเพื่อรับเงินและผูกชื่อในชีต ถ้าวันหลังอยากให้ใครเข้าเว็บได้
ไปตั้งรหัสให้ที่หน้า **บัญชี → ตั้งรหัสใหม่ให้พนักงาน** (ขั้นต่ำ 12 ตัว)

### ที่ deploy จริงอยู่ตอนนี้

| | |
|---|---|
| URL | https://darin.rocketlabth.com |
| upstream | `127.0.0.1:30100` (`APP_PORT` ใน `.env`) — bind loopback เท่านั้น |
| TLS | edge nginx กลางที่ `/root/app/nginx` (cert Let's Encrypt, ต่ออายุอัตโนมัติ) |
| DNS | หลัง Cloudflare proxy — CF ต่อ origin ทาง port 80 แล้วส่ง `X-Forwarded-Proto: https` |

vhost อยู่ที่ `/root/app/nginx/conf.d/darin.rocketlabth.com.conf` · แก้แล้ว reload ด้วย
`docker exec edge-nginx nginx -s reload`

Postgres **ไม่ publish port ออกจาก container เลย** — ต่อได้เฉพาะจาก compose network
ของสแตกนี้ ไม่มีทางเข้าจากอินเทอร์เน็ต เวลาต้อง debug ใช้ `docker compose exec db psql ...`

## พนักงานใหม่เข้ามา / ลาออก

ระบบ **ไม่พังและไม่จ่ายผิด** เมื่อเจอชื่อที่ยังไม่รู้จัก — คาบพวกนั้นเข้า **คิวรอตรวจ** พร้อมเหตุผล
`ไม่รู้จักเทรนเนอร์ "…"` (วันที่/ลูกค้ายังอ่านได้ครบ แค่ยังไม่ระบุว่าจ่ายให้ใคร)

**พนักงานใหม่:** `/admin/config` → *เพิ่มพนักงานใหม่* → ใส่ **ชื่อที่ใช้จดในชีต** ให้ตรง → กด Sync อีกครั้ง
คาบเก่าที่ค้างอยู่จะถูกจับคู่ย้อนหลังให้อัตโนมัติ ไม่ต้องไล่แก้ทีละอัน

**ลาออก/พักงาน:** กด *ปิดใช้งาน* — ไม่ต้องลบ คาบสอนและสลิปย้อนหลังยังอยู่ครบ
(ระบบบล็อกการลบพนักงานที่มีคาบสอนไว้แล้วด้วย FK constraint)

**ลูกค้าใหม่:** ไม่ต้องตั้งค่าอะไรเลย ชื่อมาจากชีตตรง ๆ

**กิจกรรมใหม่ / คลาสใหม่:** `/admin/config` → *เพิ่มกิจกรรมใหม่* แล้วใส่เรทตามระดับ

## โครงสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/parser.ts` | ชีตดิบ → คาบสอน (continuation rows, ชื่อครู 21 แบบ, เดาปี, คิวรอตรวจ) |
| `lib/payroll.ts` | engine คิดเงิน — pure function ไม่มีตัวเลข hardcode |
| `lib/sheets.ts` | Google Sheets API + อ่าน .xlsx |
| `lib/sync.ts` | sync แบบ idempotent ไม่ทับสิ่งที่คนตรวจแก้แล้ว |
| `lib/config-keys.ts` | §4 — ทุกเรท/เกณฑ์/% อยู่ที่นี่ที่เดียว |

## ก่อนใช้จ่ายเงินจริง

1. ตั้ง **rank (ST/CT/PT)** ของเทรนเนอร์ทุกคน — seed ให้เป็น PT ทั้งหมด
2. ใส่ **เรท Yoga** (สเปคยังไม่ให้)
3. ตอบคำถาม §7 ใน REQUIREMENTS.md — โดยเฉพาะ **สีในชีตแปลว่าอะไร** และ **ว่ายน้ำใครสอน**
4. เคลียร์ **คิวรอตรวจ** ให้หมดก่อนกดคำนวณ ไม่งั้นจ่ายขาด
5. เก็บรหัส `owner` ที่ seed พิมพ์ออกมาใส่ password manager
