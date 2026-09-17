#!/usr/bin/env bash
# PostToolUse hook: enforce the 500-line-per-source-file rule.
# Exit 2 feeds the message back to Claude so it splits the file immediately.
#
# ## ตัวแยก JSON พังแล้วต้อง "ดังแต่ไม่ขวาง" — **ห้ามซ่อมให้เป็น fail-closed** (task 095)
#
# เดิมบรรทัดแยก path คือ `printf … | python3 … 2>/dev/null` ⇒ python3 หาย/JSON เปลี่ยนรูป
# = `file=""` = `exit 0` = **hook ปล่อยผ่านทุกไฟล์เงียบ ๆ** ตลอดกาล (คลาสเดียวกับ FAIL ปลอม
# ของ check-sql-coverage: เครื่องมือที่รายงานผลโดยไม่ได้ตรวจอะไรเลย)
#
# แต่ทางแก้ **ไม่ใช่บล็อก**: hook นี้อยู่ใน inner loop ของการแก้ไฟล์ทุกครั้ง — มันตายแล้วบล็อก
# = แก้ไฟล์ไม่ได้ทั้งโปรเจกต์จนกว่าจะมีคนไปซ่อม hook · และ **ตาข่ายจริงยังอยู่**:
# `scripts/check-file-length.sh` กวาดทั้งรีโปใน `verify.sh` ซึ่งเป็นเกตที่ห้ามข้าม ⇒ ชั้นนี้คือ
# ความสะดวก (บอกทันทีตอนเขียน) ไม่ใช่ชั้นสุดท้าย
#
# ⇒ กติกา: ตรวจไม่ได้ = **เตือนดัง ๆ ที่ stderr แล้ว exit 0** · ตรวจได้แล้วเกิน = exit 2
#
# ## เสียงเตือนต้องไปโผล่ที่เกต ไม่ใช่หายไปกับ stderr (task 104 ข้อ 2)
#
# Claude Code ส่ง stderr ของ hook ให้โมเดลอ่านเมื่อ **exit 2** · ตอน exit 0 โดยทั่วไปไม่ส่ง
# ⇒ เจตนา "ดังแต่ไม่ขวาง" ถูก แต่ผลจริงใกล้ "เงียบแล้วปล่อยผ่าน" แบบเดิมมากกว่าที่คอมเมนต์อ้าง
# ⇒ `warn_open` จึง **แตะ marker** ไว้ด้วย แล้ว `scripts/check-file-length.sh` รายงานตอนกวาด
# ทั้งรีโป ⇒ ตาข่ายชั้นในที่เสื่อมสภาพ *มองเห็นได้ที่เกต* แทนที่จะหายไปเงียบ ๆ
#
# ## ขอบเขต "ไฟล์ไหนอยู่ใต้กติกา" ไม่ได้อยู่ในไฟล์นี้อีกแล้ว (task 193)
#
# เดิมชั้นนี้ถือ `case` ของตัวเองคนละสำเนากับการกวาดทั้งรีโป ⇒ แก้ที่เดียวแล้วอีกที่เงียบ
# · ทั้งคู่ยังเลือกไฟล์ด้วย **รายชื่อสกุล** ⇒ `.sh` `.mjs` `.py` `.awk` `.yml` ไม่เคยถูกตรวจเลย
# ⇒ ตอนนี้ทั้งสองชั้นถามคำถามเดียวกันจาก `scripts/lib/file-length-scope.sh` (เหตุผลอยู่ที่นั่น)

# **ราก repo อ่านจากตำแหน่งของสคริปต์ ไม่ใช่ cwd** — hook ถูกเรียกด้วย cwd อะไรก็ได้
# และไฟล์ชั่วคราวต้องลง `.scratch/` ของโปรเจกต์เสมอ (§6 rule 5: ห้าม `/tmp` เพราะมันถูกล้าง
# โดยไม่บอก และเจ้าของโปรเจกต์ตรวจย้อนหลังไม่ได้ว่าคำสั่งที่รันไปทิ้งอะไรไว้)
REPO_ROOT=$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd) || REPO_ROOT=""
SCRATCH="${REPO_ROOT:+$REPO_ROOT/.scratch}"
DEGRADED_MARKER="${SCRATCH:+$SCRATCH/hook-degraded}"

input=$(cat)

warn_open() { # เตือนแล้วปล่อยผ่าน — ตาข่ายที่สองอยู่ใน verify.sh
  echo "⚠️  check-file-length hook: ตรวจไม่ได้ ($1) — **กติกา 500 บรรทัดไม่ได้ถูกตรวจในรอบนี้**" >&2
  echo "    ชั้นนี้ปล่อยผ่านโดยตั้งใจ (ห้าม fail-closed — ดูคอมเมนต์ในไฟล์) · ตาข่ายจริงคือ" >&2
  echo "    'bash scripts/check-file-length.sh' ใน verify.sh — รันเองก่อน commit" >&2
  # marker = ร่องรอยที่เกตอ่านเจอ · ล้มเหลวตรงนี้ต้องไม่ทำให้ hook พัง (มันคือชั้นความสะดวก)
  if [ -n "$DEGRADED_MARKER" ] && mkdir -p "$SCRATCH" 2>/dev/null; then
    printf '%s\t%s\n' "$(date -Is 2>/dev/null || date)" "$1" >> "$DEGRADED_MARKER" 2>/dev/null || true
  fi
  exit 0
}

# **โมดูลขอบเขตอ่านไม่ได้ = ตรวจไม่ได้ ไม่ใช่ "ผ่าน"** — ไปทาง warn_open เหมือนทุกความล้มเหลว
# ของชั้นนี้ (ห้าม fail-closed ตามคอมเมนต์หัวไฟล์ · ตาข่ายจริงคือการกวาดใน verify.sh)
SCOPE_LIB="${REPO_ROOT:+$REPO_ROOT/scripts/lib/file-length-scope.sh}"
if [ -z "$SCOPE_LIB" ] || [ ! -f "$SCOPE_LIB" ]; then
  warn_open "หา scripts/lib/file-length-scope.sh ไม่เจอ (รากรีโป: ${REPO_ROOT:-บอกไม่ได้})"
fi
# shellcheck source=../../scripts/lib/file-length-scope.sh
. "$SCOPE_LIB" || warn_open "source scripts/lib/file-length-scope.sh ไม่สำเร็จ"
MAX="$FLEN_HARD"

if ! command -v python3 >/dev/null 2>&1; then
  warn_open "ไม่มี python3 บนเครื่องนี้"
fi

# แยก stderr ของ python3 ออกมาอ่าน แทนที่จะโยนทิ้ง — เงียบ = ไม่รู้ว่าตรวจหรือไม่ได้ตรวจ
#
# **`mktemp` เปล่า ๆ ตกลง `/tmp` ซึ่งละเมิด §6 rule 5 ตรง ๆ** (task 104 ข้อ 1) — ไฟล์ชั่วคราว
# ทุกชนิดของโปรเจกต์นี้ลง `.scratch/` · สร้างไม่ได้ = ไม่มีที่เขียน = **ตรวจไม่ได้** ⇒ ไปทาง
# `warn_open` (ดังแล้วปล่อยผ่าน + แตะ marker) ไม่ใช่ falling back ไป `/tmp` เงียบ ๆ
if [ -z "$SCRATCH" ] || ! mkdir -p "$SCRATCH" 2>/dev/null; then
  warn_open "สร้าง .scratch/ ของโปรเจกต์ไม่ได้ (ห้ามใช้ /tmp — §6 rule 5)"
fi
parse_err=$(mktemp -p "$SCRATCH" hook-file-length.XXXXXX) || \
  warn_open "สร้างไฟล์ชั่วคราวใน .scratch/ ไม่สำเร็จ"
file=$(printf '%s' "$input" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' \
  2>"$parse_err")
parse_rc=$?
if [ "$parse_rc" -ne 0 ]; then
  detail=$(tr '\n' ' ' < "$parse_err" | cut -c1-200)
  rm -f "$parse_err"
  warn_open "แยก JSON ของ tool_input ไม่สำเร็จ: ${detail:-python3 exit $parse_rc}"
fi
rm -f "$parse_err"

# path ว่าง = tool นี้ไม่มี file_path (Bash/Grep/…) ซึ่งเป็นเรื่องปกติ ไม่ใช่ความล้มเหลว
[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

# ── ขอบเขตเดียวกับการกวาดทั้งรีโป — ตัดสินที่ scripts/lib/file-length-scope.sh ไม่ใช่ที่นี่
rel=$(flen_rel "$file" "$REPO_ROOT")
flen_path_excluded "$rel" && exit 0
# ของที่ `.gitignore` กิน = ของที่การกวาดมองไม่เห็นอยู่แล้ว (`git ls-files --exclude-standard`)
# ⇒ ถามจาก git ให้สองชั้นตรงกันโดยโครงสร้าง แทนที่จะเติมรายการให้ตรงกันด้วยมือ
(cd "${REPO_ROOT:-.}" 2>/dev/null && flen_gitignored "$rel") && exit 0
flen_is_binary "$file" && exit 0

lines=$(wc -l < "$file" | tr -d ' ')
[ "$lines" -gt "$MAX" ] || exit 0

# ยกหนี้ไว้แล้ว = เกตทั้งรีโปก็ไม่แดง ⇒ ชั้นนี้ต้องไม่ตะโกนทุกครั้งที่มีคนแตะไฟล์นั้น
# (เตือนซ้ำทุกครั้งบนของที่ทีมตัดสินใจไปแล้ว คือเสียงที่สอนให้คนเลิกอ่านเสียงเตือนทั้งหมด)
if (cd "${REPO_ROOT:-.}" 2>/dev/null && flen_waived "$rel"); then
  exit 0
fi

echo "RULE VIOLATION: $file is $lines lines (max $MAX). Split it into sub-modules NOW before doing anything else." >&2
exit 2
