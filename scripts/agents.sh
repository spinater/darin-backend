#!/usr/bin/env bash
# ดูว่า sub-agent ที่กำลังรันอยู่ ทำอะไรถึงไหนแล้ว
#
# ใช้เมื่อดูผ่าน remote control / มือถือ แล้วไม่เห็น progress ที่ขึ้นในเทอร์มินัล
#   bash scripts/agents.sh          # สรุปสถานะครั้งเดียว
#   bash scripts/agents.sh -w       # อัปเดตทุก 5 วินาที (Ctrl-C ออก)
#
# อ่านจาก transcript ของ agent โดยตรง (ไม่รบกวนการทำงาน) — transcript ที่ขยับ
# ภายใน 2 นาที = ยังทำงานอยู่จริง; ไฟล์ที่นิ่งเกิน 10 นาที = น่าจะจบหรือค้างแล้ว
set -uo pipefail

# บ้านของ transcript = พาธโปรเจกต์ที่ถูกแปลงเป็นชื่อไดเรกทอรี (`/` → `-`)
# ⇒ คำนวณจาก **ที่ที่สคริปต์นี้ยืนอยู่จริง** ไม่ใช่พาธคงที่ — รีโปนี้ถูกเช็กเอาต์คนละที่
# บนเครื่อง dev กับบนคลาวด์ และพาธคงที่จะทำให้มันคาย "ไม่มี agent" เงียบ ๆ บนเครื่องหนึ่ง
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
ROOT="${HOME}/.claude/projects/$(printf '%s' "$PROJECT_DIR" | tr '/' '-')"

render() {
  python3 - "$ROOT" <<'PY'
import json, os, sys, time
from pathlib import Path

root = Path(sys.argv[1])
now = time.time()
rows = []

for f in root.glob("*/subagents/agent-*.jsonl"):
    age = now - f.stat().st_mtime
    if age > 900:             # นิ่งเกิน 15 นาที = จบไปแล้ว ไม่ต้องรก
        continue
    last_tool, last_text, model = "", "", ""
    try:
        # อ่านจากท้ายไฟล์พอประมาณ ไม่ต้องโหลดทั้งไฟล์ (บางตัวหลาย MB)
        with f.open("rb") as fh:
            fh.seek(max(0, f.stat().st_size - 300_000))
            chunk = fh.read().decode("utf-8", "ignore")
        for line in chunk.splitlines():
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            msg = rec.get("message") or {}
            model = msg.get("model") or model
            for part in msg.get("content") or []:
                if not isinstance(part, dict):
                    continue
                if part.get("type") == "tool_use":
                    name = part.get("name", "?")
                    inp = part.get("input") or {}
                    hint = (inp.get("file_path") or inp.get("command")
                            or inp.get("pattern") or inp.get("description") or "")
                    hint = " ".join(str(hint).replace(os.getcwd() + "/", "").split())
                    last_tool = f"{name} {hint}".strip()[:88]
                elif part.get("type") == "text" and part.get("text", "").strip():
                    last_text = " ".join(part["text"].split())[:88]
    except OSError:
        continue
    rows.append((age, f.name[6:-6][:8], model.replace("claude-", ""), last_tool, last_text))

if not rows:
    print("ไม่มี sub-agent ที่ทำงานอยู่")
    sys.exit()

rows.sort()
print(f"{'อายุ':>7}  {'สถานะ':<8} {'agent':<9} {'model':<10} กำลังทำ")
print("-" * 100)
for age, aid, model, tool, text in rows:
    mins = int(age // 60)
    stamp = f"{int(age)}s" if age < 60 else f"{mins}m"
    if age < 120:
        state = "ทำงาน"
    elif age < 600:
        state = "เงียบ"
    else:
        state = "จบ/ค้าง"
    print(f"{stamp:>7}  {state:<8} {aid:<9} {model:<10} {tool or text or '—'}")
PY
}

if [[ "${1:-}" == "-w" ]]; then
  while true; do
    clear
    date '+%H:%M:%S'
    render
    sleep 5
  done
else
  render
fi
