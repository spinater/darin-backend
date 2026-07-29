# Darin Payroll

ระบบคิดเงินเดือน Darin Pool & Fitness — Bun + Next.js + Postgres
ข้อกำหนดฉบับเต็มอยู่ที่ [REQUIREMENTS.md](REQUIREMENTS.md) · กฎการจ่ายต้นฉบับ [darin-payroll-system.md](darin-payroll-system.md)

## เริ่มใช้งาน

```bash
bun install
createdb darin_payroll                       # หรือชี้ DATABASE_URL ไปที่ Postgres ที่มีอยู่
bunx --bun prisma db push
bun run prisma/seed.ts                       # config §4 + เรท + คลาส 13 + เทรนเนอร์
bun run dev                                  # http://localhost:3000  (owner / changeme)
bun test                                     # 42 tests
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

## Deploy บน server (docker compose)

```bash
cp .env.example .env      # ตั้ง POSTGRES_PASSWORD และ GOOGLE_SHEET_LINK อย่างน้อย
docker compose up -d --build
```

| service | ทำอะไร |
|---|---|
| `db` | Postgres 17 · เก็บลง volume `pgdata` · **ไม่ publish port ออกนอก** |
| `migrate` | รันครั้งเดียวตอนขึ้นระบบ: `prisma db push` + seed แล้วจบ |
| `app` | Next.js standalone บน Node · เปิดที่ `${APP_PORT:-3000}` |

`app` รอ `migrate` เสร็จก่อนเสมอ (`service_completed_successfully`) → deploy ใหม่ไม่ต้องสั่ง migrate เอง

```bash
docker compose logs -f app          # ดู log
docker compose exec db psql -U darin darin_payroll   # เข้า DB
docker compose down                 # หยุด (ข้อมูลอยู่ใน volume ไม่หาย)
```

**ก่อนเปิดให้คนอื่นเข้า:** ล็อกอิน `owner` / `changeme` → ไปหน้า **บัญชี** เปลี่ยนรหัสทันที
แล้วตั้งรหัสให้เทรนเนอร์ทุกคนจากหน้าเดียวกัน

> ยังไม่ได้ทำ TLS ไว้ให้ — ถ้าเปิดออกอินเทอร์เน็ต ให้วาง reverse proxy (Caddy/nginx/Cloudflare Tunnel)
> หน้า `app` เพราะ session cookie ตั้ง `secure` ใน production ต้องมี https ถึงจะล็อกอินได้

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
5. เปลี่ยนรหัสผ่านทุกคนที่หน้า **บัญชี** (seed = `changeme` เหมือนกันหมด)
