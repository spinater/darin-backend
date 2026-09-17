#!/usr/bin/env bash
# ตารางความไวของ `scripts/tests/check-card-paths-selftest.sh` (แตกออกมาที่ใบ 195 — §4 เพดาน 500)
# ⚠️ `.` (source) เท่านั้น ด้วยเหตุผลเดียวกับ `cases-behaviour.sh`

# ── ตารางความไว: ถอดการแก้ทีละข้อจาก *สำเนา* ของเกต แล้วยืนยันว่าคำตัดสินเปลี่ยน
echo "selftest: ตารางความไว — ถอดทีละข้อแล้วเคสที่คู่กันต้องเปลี่ยนคำตัดสิน"
# 🔑 **"exit เปลี่ยน" อย่างเดียวเป็นตัววัดที่หยาบเกินไป** — วัดจริงตอนเขียนใบนี้: ถอดด่านกันสุสาน
# ทิศ "กลับมามีตัวตน" ออก แล้ว exit **ยังเป็น 1 เท่าเดิม** เพราะทิศที่สองไปแดงแทน (คนละสาเหตุ
# คนละทางแก้) ⇒ แถวความไวที่ดูแค่ exit จะรายงานว่า "ของที่ถอดไม่ได้เฝ้าอะไร" ทั้งที่มันเฝ้าอยู่จริง
# ⇒ เมื่อระบุ **ข้อความลายเซ็น** มา ตัววัดคือ "ก่อนถอดต้องมี · หลังถอดต้องไม่มี" ซึ่งตอบตรงคำถาม
# ว่า *ของชิ้นนี้* เฝ้าอะไร แทนที่จะถามว่ารอบนั้นแดงหรือเปล่า
sens() { # $1=ชื่อ $2=sed-expr $3=ฉาก $4=exit ปกติของฉากนั้น $5=ข้อความลายเซ็น (ไม่ใส่ = วัดด้วย exit)
  local name="$1" expr="$2" scenario="$3" normal="$4" sig="${5:-}" mutated base base_exit out got
  "$scenario"

  # ก่อนอื่น: ฉากนี้ต้องให้ผลอย่างที่เราคิดจริง ๆ — ไม่งั้นแถวนี้วัดฉากคนละอันกับที่เขียนไว้
  base="$(run_gate)"; base_exit=$?
  if [ "$base_exit" -ne "$normal" ]; then
    echo "  FAIL: [ความไว] $name — ฉากตั้งต้นให้ exit=$base_exit คาด $normal ⇒ แถวนี้วัดผิดฉาก"
    fail=$((fail + 1)); return
  fi
  if [ -n "$sig" ] && ! grep -qF -- "$sig" <<<"$base"; then
    echo "  FAIL: [ความไว] $name — ฉากตั้งต้นไม่มีข้อความลายเซ็น \"$sig\" ⇒ ไม่มีอะไรให้หายไป"
    fail=$((fail + 1)); return
  fi

  mutated="$SANDBOX/scripts/mutated.sh"
  cp "$SANDBOX/scripts/check-card-paths.sh" "$mutated"
  sed_i "$expr" "$mutated"
  # ⚠️ ถ้า sed ไม่ตรงกับของจริง แถวความไวนี้จะ "ผ่าน" ตลอดกาลโดยไม่ได้วัดอะไรเลย
  if cmp -s "$mutated" "$SANDBOX/scripts/check-card-paths.sh"; then
    echo "  FAIL: [ความไว] $name — sed ไม่ได้แก้อะไรเลย ⇒ แถวนี้วัดอะไรไม่ได้ (แก้ pattern ให้ตรงกับเกตจริง)"
    fail=$((fail + 1)); return
  fi

  out="$(run_gate "$mutated")"; got=$?
  if [ -n "$sig" ]; then
    if ! grep -qF -- "$sig" <<<"$out"; then
      echo "  ok: [ความไว] $name (ถอดแล้วข้อความ \"$sig\" หายไป)"; pass=$((pass + 1)); return
    fi
    echo "  FAIL: [ความไว] $name — ถอดออกแล้วยังรายงาน \"$sig\" ⇒ ของที่ถอดไม่ได้เฝ้าข้อนี้"
  elif [ "$got" -ne "$normal" ]; then
    echo "  ok: [ความไว] $name (ถอดแล้ว exit $normal → $got)"; pass=$((pass + 1)); return
  else
    echo "  FAIL: [ความไว] $name — ถอดออกแล้วคำตัดสินยัง $got เท่าเดิม ⇒ ของที่ถอดไม่ได้เฝ้าอะไร"
  fi
  printf '    --- output ---\n%s\n    --------------\n' "$out"; fail=$((fail + 1))
}

# ── แถวความไวของ **ข้อยกเว้น** ต้องวัดกลับทิศ (task 195)
# ข้อยกเว้นคือของที่ทำให้ฉาก **เขียว** ⇒ ถอดมันออกแล้วสิ่งที่เกิดคือข้อความ *โผล่มา* ไม่ใช่ *หายไป*
# · ใช้ `sens` เดิมไม่ได้เพราะมันบังคับว่าฉากตั้งต้นต้อง **มี** ลายเซ็นอยู่ก่อน
# · และวัดด้วย exit อย่างเดียวก็หยาบเกินไปด้วยเหตุผลเดียวกับที่เขียนไว้ข้างบน — บ้านที่ยกเว้น
#   หกหลังถูกถอดทีละหลัง แต่ทุกหลังทำให้ exit เป็น 1 เหมือนกันหมด ⇒ แยกไม่ออกว่าแถวไหนวัดอะไร
sens_appears() { # $1=ชื่อ $2=sed-expr $3=ฉาก(ต้องเขียว) $4=ข้อความที่ต้อง **โผล่มา** หลังถอด
  local name="$1" expr="$2" scenario="$3" sig="$4" mutated base base_exit out
  "$scenario"
  base="$(run_gate)"; base_exit=$?
  if [ "$base_exit" -ne 0 ]; then
    echo "  FAIL: [ความไว] $name — ฉากตั้งต้นให้ exit=$base_exit คาด 0 ⇒ แถวนี้วัดผิดฉาก"
    fail=$((fail + 1)); return
  fi
  if grep -qF -- "$sig" <<<"$base"; then
    echo "  FAIL: [ความไว] $name — ฉากตั้งต้น**มี** \"$sig\" อยู่แล้ว ⇒ ข้อยกเว้นไม่ได้ทำงาน"
    fail=$((fail + 1)); return
  fi
  mutated="$SANDBOX/scripts/mutated.sh"
  cp "$SANDBOX/scripts/check-card-paths.sh" "$mutated"
  sed_i "$expr" "$mutated"
  if cmp -s "$mutated" "$SANDBOX/scripts/check-card-paths.sh"; then
    echo "  FAIL: [ความไว] $name — sed ไม่ได้แก้อะไรเลย ⇒ แถวนี้วัดอะไรไม่ได้"
    fail=$((fail + 1)); return
  fi
  out="$(run_gate "$mutated")"
  if grep -qF -- "$sig" <<<"$out"; then
    echo "  ok: [ความไว] $name (ถอดแล้ว \"$sig\" โผล่มา)"; pass=$((pass + 1)); return
  fi
  echo "  FAIL: [ความไว] $name — ถอดข้อยกเว้นออกแล้ว \"$sig\" ยังไม่โผล่ ⇒ แถวนี้ไม่ได้เฝ้าข้อนี้"
  printf '    --- output ---\n%s\n    --------------\n' "$out"; fail=$((fail + 1))
}

# 🔑 **แถวหัวใจของใบ 195** — ย่อคลังกลับไปเป็น `.docs/knowledge/**` แบบใบ 190 แล้วพาธเน่าใน
# `CLAUDE.md` ต้องหายไปจากรายงาน · ถ้าไม่หาย แปลว่าคลังไม่ได้กว้างขึ้นจริงและทุกเคส T–Z ข้างบนโกหก
sens "คลัง = ทั้งรีโป ไม่ใช่แค่การ์ด (เคส T)" \
  "s|git ls-files -c -o --exclude-standard -z)|git ls-files -c -o --exclude-standard -z '.docs/knowledge/*.md')|" \
  sc_dead_claudemd 1 "CLAUDE.md:"

# ทุกบ้านที่ยกเว้น: ถอดทีละหลัง แล้วไฟล์ของหลังนั้น **ต้องโผล่มา** — ไม่ใช่แค่ exit ขยับ
sens_appears "ยกเว้น tasks/** (บันทึกประวัติศาสตร์)" \
  's|    tasks/\*) return 0 ;;|    tasks/zzz-no-such/*) return 0 ;;|' sc_green "tasks/done/fixture-closed-card.md:"
sens_appears "ยกเว้น scripts/tests/** (บ้านของ ghost)" \
  's|    scripts/tests/\*) return 0 ;;|    scripts/tests/zzz-no-such/*) return 0 ;;|' \
  sc_green "scripts/tests/x-selftest.sh:"
sens_appears "ยกเว้น prisma/migrations/** (migration ที่ apply แล้ว)" \
  's|    prisma/migrations/\*) return 0 ;;|    prisma/migrations/zzz-no-such/*) return 0 ;;|' \
  sc_green "prisma/migrations/0001_x.sql:"
sens_appears "ยกเว้น .claude/skills/** (vendored)" \
  's|    \.claude/skills/\*) return 0 ;;|    .claude/skills/zzz-no-such/*) return 0 ;;|' \
  sc_green ".claude/skills/demo/SKILL.md:"
# 📇 darin (ใบ 001): แถวของ `.docs/artifact/**` กับ `.docs/customer/updates/**` ถูกถอดออก
# พร้อมกับตัวข้ามของมันในเกต — รีโปนี้ไม่มีต้นฉบับลูกค้าที่ห้ามแก้ · **ถ้าวันหนึ่งมี**
# ให้เพิ่มทั้งตัวข้ามและแถวนี้พร้อมกัน: ตัวข้ามที่ไม่มีแถวเฝ้า คือพื้นที่ที่ด่านมองไม่เห็น
sens_appears "ตัวกรอง binary อ่านจากเนื้อไฟล์ (เคส X)" \
  's|grep -IlZ \. --|grep -lZ . --|' sc_green "api/cover.png:"
sens_appears "normalize ช่วงบรรทัด \`:12-20\` (เคส Y)" \
  's#sub(/:\[0-9\]+(-\[0-9\]+)?\$/, "", p)#sub(/:[0-9]+$/, "", p)#' sc_green "api/src/real.rs:12-20"

sens "ไม่ข้ามบล็อกโค้ด (เคส C)" \
  's|^{$|/^[[:space:]]*```/ { f = !f; next } f { next } {|' sc_dead_fence 1
sens "ตัวข้าม glob \`*\` (เคส A)" \
  's#index(p, "\*") || ##' sc_green 0
sens "ตัวข้ามจุดไข่ปลา (เคส A)" \
  's#index(p, "…") || ##' sc_green 0
sens "แตก span เป็นหลาย token (เคส N)" \
  's#k = split(s, t, /\[ \\t\]+/)#k = split(s, t, /\\n/)#' sc_dead_2nd_token 1 \
  "ไม่มีรากจริง: api/src/ghost.rs"
sens "จับคู่ backtick เป็นแถว (เคส O)" \
  's|if (k == run) { cl = j; break }|if (k >= 1) { cl = j; break }|' sc_dead_after_dbl 1 \
  "ไม่มีรากจริง: api/src/ghost.rs"
sens "normalize ตัดที่ \`::\` (เคส A)" \
  's|sub(/::.*|# ถอดเพื่อวัดความไว|' sc_green 0
sens "normalize ตัดเลขบรรทัดท้าย (เคส A)" \
  's|sub(/:\[0-9\].*|# ถอดเพื่อวัดความไว|' sc_green 0
# **ถอดแบบ "ข้ามเสมอ" ไม่ใช่ "ตรวจเสมอ"** — `[ -e ]` ที่ถูกลบทิ้งเฉย ๆ ทำให้ *ทุก* พาธแดง
# ⇒ exit ยัง 1 เท่าเดิม แล้วแถวนี้จะรายงานผิดว่ามันไม่ได้เฝ้าอะไร (วัดจริงตอนเขียนใบนี้)
sens "ด่านพาธเน่า \`[ -e \$p ]\` (เคส B)" \
  's|\[ -e "\$p" \] && continue|continue|' sc_dead_prose 1 "ไม่มีรากจริง: api/src/ghost.rs"
sens "ข้ามพาธที่ gitignore คลุม (เคส P)" \
  's|in_list "\$p" "\$ignored" && continue|:|' sc_green 0
sens "กรองไฟล์ที่อ่านไม่ได้ (เคส S)" \
  's|if \[ -r "\$f" \]; then prose+=("\$f")|if false; then prose+=("$f")|' sc_unreadable 0
# ⚠️ **รากที่หยิบมาวัดต้องเป็นราก *ตายตัวล้วน* ในแซนด์บ็อกซ์นี้** — ตั้งแต่ใบ 195 แซนด์บ็อกซ์มี
# `tasks/done/fixture-closed-card.md` ที่ tracked (ไว้พิสูจน์ข้อยกเว้น) ⇒ `tasks` กลายเป็นราก **ไดนามิก** ไปด้วย
# ⇒ ถอดมันออกจาก `STATIC_ROOTS` แล้วไม่มีอะไรเปลี่ยน = แถวความไวที่เขียวโดยไม่ได้วัด (เจอจริงรอบนี้)
# · `.github` ไม่มีไฟล์ tracked สักไฟล์ในแซนด์บ็อกซ์ ⇒ มันมาจากครึ่งตายตัวล้วน ๆ จึงเป็นตัววัดที่ถูก
sens "รากตายตัว (เคส Q — ราก .github/)" \
  's|^STATIC_ROOTS="api web scripts tasks .docs .github"$|STATIC_ROOTS="api web scripts tasks .docs"|' \
  sc_all_roots 1 "ไม่มีรากจริง: .github/x/ghost.yml"
sens "รากไดนามิก (เคส Q — ราก .agents/)" \
  's|git ls-files -z . tr .\\0. .\\n. . awk -F/ .NF>1 { print \$1 }.;|:;|' \
  sc_all_roots 1 "ไม่มีรากจริง: .agents/x/ghost.md"
sens "ด่านกันสุสาน ทิศ 'กลับมามีตัวตน' (เคส F)" \
  's|if \[ -e "\$a" \]; then|if false; then|' sc_allow_exists 1 "กลับมามีตัวตนแล้ว"
sens "ด่านกันสุสาน ทิศ 'ไม่มีใครอ้างแล้ว' (เคส G)" \
  's|if ! in_list "\$a" "\$allow_hit"; then|if false; then|' sc_allow_uncited 1
sens "ด่าน \`# task NNN\` ของ allowlist (เคส H)" \
  "s|\*'# task '.*|*) ;;|" sc_allow_notask 1
# ⚠️ guard ต้องจับคู่กับฉากที่มัน **ยิงจริง** — จับคู่กับฉากเขียวคือการวัดว่า "ถอดของที่ไม่ได้ทำงาน
# อยู่แล้วออก แล้วไม่มีอะไรเปลี่ยน" ซึ่งจริงเสมอและไม่ได้พิสูจน์อะไร (เขียนผิดมาก่อนแล้วรอบหนึ่ง)
sens "guard 'คลังว่าง' (เคส L)" \
  's|if \[ "\${#prose\[@\]}" -eq 0 \]; then|if false; then|' sc_no_files 1 "ไม่พบไฟล์ที่อ่านได้ในคลัง"
sens "guard 'คัดไฟล์ข้อความไม่ได้เลย' (เคส L)" \
  's|if \[ "\${#text\[@\]}" -eq 0 \]; then|if false; then|' sc_all_binary 1 "คัดไฟล์ข้อความไม่ได้เลย"
sens "guard 'awk ล้ม' (เคส M)" \
  's|if ! raw="\$(awk|if raw="$(awk|' sc_awk_fail 1 "อ่านคลังไม่สำเร็จ"
