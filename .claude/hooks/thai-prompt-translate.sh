#!/usr/bin/env bash
# UserPromptSubmit hook: คำสั่งไทยที่ยาวพอ ⇒ สั่งให้เรียก sub-agent `translator` (sonnet) ก่อน
# แล้วค่อยลงมือ · โมเดลใหญ่จะได้อ่าน brief อังกฤษที่ความกำกวมถูกทำให้เห็นแล้ว
#
# ## ทำไม "ดังแต่ไม่ขวาง" — **ห้ามซ่อมให้เป็น fail-closed** (ทิศเดียวกับ check-file-length.sh)
#
# hook นี้อยู่บนเส้นทางของ **ทุกคำสั่งที่ผู้ใช้พิมพ์** — มันตายแล้วบล็อก = คุยกับ Claude ไม่ได้
# ทั้งโปรเจกต์จนกว่าจะมีคนไปซ่อม hook · และของที่มันให้คือ **ความสะดวก** (แปลให้อัตโนมัติ)
# ไม่ใช่ความถูกต้อง: ต้นฉบับไทยยังอยู่ในคำสั่งเสมอ และโมเดลอ่านไทยออกอยู่แล้ว
# ⇒ พังแล้วเงียบ = เสียการแปลอัตโนมัติ · พังแล้วบล็อก = เสียเซสชัน
#
# แต่ "เงียบสนิท" ก็ไม่เอา — สิ่งที่พังโดยไม่มีร่องรอยคือสิ่งที่ไม่มีใครรู้ว่าพัง
# ⇒ ล้มเหลวทุกทางแตะ `.scratch/hook-degraded` ไว้ (§6 rule 5: ห้าม /tmp)
#
# ## ปิดการทำงาน
#   · ชั่วคราวรายคำสั่ง — พิมพ์ `!raw` หรือ `ห้ามแปล` ที่ไหนก็ได้ในคำสั่ง
#   · ทั้งเซสชัน       — `DARIN_NO_TRANSLATE=1`
#   · ปรับความไวขั้นต่ำ — `DARIN_TRANSLATE_MIN_THAI=<n>` (default 25 · ตั้ง 1 = ไทยตัวเดียวก็แปล)
#   · ถาวร             — ถอดบล็อก UserPromptSubmit ออกจาก .claude/settings.json

MIN_THAI="${DARIN_TRANSLATE_MIN_THAI:-25}"

REPO_ROOT=$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd) || REPO_ROOT=""
SCRATCH="${REPO_ROOT:+$REPO_ROOT/.scratch}"

skip_open() { # ปล่อยผ่านโดยไม่เติม context — แล้วทิ้งร่องรอยไว้ให้ตามได้
  if [ -n "$SCRATCH" ] && mkdir -p "$SCRATCH" 2>/dev/null; then
    printf '%s\tthai-prompt-translate: %s\n' \
      "$(date -Is 2>/dev/null || date)" "$1" >> "$SCRATCH/hook-degraded" 2>/dev/null || true
  fi
  exit 0
}

[ -n "$DARIN_NO_TRANSLATE" ] && exit 0
command -v python3 >/dev/null 2>&1 || skip_open "ไม่มี python3 บนเครื่องนี้"

if [ -z "$SCRATCH" ] || ! mkdir -p "$SCRATCH" 2>/dev/null; then
  # ไม่มีที่เขียนไฟล์ชั่วคราวของโปรเจกต์ = ตรวจไม่ได้ · **ห้าม fallback ไป /tmp** (§6 rule 5)
  echo "⚠️  thai-prompt-translate: สร้าง .scratch/ ไม่ได้ — ข้ามการแปลอัตโนมัติรอบนี้" >&2
  exit 0
fi
ERRF="$SCRATCH/hook-thai-translate.err"

input=$(cat)

# ตัวตัดสินทั้งหมดอยู่ใน python3 ใบเดียว: แยก JSON · นับอักษรไทย · เช็ค escape hatch
# stdout ที่ไม่ว่าง = JSON ของ hook · stdout ว่าง = ไม่เข้าเงื่อนไข ⇒ ไม่เติมอะไร
out=$(printf '%s' "$input" | MIN_THAI="$MIN_THAI" python3 -c '
import json, os, sys

raw = sys.stdin.read()
prompt = json.loads(raw).get("prompt", "") or ""

# slash command = คำสั่งของ harness ไม่ใช่ประโยคของผู้ใช้ ⇒ ห้ามแตะ
if prompt.lstrip().startswith("/"):
    sys.exit(0)
if "!raw" in prompt or "ห้ามแปล" in prompt:
    sys.exit(0)

thai = sum(1 for ch in prompt if "\u0e00" <= ch <= "\u0e7f")
try:
    floor = int(os.environ.get("MIN_THAI", "25"))
except ValueError:
    floor = 25
if thai < max(1, floor):
    sys.exit(0)

note = (
    "คำสั่งข้างบนเขียนเป็นภาษาไทย (" + str(thai) + " อักษรไทย)\n"
    "\n"
    "**ก่อนลงมือทำอะไรก็ตาม** ให้เรียก sub-agent ตัวแปลหนึ่งครั้ง:\n"
    "  Agent(subagent_type=\"translator\", run_in_background=false)\n"
    "  prompt = ข้อความไทยของผู้ใช้ **ทั้งดุ้น คัดลอกมาเป๊ะ ไม่ตัด ไม่ย่อ ไม่เติมคำอธิบาย**\n"
    "\n"
    "แล้วทำงานต่อจาก brief ภาษาอังกฤษที่มันคืนมา โดยถือกติกาสี่ข้อนี้:\n"
    "1. **ต้นฉบับไทยคือฉบับจริง** — brief คือคำแปล · ขัดกันเมื่อไรให้ยึดไทย\n"
    "2. **ทุกบรรทัดใต้ `## AMBIGUOUS` คือของที่ยังไม่ถูกตัดสิน** — ข้อไหนเปลี่ยนเนื้องาน\n"
    "   ให้ถามเจ้าของโปรเจกต์ (AskUserQuestion) ก่อนเขียนโค้ด ห้ามเดาแล้วเดินต่อ\n"
    "3. **ของใต้ `## Verbatim` ห้ามแปล ห้ามแก้รูป** — path, identifier, ชื่อด่าน, ERRCODE,\n"
    "   เลขใบงาน, ค่า i18n, คำพูดลูกค้า\n"
    "4. ตัวแปลไม่ได้วางแผนให้ — brief คือ *คำสั่ง* ไม่ใช่ *แผน* · แผนยังเป็นงานของคุณ\n"
    "\n"
    "ข้ามขั้นนี้ได้กรณีเดียว: คำสั่งเป็นการตอบรับสั้น ๆ ที่ไม่มีเนื้องาน (\"โอเค\", \"ทำต่อ\")\n"
    "· ปิดถาวรรายคำสั่งด้วยการพิมพ์ `!raw` · ทั้งเซสชันด้วย DARIN_NO_TRANSLATE=1"
)

json.dump({"hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": note,
}}, sys.stdout, ensure_ascii=False)
' 2>"$ERRF")
rc=$?

if [ "$rc" -ne 0 ]; then
  detail=$(tr '\n' ' ' < "$ERRF" 2>/dev/null | cut -c1-200)
  rm -f "$ERRF" 2>/dev/null
  skip_open "แยก JSON ของ prompt ไม่สำเร็จ: ${detail:-python3 exit $rc}"
fi
rm -f "$ERRF" 2>/dev/null

[ -n "$out" ] && printf '%s' "$out"
exit 0
