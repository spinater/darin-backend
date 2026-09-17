#!/usr/bin/env bash
# เคสพฤติกรรมของ `scripts/tests/check-shell-source-selftest.sh` (ใบ 315)
# ⚠️ `.` (source) เท่านั้น ห้าม `bash` — ไฟล์นี้ใช้ตัวช่วยกับตัวนับ `pass`/`fail` ของไฟล์เข้า
# ⚠️ ฉากทุกฉากเป็น **โค้ดเชลล์จริง** ที่ให้ด่านอ่านเอง ไม่ใช่ตารางที่ต้องมีคนคอยเติมให้ตรงกับด่าน

echo "selftest: A — ฉากสะอาด = เขียว พร้อมสองตัวเลข"
new_sandbox
expect "A1 — ฉากที่อ่าน rc ครบทุกจุด = เขียว" 0 "check-shell-source: OK"
check "A2 — พิมพ์จำนวนไฟล์เชลล์ที่กวาด (ฉากนี้ต้องเป็น 1 ใบพอดี)" \
  "$(grep -q 'กวาดเชลล์ 1 ใบ' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"
# 🔑 ตัวเลขที่สองนี้คือ **ที่เดียว** ที่ความตายของตัวคัด `.` จะโผล่ออกมา — ด่านนี้จงใจไม่มี
# ยาม `checked = 0` เพราะโลกที่ทุกไฟล์มี `set -e` เป็นโลกที่ถูกกฎหมาย (ต่างจาก `sites = 0`
# ของ `check-path-bytes.sh` ซึ่งเป็นไปไม่ได้) ⇒ เราปักเป็น **ตัวเลข** แทนที่จะขอให้มันแดง
check "A3 — พิมพ์จำนวนจุด \`.\` ที่ตรวจ (ฉากนี้ต้องเป็น 2 จุดพอดี)" \
  "$(grep -q 'คุ้ม 2 จุด' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"

echo "selftest: B — \`.\` ที่ไม่มีใครอ่าน rc ในสคริปต์ที่ไม่มี set -e = แดงเรียกชื่อ"
new_sandbox
add_scene tools/bad.sh <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. scripts/lib/x.sh
echo hi
EOF
expect "B1 — แดงพร้อม **ชื่อไฟล์และเลขบรรทัด**" 1 "tools/bad.sh:3"
check "B2 — พิมพ์บรรทัดที่ผิดซ้ำให้เห็นกับตา" \
  "$(grep -q '^      \. scripts/lib/x\.sh$' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"
check "B3 — บอกทางแก้ที่พิมพ์ได้จริง (เกตที่แดงแล้วไม่มีทางออก = เกตที่คนเดินข้าม)" \
  "$(grep -q 'แก้: ' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"
check "B4 — บรรทัดสรุปนับจำนวนจุดที่ผิด" \
  "$(grep -q 'check-shell-source: FAIL — 1 จุด' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"

echo "selftest: C — สคริปต์ที่มี set -e = เขียว (ตัวกรองที่ทำให้ด่านไม่ท่วม)"
new_sandbox
add_scene tools/sete.sh <<'EOF'
#!/usr/bin/env bash
set -e
. scripts/lib/x.sh
echo hi
EOF
add_scene tools/seteuo.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
. scripts/lib/x.sh
echo hi
EOF
expect "C1 — \`set -e\` และ \`set -euo pipefail\` ปลอดภัยอยู่แล้ว ⇒ ไม่ถูกฟ้อง" 0 "check-shell-source: OK" "tools/sete"
check "C2 — และไฟล์พวกนั้น **ยังถูกนับว่ากวาดแล้ว** (ตัวกรองอยู่หลังตัวนับ ไม่ใช่ก่อน)" \
  "$(grep -q 'กวาดเชลล์ 3 ใบ' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"
check "C3 — แต่ **ไม่ถูกนับเป็นจุดตรวจ** (ยังคุ้ม 2 จุดของฉากพื้นฐานเท่าเดิม)" \
  "$(grep -q 'คุ้ม 2 จุด' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"

echo "selftest: D — สามรูปที่อ่าน rc + รูปที่อ่านช้าไปหนึ่งบรรทัด"
new_sandbox
add_scene tools/forms.sh <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. scripts/lib/a.sh || exit 1
. scripts/lib/b.sh
rc=$?
if ! . scripts/lib/c.sh; then exit 1; fi
echo ok
EOF
expect "D1/D2/D3 — ทั้งสามรูปเขียว" 0 "check-shell-source: OK" "tools/forms.sh"
# 🔴 **หลักฐานว่า D3 เขียวด้วยเหตุผลอะไร** — ฉากนี้มีจุด `.` สามจุดในไฟล์เดียว แต่เกตนับได้
# 2 (รวมฉากพื้นฐานเป็น 4) ⇒ บรรทัด `if ! . …` **ไม่เคยถูกหยิบมาตรวจเลย**: มันเขียวเพราะ
# *ไม่ถูกมองเห็น* ไม่ใช่เพราะแขน `*'if ! '*` รับไว้ · เคสนี้จะแดงทันทีที่มีคนไปขยายตัวคัด
# โดยไม่มาแก้คำอธิบาย ซึ่งคือสิ่งที่ควรเกิด (ดูคอมเมนต์ในตัวเกตที่จุดนั้น)
check "D3 — และ \`if ! . …\` **ไม่ถูกนับ** (4 จุด ไม่ใช่ 5) ⇒ เขียวเพราะไม่ถูกมองเห็น" \
  "$(grep -q 'คุ้ม 4 จุด' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"
new_sandbox
add_scene tools/far.sh <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. scripts/lib/a.sh

rc=$?
EOF
expect "D4 — \`rc=\$?\` ที่ห่างไปหนึ่งบรรทัด = แดง (กติกาคือ *บรรทัดถัดไป*)" 1 "tools/far.sh:3"

echo "selftest: E — นอกขอบเขต: ไฟล์นอกรีโป (\$HOME · พาธสัมบูรณ์) ทั้งย่อหน้าและคอลัมน์ 0"
new_sandbox
add_scene tools/scope.sh <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. /etc/profile
  . /etc/profile
. "$HOME/.bashrc"
. $HOME/.bashrc
  . "$HOME/.bashrc"
echo ok
EOF
expect "E1 — ห้าจุดนี้ไม่ใช่เรื่องของเกตนี้ ⇒ เขียว" 0 "check-shell-source: OK" "tools/scope.sh"
# ⚠️ เคสนี้คือบั๊กที่ **การเขียน selftest เป็นคนหาเจอ ไม่ใช่การอ่านโค้ด**: ตัวกรองเดิมเขียน
# `*' . /'*` ซึ่งบังคับให้มีช่องว่างนำหน้าจุด ⇒ บรรทัดที่ 3 (คอลัมน์ 0) ถูกฟ้องเป็นแดงปลอม
# ที่แก้ตามคำแนะนำของเกตไม่ได้เลย · ตัวเลขข้างล่างคือหลักฐานว่าทั้งห้าจุด **ไม่ถูกนับ** ด้วย
check "E2 — และไม่ถูกนับเป็นจุดตรวจสักจุด (ยัง 2 จุดของฉากพื้นฐาน)" \
  "$(grep -q 'คุ้ม 2 จุด' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"

echo "selftest: F — ไฟล์เชลล์ชื่อภาษาไทยที่ผิดกติกา ต้องถูกเรียกชื่อ"
new_sandbox
add_scene 'tools/ตัวช่วยไทย.sh' <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. scripts/lib/x.sh
EOF
expect "F — เรียกชื่อไฟล์ภาษาไทยออกมาตรง ๆ (ของที่ \`-z\` ของใบ 314 ซื้อมา)" 1 "tools/ตัวช่วยไทย.sh:3"

echo "selftest: G — กติกาของคลัง: shebang · ไม่ใช่เชลล์ · ไบนารีอ่านจากไบต์"
new_sandbox
add_scene tools/hook <<'EOF'
#!/bin/sh
. scripts/lib/x.sh
EOF
expect "G1 — ไม่มีนามสกุลแต่ shebang มีคำว่า sh = อยู่ในคลัง ⇒ ถูกฟ้อง" 1 "tools/hook:2"
new_sandbox
add_scene tools/notes.txt <<'EOF'
. scripts/lib/x.sh
EOF
expect "G2 — ไม่ใช่เชลล์ (ไม่มีทั้งนามสกุลและ shebang) = นอกคลัง ⇒ เขียว" 0 "กวาดเชลล์ 1 ใบ" "tools/notes.txt"
new_sandbox
# ⚠️ ไฟล์นี้ **ห้ามมีบรรทัด `.`** โดยตั้งใจ — หลักฐานของกติกานี้คือ *ตัวนับ* ไม่ใช่ข้อความฟ้อง
# (และแถวความไว S2 ต้องถอดยามไบต์ออกแล้วยังอ่านผลได้ ซึ่งทำไม่ได้ถ้า `grep` ไปเจอไบนารีที่แมตช์:
# GNU grep จะพิมพ์ `Binary file … matches` แทนเลขบรรทัด แล้วเกตไปตายที่ `$((lineno + 1))`)
{ printf '#!/usr/bin/env bash\nset -uo pipefail\necho '; printf '\000'; printf '\n'; } > "$SANDBOX/tools/bin.sh"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "G3 — \`.sh\` ที่ไบต์เป็นไบนารี = นอกคลัง **ตัดสินจากไบต์ ไม่ใช่นามสกุล**" 0 "กวาดเชลล์ 1 ใบ" "tools/bin.sh"

echo "selftest: H — คลังว่าง = FAIL ที่ swept ไม่ใช่ 'ไม่มีอะไรผิด' (บทเรียนใบ 193)"
new_sandbox
git -C "$SANDBOX" ls-files -z | (cd "$SANDBOX" && xargs -0 rm -f)
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "H — กวาดได้ 0 ใบ = แดงด้วยข้อความของตัวเอง" 1 "กวาดไฟล์เชลล์ไม่ได้เลยสักใบ"

echo "selftest: I — หลายจุดผิดพร้อมกัน นับครบทุกจุด"
new_sandbox
add_scene tools/three.sh <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. scripts/lib/a.sh
. scripts/lib/b.sh
. scripts/lib/c.sh
echo ok
EOF
expect "I1 — บรรทัดสรุปนับ 3 จุด (ไม่ใช่ 'มีอะไรสักอย่างผิด')" 1 "check-shell-source: FAIL — 3 จุด"
check "I2 — และ \`checked\` รวมเป็น 5 จุด (2 ของฉากพื้นฐาน + 3)" \
  "$(grep -q 'ตรวจ `.` 5 จุด' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"
check "I3 — เรียกชื่อทุกบรรทัดที่ผิด ไม่ใช่บรรทัดแรกบรรทัดเดียว" \
  "$(grep -q 'tools/three.sh:3' <<<"$GATE_OUT" && grep -q 'tools/three.sh:4' <<<"$GATE_OUT" \
     && grep -q 'tools/three.sh:5' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"

echo "selftest: J — ขอบเขตของคลังตาม git: .gitignore ออก · ยังไม่ add ยังอยู่"
new_sandbox
add_scene .gitignore <<'EOF'
vendor/
EOF
add_scene vendor/v.sh <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. scripts/lib/x.sh
EOF
expect "J1 — ของที่ .gitignore กินอยู่ = นอกขอบเขตสองทิศ" 0 "check-shell-source: OK" "vendor/v.sh"
new_sandbox
add_untracked tools/fresh.sh <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. scripts/lib/x.sh
EOF
expect "J2 — ไฟล์ใหม่ที่ยังไม่ \`git add\` = **ยังนับ** (\`-o\` ของคลัง)" 1 "tools/fresh.sh:3"

# ── ใบ 318: `set -e` / `.` ที่เป็น **ข้อมูลในเนื้อ heredoc** ───────────────────────────────
# ⚠️ ฉากสามใบนี้เป็น heredoc **ซ้อน** heredoc โดยตั้งใจ — ป้ายชั้นนอกชื่อ `OUTER` ชั้นในชื่อ
# `INNER` เพื่อให้ตัวปิดของสองชั้นไม่มีทางชนกัน · และตัวไฟล์เคสใบนี้เองก็ถูกด่านกวาดอยู่
# (ตั้งแต่ใบ 318 มันไม่ถูกข้ามอีกแล้ว เพราะ `set -e` ของมันอยู่ในเนื้อ heredoc) ⇒ ทุกบรรทัด
# ข้างล่างนี้ต้องเป็น *ข้อมูล* ในสายตาด่าน ซึ่งคือสิ่งที่เคส L พิสูจน์ให้ทั้งไฟล์พร้อมกัน

echo "selftest: K — \`set -e\` ที่อยู่ในเนื้อ heredoc ต้องไม่ปิดตาด่านทั้งไฟล์"
new_sandbox
add_scene tools/hd-sete.sh <<'OUTER'
#!/usr/bin/env bash
set -uo pipefail
cat > /dev/null <<'INNER'
#!/usr/bin/env bash
set -e
. scripts/lib/inner.sh
INNER
. scripts/lib/real.sh
echo ok
OUTER
# 🔴 ก่อนใบ 318 เคสนี้ **เขียว** — `set -e` ที่บรรทัด 5 (ซึ่งเป็นข้อมูล) ทำให้ด่านข้ามไฟล์ทั้งใบ
# ⇒ บรรทัด 8 ที่ผิดจริงไม่มีใครเห็น · วัดบนทรีจริงวันเปิดใบ: **3 ใน 55 ใบของคลัง** เป็นแบบนี้
# และใบแรกคือ `scripts/tests/check-path-bytes-selftest.sh` ซึ่งเป็น stage ของ `verify.sh` เอง
expect "K1 — ฟ้อง \`.\` จริงที่บรรทัด 8 และ **ไม่ฟ้องบรรทัด 6 ที่เป็นข้อมูล**" \
  1 "tools/hd-sete.sh:8" "tools/hd-sete.sh:6"
# 🔑 หลักฐานที่แข็งกว่า `deny` — `deny` บอกได้แค่ว่า *ข้อความ* ไม่โผล่ ส่วนตัวเลขนี้บอกว่า
# บรรทัด 6 **ไม่ถูกนับเป็นจุดตรวจตั้งแต่แรก** (2 ของฉากพื้นฐาน + 1 ของไฟล์นี้ ไม่ใช่ 2 + 2)
# ⚠️ บรรทัดสรุปของด่านมี **สองสำนวน** — ขา OK เขียน `คุ้ม N จุด` ขา FAIL เขียน \`ตรวจ \\\`.\\\` N จุด\`
# ⇒ เคสที่คาดว่าแดงต้องใช้สำนวนของขา FAIL (เคส I2 ทำแบบเดียวกัน) · ใช้ผิดสำนวนแล้วเคสจะแดง
# ด้วยเหตุที่ไม่ใช่ความผิดของด่าน ซึ่งเกิดจริงตอนเขียนเคสนี้รอบแรก
check "K2 — และ \`checked\` เป็น 3 จุด ไม่ใช่ 4 (บรรทัดในเนื้อ heredoc ไม่ถูกนับ)" \
  "$(grep -q 'ตรวจ `.` 3 จุด' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"
check "K3 — บรรทัดสรุปนับ 1 จุดที่ผิด (ไม่ใช่ 2)" \
  "$(grep -q 'check-shell-source: FAIL — 1 จุด' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"

echo "selftest: L — \`.\` ที่อยู่ในเนื้อ heredoc เท่านั้น = เขียว และตัวนับไม่ขยับ"
new_sandbox
add_scene tools/hd-dot.sh <<'OUTER'
#!/usr/bin/env bash
set -uo pipefail
cat > /dev/null <<'INNER'
. scripts/lib/inner.sh
. scripts/lib/other.sh
INNER
echo ok
OUTER
# 🔴 ทิศนี้คือ **แดงปลอม** และมันแพงกว่าที่เห็น — ผู้ถูกฟ้องทำตามคำแนะนำของเกตไม่ได้เลย
# (บรรทัดนั้นเป็นข้อมูลของฉากทดสอบ ไม่ใช่คำสั่ง) ⇒ ทางออกเดียวคือเลิกเขียนฉากแบบนั้น
# ซึ่งแปลว่าเกตกำลังสั่งให้เทสอ่อนลง · ก่อนใบ 318 กันไว้ด้วย **คอมเมนต์** เท่านั้น
expect "L1 — ไม่ถูกฟ้องสักบรรทัด" 0 "check-shell-source: OK" "tools/hd-dot.sh"
check "L2 — และ \`checked\` ยัง 2 จุดของฉากพื้นฐาน (สองบรรทัดนั้นไม่ถูกนับ)" \
  "$(grep -q 'คุ้ม 2 จุด' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"
check "L3 — แต่ไฟล์ **ยังถูกนับว่ากวาดแล้ว** (2 ใบ) — เงียบไม่เท่ากับนอกคลัง" \
  "$(grep -q 'กวาดเชลล์ 2 ใบ' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"

echo "selftest: M — บรรทัดปิด heredoc ต้องถูกรู้จัก ไม่งั้นไฟล์ที่เหลือมืดทั้งใบแบบเงียบ ๆ"
new_sandbox
add_scene tools/hd-close.sh <<'OUTER'
#!/usr/bin/env bash
set -uo pipefail
cat > /dev/null <<'INNER'
ข้อมูลล้วน ไม่ใช่คำสั่ง
INNER
. scripts/lib/after.sh
echo ok
OUTER
# 🔴 **นี่คือโรคที่ใบ 318 เปิดมาปิด แค่มาทางประตูใหม่** — ถ้าตัวปิดไม่ถูกรู้จัก ทุกบรรทัดหลัง
# บรรทัดที่ 3 กลายเป็นข้อมูลตลอดกาล ⇒ ด่านเขียวเพราะ *มองไม่เห็น* ไม่ใช่เพราะไม่มีอะไรผิด
# ⇒ การแก้ของใบนี้ต้องมีเคสฝั่งนี้ด้วย ไม่งั้นมันแค่ย้ายความเงียบจากที่หนึ่งไปอีกที่หนึ่ง
expect "M — โค้ดที่อยู่ *หลัง* ป้ายปิดกลับมาเป็นโค้ด ⇒ บรรทัด 6 ถูกฟ้อง" 1 "tools/hd-close.sh:6"

echo "selftest: N — ตัวแยกคำหาย = แดงด้วยข้อความของตัวเอง"
new_sandbox
rm -f "$SANDBOX/$HDLIB_REL"
# ⚠️ ไม่มียามนี้ awk จะบ่น \`calling undefined function\` ลง stderr ทีละไฟล์ แล้ว **ด่านอาจ
# เดินต่อจนจบ** — ซึ่งคือรูปร่างของโรคที่ทั้งด่านนี้เกิดมาปิด มาเกิดกับตัวด่านเอง
expect "N1 — ไฟล์ตัวแยกคำหาย = ด่านบอกเองว่าตรวจอะไรไม่ได้" 1 "ไม่มีตัวแยกคำ"
expect "N2 — และไม่แอบอ้างว่าเขียว" 1 "รอบนี้ตรวจอะไรไม่ได้เลย" "check-shell-source: OK"

echo "selftest: O — opener ผีในคอมเมนต์/สตริง = ไฟล์มืดทั้งใบ ⇒ ต้องดัง ไม่ใช่เขียวเงียบ"
new_sandbox
add_scene tools/phantom.sh <<'OUTER'
#!/usr/bin/env bash
echo "วิธีเขียนคือ cat <<EOF"
. scripts/lib/x.sh
echo done
OUTER
# 🔴 **นี่คือโรคของใบ 318 มาทางประตูใหม่ และรีวิวเป็นคนวัดเจอ ไม่ใช่การอ่านโค้ด** — ตัวรู้จัก
# heredoc ตัดสินจาก *รูปบรรทัด* ⇒ บรรทัดที่ 2 ซึ่งเป็นสตริงล้วนเปิด heredoc ชื่อ `EOF` ที่ไม่มี
# วันปิด ⇒ บรรทัดที่ 3 ที่ผิดจริงกลายเป็นข้อมูล · **ก่อนใบ 318 ด่านฟ้องบรรทัดนี้ได้** (มันอ่าน
# ไฟล์ดิบ) ⇒ ถ้าไม่มียามตัวนี้ ใบ 318 จะเป็นการ *ย้าย* ความเงียบ ไม่ใช่การปิด
expect "O1 — ฟ้องว่า **อ่านไฟล์นี้ไม่ออก** พร้อมบรรทัดที่เปิดค้าง (2) และชื่อป้าย" \
  1 "tools/phantom.sh:2 — heredoc ที่เปิดไว้ไม่มีบรรทัดปิดจนจบไฟล์ · ป้าย: EOF"
check "O2 — เป็นคนละสาเหตุกับ \`.\` ที่ไม่อ่าน rc ⇒ คนละช่องบนบรรทัดสรุป (0 จุด · มืด 1 ใบ)" \
  "$(grep -q 'FAIL — 0 จุด · อ่านไฟล์ไม่ออก 1 ใบ' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"
check "O3 — บอกทางแก้ที่พิมพ์ได้จริง (เกตที่แดงแล้วไม่มีทางออก = เกตที่คนเดินข้าม)" \
  "$(grep -q 'อย่าให้มันลงท้ายด้วย' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"

echo "selftest: P — บรรทัดที่อ่าน rc **และ** เปิด heredoc ในบรรทัดเดียวกัน = เขียว"
new_sandbox
add_scene tools/rcopener.sh <<'OUTER'
#!/usr/bin/env bash
set -uo pipefail
. scripts/lib/a.sh
rc=$?; cat > /dev/null <<'INNER'
body
INNER
echo ok
OUTER
# 🔴 **แดงปลอมที่รอบแรกของใบ 318 ทำขึ้นมาเอง และคอมเมนต์ในตัวเกตก็อ้างว่าฉากแบบนี้ไม่มีอยู่** —
# `$view` เป่า *บรรทัดเปิด* heredoc ทิ้งด้วย (พฤติกรรมของใบ 314 ที่ `heredoc.awk` ประกาศไว้เอง)
# ⇒ ถ้าอ่านบรรทัดถัดไปจาก `$view` จะไม่เจอ `$?` ⇒ ฟ้องบรรทัด 3 ทั้งที่มันอ่าน rc อยู่ ·
# ผู้ถูกฟ้องทำตามคำแนะนำของเกตไม่ได้เลยนอกจากย้าย heredoc ออกไป · แถว S16 เฝ้าไว้
expect "P — อ่านบรรทัดถัดไปจาก **ไฟล์ดิบ** ⇒ เห็น \`rc=\$?\` ⇒ ไม่ถูกฟ้อง" \
  0 "check-shell-source: OK" "tools/rcopener.sh"
