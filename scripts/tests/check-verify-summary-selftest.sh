#!/usr/bin/env bash
# เกตของ **บรรทัดสรุปของ `verify.sh`** (task 258)
#
# สิ่งที่พิสูจน์:
#   1. เกตแดง → บรรทัดสุดท้าย **เอ่ยชื่อด่านที่แดง** (ไม่ใช่ `verify: FAILED` เปล่า ๆ)
#   2. หลายด่านแดงพร้อมกัน → **เอ่ยครบทุกใบ** ไม่ใช่ใบแรกใบเดียว
#   3. ทุกด่านเขียว → บรรทัดเดิมเป๊ะ `verify: ALL GREEN` (ไม่มีหางงอกมาทำให้ตัวรอค้าง)
#   4. คำนำหน้า `^verify: ` **ไม่ขยับทั้งสองทิศ** — ตัวรอของคนและของ agent match บรรทัดนี้อยู่
#      (บันทึกเป็นความจำถาวรหลังจากเคยค้างเพราะ grep หาคำว่า `OK` แต่บรรทัดจริงคือ `ALL GREEN`)
#   5. `check-knowledge.sh` **พิมพ์ชื่อตัวเองตอนแดง** เหมือนตอนเขียว — ด่านที่เงียบใบเดียว
#      ที่ทำให้ใบนี้ถูกเปิด (เกิดจริงสามครั้ง: ใบ 213 · ใบ 260 · ใบ 267)
#
# 🔑 **ทำไมต้องรัน `verify.sh` ตัวจริงบนด่านปลอม ไม่ใช่รันด่านจริง** — ของที่ทดสอบคือ
# *การรายงาน* ไม่ใช่ *ผลของด่าน* ⇒ ด่านปลอมที่ `exit 1` ทันทีให้เคสที่แม่นกว่าและเร็วกว่า
# (ด่านจริงชุดเต็มใช้เวลาเป็นนาทีและพาความผันผวนของ docker/toolchain เข้ามาโดยไม่จำเป็น)
# · แต่ **`verify.sh` ต้องเป็นสำเนาไบต์ต่อไบต์ของตัวจริง** ไม่ใช่สคริปต์จำลอง — ไม่งั้นเทสนี้
# เฝ้าสิ่งที่ตัวเองเขียน ไม่ใช่สิ่งที่รันจริงตอนคนกดเกต
set -uo pipefail
cd "$(dirname "$0")/../.."

pass=0
fail=0
scratch=".scratch/verify-summary-selftest-$$"
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/scripts/tests" "$scratch/scripts/lib"

ok()  { pass=$((pass + 1)); echo "  ok: $1"; }
bad() { fail=1; echo "  FAIL: $1"; }

# ── สนามจำลอง: `verify.sh` ตัวจริง + ด่านปลอมชื่อเดียวกับของจริงทุกใบ
#    (`verify.sh` ทำ `cd "$(dirname "$0")"` แล้วรัน `bash <ชื่อด่าน>` ⇒ มันจะเจอของปลอม)
cp scripts/verify.sh "$scratch/scripts/verify.sh"
cp scripts/lib/job-group.sh "$scratch/scripts/lib/job-group.sh"

# รายชื่อด่าน **อ่านจาก `verify.sh` ตัวจริง** ไม่ใช่พิมพ์ซ้ำ — ลิสต์ที่ก๊อปมาจะดริฟต์เงียบ ๆ
# วันที่มีคนเพิ่มด่าน แล้วเทสนี้จะสร้างของปลอมไม่ครบ ⇒ `verify.sh` ไปเรียกด่านจริงบางใบ
# ⚠️ **ต้องตัด `;` ด้วย ไม่ใช่แค่ช่องว่างกับ `\`** — ด่านใบสุดท้ายของลิสต์ติด `; do` มากับมัน
# ⇒ `check-code.sh;` ตกตะแกรง `\.sh$` ⇒ **ด่านที่แพงที่สุดหายไปจากสนามจำลองเงียบ ๆ** แล้ว
# `verify.sh` วิ่งไปเจอ "No such file" · เคสที่ 3 ข้างล่างจับได้ตอนเขียนเทสนี้จริง (ไม่ใช่สมมติ)
# **ใบ 017: อ่านจาก *ทั้งสอง* อาร์เรย์** — `verify.sh` แยกด่านเป็นสองชั้นแล้ว (`core_gates`
# ที่รันทุกรอบ กับ `gate_selftests` ที่รันเมื่อ `scripts/**` ขยับ) และลูปวนบน `"${gates[@]}"`
# ⇒ ตัวแยกที่อ่านแค่บรรทัด `for c in` จะได้ศูนย์ใบ · เกณฑ์ `>= 10` ข้างล่างคือสิ่งที่จับได้
# ถ้าวันหน้ามีคนเปลี่ยนชื่ออาร์เรย์แล้วลืมไฟล์นี้ — มันแดงทันที ไม่ได้เขียวด้วยสนามที่ว่าง
gates=$(awk '/^(core_gates|gate_selftests)=\(/,/^\)$/' scripts/verify.sh |
  tr ' \\;' '\n' | grep -E '\.sh$' | LC_ALL=C sort -u)
[ -n "$gates" ] || { echo "verify-summary-selftest: FAIL — อ่านรายชื่อด่านจาก verify.sh ไม่ได้"; exit 1; }
gate_count=$(printf '%s\n' "$gates" | wc -l | tr -d ' ')
echo "verify-summary-selftest: กวาดด่านจาก verify.sh ได้ $gate_count ใบ"
# `swept = 0` คือ FAIL ไม่ใช่เขียว — บทเรียน `check-file-length.sh` ของใบ 193
[ "$gate_count" -ge 10 ] || { echo "verify-summary-selftest: FAIL — ด่านน้อยผิดปกติ ($gate_count)"; exit 1; }

make_gates() { # $1... = ชื่อด่านที่ต้องให้แดง (ที่เหลือเขียว)
  local red=" $* "
  printf '%s\n' "$gates" | while IFS= read -r g; do
    mkdir -p "$scratch/scripts/$(dirname "$g")"
    if [ "${red#* $g }" != "$red" ]; then
      printf '#!/usr/bin/env bash\necho "%s: FAIL — ปลอม"\nexit 1\n' "$g" > "$scratch/scripts/$g"
    else
      printf '#!/usr/bin/env bash\necho "%s: OK — ปลอม"\n' "$g" > "$scratch/scripts/$g"
    fi
  done
}

# 🔑 `VERIFY_GATES=1` — สนามจำลองต้องรัน **ทั้งสองชั้น** ไม่ใช่ชั้นที่วันนี้บังเอิญเข้าเงื่อนไข
# (ใบ 017) · ไม่อย่างนั้นสัญญาของบรรทัดสรุปจะถูกพิสูจน์แค่ครึ่งลิสต์ และครึ่งที่เหลือเปลี่ยนรูป
# ได้โดยเทสนี้ยังเขียว · และมันตัดตัวตรวจ `git` ของ `verify.sh` ออกจากผลของเทสนี้ไปด้วย ⇒
# เทสนี้ให้คำตอบเดิมไม่ว่าทรีจริงจะสกปรกหรือสะอาด
export VERIFY_GATES=1

run_verify() { bash "$scratch/scripts/verify.sh" 2>&1 | tail -1; }

# ── 1. ด่านเดียวแดง → บรรทัดสรุปต้องเอ่ยชื่อมัน
make_gates check-knowledge.sh
line=$(run_verify)
case "$line" in
  "verify: FAILED"*) ok "ด่านแดงหนึ่งใบ — ขึ้นต้น 'verify: FAILED' ตามเดิม" ;;
  *) bad "บรรทัดสรุปไม่ได้ขึ้นต้นด้วย 'verify: FAILED' (ได้: $line)" ;;
esac
case "$line" in
  *check-knowledge.sh*) ok "บรรทัดสรุปเอ่ยชื่อด่านที่แดง" ;;
  *) bad "บรรทัดสรุปไม่เอ่ยชื่อด่านที่แดง (ได้: $line)" ;;
esac

# ── 2. หลายด่านแดง → ต้องเอ่ยครบ ไม่ใช่ใบแรกใบเดียว
#    (ใบแรกที่แดงมักเป็น selftest ที่แดงตามกัน ⇒ ใบที่คนสนใจอยู่ท้ายลิสต์ได้)
make_gates check-links.sh check-code.sh
line=$(run_verify)
miss=""
for g in check-links.sh check-code.sh; do
  case "$line" in *"$g"*) ;; *) miss="$miss $g" ;; esac
done
if [ -z "$miss" ]; then ok "แดงสองใบ — เอ่ยครบทั้งสอง"
else bad "แดงสองใบแต่ไม่เอ่ย:$miss (ได้: $line)"; fi

# ── 3. เขียวหมด → บรรทัดต้องเป็น `verify: ALL GREEN` เป๊ะแบบเดิม
#    ⚠️ ข้อนี้คือด้านที่ **ห้ามพัง** ของการแก้ใบนี้ — หางที่งอกบนบรรทัดเขียวจะไปโผล่ในตัวรอ
make_gates
green_out=$(bash "$scratch/scripts/verify.sh" 2>&1)
line=$(printf '%s\n' "$green_out" | tail -1)
# 🔑 **ด่านที่หายไปจากสนามจำลองต้องแดงด้วยชื่อของมันเอง ไม่ใช่ด้วย "บรรทัดสรุปเปลี่ยนรูป"** —
# ตอนเขียนเทสนี้ตัวแยกรายชื่อทิ้ง `check-code.sh` ไปจริง แล้วอาการที่เห็นคือเคสนี้แดงด้วย
# ข้อความที่ชี้ไปผิดที่ ⇒ เพิ่มเข็มที่บอกสาเหตุตรง ๆ
case "$green_out" in
  *"No such file"*) bad "สนามจำลองสร้างด่านไม่ครบ — ตัวแยกรายชื่อจาก verify.sh ทิ้งบางใบ" ;;
  *) ok "สร้างด่านปลอมครบทุกใบที่ verify.sh เรียก" ;;
esac
case "$line" in
  "verify: ALL GREEN"*) ok "เขียวหมด — บรรทัดเดิมเป๊ะ ไม่มีหางชื่อด่านงอกมา" ;;
  *) bad "เขียวหมดแต่บรรทัดสรุปเปลี่ยนรูป (ได้: $line)" ;;
esac
case "$line" in
  *check-knowledge.sh*|*"ด่านที่แดง"*) bad "บรรทัดเขียวไม่ควรเอ่ยชื่อด่านเลย (ได้: $line)" ;;
  *) ok "บรรทัดเขียวไม่เอ่ยชื่อด่าน" ;;
esac

# ── 4. `check-knowledge.sh` ตัวจริงต้องพิมพ์ชื่อตัวเอง **ตอนแดง** ไม่ใช่แค่ตอนเขียว
#    ปั้นทรีการ์ดค้างจริง: การ์ดหนึ่งใบที่ `sources:` ชี้ไฟล์ที่ **commit ทีหลัง**
kb="$scratch/tree"
mkdir -p "$kb/.docs/knowledge/code" "$kb/scripts/lib" "$kb/src"
cp scripts/check-knowledge.sh "$kb/scripts/"
[ -f scripts/lib/file-length-scope.sh ] && cp scripts/lib/*.sh "$kb/scripts/lib/" 2>/dev/null
printf 'x\n' > "$kb/src/thing.ts"
cat > "$kb/.docs/knowledge/code/fake.md" <<'CARD'
---
sources:
  - src/thing.ts
---

# การ์ดปลอมของ selftest
CARD
# 🔴 **ต้องเป็น git repo จริง** — `ftime` อ่าน **เวลา commit** (`git log -1 --format=%ct`)
# ไม่ใช่ mtime ⇒ `touch` อย่างเดียวไม่ทำให้การ์ดค้าง และเทสจะเขียวโดยไม่ได้ทดสอบอะไรเลย
# (พลาดจริงตอนเขียนเทสนี้ — เคสนี้เขียวผิดรอบแรก) · คุมลำดับด้วย `GIT_COMMITTER_DATE`
# ไม่ใช่หวังให้สอง commit ตกคนละวินาที
(
  cd "$kb" || exit 1
  git init -q . 2>/dev/null
  git config user.email t@t; git config user.name t
  git add .docs >/dev/null 2>&1
  GIT_COMMITTER_DATE='2020-01-01T00:00:00+07:00' GIT_AUTHOR_DATE='2020-01-01T00:00:00+07:00' \
    git commit -q -m card >/dev/null 2>&1
  git add src >/dev/null 2>&1
  GIT_COMMITTER_DATE='2030-01-01T00:00:00+07:00' GIT_AUTHOR_DATE='2030-01-01T00:00:00+07:00' \
    git commit -q -m source >/dev/null 2>&1
)
out=$( (cd "$kb" && bash scripts/check-knowledge.sh) 2>&1 )
rc=$?
if [ "$rc" -ne 0 ]; then ok "การ์ดค้าง ⇒ check-knowledge exit ไม่ใช่ 0"
else bad "การ์ดค้างแต่ check-knowledge เขียว"; fi
case "$out" in
  *"check-knowledge: FAIL"*) ok "check-knowledge พิมพ์ชื่อตัวเองตอนแดง (อาการเดิมของใบ 258)" ;;
  *) bad "check-knowledge แดงแต่ไม่เอ่ยชื่อตัวเอง — อาการที่ใบ 258 เปิดมาปิดพอดี" ;;
esac
# 🔴 **เข็มต้องผูกกับ *ชื่อการ์ดจริง* ไม่ใช่คำว่า `STALE:` เปล่า ๆ** — บรรทัดสรุปที่ใบ 258
# เพิ่งเพิ่มมีคำว่า `STALE:` อยู่ในตัวมันเอง ("ดูบรรทัด STALE:/FAIL: ข้างบน") ⇒ เข็มแบบสั้น
# **อิ่มตัวด้วยบรรทัดสรุป** แล้วถอดบรรทัดรายใบทิ้งได้โดยเทสยังเขียว (วัดแล้ว: S5 เขียวรอบแรก)
# · คลาสเดียวกับรูที่รีวิวของใบ 267 จับได้ในเกตของใบนั้น — เข็มที่นับ "มีคำนี้อยู่" ไม่ใช่เข็ม
case "$out" in
  *"STALE: .docs/knowledge/code/fake.md"*) ok "ยังพิมพ์บรรทัด STALE: รายใบ ที่บอกว่าการ์ดใบไหน" ;;
  *) bad "หายบรรทัด STALE: รายใบ — บรรทัดสรุปแทนที่รายละเอียดไม่ได้" ;;
esac
case "$out" in
  *"source newer than card: src/thing.ts"*) ok "บรรทัด STALE: ยังบอก **source ใบไหน** ที่ทำให้ค้าง" ;;
  *) bad "บรรทัด STALE: ไม่บอก source ที่ทำให้ค้าง — เหลือแต่ชื่อการ์ดคือครึ่งเดียวของคำตอบ" ;;
esac

echo "verify-summary-selftest: ผ่าน $pass"
[ "$fail" -eq 0 ] || { echo "verify-summary-selftest: FAILED"; exit 1; }
echo "verify-summary-selftest: OK"
