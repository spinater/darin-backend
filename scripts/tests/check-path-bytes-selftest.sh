#!/usr/bin/env bash
# เกตของ `scripts/check-path-bytes.sh` (ใบ 314)
#
# ## ทำไมเกตใบนี้ต้องมีเกตของตัวเอง
#
# ด่านนี้ตัดสินด้วย **ตัวแยกคำของภาษาเชลล์ที่เขียนเอง** — คอมเมนต์ · อัญประกาศ · heredoc ·
# บรรทัดต่อ · ตำแหน่งคำสั่ง · สแตกของลูป · ใครกิน stdout · ทั้งหมดเป็นเงื่อนไขที่ **พลาดแล้วเงียบ**
# ทั้งคู่: ตัวแยกคำที่แคบไปข้ามจุดเรียกจริง (เขียวทั้งที่ไม่ได้ตรวจ) · ตัวแยกคำที่กว้างไปฟ้อง
# ร้อยแก้วภาษาไทย (แดงปลอมจนคนเลิกอ่าน) · ทั้งสองทิศเกิดจริงระหว่างเขียนด่านนี้ ทิศละหลายครั้ง
#
# 🔑 และอีกชั้นที่หนักกว่า — **ฉากทุกฉากถูกตัดสินด้วยไฟล์ข้อมูลของสำเนาเอง** ไม่ใช่ด้วยรายชื่อ
# ที่พิมพ์ไว้ในไฟล์นี้ · และมีเคสที่ยืนยันว่า `scripts/path-bytes-allowlist.txt` **ของจริง** มีอย่าง
# น้อยหนึ่งแถว ไม่งั้นเคสเรื่องแถวทั้งหมดผ่านบนความว่างเปล่า (บทเรียน `swept = 0` ของใบ 193
# ใช้กับตัวมันเอง)
#
# ## เคส (ข้าม `S` เป็นตัวอักษรของเคส — มันชนกับชื่อแถวความไว `S1` `S4` … เวลาอ่าน log)
#
#   A. ฉากสะอาด = เขียว · พิมพ์สองตัวนับ · ทั้งคู่มากกว่า 0
#   B. `git ls-files` ที่มีคนกิน stdout แต่ไม่มี `-z` = แดง **เรียกชื่อไฟล์และเลขบรรทัด**
#   C. ไฟล์เชลล์ **ชื่อภาษาไทย** ที่ผิดกติกา = ถูกเรียกชื่อ — นี่คือข้อ 4 ของใบ 314 เอง และเป็น
#      ทิศที่ `git ls-files` เปล่า ๆ ทำให้หายเงียบ (คู่กับแถวความไว S1)
#   D. `git add` / `git mv` / `git init` = เขียว **โดยไม่มีรายชื่อ subcommand สักตัว** — ขั้น
#      "ใครกิน stdout" ตัดทิ้งเชิงโครงสร้าง (§6 rule 1: ห้ามเป็นรายการที่ต้องมีคนเติม)
#   E. `>/dev/null` และ `-q` = เขียว · แต่ `2>/dev/null` **ไม่ใช่** การโยน stdout ทิ้ง (เคส E2)
#   F. มี `-z` แต่ตัวอ่านเป็น `read -r f` = แดงด้วยข้อความ **ของ ZCONSUMER** ไม่ใช่ของ NEEDZ
#      (การแก้ครึ่งเดียว = ลูปวนศูนย์รอบ ⇒ คนละสาเหตุ คนละทางแก้ ⇒ คนละข้อความ)
#   G. `-z` ใน `$( )` ที่ไม่มี `tr` = แดงด้วยข้อความของ ZSUBST (เชลล์กลืน NUL ทิ้ง)
#   H. `-z` ใน `$( )` **ที่มี** `tr '\0'` = เขียว
#   I. `done < <(git … -z)` คู่กับ `read -r -d ''` = เขียว — `<( )` เป็น fd จริง NUL รอด
#      ⇒ ห้ามเหมารวมกับ `$( )` (คู่กับแถว S6)
#   J. **ลูปซ้อนลูป** — ตัวอ่านชั้นในที่ไม่ใช่ NUL ต้องไม่ถูกนับเป็นเจ้าของของ `done` ชั้นนอก
#      (เกิดจริงที่ `check-links.sh` ชั้นที่หนึ่ง · คู่กับแถว S2)
#   K. `for d in todo todo-human done; do` — คำว่า `done` ที่เป็น **ข้อมูล** ต้องไม่ปิดลูป
#      (เกิดจริงสองบรรทัดใน `check-links.sh` · คู่กับแถว S3)
#   L. ร้อยแก้ว: `echo "… \`git mv\` …"` และ `echo "… (git track ไว้ $n) …"` ต้องไม่ถูกฟ้อง
#      (แดงปลอมในภาษาไทยคือทางที่เร็วที่สุดที่จะทำให้คนเลิกอ่านเกต · คู่กับแถว S4 · S5)
#   M. เนื้อใน **heredoc** ที่มี `git ls-files` ต้องไม่ถูกฟ้อง (มันเป็นข้อมูล ไม่ใช่คำสั่ง)
#   N. คำสั่งที่ต่อด้วย `\` หลายบรรทัด = รายงานที่ **บรรทัดกายภาพแรก** เสมอ
#   O. `sbgit` และ `--git-dir` ต้องไม่ถูกอ่านว่าเป็นคำสั่ง `git`
#   P. แถวในไฟล์ข้อมูลยกเว้นให้ได้ · และ **จำนวนต้องตรงเป๊ะ**
#   Q. จำนวนไม่ตรง = แดง **สองทิศ สองข้อความ** (มากกว่าปัก = มีคนเพิ่มจุด · น้อยกว่า = จุดหาย)
#   R. แถวที่ไฟล์หายไปแล้ว = แดง (ตัวข้ามห้ามเป็นสุสาน)
#   T. แถวที่ไม่มีจุดให้ยกเว้นแล้ว = แดงด้วยข้อความของตัวเอง (คนละสาเหตุกับ R)
#   U. แถวที่ไม่อ้าง `ใบ NNN` = แดง
#   V. แถวซ้ำ = แดง (แถวหนึ่งกลบอีกแถว ⇒ ด่านสุสานปลดไม่ลง)
#   W. ไม่มีไฟล์ข้อมูล / ไฟล์ข้อมูล 0 แถว = แดง **คนละข้อความ** (คนละทางแก้)
#   X. คลังว่าง = แดงที่ `swept = 0` · ตัวแยกคำพัง = แดงที่ `sites = 0` — **สองตัวนับ ไม่ใช่ตัวเดียว**
#      (ตัวแรกพิสูจน์ตัวเลือกไฟล์ · ตัวที่สองพิสูจน์ตัวอ่าน · ตั้งชื่อตัวแปร awk ทับชื่อสงวนครั้งเดียว
#      ตัวอ่านก็คาย 0 บรรทัดพร้อม stderr แล้วรอบนั้นจะเขียวถ้ามีแต่ตัวนับแรก — เกิดจริงในใบ 314)
#   Y. `g=(git -C … )` (คำสั่งเก็บในอาเรย์) = แดงด้วยข้อความ **BADSUB** · และแถวคือทางออกตามกฎหมาย
#      (แดงที่ไม่มีทางออกคือเกตที่คนเรียนรู้ที่จะเดินข้าม)
#   Z. เทียบแถวเป็น **สตริงตรงตัว ห้าม `case`** — แถวที่มี `*` ต้องไม่ยกเว้นให้ใคร (ใบ 190)
#   AA. ไฟล์ข้อมูล **ของจริง** ต้องมี ≥ 1 แถว — ไม่งั้นเคสเรื่องแถวข้างบนวัดความว่างเปล่า
#   AB. ไฟล์นอกเชลล์ที่เรียก git = พิมพ์เป็น **ตัวดัก** ทุกรอบ (ไม่ใช่ด่าน — ประกาศเขตบอดออกมา)
#
# ## ตารางความไว (รันทุกรอบ ไม่ใช่ร้อยแก้ว) — อยู่ใน `cases-sensitivity.sh`
#
# **อ่านของจริงจาก `cases-sensitivity.sh` และอ่านจำนวน assertion จากบรรทัดสุดท้ายที่ selftest
# พิมพ์เอง ไม่ใช่จากที่นี่** — ตารางในร้อยแก้วไม่มีเกตเฝ้า และใบ 277 เขียนผิด 5 ใน 11 แถวมาแล้ว
set -uo pipefail
cd "$(dirname "$0")/../.."

# **ต่อ PID** ไม่ใช่ชื่อคงที่ — เครื่องนี้รัน `verify.sh` หลายสายขนานเป็นปกติ (§6 rule 6)
SANDBOX=".scratch/path-bytes-selftest-$$"
GATE_REL="scripts/check-path-bytes.sh"
CORPUS_REL="scripts/lib/shell-corpus.sh"
SCAN_REL="scripts/lib/path-bytes-scan.awk"
# ตั้งแต่ใบ 318 คำตัดสิน "บรรทัดนี้เป็นคำสั่งหรือข้อมูลใน heredoc" ย้ายออกจาก `$SCAN_REL` ไปอยู่
# บ้านเดียวที่ไฟล์นี้ ซึ่ง `check-shell-source.sh` ยืมตัวเดียวกัน ⇒ แซนด์บ็อกซ์ต้องพกไปด้วย
# มิฉะนั้น awk ตายทุกไฟล์ แล้วทุกเคสแดงด้วยเหตุที่ไม่ใช่เรื่องของมัน
HDLIB_REL="scripts/lib/heredoc.awk"
# และตั้งแต่ใบ 304 คำตัดสิน "ส่วนไหนของบรรทัดนี้เป็นโค้ด" (`mask_and_strip`/`is_word`) ก็ย้าย
# ออกจาก `$SCAN_REL` ไปอยู่บ้านเดียวที่ไฟล์นี้ ซึ่ง `check-sort-locale.sh` ยืมตัวเดียวกัน
# ⇒ แซนด์บ็อกซ์ต้องพกไปด้วย ไม่งั้น awk ตายทุกไฟล์แล้วทุกเคสแดงด้วยเหตุที่ไม่ใช่เรื่องของมัน
MASKLIB_REL="scripts/lib/shell-mask.awk"
ALLOW_REL="scripts/path-bytes-allowlist.txt"
trap 'chmod -R u+rwX "$SANDBOX" 2>/dev/null; rm -rf "$SANDBOX"' EXIT
pass=0
fail=0

check() { # $1=ชื่อ $2=0/1 $3=ข้อความตอนไม่ผ่าน
  if [ "$2" -eq 1 ]; then echo "  ok: $1"; pass=$((pass + 1))
  else echo "  FAIL: $1 — $3"; fail=$((fail + 1)); fi
}

# `< /dev/null` ไม่ใช่ของประดับ: เกตที่ถูก mutate จนเรียกเครื่องมือโดยไม่มีไฟล์ จะไปอ่าน stdin
# ⇒ selftest ค้างทั้งใบแทนที่จะรายงานผล (กับดักที่ selftest ใบพี่เจอมาแล้วจริง)
GATE_OUT=""
run_gate() { GATE_OUT="$(bash "${1:-$SANDBOX/$GATE_REL}" </dev/null 2>&1)"; }

expect() { # $1=ชื่อ $2=exit ที่คาด $3=ข้อความที่ต้องมี $4=ข้อความที่ต้องไม่มี $5=เกตที่จะรัน
  local name="$1" want="$2" msg="${3:-}" deny="${4:-}" gate="${5:-}" got ok=1
  run_gate "$gate"; got=$?
  if [ "$got" -ne "$want" ]; then echo "  FAIL: $name — exit=$got คาด $want"; ok=0; fi
  if [ -n "$msg" ] && ! grep -qF -- "$msg" <<<"$GATE_OUT"; then
    echo "  FAIL: $name — ไม่พบข้อความ \"$msg\""; ok=0
  fi
  if [ -n "$deny" ] && grep -qF -- "$deny" <<<"$GATE_OUT"; then
    echo "  FAIL: $name — เจอข้อความที่ต้องไม่มี \"$deny\" (สาเหตุคนละชั้นถูกรายงานปนกัน)"; ok=0
  fi
  if [ "$ok" -eq 1 ]; then echo "  ok: $name"; pass=$((pass + 1))
  else printf '    --- output ---\n%s\n    --------------\n' "$GATE_OUT"; fail=$((fail + 1)); fi
}

# `sed -i` เปล่า ๆ บน BSD กินอาร์กิวเมนต์ถัดไปเป็น suffix ⇒ ใช้รูปเดียวกับ selftest ใบพี่
sed_i() { sed -i.bak "$@" && rm -f "${@: -1}.bak"; }

# ── แซนด์บ็อกซ์: `scripts/` ทั้งก้อนถูกกันออกจากคลัง ⇒ สิ่งที่เกตกวาดคือ **ฉากล้วน**
# ⇒ ตัวเลขที่ออกมาอ่านได้ และเคส X (คลังว่าง) ทำได้จริงโดยไม่ต้องลบตัวเกตทิ้ง
new_sandbox() {
  rm -rf "$SANDBOX"
  mkdir -p "$SANDBOX/scripts/lib" "$SANDBOX/tools"
  cp "$GATE_REL" "$SANDBOX/$GATE_REL"
  cp "$CORPUS_REL" "$SANDBOX/$CORPUS_REL"
  cp "$SCAN_REL" "$SANDBOX/$SCAN_REL"
  cp "$HDLIB_REL" "$SANDBOX/$HDLIB_REL"
  cp "$MASKLIB_REL" "$SANDBOX/$MASKLIB_REL"
  : > "$SANDBOX/$ALLOW_REL"
  printf '# ตัวข้ามของฉากทดสอบ\n' > "$SANDBOX/$ALLOW_REL"
  scene_clean
  git init -q "$SANDBOX"
  # กันด้วย `.git/info/exclude` ไม่ใช่ `.gitignore` — เคส X ลบไฟล์ที่ git ถือทิ้งทั้งหมด
  # ซึ่งจะพา `.gitignore` ไปด้วย แล้วลากตัวเกตกลับเข้าคลัง (กับดักเดียวกับ selftest ใบ 195)
  printf 'scripts/\n' > "$SANDBOX/.git/info/exclude"
  git -C "$SANDBOX" add -A >/dev/null 2>&1
}

# ฉากพื้นฐาน: ทุกสำนวนที่ **ถูกต้อง** — ไม่มีอะไรควรแดง
scene_clean() {
  cat > "$SANDBOX/tools/ok.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
while IFS= read -r -d '' f; do
  echo "$f"
done < <(git ls-files -c -o --exclude-standard -z)
git add -- "$1"
git mv a b
git init -q .
git ls-files --error-unmatch -- "$1" >/dev/null 2>&1
git diff --quiet -- "$1"
n="$(git ls-files -z | tr '\0' '\n' | wc -l)"
echo "$n"
EOF
  chmod +x "$SANDBOX/tools/ok.sh"
}
add_scene() { mkdir -p "$SANDBOX/$(dirname "$1")"; cat > "$SANDBOX/$1"; git -C "$SANDBOX" add -A >/dev/null 2>&1; }
allow_rows() { printf '# ตัวข้ามของฉากทดสอบ\n' > "$SANDBOX/$ALLOW_REL"; printf '%s\n' "$@" >> "$SANDBOX/$ALLOW_REL"; }

CASES_DIR="scripts/tests/check-path-bytes-selftest"
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
echo "check-path-bytes-selftest: ผ่าน $pass · ล้ม $fail"
[ "$fail" -eq 0 ] || exit 1
echo "check-path-bytes-selftest: OK"
