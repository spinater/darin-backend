#!/usr/bin/env bash
# เกตของ **`scripts/check-sort-locale.sh`** (ใบ 304)
#
# ## ทำไมเกตนี้ต้องมีเกตของตัวเอง
#
# `check-sort-locale.sh` ตัดสินด้วย **ตัวอ่านที่เขียนเอง** — คอมเมนต์ · เครื่องหมายคำพูดเดี่ยว/คู่
# · เนื้อ heredoc · ตำแหน่งคำสั่ง · คำนำหน้าที่เป็นการกำหนดตัวแปร · คำที่ไม่ใช่คำเดี่ยว
# (`rows.sort()`) · การต่อบรรทัดด้วย `\` — และ **ทุกข้อพลาดได้เงียบ ๆ ทั้งสองทิศ**:
# แคบไป = เดินผ่านจุดเรียกจริง (เขียวทั้งที่ไม่ได้ตรวจ) · กว้างไป = แดงใส่ร้อยแก้วไทย
# ซึ่งเป็นทางที่เร็วที่สุดที่จะทำให้คนเรียนรู้ที่จะเดินข้ามเกต · ทั้งสองทิศเกิดจริงระหว่างเขียน
# ใบ 314 หลายครั้ง กับตัวอ่านที่หน้าตาเหมือนกันนี่แหละ
#
# 🔑 **และของที่ใบนี้ต้องพิสูจน์มากที่สุดคือ *ตัวเลข* ไม่ใช่ *สี*** — จุดเรียกที่หายไปจากการนับ
# ไม่ทำให้อะไรแดง มันแค่ทำให้ตัวเลขเล็กลงเฉย ๆ ⇒ เคสฝั่ง "ต้องไม่ฟ้อง" ทุกใบจึงผูกกับ
# **จำนวนจุดเรียกที่ด่านพิมพ์เอง** ไม่ใช่กับ exit code (ฉากพื้นฐานมีจุดเรียกจริง **หนึ่งจุด**
# พอดี เพื่อให้ตัวเลขนั้นอ่านออกด้วยตาเปล่า)
#
# ## ตารางความไว — รันทุกรอบ ไม่ใช่ร้อยแก้ว
#
# อยู่ใน `cases-sensitivity.sh` · ถอดยามทีละตัวจาก **สำเนาในแซนด์บ็อกซ์** แล้ววัดว่าเคสที่คู่กัน
# เปลี่ยนคำตัดสิน · ทุกแถวปฏิเสธการให้คะแนนถ้า `sed` ไม่ได้แก้อะไรเลย และผูกกับ **ข้อความ
# ลายเซ็นของสาเหตุที่เจาะจง** ไม่ใช่คำว่า OK ลอย ๆ ซึ่งบอกแค่ว่า "มีอะไรสักอย่างแดง"
#
# ⚠️ สำเนาต้องอยู่ **ในแซนด์บ็อกซ์** เท่านั้น — ตัวเกต `cd "$(dirname "$0")/.."` เอง ⇒ สำเนา
# ที่จอดไว้ที่อื่นจะวิ่งบน **ทรีจริง** (บทเรียนที่ใบ 277 จ่ายไปแล้ว)
#
# **อ่านจำนวน assertion จากบรรทัดสุดท้ายที่ selftest พิมพ์เอง ไม่ใช่จากที่นี่** — ตัวเลขในร้อยแก้ว
# ไม่มีเกตเฝ้า และรีโปนี้เขียนผิดมาแล้วหลายใบ
set -uo pipefail
cd "$(dirname "$0")/../.."

# **ต่อ PID** ไม่ใช่ชื่อคงที่ — เครื่องนี้รัน `verify.sh` หลายสายขนานเป็นปกติ (§6 rule 6)
SANDBOX=".scratch/sort-locale-selftest-$$"
GATE_REL="scripts/check-sort-locale.sh"
CORPUS_REL="scripts/lib/shell-corpus.sh"
SCAN_REL="scripts/lib/sort-locale-scan.awk"
HDLIB_REL="scripts/lib/heredoc.awk"
MASKLIB_REL="scripts/lib/shell-mask.awk"
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
# ⇒ ตัวเลขที่ด่านพิมพ์อ่านออกด้วยตาเปล่า และเคส "คลังว่าง" ทำได้โดยไม่ต้องลบตัวเกตทิ้ง
new_sandbox() {
  rm -rf "$SANDBOX"
  mkdir -p "$SANDBOX/scripts/lib" "$SANDBOX/tools"
  cp "$GATE_REL" "$SANDBOX/$GATE_REL"
  cp "$CORPUS_REL" "$SANDBOX/$CORPUS_REL"
  cp "$SCAN_REL" "$SANDBOX/$SCAN_REL"
  cp "$HDLIB_REL" "$SANDBOX/$HDLIB_REL"
  cp "$MASKLIB_REL" "$SANDBOX/$MASKLIB_REL"
  scene_clean
  git init -q "$SANDBOX"
  # กันด้วย `.git/info/exclude` ไม่ใช่ `.gitignore` — ฉาก "คลังว่าง" ลบไฟล์ที่ git ถือทิ้งทั้งหมด
  # ซึ่งจะพา `.gitignore` ไปด้วย แล้วลากตัวเกตกลับเข้าคลัง (กับดักเดียวกับ selftest ใบ 195)
  printf 'scripts/\n' > "$SANDBOX/.git/info/exclude"
  git -C "$SANDBOX" add -A >/dev/null 2>&1
}

# ฉากพื้นฐาน — **จุดเรียกจริงหนึ่งจุด** ที่ประกาศ locale ครบ ⇒ ไม่มีอะไรควรแดง
# (หนึ่งจุดพอดีโดยตั้งใจ: ทุกเคสฝั่ง "ต้องไม่ฟ้อง" วัดจากเลขนี้ว่ามันไม่ขยับ)
scene_clean() {
  cat > "$SANDBOX/tools/ok.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
names="$(printf '%s\n' "$@" | LC_ALL=C sort -u)"
echo "$names"
EOF
  chmod +x "$SANDBOX/tools/ok.sh"
}
add_scene() { mkdir -p "$SANDBOX/$(dirname "$1")"; cat > "$SANDBOX/$1"; git -C "$SANDBOX" add -A >/dev/null 2>&1; }

CASES_DIR="scripts/tests/check-sort-locale-selftest"
# ⚠️ ไฟล์เคสหายหรือพังต้อง **ดัง** — `set -uo pipefail` ที่ไม่มี `-e` จะเดินต่อจนจบ exit 0
# พร้อมจำนวนเคสที่น้อยลง ซึ่งคือรูที่ `check-shell-source.sh` (ใบ 239) เกิดมาปิด
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
echo "check-sort-locale-selftest: ผ่าน $pass · ล้ม $fail"
[ "$fail" -eq 0 ] || exit 1
echo "check-sort-locale-selftest: OK"
