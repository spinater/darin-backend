# Darin Payroll System — Requirement & Implementation Plan

## Context

ยิม Darin Pool & Fitness คิดเงินเดือนด้วยมือจาก Google Spreadsheet ที่ลงตารางสอนรายลูกค้า
กฎการจ่ายอยู่ใน [darin-payroll-system.md](darin-payroll-system.md) v0.8 (ฐานเงินเดือน + ค่าสอน 1-on-1
ตามตารางเรท กิจกรรม×ระดับ + ค่าสอนคลาสส่วนเกินเครดิต + ค่าคอมขาย + incentive + OT)

เป้าหมาย: เว็บแอป (Bun + Next.js + Postgres) ที่ **sync ตารางสอนจาก Google Sheet อัตโนมัติ**
แล้วออก payslip รายเดือนได้ โดย **ทุกเรท/เกณฑ์/% เป็น config แก้ในหน้า Admin ห้าม hardcode**

**การตัดสินใจที่ผู้ใช้เลือกแล้ว:**
| หัวข้อ | เลือก |
|---|---|
| ขอบเขต v1 | ค่าสอน (sync จาก Sheet) + คีย์ยอดขาย/คอมเอง → payslip ครบสูตร §1.7/§2.5 |
| Source of truth | **Google Sheet ยังเป็นหลัก** ระบบ sync อ่านอย่างเดียว (พนักงานทำงานเหมือนเดิม) |
| Database | Postgres |
| Auth | user/password ในระบบเอง |

---

## 1. สิ่งที่พบจากไฟล์ที่ให้มา (ต้องอ่านก่อนออกแบบ import)

วิเคราะห์จริงจาก `Darin scheduled.xlsx` — **ไม่ตรงกับที่เข้าใจตอนแรก**

### 1.1 สองไฟล์ไม่เหมือนกัน — CSV ใช้ไม่ได้
- `Darin scheduled.csv` = ชีต **Pilates ชีตเดียว**
- `Darin scheduled.xlsx` = **5 ชีต**: `ชีต1` (ซ่อน, ตาราง layout ไม่ใช่ข้อมูล), **`Pilates`** 185 แถว, **`PT`** 401 แถว, **`สอนว่ายน้ำ`** 93 แถว, **`Yoga`** 1 แถว
- ❌ **CSV ทำปีหาย**: ใน xlsx วันที่เก็บเป็น date serial จริง (`45405` → `2024-04-23`) แต่ Google export CSV ตาม display format ได้แค่ `23/4`
  ข้อมูลคร่อม **2024 (683) / 2025 (2,588) / 2026 (2,265)** → แยกปีไม่ออก = คิดเงินเดือนไม่ได้
  **→ ห้ามใช้ CSV เป็น input ไม่ว่ากรณีใด**

### 1.2 โครงสร้างแต่ละชีต (ไม่เหมือนกันสักชีต)
| ชีต | คอลัมน์ | ครู | แถว | เซลล์วันที่ |
|---|---|---|---|---|
| Pilates | `_ , ชื่อ-นามสกุล, ชื่อเล่น, เบอร์โทร, วันสมัคร, รายครั้ง, ครู, 1..20` | คอลัมน์ G | 185 | 1,120 |
| PT | `ชื่อ-นามสกุล, ชื่อเล่น, เบอร์โทร., วันสมัคร, จำนวนครั้ง, เทรนเนอร์, 1..15+` | คอลัมน์ F | 401 | 3,691 |
| สอนว่ายน้ำ | `ชื่อ-นามสกุล, ชื่อเล่น, เบอร์โทร., วันที่สมัคร, 1..11+` | **ไม่มีเลย** | 93 | 725 |
| Yoga | เหมือน Pilates | คอลัมน์ F | 1 | 1 |

→ parser ต้องมี **config การ map คอลัมน์ต่อชีต** ไม่ใช่ hardcode ตำแหน่งเดียว

### 1.3 แถวต่อเนื่อง (continuation rows) — 30% ของชีต PT
ลูกค้าที่ซื้อแพ็คใหญ่ลงวันที่ไม่พอ ใช้แถวถัดไปต่อ โดย **เว้นชื่อ/เบอร์/ครูว่างหมด**
- PT **120 แถว** / Pilates 24 แถว / ว่ายน้ำ 8 แถว
- **กฎ parser:** แถวที่ชื่อ+เบอร์ว่าง แต่มีเซลล์วันที่ → เป็นแพ็คเดียวกับแถวก่อนหน้าที่มีชื่อ (สืบทอด customer + trainer)
- มีแถวว่างล้วนคั่น (PT 45, Pilates 13) — ต้องข้าม **โดยไม่ตัดสายการสืบทอด** (ดูตัวอย่างแถว 99–104 ใน CSV)

### 1.4 ชื่อเทรนเนอร์สะกด 21 แบบ สำหรับคนจริง ~5 คน
```
pt แพท(47) PT โอ(28) PT แพท(27) PT ต้น(21) pt โอ(16) PTแพท(15) พลอย(10)
PT พลอย(8) Pt โอ(4) PT พี่แพท(4) PTโอ(4) PTพลอย(4) pt พลอย(3) pt พี่แพท(2)
แพท(2) PTต้น(2) PT มิกซ์(1) Pt แพท(1) พี่แพท(1) ต้น(1) โอ(1)
```
Pilates ใช้อีกชุด: `พลอย(56) แพท(16) พี่แพท(11)`
**→ ต้องมีตาราง `TrainerAlias` (alias → staffId) แก้ได้ในหน้า admin** normalize แล้ว match
(`PT มิกซ์` = สอนคู่? ต้องถามเจ้าของก่อน — ดู §7)

### 1.5 เซลล์ที่ไม่ใช่วันที่ ~190 ช่อง (3.4%) — ต้องมีคิว "รอตรวจ"
กลุ่มความหมายที่เจอจริง:
| แบบ | ตัวอย่าง | ควรทำ |
|---|---|---|
| คนสอนแทน | `แนน 7/2/2025`, `30/9 พลอย`, `6/10 พี่แพท`, `3/6แพท`, `วันที่ 27/4 ต้นสอนแทนโอ` | แยกวันที่ + **override เทรนเนอร์เฉพาะครั้งนั้น** (จ่ายคนสอนจริง) |
| ป้ายกำกับแพ็ค | `Platinum 1 เดือน`, `โปร Platinum 3 เดือน`, `โปร 5.5`, `6.6 Gold`, `ได้จากโปรรายปี`, `แถม premium 3 เดือน` | ไม่ใช่ session → ข้าม เก็บเป็น note ของแพ็ค |
| สถานะแพ็ค | `ตัดไปรอบใหม่`, `เดือน มีนาคม`, `ย้ายลงไปด้านล่าง`, `ย้ายจากชั่วโมงเทรนของคุณฟ้า` | ข้าม + flag |
| แก้ไข/ผิดพลาด | `หัก 16/6`, `หัก16/6`, `26/6 จิ้บลืมลง`, `15/9 ลูกค้าไม่ได้มาไม่ได้แจ้งล่วงหน้า` | **เข้าคิวรอตรวจ** — คนตัดสิน จ่าย/ไม่จ่าย |
| วันที่พิมพ์เพี้ยน | `4/4/`, `21/2.`, `5//7`, `/`, `.` | เข้าคิวรอตรวจ |
| ตัวเลขหลง | `641.0`, `594.0`, `837`, `7.7`, `482`, `628` | เข้าคิวรอตรวจ (น่าจะพิมพ์ผิด) |
| ทดลองเรียน | `ทดลอง` (คอลัมน์จำนวนครั้ง) | นับเป็น session ไหม? — ดู §7 |
| ว่ายน้ำเฉพาะ | `เรียนคู่`, `เรียนกลุ่ม`, `รายครั้ง` | **เรทว่ายน้ำแบบคู่/กลุ่มยังไม่มีในสเปค** — ดู §7 |

### 1.6 ⚠️ ชีตใช้ "สี" เข้ารหัสความหมาย — ความเสี่ยงสูงสุดของงานนี้
เซลล์ข้อมูลมีสีพื้น **Pilates 28 แบบ / PT 41 แบบ / ว่ายน้ำ 13 แบบ**
(`FF999999`, `FFFFE599`, `FF9FC5E8`, `FFEA9999`, `FFB6D7A8`, `FFB4A7D6` …)
สีจำนวนนี้ไม่ใช่การตกแต่ง — เกือบแน่นอนว่าหมายถึงบางอย่าง (จ่ายแล้ว/ยกเลิก/no-show/คนสอน/รอบแพ็ค)

**ทั้ง CSV export และ Sheets API `values.get` ทิ้งสีทั้งหมด**
→ ต้องถามเจ้าของว่าสีแปลว่าอะไร (§7 ข้อ 1) แล้วเลือกทางใดทางหนึ่ง:
- **(ก) sync เก็บสีมาด้วย** ใช้ `spreadsheets.get?includeGridData=true` → มี `effectiveFormat.backgroundColor` → หน้า admin map สี→ความหมาย
- **(ข) ให้พนักงานเลิกใช้สีสื่อความหมาย** เพิ่มคอลัมน์สถานะแทน (สะอาดกว่า แต่เปลี่ยนวิธีทำงาน)

**แผนนี้เลือก (ก)** เพราะข้อตกลงคือ "พนักงานทำงานเหมือนเดิม"

### 1.7 ช่องว่างของข้อมูล — ไม่มีในไฟล์เลย ต้องคีย์ในระบบ
1. **ราคา/ยอดขาย** — ไม่มีเลขเงินสักช่อง → ค่าคอม §1.5/§2.2 คำนวณจากชีตนี้ไม่ได้
2. **คลาส Group** — ชีตทั้งหมดเป็น 1-on-1 → ค่าสอนคลาส §1.4 ไม่มีแหล่งข้อมูล ต้องมีหน้าคีย์คาบคลาส
3. **OT** — ยังไม่มีไฟล์ตัวอย่างจากเครื่องสแกนนิ้ว
4. **เรท Yoga** — มีชีต Yoga แล้ว แต่ตารางเรท §1.2 ไม่มีแถว Yoga → ต้องเพิ่ม
5. **เทรนเนอร์ว่ายน้ำ** — ชีตไม่มีคอลัมน์ครู → จ่ายให้ใครไม่รู้ (§7)

---

## 2. Stack

| ส่วน | เลือก | เหตุผล |
|---|---|---|
| Runtime | **Bun 1.3+** | ตามที่ขอ |
| Framework | **Next.js 15 App Router** (แอปเดียว ไม่แยก backend) | UI + API route handlers ในโปรเจกต์เดียว |
| DB | **Postgres** + **Prisma** | สเปค §5 เขียนเป็น Prisma schema อยู่แล้ว → ใช้ต่อได้เลย |
| Auth | ตาราง `Staff.passwordHash` + session cookie | ใช้ **`Bun.password`** (argon2id, built-in) — ไม่ต้องลง bcrypt |
| Google Sheets | `google-auth-library` + `fetch` เรียก REST ตรง | ไม่ต้องลง `googleapis` ทั้งก้อน |
| Excel (OT) | `xlsx` (SheetJS) เฉพาะตอนอัปโหลดไฟล์สแกนนิ้ว | ใช้ตอนได้ไฟล์ตัวอย่างแล้วเท่านั้น |
| UI | Tailwind + shadcn/ui | ฟอร์ม/ตารางล้วน |

**ไม่ทำ:** แยก service, message queue, Redis, Docker compose หลายตัว, GraphQL, state library
(แอปนี้ผู้ใช้ ~5 คน ข้อมูลหลักพันแถว — Postgres + Next.js พอเกินพอ)

---

## 3. Data Model

ใช้ตาม §5 ของสเปคเดิมทั้งหมด (`Staff`, `TeachRate`, `PayrollConfig`, `SaleAttribution`, `Payslip`, `PayslipLine`)
**เพิ่ม** ส่วนที่สเปคยังไม่มี:

```prisma
// ── Sheet sync ──────────────────────────────────────────
model SheetSource {                  // ตั้งค่าต่อชีต แก้ในหน้า admin
  id            String @id @default(cuid())
  spreadsheetId String
  sheetName     String               // "PT" | "Pilates" | "สอนว่ายน้ำ" | "Yoga"
  activity      String               // pt | pilates | swim | yoga  → ใช้ join TeachRate
  colMap        Json                 // {name:0, nickname:1, phone:2, signup:3, count:4, trainer:5, firstSession:6}
  headerRows    Int    @default(1)
  active        Boolean @default(true)
  lastSyncAt    DateTime?
}

model SheetRowRaw {                  // เก็บดิบทุกครั้งที่ sync — re-parse ได้โดยไม่ต้องยิง API ใหม่
  id        String @id @default(cuid())
  sourceId  String
  rowIndex  Int
  cells     Json                     // [{v: 45405, bg: "#b6d7a8", note: "..."}]
  syncedAt  DateTime @default(now())
  @@unique([sourceId, rowIndex])
}

model TrainerAlias {                 // "PTแพท" → staffId  (แก้ในหน้า admin)
  alias   String @id                 // normalize แล้ว: lowercase + ตัดช่องว่าง + ตัด prefix "pt"
  staffId String
}

model TeachSession {                 // 1 คาบสอน = 1 เซลล์วันที่
  id           String @id @default(cuid())
  sourceId     String
  rowIndex     Int
  colIndex     Int                   // (sourceId,rowIndex,colIndex) = idempotency key
  date         DateTime?
  activity     String
  staffId      String?               // null = จับคู่เทรนเนอร์ไม่ได้
  customerName String?
  customerPhone String?
  rawValue     String                // ค่าดิบในเซลล์ ไว้ให้คนตรวจ
  bgColor      String?               // §1.6
  status       String @default("ok") // ok | needs_review | ignored
  reviewNote   String?
  @@unique([sourceId, rowIndex, colIndex])
}

model ClassSession {                 // คลาส Group §1.4 — คีย์มือ ไม่มีในชีต
  id        String @id @default(cuid())
  date      DateTime
  classId   String                   // → ClassPrice
  staffId   String
  booked    Int
  noShow    Int    @default(0)
}

model ClassPrice { id String @id @default(cuid())  name String @unique  price Int  active Boolean @default(true) }

model Sale {                         // คีย์มือ — ฐานคำนวณค่าคอม
  id        String @id @default(cuid())
  date      DateTime
  kind      String                   // pt | membership | course_ext | freeze
  productName String
  listPrice Float?                   // ราคาเต็มใน catalog → ใช้ตัดสิน "โปรฯ"
  netPrice  Float                    // ราคาจ่ายจริง = ฐานคำนวณคอม
  note      String?
  attributions SaleAttribution[]     // closer | referrer | content_owner
}

model OtEntry { id String @id @default(cuid())  staffId String  date DateTime  hours Float }

model Session { id String @id @default(cuid())  staffId String  expiresAt DateTime }  // auth cookie
```

`PayrollConfig` seed ครบทั้ง 12 ข้อของ §4 — engine อ่านจาก DB ล้วน ไม่มีตัวเลขในโค้ด

---

## 4. Google Sheets Sync — วิธีอ่านตรงจาก Spreadsheet (ที่ถาม)

### 4.0 ✅ ทดสอบกับชีตจริงแล้ว — ไม่ต้องใช้ credential
ชีต `12mNsqeNGb1GjT_qn7IDzH8Ua6ppGDKiO3xMzPiZh_x0` แชร์แบบ "ทุกคนที่มีลิงก์ดูได้" อยู่แล้ว
→ โหลดผ่าน `https://docs.google.com/spreadsheets/d/<id>/export?format=xlsx` ได้ตรง ๆ
ได้ครบทั้ง **date serial** (ปีไม่หาย) และ **สีพื้นเซลล์** (§1.6) · sync ทั้ง 4 ชีต ~8 วินาที

- ⚠️ แลกมาด้วยความเสี่ยง: ชื่อ+เบอร์ลูกค้าทั้งหมด ใครมีลิงก์ก็เปิดดูได้ → ถ้าจะปิด ให้ไปใช้ §4.1
- ❌ **OAuth client ID/secret ใช้ไม่ได้** — ต้องมีคนกดยินยอมในเบราว์เซอร์เพื่อแลก refresh token
  ไม่ใช่ server-to-server (ต่างจาก service account)

### 4.1 ตั้งค่า Service Account (ถ้าจะปิดชีตไม่ให้สาธารณะ)
1. Google Cloud Console → สร้างโปรเจกต์ → เปิด **Google Sheets API**
2. สร้าง **Service Account** → สร้าง JSON key → เก็บใน `.env` (`GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`)
3. เปิด Google Sheet → **Share** → ใส่อีเมล service account (`xxx@yyy.iam.gserviceaccount.com`) สิทธิ์ **Viewer**
4. คัดลอก `spreadsheetId` จาก URL → ใส่ในหน้า admin

> Service account เหมาะกว่า OAuth เพราะเป็น server-to-server ไม่ต้องมีคนกดยืนยัน ไม่มี refresh token หมดอายุ

### 4.2 เรียก API — **ต้องใช้ endpoint ที่ได้ค่าดิบ**
```ts
// ❌ ผิด — ได้ "23/4" ปีหาย เหมือน CSV
GET /v4/spreadsheets/{id}/values/PT!A1:AA500

// ✅ ถูก — ได้ serial 45405 + สีพื้น + note (แก้ทั้งปัญหา §1.1 และ §1.6 ในครั้งเดียว)
GET /v4/spreadsheets/{id}
  ?includeGridData=true
  &ranges=PT&ranges=Pilates&ranges=สอนว่ายน้ำ&ranges=Yoga
  &fields=sheets(properties/title,data/rowData/values(
      formattedValue,effectiveValue,effectiveFormat/backgroundColor,note))
```
- `effectiveValue.numberValue` = date serial → `new Date(Date.UTC(1899,11,30) + serial*864e5)`
  (Google Sheets ใช้ epoch 1899-12-30 เหมือน Excel)
- `formattedValue` = ข้อความที่คนเห็น → เก็บไว้เป็น `rawValue` ให้คนตรวจอ่านรู้เรื่อง
- `effectiveFormat.backgroundColor` = สี §1.6
- `note` = Note ในเซลล์ (comment) ที่ CSV ทิ้งไปหมด

### 4.3 Pipeline (3 ขั้น แยกกันชัด — re-parse ได้โดยไม่ยิง API ซ้ำ)
```
[Sheets API] → SheetRowRaw (เก็บดิบ)
             → parse       → TeachSession (upsert ด้วย sourceId+rowIndex+colIndex)
             → payroll engine → Payslip
```
**กฎ parse ตามลำดับ** (ทดสอบด้วยไฟล์ตัวอย่างจริงที่มีอยู่):
1. ข้าม `headerRows`
2. แถวว่างล้วน → ข้าม **แต่ไม่รีเซ็ต customer/trainer ที่สืบทอดอยู่** (§1.3)
3. ชื่อ+เบอร์ว่าง + มีเซลล์วันที่ → สืบทอดจากแถวก่อนหน้า (§1.3)
4. เทรนเนอร์: normalize (lowercase, ตัดช่องว่าง, ตัด prefix `pt`) → lookup `TrainerAlias`
   ไม่เจอ → `status=needs_review` (ไม่เดา)
5. เซลล์วันที่: numeric → serial→วันที่ / เป็นข้อความ → regex `(\d{1,2})/(\d{1,2})(/\d{2,4})?` + จับชื่อคนสอนแทนที่ติดมา (§1.5)
   ไม่มีปี → เดาจากลำดับวันที่ในแถวเดียวกัน (วิ่งขึ้น) **แล้ว flag ให้ตรวจ**
6. ข้อความล้วน (ป้ายแพ็ค/สถานะ) → `status=ignored` + เก็บ note
7. อื่นๆ ทั้งหมด → `status=needs_review`

**Sync ทับซ้ำได้ปลอดภัย**: upsert ด้วย key `(sourceId,rowIndex,colIndex)` → กด sync ซ้ำกี่ครั้งก็ได้ผลเดิม
ถ้าค่าในชีตเปลี่ยนหลังจากคนแก้ review แล้ว → ไม่ทับทับค่าที่คนแก้ แต่ flag `conflict` ให้ดู

### 4.4 ระยะเวลา
v1 กดปุ่ม **"Sync ตอนนี้"** ในหน้า admin (พอสำหรับรอบจ่ายเดือนละครั้ง)
ถ้าอยากอัตโนมัติทีหลัง → cron เรียก route เดียวกัน (ไม่ต้องเขียนโค้ดเพิ่ม)

---

## 5. Payroll Engine

ไฟล์เดียว `lib/payroll.ts` — pure function ไม่แตะ DB (รับ input ที่ query มาแล้ว)

```ts
computePayslip(input: {
  staff, period,                    // "2026-07"
  sessions: TeachSession[],          // status=ok เท่านั้น
  classSessions, sales, otEntries,
  config, teachRates, classPrices,
}): { lines: PayslipLine[], base, teachPay, classPay, commission, otPay, net }
```

ลำดับคำนวณ (ตาม §1.7 / §2.5):
1. **base** = `staff.baseSalary`
2. **teachPay** = Σ `teachRate[session.activity][staff.rank]` ต่อ session
3. **classValue** = Σ ราคาคลาส × ตัวคูณ โดย `attended = booked − noShow` → `0 คน = 0` · `1–2 = ×0.5` · `≥3 = ×1`
   **classPay** = `max(0, classValue − staff.classCredit)`
4. **commission**:
   - รวมยอด PT ที่ปิดเอง (`role=closer` และไม่มี referrer ในบิลเดียวกัน) ทั้งเดือน
   - ถึงเกณฑ์ `incentive.threshold` (30,000) → ใช้ `incentive.rate` **ย้อนหลังทั้งเดือน**
   - PT มี referrer → closer `7%` + referrer/content_owner `3%`
   - สมาชิก: `netPrice < listPrice` → เรท promo (5%) · เต็มราคา Premium/Platinum → 10% · Basic → 5%
   - `kind = course_ext | freeze` → **ไม่จ่ายคอมใคร** (§3)
5. **otPay** = Σ `max(0, hours − ot.threshold) × ot.rate` **รายวัน** (ไม่ใช่รวมเดือนแล้วลบ)
6. **net** = ผลรวม · ทุกรายการเขียนลง `PayslipLine` (label/qty/rate/amount) ให้ตรวจย้อนได้

**ทุกตัวเลขมาจาก `config`/`teachRates`/`classPrices` — ไม่มี literal ในไฟล์นี้**

**Test:** `lib/payroll.test.ts` (`bun test`) — เคสจริงอย่างน้อย 6 เคส:
เทรนเนอร์ ST ครบสูตร / คลาสต่ำกว่าเครดิต / คลาสเกินเครดิต / incentive ข้ามเกณฑ์พอดี (29,999 vs 30,000) /
คลาส 0-1-2-3 คน / OT รายวันเทียบรวมเดือน

---

## 6. หน้าจอ

| หน้า | สิทธิ์ | ทำอะไร |
|---|---|---|
| `/login` | ทุกคน | user/password (`Bun.password.verify`) |
| `/` Dashboard | Owner/Admin | เลือกงวด → สรุปยอดรวม → ปุ่ม "คำนวณเงินเดือน" |
| `/sync` | Owner/Admin | ปุ่ม Sync + สรุปผล (เพิ่ม/แก้/เข้าคิวตรวจกี่รายการ) |
| `/sync/review` | Owner/Admin | **คิวรอตรวจ** — เซลล์ที่ parse ไม่ได้ พร้อมบริบทแถว กด: ระบุวันที่ / เลือกเทรนเนอร์ / ข้าม |
| `/classes` | Owner/Admin | คีย์คาบคลาส Group (วันที่/คลาส/ผู้สอน/จอง/no-show) |
| `/sales` | Owner/Admin/Counter | คีย์บิลขาย + ระบุ closer/referrer/content_owner |
| `/ot` | Owner/Admin | คีย์/อัปโหลด OT รายวัน |
| `/payslips` `/payslips/[id]` | Owner/Admin | รายการ + รายละเอียดทีละบรรทัด · draft→approved→paid · export CSV/PDF |
| `/admin/config` | Owner/Admin | **ตารางเรท กิจกรรม×ระดับ** (แก้ทุกช่อง + เพิ่มกิจกรรม/ระดับ) · ราคาคลาส 13 รายการ · % คอมทุกตัว · incentive · OT · ฐานเงินเดือน+เครดิตรายคน · `SheetSource` colMap · `TrainerAlias` · map สี→ความหมาย |
| `/me` | Trainer | เห็นเฉพาะชั่วโมง/KPI ตัวเอง **ห้ามเห็นเงิน** |

**Access control**: `middleware.ts` เช็ค session + role ทุก path ยกเว้น `/login` และ `/me`
เส้นทางเงินเดือนทั้งหมด = Owner/Admin เท่านั้น (§ หัวสเปค)

---

## 7. คำถามที่ต้องถามเจ้าของยิมก่อน/ระหว่างทำ (ไม่บล็อกการเริ่ม)

**บล็อกความถูกต้องของตัวเลข:**
1. 🔴 **สีในชีตแปลว่าอะไร?** (28–41 สี) — ถ้าสีแปลว่า "ยกเลิก/ไม่จ่าย" แล้วเราไม่รู้ = **จ่ายเงินผิด**
2. 🔴 **ว่ายน้ำจ่ายให้ใคร?** ชีตไม่มีคอลัมน์ครู (725 คาบ) — เพิ่มคอลัมน์ในชีต หรือมีคนสอนคนเดียว?
3. 🔴 **`เรียนคู่` / `เรียนกลุ่ม` ในชีตว่ายน้ำจ่ายเรทเท่าไร?** สเปค §1.2 มีแค่ว่ายน้ำ 250 เดี่ยว
4. 🟡 **`ทดลอง` (ทดลองเรียนฟรี) จ่ายค่าสอนไหม?**
5. 🟡 **`PT มิกซ์` คือใคร?** — สอน 2 คน? แบ่งเงินยังไง?
6. 🟡 **`หัก 16/6` / `26/6 จิ้บลืมลง`** — คาบที่ต้องหักออก/เพิ่มเข้า ยืนยันกฎ

**จากสเปคเดิม §7 ที่ยังค้าง:**
7. TikTok: เจ้าของคลิปปิดเอง → 7%+3%=10% ถูกไหม
8. ต่ออายุ/walk-in/สินค้าหน้าร้าน — เรทคอม TBD
9. เกณฑ์ตัดสิน "ใครส่งลีด" — บังคับกรอกช่องที่มาของลูกค้าไหม
10. เรท **Yoga** ยังไม่มีในตาราง §1.2 (มีชีตแล้ว)
11. ไฟล์ตัวอย่าง OT จากเครื่องสแกนนิ้ว

> ระหว่างรอคำตอบ: ทำ engine + sync ได้เลย เคสที่ไม่ชัดทั้งหมดตกเข้า **คิวรอตรวจ** ไม่เดาแทนคน

---

## 8. ลำดับการทำ

| เฟส | ได้อะไร | เสร็จเมื่อ |
|---|---|---|
| **0** | `bun create next-app` + Prisma + Postgres + schema §3 + seed config §4 ครบ | `bunx prisma migrate dev` ผ่าน seed ครบ |
| **1** | Auth + role guard + หน้า `/admin/config` | ล็อกอินได้ แก้เรททุกช่องได้ trainer เข้า `/payslips` ไม่ได้ |
| **2** | **Sheets sync + parser + คิวรอตรวจ** (ใหญ่สุด) | sync ชีตจริง 4 ชีตแล้ว: session ที่ status=ok ตรงกับที่นับมือใน 1 เดือน |
| **3** | **Payroll engine + test** | `bun test` เขียว เทียบกับที่คิดมือได้ตรง |
| **4** | คีย์ยอดขาย/คลาส/OT + ออก payslip + export | ออก payslip เดือนจริงได้ครบทุกคน |
| **5** | สี→ความหมาย, cron sync, PDF | หลังได้คำตอบ §7 |

---

## 9. การตรวจสอบ (Verification)

1. **Parser** — `bun test lib/parser.test.ts` ใช้ **`Darin scheduled.xlsx` ของจริง** เป็น fixture
   ยืนยันตัวเลขที่นับได้จากไฟล์: `PT=401 แถว (120 continuation)`, `Pilates=185 (24)`, `Swim=93 (8)`,
   เซลล์วันที่ `5,537 serial + ~190 non-serial` → non-serial ต้องเข้า `needs_review`/`ignored` ทั้งหมด **ห้ามหายเงียบ**
2. **Sheets API** — ยิงจริง ตรวจว่า `effectiveValue.numberValue = 45405` → `2024-04-23` (ไม่ใช่ `23/4`)
   และ `backgroundColor` มาครบ
3. **Engine** — `bun test lib/payroll.test.ts` (§5) + คิดมือ 1 คนเทียบทีละบรรทัดใน `PayslipLine`
4. **End-to-end** — `bun --bun run dev` → login → sync → เคลียร์คิวตรวจ → คีย์ยอดขาย 2-3 บิล →
   คำนวณงวด `2026-07` → เปิด payslip → ยอดตรงกับที่ทำมือ
5. **สิทธิ์** — ล็อกอินเป็น trainer แล้วยิง `/payslips`, `/admin/config`, API routes → ต้องได้ 403 ทุกเส้น

---

## 10. ไฟล์หลักที่จะสร้าง

```
prisma/schema.prisma          §3 ทั้งหมด
prisma/seed.ts                config §4 ครบ 12 ข้อ + เรท §1.2 + คลาส 13 §1.4 + TrainerAlias 21 ตัว §1.4
lib/sheets.ts                 เรียก Google Sheets API (§4.2)
lib/parser.ts                 SheetRowRaw → TeachSession (§4.3) ← หัวใจของงาน
lib/payroll.ts                engine (§5) — pure, ไม่มีตัวเลข hardcode
lib/auth.ts                   Bun.password + session cookie
middleware.ts                 role guard
app/**                        หน้าจอ §6
lib/parser.test.ts            fixture = xlsx จริง
lib/payroll.test.ts           6 เคสตาม §5
```
