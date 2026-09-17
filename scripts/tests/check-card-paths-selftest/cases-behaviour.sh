#!/usr/bin/env bash
# เคสพฤติกรรมของ `scripts/tests/check-card-paths-selftest.sh` (แตกออกมาที่ใบ 195 — §4 เพดาน 500)
# ⚠️ ไฟล์นี้ถูก **`.` (source)** จากไฟล์เข้า ไม่ใช่รันเอง ⇒ ใช้ตัวแปร/ฟังก์ชันของไฟล์นั้นร่วมกัน
# (ตัวนับ `pass`/`fail` และ trap ต้องเป็นชุดเดียว — รูปเดียวกับ `check-counter-test-selftest/`)

echo "selftest: A — แซนด์บ็อกซ์ครบ ⇒ เขียว (ตรึง normalize + ตัวข้าม + บล็อกโค้ด + ราก)"
sc_green
expect "แซนด์บ็อกซ์ครบ" 0 "check-card-paths: OK"

echo "selftest: B — พาธเน่าในร้อยแก้ว ⇒ แดงพร้อมการ์ด:บรรทัดที่ถูกต้อง"
sc_dead_prose
b_line="$(grep -n 'api/src/ghost.rs' "$SANDBOX/$CARD" | cut -d: -f1)"
expect "พาธเน่าในร้อยแก้ว" 1 "$CARD:$b_line — พาธในร้อยแก้วไม่มีรากจริง: api/src/ghost.rs"

echo "selftest: C — พาธเน่าใน**บล็อกโค้ด** ⇒ แดง (ตรึงคำตัดสิน 'ไม่ข้ามบล็อกโค้ด')"
sc_dead_fence
expect "พาธเน่าในบล็อกโค้ด" 1 "ไม่มีรากจริง: api/src/ghost.rs"

echo "selftest: D — พาธเน่าที่มี [locale]/(app) ⇒ แดง (วงเล็บไม่ใช่ตัวข้าม)"
sc_dead_brackets
expect "พาธเน่าที่มีวงเล็บ" 1 "ไม่มีรากจริง: web/src/app/[locale]/(app)/ghost.tsx"

echo "selftest: E — พาธเน่าที่อยู่ใน allowlist ⇒ เขียว (รวมอยู่ในเคส A แล้ว ยืนยันซ้ำแบบเจาะจง)"
sc_green
expect "allowlist ดูดพาธที่ตั้งใจให้ไม่มี" 0 "check-card-paths: OK" ".github/gone.md"

echo "selftest: F — allowlist มีพาธที่กลับมามีตัวตน ⇒ แดง (ห้ามพูดใบ G)"
sc_allow_exists
expect "allowlist กลับมามีตัวตน" 1 "กลับมามีตัวตนแล้ว" "ไม่มีการ์ดไหนอ้าง"

echo "selftest: G — allowlist มีพาธที่ไม่มีไฟล์ไหนในคลังอ้าง ⇒ แดง (ห้ามพูดใบ F)"
sc_allow_uncited
expect "allowlist เป็นสุสาน" 1 "ไม่มีไฟล์ไหนในคลังอ้างพาธนี้แล้ว" "กลับมามีตัวตนแล้ว"

echo "selftest: H — แถว allowlist ที่ไม่อ้าง \`# task NNN\` ⇒ แดง · แถวที่ย่อหน้าต้องไม่หายเงียบ"
sc_allow_notask
expect "allowlist ไม่อ้างใบงาน" 1 "ต้องอ้างใบงาน"
new_sandbox
add_line "$ALLOW" '   .docs/indented.md  # ไม่มีเลขใบ'
add_line "$CARD" 'ย่อหน้า: `.docs/indented.md`'
expect "แถว allowlist ที่ย่อหน้าไม่หายเงียบ" 1 "ต้องอ้างใบงาน"

echo "selftest: I — allowlist กับพาธที่มีวงเล็บ ⇒ เขียว (ตัวเทียบเป็นสตริงตรง ๆ ไม่ใช่ case)"
sc_dead_brackets
add_line "$ALLOW" 'web/src/app/[locale]/(app)/ghost.tsx  # task 190 — จอที่ยกเลิกแล้ว'
expect "allowlist รับพาธที่มีวงเล็บได้" 0 "check-card-paths: OK"

echo "selftest: J — การ์ดใหม่ที่ยังไม่ git add ก็ถูกสแกน"
new_sandbox
printf '# การ์ดใหม่\n\nพาธที่ย้ายไปแล้ว: `%s`\n' "api/src/ghost.rs" \
  > "$SANDBOX/.docs/knowledge/code/brand-new.md"
expect "การ์ด untracked ถูกสแกน" 1 "brand-new.md:"

echo "selftest: K — #ARGS ไม่ครบ ⇒ 'อ่านคลังไม่ครบ' ไม่ใช่ OK"
new_sandbox
sed_i 's|(ARGC - 1)|(ARGC - 2)|' "$SANDBOX/scripts/check-card-paths.sh"
expect "อ่านคลังไม่ครบ = แดง ไม่ใช่เขียว" 1 "อ่านคลังไม่ครบ" "check-card-paths: OK"

echo "selftest: L — คลังว่าง ⇒ แดง ไม่ใช่เขียว (ตั้งแต่ใบ 195 คลัง = ทั้งทรี ⇒ ฉากคือ *ไม่มีไฟล์ที่อ่านได้เลย*)"
sc_no_files
expect "ทรีที่ไม่มีไฟล์อ่านได้ = แดง" 1 "ไม่พบไฟล์ที่อ่านได้ในคลัง" "check-card-paths: OK"
sc_all_binary
expect "ทรีที่เป็นไบนารีล้วน = แดง ไม่ใช่ OK" 1 "คัดไฟล์ข้อความไม่ได้เลย" "check-card-paths: OK"

echo "selftest: M — awk ล้ม ⇒ 'อ่านคลังไม่สำเร็จ' แล้วหยุด (ห้ามสั่งลบแถว allowlist ที่ยังจำเป็น)"
new_sandbox
sed_i 's|k = split(s, t, /\[ \\t\]+/)|k = split(|' "$SANDBOX/scripts/check-card-paths.sh"
expect "awk ล้ม = แดงใบของตัวเอง" 1 "อ่านคลังไม่สำเร็จ" "ไม่มีไฟล์ไหนในคลังอ้าง"

echo "selftest: N — พาธเน่าที่เป็น token ที่สองของ span ⇒ แดง"
sc_dead_2nd_token
expect "token ที่สองถูกตรวจ" 1 "ไม่มีรากจริง: api/src/ghost.rs"

echo "selftest: O — พาธเน่าหลังโครงสร้าง backtick คู่บนบรรทัดเดียวกัน ⇒ แดง"
sc_dead_after_dbl
expect "การจับคู่ backtick ไม่สลับขั้ว" 1 "ไม่มีรากจริง: api/src/ghost.rs"

echo "selftest: P — พาธที่ .gitignore คลุม = นอกขอบเขตทั้งสองทิศ"
sc_green
expect "gitignore + ไม่มีไฟล์ ⇒ ไม่แดง" 0 "check-card-paths: OK" "api/build/out.txt"
sc_gitignored_exists
expect "gitignore + มีไฟล์ ⇒ ก็ยังไม่ใช่หลักฐาน" 0 "check-card-paths: OK" "api/build/out.txt"

echo "selftest: Q — พาธเน่าหนึ่งเส้นต่อหนึ่งราก ต้องถูกรายงานทุกเส้น"
sc_all_roots
for r in "api/x/ghost.rs" "web/x/ghost.tsx" "scripts/x/ghost.sh" \
         "tasks/x/ghost.md" ".docs/x/ghost.md" ".github/x/ghost.yml" ".agents/x/ghost.md"; do
  expect "ราก $(printf '%s' "${r%%/*}") ถูกเฝ้า" 1 "ไม่มีรากจริง: $r"
done

echo "selftest: S — ไฟล์ที่อ่านไม่ได้ ⇒ note: บอกชื่อ แล้วเดินต่อจนจบ"
sc_unreadable
expect "ไฟล์อ่านไม่ได้ไม่ทำให้ทั้งรอบตาย" 0 "note: ข้ามไฟล์ที่อ่านไม่ได้" "อ่านคลังไม่สำเร็จ"

echo "selftest: T — พาธเน่าใน .md **นอก** .docs/knowledge/ (CLAUDE.md) ⇒ แดง (คลังใบ 195)"
sc_dead_claudemd
expect "CLAUDE.md อยู่ในคลัง" 1 "CLAUDE.md:" 
expect "CLAUDE.md แดงด้วยพาธที่ถูก" 1 "ไม่มีรากจริง: api/src/ghost.rs"

echo "selftest: U — พาธเน่าใน **คอมเมนต์ซอร์ส** (.ts · .rs · .sh) ⇒ แดง"
sc_dead_ts_comment
expect "คอมเมนต์ .ts ถูกสแกน" 1 "web/src/demo.ts:"
sc_dead_rs_comment
expect "คอมเมนต์ .rs ถูกสแกน" 1 "api/src/demo.rs:"
sc_dead_sh
expect "คอมเมนต์ .sh ถูกสแกน" 1 "scripts/tool.sh:"

echo "selftest: V — พาธเน่าในสตริง \`throw new Error(...)\` ⇒ แดง (ตัวกวาดที่เดินตาม import มองไม่เห็น)"
sc_dead_throw
expect "สตริงใน throw ถูกสแกน" 1 "web/tests/demo.test.ts:"

echo "selftest: W — บ้านที่ยกเว้น ต้อง **เขียว** ทั้งที่ถือพาธเน่าไว้จริงตั้งแต่ฉากตั้งต้น"
sc_green
expect "ฉากตั้งต้นเขียวทั้งที่มีพาธเน่าในบ้านที่ยกเว้น" 0 "check-card-paths: OK" "ไม่มีรากจริง"
for f in "tasks/done/fixture-closed-card.md" "scripts/tests/x-selftest.sh" "api/migrations/0001_x.sql" \
         ".claude/skills/demo/SKILL.md"; do
  expect "ยกเว้น $f" 0 "check-card-paths: OK" "$f:"
done

echo "selftest: X — ไฟล์ binary ถูกตัดจาก **เนื้อไฟล์** ไม่ใช่จากนามสกุล"
sc_green
expect "binary ไม่ถูกสแกน" 0 "check-card-paths: OK" "api/cover.png:"

echo "selftest: Y — ช่วงบรรทัดต่อท้าย \`:12-20\` ไม่ใช่ส่วนหนึ่งของพาธ ⇒ เขียว"
sc_green
expect "normalize ช่วงบรรทัด" 0 "check-card-paths: OK" "api/src/real.rs:12-20"

echo "selftest: Z — URL ที่ขึ้นต้นด้วยสแลช (\`/api/…\`) ไม่ชนราก ⇒ เขียว"
sc_green
expect "URL ไม่ชนราก api/" 0 "check-card-paths: OK" "/api/ghost"
