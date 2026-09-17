# รวม `feat/sync-progress-ui` กับ develop แล้วใช้ develop เป็นตัว deploy

- status: todo
- commit:

## Goal

linus สั่ง 2026-09-17 ตามลำดับนี้เป๊ะ:
**merge develop → `feat/sync-progress-ui` → merge กลับเข้า develop → ใช้ `develop` เป็นตัวหลักในการ deploy**

ทำสองทางเพราะแก้ conflict บน branch ก่อน แล้วทดสอบบนของจริงได้ · พอ branch มี develop ครบแล้ว
ขา merge กลับจะเป็น **fast-forward** ไม่มี conflict ซ้ำสอง

## ทำไมเร่ง — ข้อเท็จจริงที่วัดเอง 2026-09-17

- `https://darin.rocketlabth.com` (production) รัน **`106cbe8` บน `feat/sync-progress-ui`**
  คอมมิตลงวันที่ **2026-07-29 → ค้างมา 50 วัน**
- **`develop` ไม่เคยถูก deploy เลยสักครั้ง** รวมถึงใบ 001/002 ที่ push ไปวันนี้
- ⇒ ทุกวันนี้ "โค้ดที่ลูกค้าใช้" กับ "โค้ดบน develop" เป็นคนละต้นไม้

## โค้ดฝั่ง branch ที่ **ต้องรอดมาให้ครบ** (ผู้ใช้เห็นอยู่จริงทุกวันนี้)

`edf0a11` = ฟีเจอร์บอกความคืบหน้า/เวลาที่เหลือตอน sync · ไฟล์ที่เกี่ยวข้อง:

```
A app/_components/action-progress.tsx   A app/_components/spinner.tsx
A app/_components/submit-button.tsx     A app/api/sync/route.ts
A app/loading.tsx                       A app/sync/sync-runner.tsx
A lib/duration.ts                       A lib/job-timing.ts
M app/{account,admin/config,classes,login,ot,payslips,sales,sync,sync/review}/page.tsx
M app/globals.css  M lib/sync.ts  M prisma/schema.prisma  M package.json  M bun.lock
```

⚠️ `prisma/schema.prisma` เปลี่ยนด้วย ⇒ ขาทดสอบต้องผ่าน stage `db` ของ `scripts/check-code.sh`
(push schema + seed บน postgres ใช้แล้วทิ้ง) ไม่ใช่แค่ `tsc`

## conflict ที่จะเจอ — ลองมาแล้ว มี 6 ไฟล์เท่านั้น

| ไฟล์ | ทางแก้ที่แนะนำ |
|---|---|
| `CLAUDE.md` | **เอาของ develop** (rulebook ใบ 001 คือของจริงตามคำสั่ง 17 ก.ย.) |
| `.claude/settings.json` | เอาของ develop |
| `.claude/agents/code-reviewer.md` | เอาของ develop |
| `tasks/README.md` | เอาของ develop |
| `docker-compose.yml` | เอาของ develop — **เนื้อบรรทัดเหมือนกัน ต่างแค่คอมเมนต์** (ทั้งสองฝั่ง bind `127.0.0.1` อยู่แล้ว) |
| `.env.example` | รวมมือ: เก็บคำอธิบายผังพอร์ตของฝั่ง branch + ชื่อ vhost `darin.rocketlabth.com` ของฝั่ง develop |

## 🔴 กติกาชุดเก่าที่ติดมากับ branch — linus สั่งว่า "เอาออก ไม่ต้องใช้ งานนานแล้ว"

ลบทิ้งตอน merge (ไม่ใช่เก็บไว้คู่กัน — สองรายการกติกาในรีโปเดียวทำให้ agent รุ่นถัดไปอ่านคนละเล่ม):

```
.claude/knowledge/**            (12 ไฟล์)
.claude/skills/dev-loop/  .claude/skills/verify/
.github/copilot-instructions.md  .github/instructions/**  (4 ไฟล์)
.claude/agents/{data-developer,debugger,doc-sync,domain-developer,solution-architect,test-engineer,web-developer}.md
tasks/todo/001-agent-rule-knowledge-layer.md
```

⚠️ **ใบนั้นเลข 001 ชนกับ `tasks/done/001-port-groove-rulebook.md` ของ develop** ⇒ ปล่อยไว้
`check-links.sh` ชั้นที่สองจะแดงทันที ("ใบมีสองบ้าน") — ลบทิ้งคือทางที่ตรงกับคำสั่ง

🔑 **ข้อเดียวที่ควรคิดก่อนลบ: `.claude/agents/payroll-auditor.md`** — เป็นยามฝั่งตัวเลขเงินซึ่ง
ชุดใหม่ไม่มี และ §2 ข้อ 2–5 ต้องการพอดี · **ข้อเสนอ: เก็บไว้ แล้วปรับให้อ้าง § ของ `CLAUDE.md`
ชุดใหม่** · ถ้าจะลบก็ได้ แต่ให้เป็นคำตัดสินที่เขียนไว้ในคอมมิต ไม่ใช่ลบเพราะกวาดทั้งกอง

## ขั้นตอน

1. ทำใน **worktree แยก** (`git worktree add`) — ทรีหลักมีงานค้างของสายอื่นอยู่ อย่าเอาไปปนกัน
2. `git merge origin/develop` บน branch → แก้ 6 conflict ข้างบน → ถอดกติกาชุดเก่า → commit → push branch
3. `git checkout develop && git merge feat/sync-progress-ui` (จะเป็น fast-forward) → `bash scripts/verify.sh`
   ต้อง **ALL GREEN** ก่อน push (§6 rule 3)
4. **ย้าย production มา `develop`** — บนเครื่อง `/root/app/lim/darin-backend`:
   - 🔴 **เก็บ `docker-compose.yml` ที่แก้ค้างบนเครื่องก่อนเป็นอย่างแรก** — ใส่
     `mem_limit`/`memswap_limit` ให้ db กับ web อ้างเหตุการณ์เครื่องค้าง 2026-08-14
     **มีอยู่ที่เดียวในโลกคือดิสก์เครื่องนั้น** ⇒ เอาเข้ารีโปเป็นคอมมิตจริง
     อย่าปล่อยให้ `git checkout` กลืนหาย (§6 rule 8)
   - แล้ว `git checkout develop`
5. deploy แล้วยืนยันสามอย่าง: SHA ตรง · ไม่มี `docker compose up` ค้าง · เว็บ 200
   ([.docs/knowledge/ops/deploy.md](../../.docs/knowledge/ops/deploy.md))

## ของที่พร้อมแล้ว ไม่ต้องทำซ้ำ (ทดสอบจริง 2026-09-17)

- คำสั่ง deploy อยู่ใน `.github/workflows/deploy-dev.yml` (ส่งจาก runner ผ่าน `bash -s`)
  ทดสอบยิงด้วยกุญแจจริง: pull → build → recreate → เว็บ 200 · `exit=0` · `flock` กันรอบซ้อนได้
- กุญแจ deploy อยู่ใน `/root/.ssh/authorized_keys` (`restrict` — port-forward ถูกปิด วัดแล้ว)
- edge nginx มี catch-all แล้ว (Host ที่ไม่มี vhost ไม่ไปโผล่แอปของคนอื่น)
- ⚠️ **ยังขาด GitHub secret `DEPLOY_SSH_KEY`** ⇒ push develop แล้ว workflow ยังล้มที่ ssh ·
  private key อยู่ที่ `/home/linus/.ssh/darin-deploy-ed25519` · จนกว่าจะตั้ง ให้ deploy ด้วยการยิง
  คำสั่งชุดเดียวกับใน workflow เอง
