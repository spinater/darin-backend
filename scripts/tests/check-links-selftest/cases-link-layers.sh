#!/usr/bin/env bash
# เคสของ **ชั้นที่หนึ่ง–สาม ของ `check-links.sh`** (A–G · J) — แตกออกมาจาก `scripts/tests/check-links-selftest.sh` ที่ใบ 276 (§4 เพดาน 500)
# ⚠️ ไฟล์นี้ถูก **`.` (source)** จากไฟล์เข้า ไม่ใช่รันเอง ⇒ ใช้ตัวแปร/ฟังก์ชันของไฟล์นั้นร่วมกัน
# (ตัวนับ `pass`/`fail` · `new_sandbox` · `expect` · `check` · `strip` และ trap ต้องเป็นชุดเดียว
#  — รูปเดียวกับ `scripts/tests/check-card-paths-selftest/` และ `check-counter-test-selftest/`)

echo "selftest: A — แซนด์บ็อกซ์ครบ ⇒ เขียว (และตรึงข้อยกเว้น api/migrations/**)"
new_sandbox
expect "แซนด์บ็อกซ์ครบ" 0 "check-links: OK"

echo "selftest: B — ใบเดียวสองบ้าน ⇒ แดง"
new_sandbox
cp "$SANDBOX/$T/todo/$A" "$SANDBOX/$T/done/$A"
expect "ใบเดียวสองบ้าน" 1 "มีมากกว่าหนึ่งบ้าน"

echo "selftest: C — พาธในไฟล์โค้ดชี้ผิดบ้าน ⇒ แดงพร้อมบอกบ้านจริง"
new_sandbox
git -C "$SANDBOX" mv "$T/todo/$A" "$T/done/$A" >/dev/null
sed -i.bak "s#](${T}/todo/${A})#](${T}/done/${A})#" "$SANDBOX/README.md" && rm -f "$SANDBOX/README.md.bak"
expect "พาธโค้ดชี้ผิดบ้าน" 1 "พาธใบงานชี้ผิดบ้าน" 
expect "พาธโค้ดชี้ผิดบ้าน (บอกบ้านจริง)" 1 "บ้านจริงวันนี้: $T/done/$A"

echo "selftest: D — พาธในไฟล์โค้ดชี้ใบที่ไม่มีในสามบ้าน ⇒ คนละใบกับ C"
new_sandbox
sed -i.bak "s#${T}/todo/${A}#${T}/todo/${GHOST}#" "$SANDBOX/lib/demo.ts" && rm -f "$SANDBOX/lib/demo.ts.bak"
expect "พาธโค้ดชี้ใบผี" 1 "ไม่มีในสามบ้าน" "ชี้ผิดบ้าน"

echo "selftest: E — ลิงก์ markdown พัง ⇒ ชั้นที่หนึ่งยังทำงาน"
new_sandbox
printf '\n[ใบที่ไม่มี](%s)\n' "$T/done/$GHOST" >> "$SANDBOX/README.md"
expect "ลิงก์ markdown พัง" 1 "broken link"

echo "selftest: F — หัว migration ใบใหม่อ้างด้วยพาธ ⇒ กติกา 083"
new_sandbox
printf -- '-- อ้างอิง: %s\nSELECT 1;\n' "$T/done/$B" > "$SANDBOX/prisma/migrations/9999_selftest.sql"
expect "หัว migration ใหม่อ้างพาธ" 1 "กติกา task 083" "ชี้ผิดบ้าน"

echo "selftest: G — FROZEN มีเลขที่ไม่มีตัวตนแล้ว ⇒ แดง (รายการยกเว้นห้ามเป็นสุสาน)"
new_sandbox
rm -f "$SANDBOX/prisma/migrations/0028_selftest.sql"
expect "FROZEN เป็นสุสาน" 1 "ไม่มีหัว migration ไหนอ้างพาธแล้ว"


echo "selftest: J — color.ui/grep.column ของผู้ใช้ต้องไม่เปลี่ยนคำตัดสินของเกต"
new_sandbox
printf '[color]\n\tui = always\n[grep]\n\tcolumn = true\n' > "$SANDBOX/gitconfig-color"
out_j="$(GIT_CONFIG_GLOBAL="$PWD/$SANDBOX/gitconfig-color" bash "$SANDBOX/scripts/check-links.sh" 2>&1)"; j=$?
check "ทรีสะอาดยังเขียวใต้ color.ui=always" \
  "$([ "$j" -eq 0 ] && echo 1 || echo 0)" \
  "exit=$j · output: $out_j"
sed -i.bak "s#${T}/todo/${A}#${T}/todo/${GHOST}#" "$SANDBOX/lib/demo.ts" && rm -f "$SANDBOX/lib/demo.ts.bak"
out_j="$(GIT_CONFIG_GLOBAL="$PWD/$SANDBOX/gitconfig-color" bash "$SANDBOX/scripts/check-links.sh" 2>&1)"; j=$?
check "พาธเน่ายังแดงด้วยข้อความเดิมใต้ color.ui=always" \
  "$([ "$j" -eq 1 ] && grep -qF "ไม่มีในสามบ้าน" <<<"$out_j" && echo 1 || echo 0)" \
  "exit=$j · output: $out_j"

