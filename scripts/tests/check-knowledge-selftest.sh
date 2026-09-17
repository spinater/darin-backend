#!/usr/bin/env bash
# เกตของ `scripts/check-knowledge.sh` **เฉพาะแขนแผนที่** (ใบ 322)
#
# ## ทำไมมีไฟล์นี้
#
# `check-knowledge.sh` เป็น stage ของ `verify.sh` ที่ §7 บันทึกไว้เองว่า **มีแค่แขน STALE จาก
# `scripts/tests/check-verify-summary-selftest.sh`** เฝ้าอยู่ ⇒ แขนอื่นทุกแขนคือความจำของคนเขียน ·
# ใบ 322 เพิ่มแขนใหม่เข้าไป (การ์ดทุกใบต้องมีแถวใน `index.md`) และแขนที่ไม่มีอะไรเฝ้า **ไม่ถือว่าเสร็จ**
# — คำถามที่ต้องตอบได้คือ *ถอดการแก้นี้ออกแล้วอะไรแดง* ซึ่งตารางความไวข้างล่างตอบด้วยการ **รันจริง**
#
# ✅ **ต่อเข้า `scripts/verify.sh` แล้ว** (กลุ่ม selftest ก่อน `check-knowledge.sh` ตัวจริง) พร้อม
# แถวของตัวเองใน §7 · ตอนไฟล์นี้เกิด มันยังไม่ได้ต่อ และนั่นแปลว่า **ไฟล์เทสที่เขียวอยู่ทุกวัน
# โดยไม่มีใครเรียก** ⇒ ถอดการแก้ของใบ 322 ออกแล้วไม่มีอะไรแดงเลยสักด่าน — คือคำตอบที่รีโปนี้
# ถือว่า "ยังไม่เสร็จ" · รันเดี่ยวได้ตลอด: `bash scripts/tests/check-knowledge-selftest.sh`
# (วินาทีเดียว ไม่ต้องใช้ toolchain ไม่ต้องใช้ docker และ **ไม่ต้องมี git repo** เพราะทุกการ์ด
# ในฉากไม่มี `sources:` ⇒ ลูปไปไม่ถึง `ftime` เลยสักครั้ง)
#
# ## เคส (ของจริงอยู่ที่ `cases-behaviour.sh` — ที่นี่คือสารบัญ)
#
#   A. ฉากสะอาด = เขียว และพิมพ์ **สองตัวเลข** (กวาดกี่ใบ · แถวในแผนที่กี่แถว)
#   B. การ์ดที่ไม่มีแถว = แดง **เรียกชื่อการ์ด** และพิมพ์แถวที่พิมพ์ทับลงไปได้ทันที
#   C. แถวที่ชี้ไปไฟล์ที่ไม่มีอยู่ = **เขียวที่ด่านนี้โดยตั้งใจ** — ทิศนั้นเป็นของ `check-links.sh`
#      (สำเนาที่สองของคำตัดสินเดียวกันคือของที่ §4 ห้าม)
#   D. แผนที่ที่สกัดลิงก์ไม่ได้สักแถว = แดงด้วย **ข้อความของตัวเอง** และ **ห้าม** พ่นคำตัดสินรายใบ
#      (สาเหตุคนละชั้น ทางแก้คนละอย่าง)
#   E. แถวที่เขียนเป็น `](domain/a.md#หัวข้อ)` = นับว่ามีแถว
#   F. ไม่มี `index.md` เลย = แดงด้วยข้อความของตัวเอง · **และรอบนั้นต้องเดินต่อจนจบ** (การ์ดเกินเพดาน
#      ยังถูกรายงาน) — ถ้าใครเปลี่ยนเป็น `exit` กลางทาง เคสนี้จะจับได้
#   G. การ์ด **ชื่อภาษาไทย** — สองทิศ: ไม่มีแถว = ถูกเรียกชื่อ (G1) · **มีแถวอยู่แล้ว = เขียว** (G2/G3)
#      ⇒ ตัวสกัดลิงก์ต้องกินไบต์นอก ASCII · ทิศหลังคือทิศที่แดงแล้ว **แก้ตามคำแนะนำของเกตไม่ได้**
#      เพราะมันสั่งให้เติมแถวที่มีอยู่แล้ว (เจอในรีวิวใบ 322 — แถว S7 เฝ้าไว้)
#   H. ไม่มีการ์ดสักใบ = FAIL ที่ `swept` (บทเรียนใบ 193) — แขนเดิมที่ต้องไม่ถูกแขนใหม่กลบ
#   I. การ์ดที่อยู่ราก `.docs/knowledge/` = เทียบด้วยพาธที่ตัดคำนำหน้าแล้ว
#   J. 🔴 แถว `domain/ab.md` **ห้าม** ครอบคลุมการ์ด `domain/a.md` ให้ฟรี (บทเรียนตัวคั่นของใบ 190)
#   K. 🔴 **ลิงก์ในร้อยแก้วไม่ใช่แถวในตาราง** — ข้อความของด่านสั่งให้เติม *แถว* ⇒ โค้ดต้องนับเฉพาะ
#      บรรทัดของตาราง (K1 แดง · K2/K3 เขียวพร้อมตัวนับที่ไม่กินลิงก์นอกตาราง — แถว S8 เฝ้าไว้)
#
# ## ตารางความไว — อยู่ที่ `cases-sensitivity.sh` และ **รันทุกรอบ ไม่ใช่ร้อยแก้ว**
#
# อ่านจำนวน assertion จากบรรทัดสุดท้ายที่ไฟล์นี้พิมพ์เอง ไม่ใช่จากคอมเมนต์นี้
#
# ⚠️ ไฟล์นี้ตั้ง `set -uo pipefail` **โดยจำเป็น** (มี `-e` ไม่ได้ เพราะต้องไม่หยุดตอน assertion ล้ม)
# ⇒ `.` ทุกจุดข้างล่าง **ต้องอ่าน rc** ตามกติกาของ `scripts/check-shell-source.sh`
set -uo pipefail
cd "$(dirname "$0")/../.."

# ต่อ PID — เครื่องนี้รันหลายสายขนานเป็นปกติ (§6 rule 6)
SANDBOX=".scratch/knowledge-selftest-$$"
GATE_REL="scripts/check-knowledge.sh"
trap 'rm -rf "$SANDBOX"' EXIT
pass=0
fail=0

check() { # $1=ชื่อ $2=0/1 $3=ข้อความตอนไม่ผ่าน
  if [ "$2" -eq 1 ]; then echo "  ok: $1"; pass=$((pass + 1))
  else echo "  FAIL: $1 — $3"; fail=$((fail + 1)); fi
}

# `< /dev/null` ไม่ใช่ของประดับ: เกตที่ถูก mutate จนเรียกเครื่องมือโดยไม่มีไฟล์จะไปอ่าน stdin
# ⇒ selftest ค้างทั้งใบแทนที่จะรายงานผล
GATE_OUT=""
run_gate() { GATE_OUT="$(bash "$SANDBOX/$GATE_REL" </dev/null 2>&1)"; }

expect() { # $1=ชื่อ $2=exit ที่คาด $3=ข้อความที่ต้องมี $4=ข้อความที่ต้องไม่มี
  local name="$1" want="$2" msg="${3:-}" deny="${4:-}" got ok=1
  run_gate; got=$?
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

# `sed -i` เปล่า ๆ บน BSD กินอาร์กิวเมนต์ถัดไปเป็น suffix ⇒ รูปเดียวกับ selftest ใบพี่
sed_i() { sed -i.bak "$@" && rm -f "${@: -1}.bak"; }

# ── แซนด์บ็อกซ์: สำเนาเกต **ต้องอยู่ใน** แซนด์บ็อกซ์ เพราะเกตทำ `cd "$(dirname "$0")/.."` เอง
# ⇒ สำเนาที่จอดไว้ที่อื่นจะวิ่งใส่ **ทรีจริง** (บทเรียนที่ใบ 277 จ่ายมาแล้ว)
new_sandbox() {
  rm -rf "$SANDBOX"
  mkdir -p "$SANDBOX/scripts"
  cp "$GATE_REL" "$SANDBOX/$GATE_REL"
}
# ล้าง **เฉพาะทรีการ์ด** ไม่แตะสำเนาเกต — ตารางความไวต้องปั้นฉากใหม่บนเกตที่ถูก mutate แล้ว
reset_tree() { rm -rf "$SANDBOX/.docs"; mkdir -p "$SANDBOX/.docs/knowledge/domain"; }
add_card()   { mkdir -p "$SANDBOX/.docs/knowledge/$(dirname "$1")"; cat > "$SANDBOX/.docs/knowledge/$1"; }
write_index() { cat > "$SANDBOX/.docs/knowledge/index.md"; }

# การ์ดในฉากทุกใบ **ไม่มี `sources:`** โดยตั้งใจ ⇒ ลูปไปไม่ถึง `ftime` ⇒ ไม่ต้องมี git repo
# และผลของทุกเคสมาจากแขนที่เคสนั้นวัดจริง ไม่ใช่จากเวลาคอมมิตของเครื่องที่รัน
plain_card() { printf '# %s\n' "$1"; }

build_clean() {
  reset_tree
  plain_card "การ์ด ก" | add_card domain/a.md
  plain_card "การ์ด ข" | add_card domain/b.md
  write_index <<'IDX'
# Knowledge Cards

| Card | ครอบคลุม |
|---|---|
| [domain/a.md](domain/a.md) | ก |
| [domain/b.md](domain/b.md) | ข |
IDX
}
scene_clean() { new_sandbox; build_clean; }

CASES_DIR="scripts/tests/check-knowledge-selftest"
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

rm -rf "$SANDBOX"
echo "check-knowledge-selftest: ผ่าน $pass · ล้ม $fail"
[ "$fail" -eq 0 ] || exit 1
echo "check-knowledge-selftest: OK"
