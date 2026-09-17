# ส่งต่องานค้าง: กติกาสองชุด + ของค้างใน working tree + ฝั่ง deploy

- status: done
- commit: 14d3963 (002 deploy) · 76a6f71 (004 graph) · d56c98a (006 design)

## ✅ ปิดแล้ว 2026-09-17 — ของค้างใน working tree ลงคอมมิตครบ

ทรีว่างแล้ว · `bash scripts/verify.sh` = **ALL GREEN** ก่อนทุกคอมมิต · แยกตามฟีเจอร์ (§6 rule 4)
ไม่ได้กองรวมเป็นก้อนเดียว:

| คอมมิต | ถืออะไร |
|---|---|
| `14d3963` (task 002) | `deploy-dev.yml` ส่งคำสั่งเองจาก workflow + `.docs/knowledge/ops/deploy.md` + ใบ 002 |
| `76a6f71` (task 004) | ชั้น graphify: `.gitignore` + `CLAUDE.md` §8 + [ใบ 004](004-graphify-context-graph.md) |
| `d56c98a` (task 006) | `.claude/skills/` 11 ตัว + `uxui-designer` + `.docs/design/` + ตาราง skills ใน `CLAUDE.md` |

**ข้อ 2 (เกตแดงที่ `check-card-paths.sh`) หายไปเอง** — `.docs/design/**` มีไฟล์จริงแล้ว
(`README.md` + `.gitkeep.md` ห้าใบ) ⇒ พาธในร้อยแก้วมีรากจริง ไม่ต้องใช้ allowlist

**ข้อ 3 และ 4 ย้ายไปอยู่ [ใบ 008](../todo-human/008-merge-sync-progress-then-deploy-develop.md)** ซึ่ง
เป็นใบที่ลงมือ merge จริง (ชุด B push ขึ้น origin แล้ว — `origin/feat/sync-progress-ui` มี
`edf0a11` + `106cbe8` ครบ ⇒ ของที่เคยอยู่ที่เดียวบนดิสก์เครื่องคลาวด์ ไม่ได้อยู่ที่เดียวแล้ว)

## Goal

ใบนี้เป็น **ใบส่งต่อ** จากสายที่ปิดใบ 001 (พอร์ตกติกาจาก groove-clinic · คอมมิต `cdb1778`,
`1cb4455`) · linus สั่งเมื่อ 2026-09-17 ว่าสายนั้นหยุดตรงนี้ และให้สายที่กำลังทำงานอยู่ใน
รีโปนี้รับไปจัดการต่อ **ทั้งหมด** ⇒ ทุกข้อข้างล่างคือของที่ *ยังไม่มีใครถือ*

## 1. 🔴 ต้อง commit ให้ด้วย — มีของค้างใน working tree ที่ไม่ใช่ของคุณ

สายเดิมแก้ไว้แล้วหยุดกลางทาง เพราะเกตแดงจากงานที่คุณกำลังทำอยู่ ⇒ commit เองไม่ได้
(§6 rule 3: เกตต้องเขียวก่อน) · **ไฟล์พวกนี้ถูกต้องตามของจริงบนเครื่องแล้ว วัดสดเมื่อ 20:37 น.
ไม่ต้องแก้เนื้อ แค่เอาเข้าคอมมิต**

| ไฟล์ | แก้อะไร |
|---|---|
| `tasks/todo-human/002-deploy-host-setup.md` | ติ๊กข้อ 7 ว่าทำแล้ว + ตารางผลวัดก่อน/หลังของ catch-all |
| `.docs/knowledge/ops/deploy.md` | บันทึกว่า catch-all ลงเครื่องแล้ว · DNS `darin-dev` ยังรอลบ |
| `tasks/done/005-handoff-rulebook-and-deploy.md` | ใบนี้เอง |

### ทำยังไง

```bash
bash scripts/verify.sh        # ต้อง ALL GREEN ก่อน (ดูข้อ 2 — วันนี้ยังแดงอยู่)
git add tasks/todo-human/002-deploy-host-setup.md \
        .docs/knowledge/ops/deploy.md \
        tasks/done/005-handoff-rulebook-and-deploy.md
git commit
git push origin develop       # §6: push ทุกคอมมิต ไม่ใช่ตอนจบเฟส
```

ข้อความคอมมิตที่ใช้ได้เลย (ลงท้ายด้วยเลขใบตาม §6 rule 4):

```
docs: ปิดรู catch-all ของ edge nginx + บันทึกสถานะ deploy จริง (task 002)

Host ที่ไม่มี vhost รับ เคยตกไปที่ server block แรกของ conf.d (api-franchise)
แล้วโผล่หน้า franchise-management ⇒ วาง 00-default-catchall.conf บนเครื่องแล้ว
(80 → return 444 · 443 → ssl_reject_handshake on) วัดครบทุกโดเมนแล้วไม่มีตัวไหนพัง

ไฟล์บนเครื่องอยู่นอกรีโป (/root/app/nginx/conf.d/) — คอมมิตนี้คือบันทึกฝั่งเอกสาร
```

⚠️ **ถ้าจะแยกเป็นคอมมิตของตัวเอง ก็ได้ แต่ห้ามทิ้ง** — มันคือบันทึกของการเปลี่ยนแปลงที่
เกิดขึ้นจริงบนเครื่อง production และตอนนี้มันมีอยู่ที่เดียวคือ working tree นี้
· **และห้าม `git checkout -- <path>` กับไฟล์พวกนี้** (§6 rule 8: ของที่ยังไม่ `git add` หายถาวร)

## 2. เกตแดงอยู่ตอนนี้ — `check-card-paths.sh`

```
FAIL: CLAUDE.md:40 — พาธในร้อยแก้วไม่มีรากจริง: .docs/design/
FAIL: CLAUDE.md:42 — พาธในร้อยแก้วไม่มีรากจริง: .docs/design/brand/
FAIL: CLAUDE.md:50 — พาธในร้อยแก้วไม่มีรากจริง: .docs/design/sop/
```

มาจากตาราง design-skills ที่เพิ่งเพิ่มเข้า `CLAUDE.md` · เกตทำงานถูกแล้ว — พาธในร้อยแก้วต้องมีราก
จริง · ทางออกมีสองทางตามกติกา §5/§7: **สร้างบ้านของมันจริง** (มีไฟล์อย่างน้อยหนึ่งใบใน
`.docs/design/**` — git ไม่เก็บไดเรกทอรีเปล่า) หรือ **ใส่ `scripts/card-paths-allowlist.txt`
พร้อม `# task NNN`** ถ้าตั้งใจให้มันยังไม่มีอยู่ · ⚠️ ห้ามแก้ด้วยการถอดเกตหรือถอด backtick ออกเฉย ๆ

📇 **อัปเดต 20:41** — `.docs/design/` โผล่ขึ้นมาในทรีแล้ว (ยังไม่ได้ commit) ⇒ ถ้าในนั้นมีไฟล์จริง
เกตน่าจะเขียวแล้ว **รัน `bash scripts/verify.sh` ยืนยันเองก่อน commit เสมอ** อย่าเชื่อบรรทัดนี้
· และของที่เห็นค้างอยู่ตอนนั้นยังมี `graphify-out/` (ดูใบ 004) · `.claude/skills/` ·
`.claude/agents/uxui-designer.md` ซึ่งเป็นของคุณ ไม่ใช่ของสายเดิม

## 3. 🔴 กติกามีสองชุดในรีโปเดียว — ต้องตัดสิน

- **ชุด A** (ใบ 001, อยู่บน `develop` แล้ว): `CLAUDE.md` §1–§11 + `scripts/verify.sh` + selftest
  ทั้งชุด + `.claude/agents/` 9 ตัว + `.docs/knowledge/`
- **ชุด B** (อยู่บนเครื่องคลาวด์ ยังไม่เคย push): คอมมิต `106cbe8` *"chore: agent rules +
  knowledge layer + verify gate"* บน branch `feat/sync-progress-ui` ของ
  `/root/app/lim/darin-backend` — เป็นคนละดีไซน์: `.claude/knowledge/` · `.github/instructions/`
  · skills `dev-loop`/`verify` · agent คนละชุด (มี `payroll-auditor` ที่ชุด A ไม่มี)

⚠️ **ชุด B ยังไม่เคย push ขึ้น origin เลย** ⇒ มันอยู่ที่เดียวในโลกคือดิสก์ของเครื่องนั้น
**push ขึ้น origin ก่อนเป็นอย่างแรก** แล้วค่อยตัดสินว่าจะรวมยังไง

## 4. ของค้างบนเครื่องคลาวด์ (157.85.104.171)

- working copy `/root/app/lim/darin-backend` อยู่บน branch `feat/sync-progress-ui` **ไม่ใช่
  `develop`** + มี `docker-compose.yml` แก้ค้างยังไม่ commit (ใส่ `mem_limit`/`memswap_limit`
  อ้างเหตุการณ์เครื่องค้าง 2026-08-14 — **ของจริงที่ควรเข้ารีโป**)
- ⇒ `git pull --ff-only` ของสคริปต์ deploy จะล้ม ⇒ **ห้ามเปิด deploy อัตโนมัติจนกว่าข้อนี้จบ**
- รายละเอียดที่เหลือ (deploy script · กุญแจ · secret · ลบ DNS `darin-dev`) อยู่ใน
  [ใบ 002](../todo-human/002-deploy-host-setup.md) ซึ่ง **บล็อกที่คน** ไม่ใช่ที่โค้ด

## Notes — สิ่งที่ทำไปแล้วบนเครื่อง ไม่ต้องทำซ้ำ

`/root/app/nginx/conf.d/00-default-catchall.conf` ลงแล้วและ reload แล้ว (2026-09-17 20:37):
Host ที่ไม่มี vhost รับ จะถูกปิดการเชื่อมต่อ (444 / TLS reject) แทนที่จะไปโผล่
franchise-management · vhost ที่มี `server_name` ของตัวเองทุกตัวไม่กระทบ (วัดครบทุกโดเมนแล้ว)
