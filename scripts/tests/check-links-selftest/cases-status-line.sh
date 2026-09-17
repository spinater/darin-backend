#!/usr/bin/env bash
# เคสของ **ชั้นที่สี่ (บรรทัด `- status:` / `- 🚫`) + ตารางความไวทั้งเก้าแถว** (P–X) — แตกออกมาจาก `scripts/tests/check-links-selftest.sh` ที่ใบ 276 (§4 เพดาน 500)
# ⚠️ ไฟล์นี้ถูก **`.` (source)** จากไฟล์เข้า ไม่ใช่รันเอง ⇒ ใช้ตัวแปร/ฟังก์ชันของไฟล์นั้นร่วมกัน
# (ตัวนับ `pass`/`fail` · `new_sandbox` · `expect` · `check` · `strip` และ trap ต้องเป็นชุดเดียว
#  — รูปเดียวกับ `scripts/tests/check-card-paths-selftest/` และ `check-counter-test-selftest/`)

echo "selftest: P — ชั้นที่สี่: บรรทัด status ที่อ้างบ้านอื่น ⇒ แดง **พร้อมชื่อ token เต็มคำ**"
new_sandbox
printf '# ใบสมมติ ก\n\n- status: **todo-human** — รอคนตอบ 3 ข้อ\n' > "$SANDBOX/$T/todo/$A"
# ข้อความต้องเอ่ย `todo-human` เต็มคำ ไม่ใช่ `todo` — ถ้าตัวจับหยุดที่ `-` มันจะอ่านได้ `todo`
# ซึ่งเท่ากับชื่อบ้าน ⇒ **เขียว** ทั้งที่ใบโกหก (กับดัก prefix เดียวกับใบ 190/193)
expect "status อ้างบ้านอื่น" 1 'เขียน `todo-human` แต่ใบอยู่บ้าน tasks/todo/'

echo "selftest: Q — token ที่**ไม่ใช่ชื่อบ้าน** ต้องไม่ถูกตรวจ (ตัวพิสูจน์ว่าไม่มีแดงปลอม)"
new_sandbox
# ของจริง 39 ใบเขียนแบบนี้ (`ship แล้ว` 20 · ไทย 17 · `absorbed` 1 · `Phase 1` 1) ⇒ กติกาที่
# เขียนว่า "token ต้องเท่าชื่อบ้าน" จะแดงใส่ทุกใบพวกนี้โดยไม่มีใบไหนโกหกเลยสักใบ
printf '# ใบสมมติ ข\n\n- status: **ship แล้ว** (2026-08-20) — ปิดครบ\n' > "$SANDBOX/$T/done/$B"
expect "token ที่ไม่ใช่ชื่อบ้าน ⇒ ไม่ถูกตรวจ" 0 "check-links: OK"

echo "selftest: R — บรรทัด \`- 🚫\` อยู่ได้บ้านเดียว (ตรวจทั้งสองทิศ)"
new_sandbox
printf '# ใบสมมติ ก\n\n- status: todo\n- 🚫 บล็อกที่: รอคนตอบ\n' > "$SANDBOX/$T/todo/$A"
expect "🚫 ใน todo/ ⇒ แดง" 1 "ประกาศว่าบล็อกที่คน"
# ⚠️ ครึ่งที่สองคือของจริง: ยามที่จับคู่กับฉากที่มันไม่เคยทำงาน วัดอะไรไม่ได้ (§7 เตือนไว้เอง)
new_sandbox
printf '# ใบสมมติ ค\n\n- status: todo-human\n- 🚫 บล็อกที่: รอคนตอบ\n' > "$SANDBOX/$T/todo-human/$C"
git -C "$SANDBOX" add -Af >/dev/null
expect "🚫 ใน todo-human/ ⇒ เขียว" 0 "check-links: OK"
# และทางออกที่กติกาบอกไว้ต้องใช้ได้จริง — ลดชั้นเป็น `(เดิม)` แบบที่ใบ 166 ทำ
new_sandbox
printf '# ใบสมมติ ก\n\n- status: todo\n- (เดิม) 🚫 บล็อกที่: เคยรอคนตอบ\n' > "$SANDBOX/$T/todo/$A"
expect "รูป (เดิม) 🚫 ⇒ เขียว (ทางออกที่เกตบอกเอง)" 0 "check-links: OK"

echo "selftest: S — --answered ต้องแก้ token ของบรรทัด status **ที่มีหาง** แล้วเก็บหางไว้"
new_sandbox
(cd "$SANDBOX" && bash scripts/task-move.sh 900 --human >/dev/null 2>&1)
# รูป "มีหาง" = 98 จาก 242 บรรทัดของจริง · `sed` เดิมแมตช์แต่รูปเปล่าล้วน **แล้วเงียบ**
# ⇒ ใบไปถึงบ้านใหม่พร้อมบรรทัดที่ยังบอกบ้านเก่า = กลไกที่ผลิต 11 ใบของ `1e4e3f2`/`dfa355d`
printf '# ใบสมมติ ก\n\n- status: **todo-human** — รอคนตอบ 3 ข้อ\n' > "$SANDBOX/$T/todo-human/$A"
s_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 --answered 2>&1)"; s_code=$?
check "token ถูกเขียนใหม่เป็น todo **และหางอยู่ครบ**" \
  "$(grep -qF -- '- status: **todo** — รอคนตอบ 3 ข้อ' "$SANDBOX/$T/todo/$A" && echo 1 || echo 0)" \
  "บรรทัดที่ได้: $(grep -m1 '^- status:' "$SANDBOX/$T/todo/$A")"
check "และเกตเขียวหลังย้าย (ชั้นที่สี่ไม่มีอะไรค้าง)" \
  "$([ "$s_code" -eq 0 ] && grep -q 'check-links: OK' <<<"$s_out" && echo 1 || echo 0)" \
  "exit=$s_code · output: $s_out"

echo "selftest: T — task-move ต้อง**รายงานสิ่งที่ทำแทนคนไม่ได้** แล้วปล่อยให้เกตแดง"
new_sandbox
printf '# ใบสมมติ ก\n\n- status: todo\n- 🚫 บล็อกที่: รอคนตอบ\n' > "$SANDBOX/$T/todo/$A"
(cd "$SANDBOX" && bash scripts/task-move.sh 900 --human >/dev/null 2>&1)
t_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 --answered 2>&1)"; t_code=$?
check "เตือนว่ายังมีบรรทัด 🚫 ที่บ้านใหม่รับไม่ได้" \
  "$(grep -q 'ยังมีบรรทัดขึ้นต้น' <<<"$t_out" && echo 1 || echo 0)" \
  "ไม่มีคำเตือน · output: $t_out"
# ⚠️ ครึ่งนี้คือ **ความแดงที่ตั้งใจ** ไม่ใช่บั๊ก: เครื่องเปลี่ยน token ให้ได้ แต่ตัดสินแทนคนไม่ได้
# ว่าข้อความบล็อกยังจริงอยู่ไหม ⇒ ปล่อยให้เกตแดงจนกว่าคนจะลดชั้นเป็น `(เดิม)`
check "และเกตแดงจนกว่าคนจะแก้ (ตั้งใจให้แดง)" \
  "$([ "$t_code" -ne 0 ] && echo 1 || echo 0)" \
  "exit=$t_code — เขียวทั้งที่ใบยังประกาศว่าบล็อกอยู่ · output: $t_out"

echo "selftest: U — ไวยากรณ์ที่สอง \`**สถานะ:**\` (ใบ 237–240 ใช้อยู่จริง) ต้องถูกอ่านด้วย"
new_sandbox
printf '# ใบสมมติ ก\n\n**สถานะ:** todo-human\n' > "$SANDBOX/$T/todo/$A"
expect "หัวใบรูป **สถานะ:** ที่อ้างบ้านอื่น ⇒ แดง" 1 'เขียน `todo-human` แต่ใบอยู่บ้าน tasks/todo/'

echo "selftest: V — คำนำหน้า \`✅\` (5 ใบใช้อยู่จริง) ต้องถูกปอกทิ้ง ไม่ใช่ทำให้ทั้งใบมองไม่เห็น"
new_sandbox
printf '# ใบสมมติ ก\n\n- status: ✅ **todo-human** — ปิดแล้ว\n' > "$SANDBOX/$T/todo/$A"
expect "หัวใบมี ✅ นำหน้า ⇒ ยังอ่าน token ออก ⇒ แดง" 1 'เขียน `todo-human` แต่ใบอยู่บ้าน tasks/todo/'

echo "selftest: W — \`- สถานะ:\` (ไม่มี \`**\`) คือ**เนื้อหาโดเมน** ห้ามอ่านเป็นสถานะของใบ"
new_sandbox
# ของจริงคือ `done/054` บรรทัด 16: `- สถานะ: waiting · in_service · done · cancelled`
# = สถานะของ**คิวคนไข้** · มีคำว่า `done` อยู่ในนั้น ⇒ ตัวสกัดที่ละโมบเกินจะอ่านได้ `done`
# แล้วแดงใส่ใบใน `todo/` โดยที่ใบไม่ได้โกหกอะไรเลย
printf '# ใบสมมติ ก\n\n- สถานะ: done · waiting · cancelled\n' > "$SANDBOX/$T/todo/$A"
expect "บรรทัดโดเมนต้องไม่ถูกอ่านเป็นสถานะของใบ ⇒ เขียว" 0 "check-links: OK"

echo "selftest: X — กองที่ **อ่านไม่ออก** ต้องถูกนับและพิมพ์ทุกรอบ (ห้ามข้ามเงียบ ๆ)"
new_sandbox
printf '# ใบสมมติ ก\n\n- status: **ปิดแล้ว** (2026-08-28)\n' > "$SANDBOX/$T/todo/$A"
out_x="$(bash "$SANDBOX/scripts/check-links.sh" 2>&1)"; x=$?
check "token ไทยไม่ทำให้แดง (ไม่ได้อ้างบ้าน) แต่ต้องถูกนับ" \
  "$([ "$x" -eq 0 ] && grep -q 'token อ่านไม่ออก 1 ใบ' <<<"$out_x" && echo 1 || echo 0)" \
  "exit=$x · output: $out_x"

echo "selftest: ความไว 1 — ถอดแขน status ของชั้นที่สี่ ⇒ P ต้องเขียว"
new_sandbox
printf '# ใบสมมติ ก\n\n- status: **todo-human** — รอคนตอบ 3 ข้อ\n' > "$SANDBOX/$T/todo/$A"
strip scripts/check-links.sh 's#^    case "\$tok" in#    case "ไม่มีทางแมตช์" in#' "แขน status"
out_s1="$(bash "$SANDBOX/scripts/check-links.sh" 2>&1)"; s1=$?
check "ถอดแขน status แล้ว P เขียว (⇒ แขนนั้นคือของที่จับ P)" \
  "$([ "$s1" -eq 0 ] && echo 1 || echo 0)" "exit=$s1 · output: $out_s1"

echo "selftest: ความไว 2 — ตัวจับ token หยุดที่ \`-\` ⇒ P เขียวทั้งที่ใบโกหก (กับดัก prefix)"
new_sandbox
printf '# ใบสมมติ ก\n\n- status: **todo-human** — รอคนตอบ 3 ข้อ\n' > "$SANDBOX/$T/todo/$A"
strip scripts/check-links.sh 's#\[a-z\]\[a-z-\]\*#[a-z]*#' "ตัวจับ token แบบไม่ละโมบ"
out_s2="$(bash "$SANDBOX/scripts/check-links.sh" 2>&1)"; s2=$?
check "อ่าน token ได้แค่ \`todo\` ⇒ เท่าชื่อบ้าน ⇒ เขียว (นี่คือเหตุผลที่ต้องละโมบ)" \
  "$([ "$s2" -eq 0 ] && echo 1 || echo 0)" "exit=$s2 · output: $out_s2"

echo "selftest: ความไว 3 — ถอดแขน 🚫 ⇒ R ครึ่งแรกต้องเขียว"
new_sandbox
printf '# ใบสมมติ ก\n\n- status: todo\n- 🚫 บล็อกที่: รอคนตอบ\n' > "$SANDBOX/$T/todo/$A"
strip scripts/check-links.sh 's#^    if \[ "\$d" != "todo-human" \]; then#    if false; then#' "แขน 🚫"
out_s3="$(bash "$SANDBOX/scripts/check-links.sh" 2>&1)"; s3=$?
check "ถอดแขน 🚫 แล้ว R ครึ่งแรกเขียว" \
  "$([ "$s3" -eq 0 ] && echo 1 || echo 0)" "exit=$s3 · output: $out_s3"

echo "selftest: ความไว 4 — ถอดตัวเขียน token ของ task-move.sh ⇒ S ต้องแดง"
new_sandbox
(cd "$SANDBOX" && bash scripts/task-move.sh 900 --human >/dev/null 2>&1)
printf '# ใบสมมติ ก\n\n- status: **todo-human** — รอคนตอบ 3 ข้อ\n' > "$SANDBOX/$T/todo-human/$A"
strip scripts/task-move.sh 's#^edit "\$moved" -E -e#: #' "ตัวเขียน token ของ task-move"
s4_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 --answered 2>&1)"; s4=$?
check "ไม่เขียน token ⇒ ใบถึงบ้านใหม่พร้อมบรรทัดที่บอกบ้านเก่า ⇒ เกตแดง" \
  "$([ "$s4" -ne 0 ] && grep -q 'บรรทัด status เขียน' <<<"$s4_out" && echo 1 || echo 0)" \
  "exit=$s4 · output: $s4_out"
check "และตัวเครื่องมือเองก็ต้องเตือนไว้ก่อนแล้ว (ไม่ใช่ปล่อยให้เกตพูดคนเดียว)" \
  "$(grep -q 'บรรทัด status ยังเขียน' <<<"$s4_out" && echo 1 || echo 0)" \
  "ไม่มีคำเตือนของ task-move · output: $s4_out"

echo "selftest: ความไว 5 — ตัวเลือกไฟล์ของชั้นที่สี่กวาดได้ศูนย์ใบ ⇒ ต้อง FAIL ไม่ใช่เขียว"
new_sandbox
strip scripts/check-links.sh 's#^for d in todo todo-human done; do#for d in ไม่มีบ้านนี้; do#' "ตัวเลือกบ้าน"
out_s5="$(bash "$SANDBOX/scripts/check-links.sh" 2>&1)"; s5=$?
check "กวาด 0 ใบ = FAIL พร้อมบอกว่าตัวเลือกพัง (บทเรียน check-file-length ของใบ 193)" \
  "$([ "$s5" -ne 0 ] && grep -q 'อ่านใบงานได้ 0 ใบ' <<<"$out_s5" && echo 1 || echo 0)" \
  "exit=$s5 · output: $out_s5"

echo "selftest: ความไว 6 — ถอนไวยากรณ์ \`**สถานะ:**\` ⇒ U เขียว (ใบ 237–240 หายไปจากสายตา)"
new_sandbox
printf '# ใบสมมติ ก\n\n**สถานะ:** todo-human\n' > "$SANDBOX/$T/todo/$A"
strip scripts/check-links.sh 's#|\\\*\\\*สถานะ:\\\*\\\*)#)#g' "ไวยากรณ์ **สถานะ:**"
out_s6="$(bash "$SANDBOX/scripts/check-links.sh" 2>&1)"; s6=$?
check "อ่านหัวใบรูปที่สองไม่ออก ⇒ U เขียวทั้งที่ใบโกหก" \
  "$([ "$s6" -eq 0 ] && echo 1 || echo 0)" "exit=$s6 · output: $out_s6"

echo "selftest: ความไว 7 — ถอนตัวปอก \`✅\` ⇒ V เขียว"
new_sandbox
printf '# ใบสมมติ ก\n\n- status: ✅ **todo-human** — ปิดแล้ว\n' > "$SANDBOX/$T/todo/$A"
strip scripts/check-links.sh 's#s/\^✅ \*//; ##' "ตัวปอก ✅"
out_s7="$(bash "$SANDBOX/scripts/check-links.sh" 2>&1)"; s7=$?
check "ไม่ปอก ✅ ⇒ token อ่านไม่ออก ⇒ V เขียวทั้งที่ใบโกหก" \
  "$([ "$s7" -eq 0 ] && echo 1 || echo 0)" "exit=$s7 · output: $out_s7"

echo "selftest: ความไว 8 — ทิ้งเงื่อนไข \`**\` ของ \`สถานะ:\` ⇒ W แดงปลอม"
new_sandbox
printf '# ใบสมมติ ก\n\n- สถานะ: done · waiting · cancelled\n' > "$SANDBOX/$T/todo/$A"
strip scripts/check-links.sh 's#\\\*\\\*สถานะ:\\\*\\\*#- สถานะ:#g' "เงื่อนไข ** ของ สถานะ:"
out_s8="$(bash "$SANDBOX/scripts/check-links.sh" 2>&1)"; s8=$?
check "อ่านบรรทัดโดเมนเป็นสถานะของใบ ⇒ แดงปลอมทันที (นี่คือเหตุผลที่ต้องบังคับ \`**\`)" \
  "$([ "$s8" -ne 0 ] && grep -q 'บรรทัด status เขียน' <<<"$out_s8" && echo 1 || echo 0)" \
  "exit=$s8 · output: $out_s8"

echo "selftest: ความไว 9 — ถอนตัวนับกองอ่านไม่ออก ⇒ X ต้องพลิก (เลขที่พิมพ์เปลี่ยน)"
new_sandbox
printf '# ใบสมมติ ก\n\n- status: **ปิดแล้ว** (2026-08-28)\n' > "$SANDBOX/$T/todo/$A"
strip scripts/check-links.sh 's#^    \[ -n "\$tok" \] || unread=\$((unread + 1))#    :#' "ตัวนับ unread"
out_s9="$(bash "$SANDBOX/scripts/check-links.sh" 2>&1)"
check "ไม่นับ ⇒ พิมพ์ 0 ใบ ทั้งที่มีใบที่อ่านไม่ออกจริง" \
  "$(grep -q 'token อ่านไม่ออก 0 ใบ' <<<"$out_s9" && echo 1 || echo 0)" \
  "output: $out_s9"
