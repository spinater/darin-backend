#!/usr/bin/env bash
# เกตของ **เครื่องมือที่ §6 rule 8 สั่งให้ใช้แทน `git checkout`** (ใบ 187)
#
# `scripts/counter-test.sh` คือทางที่ rulebook บังคับสำหรับ counter-test ทุกครั้ง เพราะมัน
# "คืนด้วย `cp` แล้วยืนยันผล" ⇒ **ความน่าเชื่อถือของ rule 8 ทั้งข้อพิงอยู่บนสคริปต์ใบเดียว**
# ที่ก่อนใบ 187 ไม่มีเทสสักตัว · และมันเคย **คืนสำเนาของรอบก่อนแล้วประกาศว่าสำเร็จ** มาแล้วจริง
# ⇒ คลาสเดียวกับ "เกตที่โกหกว่าเขียว" เป๊ะ ๆ
#
# รูปเดียวกับพี่น้องในโฟลเดอร์นี้ (ใบ 095 · 151 · 168): ก๊อปสคริปต์ลงแซนด์บ็อกซ์ใน `.scratch/`
# แล้วพังทีละแบบ · ไม่ต้องมี toolchain/docker · จบในไม่กี่วินาที
#
# ## ⚠️ กติกาข้อเดียวที่ห้ามลืมตอนแก้ไฟล์นี้
# ไฟล์นี้เป็น `.sh` ⇒ **`check-links.sh` ชั้นที่สามสแกนไฟล์นี้ด้วย** ⇒ ห้ามเขียนพาธใบงาน
# (`tasks/<บ้าน>/NNN-slug.md`) เป็นสตริงตรง ๆ เด็ดขาด — อ้างด้วยคำว่า "ใบ NNN" เท่านั้น
#
# ## ใบนี้ถูกแตกเป็นสามไฟล์ที่ใบ 193 — เกต 500 บรรทัดเพิ่งเห็น `.sh` เป็นครั้งแรก
# (ก่อนหน้านั้นมันเลือกไฟล์ด้วยรายการสกุล ⇒ เชลล์ไม่เคยถูกกวาดเลย) ⇒ ใบเดิม 591 บรรทัดเกินเพดาน
# · ไฟล์นี้ = โครง: `set`/`cd` · `SANDBOX`+`trap` · ตัวนับแต้ม · ตัวช่วยทุกตัว · บรรทัดสรุป
# · `scripts/tests/check-counter-test-selftest/cases-behaviour.sh`  = สารบัญเคส A–U + ตัวเคสเอง
# · `scripts/tests/check-counter-test-selftest/cases-sensitivity.sh` = ตารางความไว + เคส S1–S17
# **ทางเข้าไม่ย้าย** (§4 "prefer the barrel") — `verify.sh` ยังเรียกพาธเดิมและไม่ต้องแก้อะไร
set -uo pipefail
cd "$(dirname "$0")/../.."

# **ต่อ PID** — เครื่องนี้รัน `verify.sh` หลายสายขนานกันเป็นปกติ (§6 rule 6) ⇒ ชื่อคงที่ +
# `rm -rf` ตอนต้นทุกเคส = สายหนึ่งลบทับกลางคันของอีกสาย (เจอจริงตอนใบ 168)
# · `trap` คู่กันเสมอ: ชื่อไม่ซ้ำแปลว่ารอบที่ถูกขัดจังหวะทิ้งขยะค้างถาวรแทนที่จะถูกเขียนทับ
SANDBOX=".scratch/counter-test-selftest-$$"
trap 'rm -rf "$SANDBOX"' EXIT
pass=0
fail=0
CT="scripts/counter-test.sh"

# ── ไฟล์ทั้งชุดที่ประกอบเป็นเครื่องมือ — **อ่านจากบรรทัด `.` ของทางเข้าเอง ไม่ใช่ glob**
#
# ใบ 188 แตก `counter-test.sh` เป็นทางเข้า + โมดูลใต้ `scripts/lib/` ⇒ ถ้าที่นี่ยังก๊อป/สแกน
# ไฟล์เดียว **ตารางความไวจะเฝ้าโค้ดน้อยลงทุกครั้งที่มีการแตกไฟล์** ซึ่งเป็นบทเรียนคำต่อคำของ
# `check-sql-coverage-selftest` เคส F (§7) · และ **ห้ามใช้ glob ตามธรรมเนียมชื่อ** — §7 วัดแล้ว
# ว่าหลอกได้: ตั้งชื่อโมดูลนอกแบบ แล้วคอร์ปัสไม่มีโค้ดที่เครื่องมือรันจริงอยู่เลยโดยไม่มีอะไรแดง
# ⇒ ที่นี่เก็บค่าตัวแปรจากทางเข้า แล้วแปลงทุกบรรทัด `. "$VAR"` เป็นไฟล์จริง · **ชี้ไปไฟล์ที่
# ไม่มีอยู่ = แดงทันที** (ไม่ใช่เงียบแล้วเฝ้าน้อยลง)
ct_parts_src() {
  printf '%s\n' "$CT"
  awk '
    /^[A-Za-z_][A-Za-z0-9_]*="[^"]*"$/ {
      k = $0; sub(/=.*/, "", k)
      v = $0; sub(/^[^=]*="/, "", v); sub(/"$/, "", v)
      val[k] = v; next
    }
    /^\. / { p = $2; gsub(/["$]/, "", p); if (p in val) p = val[p]; print p }
  ' "$CT"
}

new_sandbox() {
  rm -rf "$SANDBOX"
  mkdir -p "$SANDBOX/scripts" "$SANDBOX/a"
  while IFS= read -r part; do
    if [ ! -f "$part" ]; then
      echo "counter-test-selftest: ทางเข้าอ้างไฟล์ที่ไม่มีจริง ($part) — คอร์ปัสไม่ครบ"
      exit 1
    fi
    mkdir -p "$SANDBOX/$(dirname "$part")"
    cp "$part" "$SANDBOX/$part"
  done < <(ct_parts_src)
  printf '.scratch/\n' > "$SANDBOX/.gitignore"
  printf 'ORIG-SLASH\n'      > "$SANDBOX/a/b.txt"
  printf 'ORIG-UNDERSCORE\n' > "$SANDBOX/a_b.txt"
  printf 'ORIG-X\n'          > "$SANDBOX/x.txt"
  printf 'ORIG-Y\n'          > "$SANDBOX/y.txt"
  printf 'ORIG-Z\n'          > "$SANDBOX/z.txt"
  git init -q "$SANDBOX"
  git -C "$SANDBOX" add -Af >/dev/null 2>&1
  git -C "$SANDBOX" -c user.email=selftest@local -c user.name=selftest commit -qm base >/dev/null 2>&1
}

# รันสคริปต์ในแซนด์บ็อกซ์ · เก็บผลใส่ $OUT/$RC **แล้วค่อย grep จาก herestring**
# — ห้าม `… | grep -q` (SIGPIPE ⇒ 141 ⇒ "ไม่เจอ" ทั้งที่เจอ · บทเรียนใบ 095)
OUT=""; RC=0
# ⚠️ ต้อง `cd` เข้าแซนด์บ็อกซ์ก่อนเรียก — สคริปต์ resolve อาร์กิวเมนต์เทียบ **ที่ที่ผู้เรียกยืนอยู่**
# แล้วปฏิเสธของนอกรากรีโปของมันเอง ⇒ เรียกจากรากรีโปจริงจะได้ "อยู่นอกรีโปนี้" ทุกใบ
# (เจอตอนเขียนเทสนี้เอง — และนั่นแปลว่าด่านนอกรากทำงานจริง)
run() { # $1 = เลขสาย, ที่เหลือ = อาร์กิวเมนต์ของสคริปต์
  local ln="$1"; shift
  OUT="$(cd "$SANDBOX" && COUNTER_TEST_LANE="$ln" bash scripts/counter-test.sh "$@" 2>&1)"
  RC=$?
}

ok()   { pass=$((pass + 1)); }
bad()  { echo "  FAIL: $1"; fail=$((fail + 1)); }
want_exit() { [ "$RC" = "$1" ] && ok || bad "$2 — exit=$RC คาด $1"; }
want_msg()  { case "$OUT" in *"$1"*) ok ;; *) bad "$2 — ไม่พบข้อความ \"$1\"" ;; esac; }
deny_msg()  { case "$OUT" in *"$1"*) bad "$2 — เจอข้อความที่ต้องไม่มี \"$1\"" ;; *) ok ;; esac; }
want_file() { # $1=พาธในแซนด์บ็อกซ์ $2=เนื้อที่คาด $3=ชื่อเคส
  local got; got="$(cat "$SANDBOX/$1" 2>/dev/null)"
  [ "$got" = "$2" ] && ok || bad "$3 — $1 มีเนื้อ \"$got\" คาด \"$2\""
}
# ⚠️ หา blob จาก **manifest** ไม่ใช่เดาชื่อไฟล์ — เดาชื่อ (`0001.blob`) ทำให้เคส D/I
# แดงพ่วงไปกับ S3/S4 ที่เปลี่ยนชื่อ/ที่อยู่ของ blob ⇒ ตารางความไวอ่านไม่ออกว่าอะไรเฝ้าอะไร
# (วัดจริงรอบแรก: S3 ลาก D+I แดงด้วย · S4 ก็เหมือนกัน)
blob_path() { # $1=เลขสาย $2=พาธไฟล์ → พาธ blob จริง
  local sdir="$SANDBOX/.scratch/counter-test/$1" m b
  [ -f "$sdir/manifest.tsv" ] || sdir="$SANDBOX/.scratch/counter-test"
  m="$sdir/manifest.tsv"
  b="$(awk -F'\t' -v p="$2" '$1==p{print $4}' "$m" 2>/dev/null | head -1)"
  [ -n "$b" ] && printf '%s' "$sdir/$b"
}

store_dir() { # $1=เลขสาย → ไดเรกทอรีคลังจริง (ทนต่อการถอดคลังต่อสายในเคส S4)
  local d="$SANDBOX/.scratch/counter-test/$1"
  [ -d "$d" ] || d="$SANDBOX/.scratch/counter-test"
  printf '%s' "$d"
}
store_files() { # นับ **สำเนา** ในคลัง โดยไม่ผูกกับสกุลชื่อ (เคส S3 เปลี่ยนชื่อ blob)
  find "$(store_dir "$1")" -maxdepth 1 -type f \
    ! -name manifest.tsv ! -name owner.txt ! -name window.start 2>/dev/null | wc -l | tr -d ' '
}

# `sed` ที่ไม่แมตช์ = ความไวปลอม ⇒ ทุกเคส S ต้องผ่านตัวนี้ก่อน
# ⚠️ **ถอนจากไฟล์ *ทั้งชุด* ไม่ใช่จากทางเข้าใบเดียว** (ใบ 188) — แถว S ไม่ต้องรู้ว่าโค้ดที่มัน
# ถอนอยู่ไฟล์ไหน ⇒ ย้ายโค้ดข้ามโมดูลทีหลังไม่ทำให้แถวไหนเงียบลง · เกณฑ์ยังเป็นเดิม: ไม่แมตช์
# สักไฟล์ = แดง (ไม่ใช่ "ผ่านเพราะไม่มีอะไรให้ถอน")
sed_must_match() { # $1=นิพจน์ $2=ชื่อเคส
  local f before after hit=0
  while IFS= read -r f; do
    f="$SANDBOX/$f"
    [ -f "$f" ] || continue
    before="$(sha256sum "$f" | cut -d' ' -f1)"
    sed -i "$1" "$f"
    after="$(sha256sum "$f" | cut -d' ' -f1)"
    [ "$before" != "$after" ] && hit=$((hit + 1))
  done < <(ct_parts_src)
  [ "$hit" -gt 0 ] || { bad "$2 — sed ไม่แมตช์อะไรเลยในไฟล์ทั้งชุด (ความไวที่วัดไม่ได้ = วัดไม่ได้จริง)"; return 1; }
  return 0
}

# ══ ต่อสองใบเข้ากับโครงนี้ ═══════════════════════════════════════════════════════
# ⚠️ ต้องเป็น `.` (source) เท่านั้น — ห้าม `bash <ไฟล์>` ห้าม pipe ห้าม subshell:
# `pass`/`fail`/`OUT`/`RC`/`SANDBOX` ต้องเป็น **ชุดเดียว** กับที่นับไว้ข้างบน · ลูกที่เป็น
# โปรเซสแยกจะนับแต้มของตัวเอง ⇒ ใบนี้พิมพ์ "ผ่าน 0" **แล้ว exit 0** = เขียวปลอมที่เงียบสนิท
# · `trap` ข้างบนคุมโค้ดที่ source เข้ามาด้วย เพราะมันคือเชลล์ตัวเดียวกัน ⇒ แซนด์บ็อกซ์ยังถูก
#   เก็บกวาดเหมือนเดิมแม้รอบจะตายกลางเคส
# · สองใบนั้น **ไม่ได้นิยามตัวช่วยเอง** ⇒ ลำดับสำคัญ: ต้องอยู่ **หลัง** บล็อกตัวช่วยข้างบนเสมอ
# · พาธเป็นแบบเทียบรากรีโป เพราะ `cd` ข้างบนรันไปแล้ว และ **ไม่มีเคสไหน `cd` ในเชลล์นี้**
#   (เคสที่ต้องยืนในแซนด์บ็อกซ์ `cd` ใน subshell ของ `run()` เท่านั้น ⇒ cwd ตรงนี้ไม่เคยขยับ)
# · ⚠️ **ด่านนี้เกิดมาพร้อมการแตกไฟล์เอง** — ไฟล์นี้ไม่มี `set -e` ⇒ `.` ที่หาไฟล์ไม่เจอจะบ่นลง
#   stderr **แล้วรันต่อ** ⇒ ลบใบเคสทิ้งใบหนึ่ง = เกตพิมพ์แต้มที่น้อยลง **แล้ว exit 0** เหมือนเดิม
#   (ตอนยังเป็นไฟล์เดียวอาการนี้เป็นไปไม่ได้) · ไม่มีเกตอื่นในรีโปเฝ้าพาธ source ของเชลล์เลย
#   ⇒ ต้องเฝ้าตรงนี้ ไม่ใช่ฝากไว้กับความจำว่าใบเคสมีสองใบ
# ⚠️ **ด่านข้างบนตรวจแค่ "ไฟล์มีอยู่ไหม" และวัดแล้วว่าไม่พอ** (ใบ 239) — ไฟล์เคสที่ *มีอยู่แต่
# syntax พัง* ทำให้ `.` คืน non-zero แล้วรอบนี้ **เดินต่อจนจบ exit 0 พร้อมแต้มที่น้อยลง**:
# แทรก `if` ค้างไว้ต้นไฟล์ `cases-sensitivity.sh` วัดได้ **ผ่าน 98 → 82 แล้วยังพิมพ์ `OK`**
# ⇒ `.` ต้องเกิด **ในลูปเดียวกับการตรวจ** แล้วอ่าน `rc` ทันที · และการรวมลูปยังปิดรูที่สอง:
# เดิมรายชื่อใบเขียนสองที่ (brace expansion ในลูป + สองบรรทัด `.` แบบพาธเต็ม) ที่ไม่มีอะไร
# ผูกกันเลย = §6 rule 1 คำต่อคำ · **ลำดับยังเป็น behaviour → sensitivity เหมือนเดิม**
CASES_DIR="scripts/tests/check-counter-test-selftest"
for part in cases-behaviour.sh cases-sensitivity.sh; do
  if [ ! -f "$CASES_DIR/$part" ]; then
    echo "counter-test-selftest: หาใบเคสไม่เจอ ($CASES_DIR/$part) — เกตที่หายไปเงียบ ๆ คือเกตที่ไม่มีอยู่"
    exit 1
  fi
  # shellcheck source=/dev/null
  . "$CASES_DIR/$part"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "counter-test-selftest: โหลด $CASES_DIR/$part ไม่สำเร็จ (rc=$rc) — เคสในใบนั้นไม่ได้รันครบ"
    exit 1
  fi
done

echo "counter-test-selftest: ผ่าน $pass · ล้ม $fail"
[ "$fail" -eq 0 ] || exit 1
echo "counter-test-selftest: OK"
