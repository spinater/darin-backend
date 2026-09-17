#!/usr/bin/env bash
# เทสของ **ตัวเกตเอง** (task 190) — พิสูจน์ว่า `scripts/check-card-paths.sh` แดงเมื่อควรแดง
# **และแดงด้วยข้อความที่ถูกใบ** · รูปเดียวกับ `scripts/tests/check-links-selftest.sh` (task 168)
# และ `scripts/tests/check-sql-coverage-selftest.sh` (task 095): ก๊อปเกตไปลงแซนด์บ็อกซ์ใน
# `.scratch/` แล้วพังทีละแบบ
#
# ## ทำไมเกตนี้ต้องมีเกตของตัวเอง
# ด่านนี้ตัดสินด้วย **รายการตัวข้าม** (`*` `{}` `…` `NNN` …) และ **รายการราก** ซึ่งทุกตัวคือพื้นที่ที่
# ด่านมองไม่เห็น ⇒ ตัวข้ามที่กว้างไปหนึ่งตัว หรือรากที่หายไปหนึ่งราก = เกตที่ยังเขียวอยู่แต่ไม่ได้ตรวจ
# อะไรเลย **โดยไม่มีอะไรบอก** (คลาสเดียวกับ allowlist ที่กลายเป็นสุสาน แต่เงียบกว่า เพราะไม่มีแม้แต่
# แถวให้ใครเห็น) · เกตรอบแรกของใบนี้ **มีรูจริงห้าจุด** ที่หาเจอด้วยการรีวิวแบบสายค้าน ไม่ใช่ด้วยเทส
# ⇒ เคส L–S ข้างล่างคือรูเหล่านั้นที่ถูกตรึงไว้ทีละใบ
#
# ## เคส
#   A. แซนด์บ็อกซ์ครบ → เขียว — ตรึง normalize (`::` · `:NN` · หลาย token ต่อ span) + ตัวข้ามทุกตัว
#      + พาธ Next.js จริงที่มี `[locale]`/`(app)` + ชวเลขสัมพัทธ์ที่อยู่นอกขอบเขต + บล็อกโค้ด
#   B. พาธเน่าในร้อยแก้ว        → แดง **พร้อมไฟล์:บรรทัดที่ถูกต้อง และตัวพาธ**
#   C. พาธเน่าใน **บล็อกโค้ด**  → แดง — ตรึงคำตัดสิน "ไม่ข้ามบล็อกโค้ด" ที่ซื้อของจริงมา 4 จุด
#   D. พาธเน่าที่มี `[locale]`/`(app)` → แดง — วงเล็บ **ไม่ใช่** ตัวข้าม (ถ้าเผลอใส่ = ปิดตาทั้งฝั่งเว็บ)
#   E. พาธเน่าที่อยู่ใน allowlist → เขียว
#   F. allowlist มีพาธที่กลับมามีตัวตน → แดง "กลับมามีตัวตน" **ห้าม**พูดใบ G
#   G. allowlist มีพาธที่ไม่มีไฟล์ไหนในคลังอ้างแล้ว → แดง "ไม่มีไฟล์ไหนในคลังอ้าง" **ห้าม**พูดใบ F
#      (คนละทางแก้: F อาจต้องลบ*ไฟล์* · G ต้องลบ*แถว* ⇒ ยุบเป็นข้อความเดียวไม่ได้)
#   H. แถว allowlist ที่ไม่อ้าง `# task NNN` → แดง · และแถวที่ **ย่อหน้า** ต้องไม่หายเงียบ
#   I. allowlist กับพาธที่มี `[` `]` `(` `)` → เขียว — ตรึงว่าตัวเทียบสมาชิกเป็น **สตริงตรง ๆ**
#      ไม่ใช่ `case` (ซึ่งจะอ่าน `[locale]` เป็น bracket expression แล้วเทียบตัวเองไม่ตรง)
#   J. การ์ดใหม่ที่ยัง **ไม่ `git add`** ก็ถูกสแกน (ธง `-o` ของ `git ls-files`)
#   K. `#ARGS` ไม่ครบ → "อ่านคลังไม่ครบ" ไม่ใช่ OK (การนับสองทาง, บทเรียนใบ 095)
#   L. **คลังว่าง → แดง ไม่ใช่เขียว** — ถ้าตัวเลือกไฟล์ในเกตเน่า เกตจะเขียวตลอดกาลบนทรีที่มัน
#      ไม่เคยมอง · สองด่านคนละใบ: "ไม่มีไฟล์ที่อ่านได้เลย" กับ "คัดไฟล์ข้อความไม่ได้เลยสักไฟล์"
#      (ตัวหลังคือทรีที่เป็นไบนารีล้วน — คนละสาเหตุ คนละทางแก้ ⇒ คนละข้อความ)
#   M. **awk ล้ม → "อ่านคลังไม่สำเร็จ" และ `exit` ทันที** — ห้ามเดินต่อไปพิมพ์ "ไม่มีไฟล์ไหนในคลังอ้าง"
#      ซึ่งเป็นคำสั่งให้ลบแถว allowlist ที่ยังจำเป็น **ในรอบที่เกตเพิ่งยอมรับเองว่าไม่มีความหมาย**
#   N. **พาธเน่าที่เป็น token ที่ *สอง* ของ span** (`touch api/src/ghost.rs`) → แดง — เกตรอบแรก
#      ตัดตั้งแต่ช่องว่างแรกแล้วทิ้งที่เหลือ ⇒ วัดได้ 33 จุด/17 พาธในคลังจริงที่ไม่มีใครเฝ้าเลย
#   O. **พาธเน่าหลังโครงสร้าง ``​`x`​`` บนบรรทัดเดียวกัน** → แดง — ตัวจับคู่ backtick ทีละตัวจะ
#      **สลับขั้ว** ตรงนั้นแล้วอ่านพาธจริงเป็นร้อยแก้วไปตลอดบรรทัด (โครงสร้างนี้มีอยู่ในคลังจริงแล้ว)
#   P. **พาธที่ `.gitignore` คลุม = นอกขอบเขตทั้งสองทิศ** — ไม่แดงตอนไม่มี และไม่ใช่หลักฐานตอนมี
#      (ก่อนแก้ข้อนี้ เกต **เขียวบนเครื่องอุ่น แดง 8 บรรทัดบน worktree ใหม่** ซึ่ง allowlist ซ่อมไม่ได้
#      เชิงตรรกะ: แถวที่แก้เครื่องเย็นได้ จะแดง "กลับมามีตัวตน" บนเครื่องอุ่น)
#   Q. **รากครบทุกราก** — พาธเน่าหนึ่งเส้นต่อหนึ่งราก ต้องถูกรายงาน **ทุกเส้น** (ทั้งรากตายตัว
#      และรากไดนามิกที่มาจาก `git ls-files`) · ก่อนมีเคสนี้ เกตที่ตาบอดทั้งราก `tasks/` ผ่าน selftest ได้
#   S. **ไฟล์ที่อ่านไม่ได้** (ย้าย/ลบแล้วยังไม่ staged) → `note:` บอกชื่อไฟล์ แล้ว **เดินต่อจนจบ**
#      ไม่ใช่ทั้งรอบตายโดยไม่บอกชื่อ
#
# ## เคสของคลังที่ใบ 195 ขยาย — **ครึ่งหนึ่งของด่านนี้คือ "มองเห็นอะไรบ้าง" ไม่ใช่ "ตัดสินถูกไหม"**
#   T. พาธเน่าใน `.md` **นอก** `.docs/knowledge/` (`CLAUDE.md`) → แดง — ใบ 190 เฝ้าบ้านเดียว
#      แล้วใบ 194 ก็ทิ้งพาธตายไว้นอกบ้านนั้นทันทีโดยทุกเกตเขียวหมด
#   U. พาธเน่าใน **คอมเมนต์ซอร์ส** `.ts` · `.rs` · `.sh` → แดง (เคส `.sh` คือของที่พิสูจน์ว่า
#      การเอาสำเนาเกตออกจากคลังไม่ได้ทำให้เสียการเฝ้าไฟล์เชลล์)
#   V. พาธเน่าใน **สตริงของ `throw new Error(...)`** → แดง — ไม่ใช่คอมเมนต์และไม่ใช่ import
#      ⇒ เป็นเหตุผลที่เลือก "อ่านทั้งไฟล์" แทน "แยกคอมเมนต์ออกก่อน"
#   W. **บ้านที่ยกเว้นหกหลังถือพาธเน่าไว้จริงตั้งแต่ฉากตั้งต้น** แล้วยังต้องเขียว — ⚠️ ข้อยกเว้น
#      ที่จับคู่กับฉากที่มันไม่เคยยิง คือการวัดที่จริงโดยโครงสร้าง (ความผิดที่ใบ 190 เคยทำในการ์ดตัวเอง)
#   X. ไฟล์ binary ถูกตัด **จากเนื้อไฟล์** ไม่ใช่จากนามสกุล
#   Y. ช่วงบรรทัดต่อท้าย `:12-20` ไม่ใช่ส่วนหนึ่งของพาธ (ก่อนใบ 195 เป็น false positive สองจุด)
#   Z. URL ที่ขึ้นต้นด้วยสแลช (`/api/…`) **ไม่ชนราก `api/`** — ข้อนี้คือทั้งหมดที่ทำให้ FP เป็นศูนย์
#      ตอนคลังขยายเข้ามาในซอร์ส ⇒ ต้องมีเคสตรึงไว้ ไม่ใช่ความจริงที่บังเอิญเป็นจริงวันนี้
#
# ## ตารางความไว — **รันจริงทุกรอบ ไม่ใช่ตารางร้อยแก้ว**
# ลูปท้ายไฟล์ถอดการแก้ทีละข้อออกจาก *สำเนา* ของเกต แล้วยืนยันว่าเคสที่คู่กัน **เปลี่ยนคำตัดสิน**
# · เคสที่ไม่เปลี่ยนตอนของที่มันเฝ้าหายไป คือเคสที่ไม่มีอยู่จริง
# · ตัวรันเช็คก่อนเสมอว่า `sed` **แก้ไฟล์ได้จริง** — pattern ที่ไม่ตรงกับของจริงคือแถวความไว
#   ที่เขียวตลอดกาลโดยไม่ได้วัดอะไร (บทเรียนเคส I ของ check-links-selftest)
set -uo pipefail
cd "$(dirname "$0")/../.."

# **ต่อ PID** ไม่ใช่ชื่อคงที่ — เครื่องนี้รัน `verify.sh` หลายสายขนานกันเป็นปกติ (§6 rule 6)
SANDBOX=".scratch/card-paths-selftest-$$"
trap 'chmod -R u+rwX "$SANDBOX" 2>/dev/null; rm -rf "$SANDBOX"' EXIT
pass=0
fail=0

GATE="scripts/check-card-paths.sh"
ALLOW="scripts/card-paths-allowlist.txt"
CARD=".docs/knowledge/code/demo.md"
EXTRA=".docs/knowledge/ops/extra.md"

# `sed -i` เปล่า ๆ บน BSD กินอาร์กิวเมนต์ถัดไปเป็น suffix ⇒ ใช้รูปเดียวกับ selftest ใบพี่
sed_i() { sed -i.bak "$@" && rm -f "${@: -1}.bak"; }

new_sandbox() {
  chmod -R u+rwX "$SANDBOX" 2>/dev/null
  rm -rf "$SANDBOX"
  mkdir -p "$SANDBOX/scripts" "$SANDBOX/scripts/tests" "$SANDBOX/api/src" \
           "$SANDBOX/lib/demo" "$SANDBOX/prisma/migrations" \
           "$SANDBOX/.docs/knowledge/code" "$SANDBOX/.docs/knowledge/ops" \
           "$SANDBOX/.docs/knowledge" \
           "$SANDBOX/.claude/skills/demo" \
           "$SANDBOX/.agents/rules" "$SANDBOX/tasks/done" \
           "$SANDBOX/web/src/app/[locale]/(app)" "$SANDBOX/web/tests"
  cp "$GATE" "$SANDBOX/scripts/"

  : > "$SANDBOX/api/src/real.rs"
  : > "$SANDBOX/lib/demo/mod.ts"
  : > "$SANDBOX/.docs/knowledge/DOC.md"
  : > "$SANDBOX/web/src/app/[locale]/(app)/page.tsx"
  : > "$SANDBOX/.agents/rules/real-rule.md"
  printf '#!/usr/bin/env bash\necho hi\n' > "$SANDBOX/scripts/tool.sh"
  # 🔴 **สำเนาเกตเองต้องอยู่นอกคลัง — ไม่ใช่การหลบเลี่ยง แต่เพราะมันคือ *เครื่องมือ* ไม่ใช่ *ตัวอย่าง*** (task 195)
  # ตั้งแต่คลังขยายเป็นทั้งทรี เกตจะอ่านหัวคอมเมนต์ของ **ตัวมันเอง** ซึ่งอ้างพาธจริงของรีโปหลัก
  # (`api/src/stock/models/` ฯลฯ) ที่ไม่มีวันมีอยู่ในทรีปลอม ⇒ ทุกเคสจะแดงด้วยเหตุที่ไม่เกี่ยวกับเคสเลย
  # · ความสามารถ "สแกนไฟล์ `.sh`" ยังถูกพิสูจน์อยู่ผ่าน `scripts/tool.sh` (เคส U) ⇒ ไม่ได้เสียการเฝ้า
  # · `mutated.sh` ด้วยเหตุผลเดียวกัน — มันถูกสร้างหลัง `git add` ⇒ ธง `-o` จะกวาดมันเข้ามา
  printf 'api/build/\n' > "$SANDBOX/.gitignore"

  cat > "$SANDBOX/$CARD" <<'MD'
# การ์ดสมมติของ selftest

ของจริง: `api/src/real.rs` · `web/src/app/[locale]/(app)/page.tsx`
สัญลักษณ์ต่อท้าย: `lib/demo/mod.ts::some_test(arg)`
เลขบรรทัดต่อท้าย: `.docs/knowledge/DOC.md:12`
หลาย token ต่อ span: `bash scripts/tool.sh` · `touch api/src/real.rs`
glob: `api/src/*.rs` · `web/tests/contract*.test.ts`
ตัวแทนเลขใบ: `tasks/todo/NNN-slug.md`
วงเล็บปีกกา: `api/src/{a,b}.rs`
จุดไข่ปลา: `web/…/page.tsx` · `web/.../page.tsx`
ชวเลขสัมพัทธ์ (นอกขอบเขตโดยเจตนา): `helpers/api/x.ts` · `components/demo/`
พาธที่ตั้งใจให้ไม่มี: `.github/gone.md`
พาธที่ gitignore คลุม: `api/build/out.txt`
รากไดนามิก: `.agents/rules/real-rule.md`

```
แผนที่ในบล็อกโค้ด — ต้องถูกสแกนด้วย: `api/src/real.rs`
```
MD

  printf '# การ์ดที่สอง\n\nของจริง: `%s`\n' "api/src/real.rs" > "$SANDBOX/$EXTRA"

  # ── คลังนอก `.docs/knowledge/**` ที่ใบ 195 ดึงเข้ามา (ทุกใบต้องเขียวในฉากตั้งต้น)
  printf '# กติกาสมมติ\n\nของจริง: `%s`\n' "api/src/real.rs" > "$SANDBOX/CLAUDE.md"
  printf '/** หัวโมดูล — ดู `%s` */\nexport const X = 1;\n' "api/src/real.rs" \
    > "$SANDBOX/web/src/demo.ts"
  printf '//! หัวไฟล์ — คู่กับ `%s`\npub const X: u8 = 1;\n' "web/src/demo.ts" \
    > "$SANDBOX/api/src/demo.rs"
  # สตริงใน `throw new Error(...)` — ไม่ใช่คอมเมนต์ ⇒ ตัวกวาดที่เดินตาม import มองไม่เห็นตามนิยาม
  printf 'if (!x) throw new Error("ตัวตรึงอยู่ที่ `%s`");\n' "api/src/real.rs" \
    > "$SANDBOX/web/tests/demo.test.ts"
  # URL ของ API เขียนด้วยสแลชนำ ⇒ **ต้องไม่** ชนราก `api/` (ถ้าชน เคส A จะแดงทันที)
  printf 'const u = `/api/ghost/${id}`;\nconst v = `/api/customers`;\n' >> "$SANDBOX/web/src/demo.ts"
  # ช่วงบรรทัดต่อท้าย — รูปที่มากับคลังใหม่ (ก่อนใบ 195 เป็น false positive)
  printf 'ช่วงบรรทัด: `%s`\n' "api/src/real.rs:12-20" >> "$SANDBOX/CLAUDE.md"

  # ── บ้านที่ **ถูกยกเว้น** — ทุกใบถือพาธเน่าไว้ตั้งแต่ฉากตั้งต้น เพื่อให้แถวความไวมีของให้ยิงจริง
  # ⚠️ ชื่อ fixture **จงใจไม่มีคำนำหน้าเลขสามหลัก** — `check-links.sh` ชั้นสามอ่าน
  # `tasks/(todo|todo-human|done)/NNN-slug.md` ในไฟล์ที่ไม่ใช่ `.md` ว่าเป็น *พอยน์เตอร์ใบงานจริง*
  # แล้วแดงว่าใบนั้นไม่มีในสามบ้าน ⇒ ตั้งชื่อให้แยกออกจากใบจริงตั้งแต่ต้น ดีกว่าไปเจาะข้อยกเว้นให้เกตอีกใบ
  printf '# ใบที่ปิดแล้ว\n\nตอนนั้นอยู่ที่ `%s`\n' "api/src/ghost.rs" > "$SANDBOX/tasks/done/fixture-closed-card.md"
  printf '# selftest ปลอม\nghost=`%s`\n' "api/src/ghost.rs" > "$SANDBOX/scripts/tests/x-selftest.sh"
  printf -- '-- ย้ายแล้วแก้ไม่ได้: `%s`\nSELECT 1;\n' "api/src/ghost.rs" \
    > "$SANDBOX/prisma/migrations/0001_x.sql"
  printf '# สกิลที่ติดตั้งมา\n\nเขียนผลไปที่ `%s`\n' "api/src/ghost.rs" \
    > "$SANDBOX/.claude/skills/demo/SKILL.md"
  # ไบนารี: มีลำดับไบต์ที่ *อ่านเป็นพาธเน่าได้* อยู่ข้างใน ⇒ ต้องถูกตัดออกจากเนื้อไฟล์ ไม่ใช่จากนามสกุล
  printf '\000\001\002 `api/src/ghost.rs` \003\004' > "$SANDBOX/api/cover.png"

  cat > "$SANDBOX/$ALLOW" <<'TXT'
# allowlist ของแซนด์บ็อกซ์
.github/gone.md  # task 190 — ของที่ตั้งใจให้ไม่มีอยู่จริง
TXT

  git init -q "$SANDBOX"
  # 🔴 ข้อยกเว้นของสำเนาเกตอยู่ที่ **`.git/info/exclude` ไม่ใช่ `.gitignore`** — ฉาก "คลังว่าง"
  # ลบไฟล์ที่ tracked ทิ้งทั้งหมด ซึ่งรวม `.gitignore` ด้วย ⇒ ถ้าข้อยกเว้นอยู่ที่นั่น มันจะหายไปพร้อมกัน
  # แล้วสำเนาเกตจะโผล่กลับเข้าคลังพอดีในฉากที่ต้องพิสูจน์ว่าคลังว่าง (เจอจริงตอนเขียนแถวนี้)
  printf 'scripts/check-card-paths.sh\nscripts/mutated.sh\n' >> "$SANDBOX/.git/info/exclude"
  sandbox_add
}

# ⚠️ **`add -A` ไม่มี `-f`** — `-f` แปลว่า "เพิ่มของที่ถูก exclude ด้วย" ซึ่งจะลากสำเนาเกตกลับเข้าคลัง
# ทุกครั้ง แล้วต้องไปถอนออกจาก index ทีหลัง = สองคำสั่งที่ต้องตรงกันเสมอ · ตัด `-f` ทิ้งทำให้
# `.git/info/exclude` เป็นคำตอบเดียวของคำถาม "อะไรอยู่นอกคลัง" ทั้งตอน add และตอนที่เกตอ่าน
sandbox_add() { git -C "$SANDBOX" add -A >/dev/null 2>&1; }

# `< /dev/null` ไม่ใช่ของประดับ: เกตที่ถูก mutate จนเรียก awk โดยไม่มีไฟล์เลย จะไปอ่าน stdin
# ⇒ selftest ค้างทั้งใบแทนที่จะรายงานผล (เจอจริงตอนเขียนแถวความไวของเคส L)
run_gate() { bash "${1:-$SANDBOX/scripts/check-card-paths.sh}" </dev/null 2>&1; }

expect() { # $1=ชื่อเคส $2=exit ที่คาด $3=ข้อความที่ต้องมี $4=ข้อความที่ต้องไม่มี $5=เกตที่จะรัน
  local case_name="$1" want_exit="$2" want_msg="${3:-}" deny_msg="${4:-}" gate="${5:-}" got out ok=1
  out="$(run_gate "$gate")"
  got=$?
  if [ "$got" -ne "$want_exit" ]; then
    echo "  FAIL: $case_name — exit=$got คาด $want_exit"; ok=0
  fi
  if [ -n "$want_msg" ] && ! grep -qF -- "$want_msg" <<<"$out"; then
    echo "  FAIL: $case_name — ไม่พบข้อความ \"$want_msg\""; ok=0
  fi
  if [ -n "$deny_msg" ] && grep -qF -- "$deny_msg" <<<"$out"; then
    echo "  FAIL: $case_name — เจอข้อความที่ต้องไม่มี \"$deny_msg\" (สาเหตุคนละใบถูกรายงานปนกัน)"; ok=0
  fi
  if [ "$ok" -eq 1 ]; then
    echo "  ok: $case_name"; pass=$((pass + 1))
  else
    printf '    --- output ---\n%s\n    --------------\n' "$out"; fail=$((fail + 1))
  fi
}

# ── ฉากที่ตารางความไวเรียกใช้ซ้ำ (สร้างแซนด์บ็อกซ์ใหม่เองทุกตัว)
add_line() { printf '%s\n' "$2" >> "$SANDBOX/$1"; }

sc_green()      { new_sandbox; }
sc_dead_prose() { new_sandbox; add_line "$CARD" 'พาธที่ย้ายไปแล้ว: `api/src/ghost.rs`'; }
sc_dead_fence() { new_sandbox; add_line "$CARD" '```'
                  add_line "$CARD" 'แผนที่: `api/src/ghost.rs`'; add_line "$CARD" '```'; }
sc_dead_brackets() { new_sandbox
                  add_line "$CARD" 'จอที่ย้ายแล้ว: `web/src/app/[locale]/(app)/ghost.tsx`'; }
sc_dead_2nd_token() { new_sandbox; add_line "$CARD" 'สั่งด้วย: `touch api/src/ghost.rs`'; }
sc_dead_after_dbl() { new_sandbox
                  add_line "$CARD" 'backtick ตัวจริง: `` `x` `` แล้วต่อด้วย `api/src/ghost.rs`'; }
sc_allow_exists() { new_sandbox; mkdir -p "$SANDBOX/.github"; : > "$SANDBOX/.github/gone.md"; }
sc_allow_uncited() { new_sandbox
                  add_line "$ALLOW" '.docs/never-cited.md  # task 190 — ไม่มีการ์ดไหนอ้าง'; }
sc_allow_notask() { new_sandbox
                  add_line "$ALLOW" '.docs/no-reason.md  # เพราะฉันว่าอย่างนั้น'
                  add_line "$CARD" 'อีกอันที่ตั้งใจให้ไม่มี: `.docs/no-reason.md`'; }
sc_gitignored_exists() { new_sandbox; mkdir -p "$SANDBOX/api/build"; : > "$SANDBOX/api/build/out.txt"; }
sc_unreadable()  { new_sandbox; chmod 000 "$SANDBOX/$EXTRA"; }
# คลังว่าง = *ไม่มีไฟล์ไหนอ่านได้เลย* (ลบไฟล์ทิ้งแต่ index ยังจำ) — ตั้งแต่ใบ 195 การลบ
# `.docs/knowledge/` ทิ้งไม่ทำให้คลังว่างอีกแล้ว ⇒ ฉากเดิมจะวัดคนละเรื่องกับ guard ที่มันคู่อยู่
sc_no_files()    { new_sandbox; git -C "$SANDBOX" ls-files -z | (cd "$SANDBOX" && xargs -0 rm -f); }
sc_all_binary()  { sc_no_files; printf '\x00\x01 `api/src/ghost.rs` \x02' > "$SANDBOX/api/only.bin"
                  sandbox_add; }
sc_awk_fail()    { new_sandbox
                  sed_i 's|k = split(s, t, /\[ \\t\]+/)|k = split(|' "$SANDBOX/scripts/check-card-paths.sh"; }
# ── ฉากของคลังใหม่ (ใบ 195)
sc_dead_claudemd()  { new_sandbox; add_line "CLAUDE.md" 'กติกาชี้ไปที่: `api/src/ghost.rs`'; }
sc_dead_ts_comment(){ new_sandbox; add_line "web/src/demo.ts" '/* ย้ายไปแล้ว: `api/src/ghost.rs` */'; }
sc_dead_rs_comment(){ new_sandbox; add_line "api/src/demo.rs" '//! ย้ายไปแล้ว: `api/src/ghost.rs`'; }
sc_dead_throw()     { new_sandbox
                  add_line "web/tests/demo.test.ts" 'throw new Error("ดู `api/src/ghost.rs`");'; }
sc_dead_sh()        { new_sandbox; add_line "scripts/tool.sh" '# ย้ายไปแล้ว: `api/src/ghost.rs`'; }
sc_all_roots()   { new_sandbox
                  add_line "$CARD" 'ทุกราก: `api/x/ghost.rs` `web/x/ghost.tsx` `scripts/x/ghost.sh`'
                  add_line "$CARD" 'ต่อ: `tasks/x/ghost.md` `.docs/x/ghost.md` `.github/x/ghost.yml`'
                  add_line "$CARD" 'ไดนามิก: `.agents/x/ghost.md`'; }

# ── เคสถูกแตกเป็นบาร์เรลที่ใบ 195 (§4) — **พาธของไฟล์เข้าไม่ขยับ** (`verify.sh` เรียกด้วยพาธนี้)
# 🔴 **ต้องเช็คว่าครบก่อน `.`** — สคริปต์นี้ใช้ `set -uo pipefail` (ไม่มี `-e`) ⇒ `.` ที่ล้มจะพิมพ์
# ลง stderr แล้ว **เดินต่อจนจบและ exit 0 พร้อมจำนวนเคสที่น้อยลง** ซึ่งอ่านจากภายนอกไม่ออกเลยว่าหายไป
# (บทเรียนคำต่อคำจาก `check-counter-test-selftest.sh` ใบ 193)
CASES_DIR="scripts/tests/check-card-paths-selftest"
# ⚠️ **ตรวจ `-r` อย่างเดียวไม่พอ และวัดแล้วว่าไม่พอ** (ใบ 239) — ไฟล์เคสที่ *มีอยู่แต่ syntax พัง*
# ทำให้ `.` คืน non-zero แล้วรอบนี้ **เดินต่อจนจบ exit 0 พร้อมแต้มที่น้อยลง**: แทรก `if` ค้างไว้
# ต้นไฟล์ `cases-sensitivity.sh` วัดได้ **ผ่าน 70 → 43 แล้วยังพิมพ์ `OK`** ⇒ รอบที่พิสูจน์ได้
# 43 จาก 70 ประกาศตัวเองว่าเขียว · ⇒ `.` ต้องเกิด **ในลูปเดียวกับการตรวจ** แล้วอ่าน `rc` ทันที
# ⇒ ปิดรูที่สองไปด้วย: เดิมรายชื่อใบเขียนสองที่ (ลูปตรวจ + บรรทัด `.`) ที่ไม่มีอะไรผูกกันเลย
# = §6 rule 1 คำต่อคำ ⇒ พิมพ์พาธผิดในบรรทัด `.` ใบเดียว = ลูปตรวจใบที่สะกดถูกแล้วผ่าน
for half in cases-behaviour.sh cases-sensitivity.sh; do
  if [ ! -r "$CASES_DIR/$half" ]; then
    echo "FAIL: หาไฟล์เคสไม่เจอ: $CASES_DIR/$half — รอบนี้จะนับเคสไม่ครบโดยไม่มีอะไรบอก"
    exit 1
  fi
  # shellcheck source=/dev/null
  . "$CASES_DIR/$half"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "FAIL: โหลด $CASES_DIR/$half ไม่สำเร็จ (rc=$rc) — เคสในใบนั้นไม่ได้รันครบ"
    exit 1
  fi
done

chmod -R u+rwX "$SANDBOX" 2>/dev/null
rm -rf "$SANDBOX"
echo "check-card-paths-selftest: ผ่าน $pass · ล้ม $fail"
[ "$fail" -eq 0 ] || exit 1
echo "check-card-paths-selftest: OK"
