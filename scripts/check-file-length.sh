#!/usr/bin/env bash
# กวาดกติกา 500 บรรทัดทั้งรีโป (FAIL) / เตือนที่ 450 — ฝาแฝดของ .claude/hooks/check-file-length.sh
#
# **ขอบเขตของทั้งสองชั้นอยู่ที่ `scripts/lib/file-length-scope.sh` ไฟล์เดียว** (task 193) —
# ก่อนหน้านั้นเป็น `case` สองสำเนาที่บังเอิญตรงกัน และทั้งคู่เลือกไฟล์ด้วย **รายชื่อสกุล**
# ⇒ `.sh` `.mjs` `.py` `.awk` `.yml` ไม่เคยถูกกวาดเลย · เหตุผลทั้งหมดอยู่ในหัวไฟล์ของโมดูลนั้น
set -euo pipefail
cd "$(dirname "$0")/.."

. scripts/lib/file-length-scope.sh

HARD="$FLEN_HARD"
WARN="$FLEN_WARN"
fail=0
swept=0
waived_hit=""

# ── allowlist หนี้: `<พาธ>  # task NNN — เหตุผล` บรรทัดละหนึ่ง (รูปเดียวกับ card-paths-allowlist.txt)
#
# ไฟล์ที่เกินเพดานอยู่แล้วและ **แตกในใบนี้ไม่ได้** ไปอยู่ที่นี่ แทนที่จะหายเข้าไปในรายการยกเว้น
# ⇒ หนี้ที่มองเห็นได้ ดีกว่าการยกเว้นที่ไม่มีใครเห็น ซึ่งคืออาการของใบ 193 เอง
# · แถวต้องอ้าง `# task NNN` เสมอ — แถวที่ไม่บอกที่มา = แถวที่ไม่มีใครรื้อได้อีก
# · **ห้ามเป็นสุสาน สามทิศ คนละข้อความ** (คนละทางแก้ ⇒ ห้ามยุบเป็นใบเดียว) — ตรวจท้ายไฟล์
while IFS=$'\t' read -r n path rest; do
  case "$rest" in
    *"task "[0-9][0-9][0-9]*) ;;
    *)
      echo "FAIL: $FLEN_ALLOWLIST:$n — แถว allowlist ต้องอ้างใบงาน: \`# task NNN — เหตุผล\`"
      echo "      (คนรุ่นถัดไปต้องรู้ว่าแถวนี้รออะไรอยู่ ไม่งั้นมันอยู่ตลอดกาล = สุสาน)"
      fail=1
      ;;
  esac
done < <(flen_allowlist_rows)

# 🔴 **`-z` + `read -r -d ''` ไม่ใช่ของประดับ** (ใบ 314) — `git ls-files` เปล่า ๆ **ใส่เครื่องหมาย
# คำพูดให้พาธที่ไม่ใช่ ASCII** (`core.quotePath` = true) ได้ `".docs/artifact/\340\270\225…"`
# ⇒ `[ -f "$f" ]` ล้มทุกใบ ⇒ `continue` เงียบ ๆ **ก่อน** `swept` จะขยับ ⇒ ตัวเลขที่พิมพ์ท้ายรอบ
# มองไม่เห็นรูนี้ด้วยตัวมันเอง · วัดในรีโปจริงวันเปิดใบ: **24 ไฟล์ชื่อไทย** หายจากการกวาดทุกใบ
# ที่ใช้สำนวนเปล่า ๆ · ในโปรเจกต์ที่ requirement ทุกใบเป็นภาษาไทย นี่ไม่ใช่ฉากสมมติ
while IFS= read -r -d '' f; do
  flen_path_excluded "$f" && continue
  [ -f "$f" ] || continue
  swept=$((swept + 1))
  lines=$(wc -l < "$f")
  [ "$lines" -gt "$WARN" ] || continue
  # ตรวจ binary **หลัง** นับบรรทัด: ราคาถูกลง และไฟล์ที่ไม่เข้าใกล้เพดานไม่ต้องถูกอ่านซ้ำ
  flen_is_binary "$f" && continue
  if [ "$lines" -gt "$HARD" ]; then
    if flen_waived "$f"; then
      waived_hit="$waived_hit"$'\n'"$f"$'\n'
      echo "warn: $f — $lines บรรทัด · ยกหนี้ไว้ใน $FLEN_ALLOWLIST (ยังเกินเพดาน $HARD)"
      continue
    fi
    echo "FAIL: $f — $lines บรรทัด (เพดาน $HARD) แตกเป็น sub-module ตาม rulebook §4"
    fail=1
  else
    echo "warn: $f — $lines บรรทัด (ใกล้เพดาน $HARD)"
  fi
done < <(git ls-files -c -o --exclude-standard -z)

# ── allowlist ห้ามเป็นสุสาน — **สามทิศ คนละข้อความ**
# (1) ไฟล์หายไปแล้ว (2) ลดลงต่ำกว่าเพดานแล้วแต่ยังอยู่ในลิสต์ (3) ไฟล์อยู่นอกขอบเขตของกติกา
#     ⇒ แถวที่ไม่มีวันถูกปลดได้เชิงตรรกะ ซึ่งอันตรายกว่าสองข้อบนเพราะมันดู "ถูกต้อง" ตลอดไป
while IFS=$'\t' read -r n path _; do
  if [ ! -f "$path" ]; then
    echo "FAIL: $FLEN_ALLOWLIST:$n — ไม่มีไฟล์นี้แล้ว: $path (ถอดแถวออก — allowlist ห้ามเป็นสุสาน)"
    fail=1
    continue
  fi
  if flen_path_excluded "$path" || flen_is_binary "$path"; then
    echo "FAIL: $FLEN_ALLOWLIST:$n — ไฟล์นี้อยู่นอกขอบเขตกติกา §4 อยู่แล้ว: $path"
    echo "      (แถวนี้ปลดไม่ได้เชิงตรรกะ ⇒ ถอดออก · ถ้าตั้งใจให้อยู่นอกขอบเขตจริง ที่ของมันคือ"
    echo "       scripts/lib/file-length-scope.sh ไม่ใช่ allowlist หนี้)"
    fail=1
    continue
  fi
  # เทียบทั้งเซกเมนต์ (ห่อด้วย \n สองด้าน) — `*"$path"*` เปล่า ๆ จะจับ `xa/b.txt` ให้ `a/b.txt` ด้วย
  case "$waived_hit" in
    *$'\n'"$path"$'\n'*) continue ;;
  esac
  echo "FAIL: $FLEN_ALLOWLIST:$n — ไฟล์นี้ไม่เกินเพดานแล้ว ($(wc -l < "$path") บรรทัด): $path"
  echo "      (ถอดแถวออก — allowlist ห้ามเป็นสุสาน)"
  fail=1
done < <(flen_allowlist_rows)

# **รายงานว่าตาข่ายชั้นในเสื่อมสภาพ** (task 104 ข้อ 2)
#
# `.claude/hooks/check-file-length.sh` เป็น hook ใน inner loop — มันตายแล้วบล็อก = แก้ไฟล์
# ไม่ได้ทั้งโปรเจกต์ จึงถูกออกแบบให้ "ดังแต่ไม่ขวาง" (exit 0 + stderr) · แต่ Claude Code
# ส่ง stderr ของ hook ให้โมเดลอ่านเมื่อ exit 2 เป็นหลัก ⇒ เสียงเตือนตอน exit 0 อาจไม่มีใครได้ยิน
# ⇒ hook แตะ marker ไว้ แล้วรายงานที่นี่ ซึ่งเป็นที่ที่มีคนอ่านจริงทุกรอบ
#
# **เป็น warn ไม่ใช่ FAIL โดยตั้งใจ**: ถึงตรงนี้กฎ 500 บรรทัดถูกกวาดทั้งรีโปเรียบร้อยแล้ว
# (ตาข่ายชั้นสุดท้ายทำงานครบ) — สิ่งที่ marker บอกคือ *ชั้นความสะดวกเสีย* ซึ่งเป็นปัญหา
# สภาพแวดล้อม ไม่ใช่การละเมิดกฎ · ทำให้มันแดงคือการบล็อกงานด้วยเหตุที่กฎไม่ได้ถูกละเมิด
MARKER=".scratch/hook-degraded"
if [ -f "$MARKER" ]; then
  echo "warn: ────────────────────────────────────────────────────────────"
  echo "warn: hook นับบรรทัด (.claude/hooks/check-file-length.sh) **ตรวจไม่ได้** $(wc -l < "$MARKER") ครั้ง"
  echo "warn: ตั้งแต่การกวาดรอบก่อน — ชั้นที่เตือนทันทีตอนเขียนไฟล์ไม่ทำงาน (การกวาดรอบนี้ยังครบ)"
  sed 's/^/warn:   /' "$MARKER"
  echo "warn: ────────────────────────────────────────────────────────────"
  # ย้ายทิ้งแทนการลบ: สัญญาณต้องรีเซ็ตทุกรอบ (ไม่งั้นกลายเป็น noise ถาวรที่คนเลิกอ่าน)
  # แต่หลักฐานต้องยังอยู่ให้ตรวจย้อนหลังได้ตาม §6 rule 5
  mv -f "$MARKER" "$MARKER.reported" 2>/dev/null || true
fi

if [ "$fail" -eq 0 ]; then
  # **พิมพ์จำนวนที่กวาดจริง** — เกตที่ไม่บอกว่าตรวจกี่ไฟล์ คือเกตที่ยังเขียวอยู่ได้ตอนที่มัน
  # ไม่ได้ตรวจอะไรเลย (คลาสเดียวกับที่ทำให้ใบนี้เกิด: ตัวเลือกไฟล์ที่ว่างเปล่าไม่ส่งเสียงใด ๆ)
  echo "check-file-length: OK — กวาด $swept ไฟล์"
fi
exit "$fail"
