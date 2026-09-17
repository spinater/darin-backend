#!/usr/bin/env bash
# เคสพฤติกรรมของ `scripts/tests/check-sort-locale-selftest.sh` (ใบ 304)
# ⚠️ ไฟล์นี้ถูก `.` (source) เข้าไปในตัว selftest — ห้าม `bash` เพราะตัวนับ (`pass`/`fail`)
# กับฟังก์ชันจัดฉากอยู่ที่นั่นใบเดียว
#
# 🔴 **backtick ในชื่อเคส (สตริง `"…"`) คือ command substitution ไม่ใช่เครื่องหมายอ้างคำ** —
# เจอตอนเขียนใบนี้ **ด้วยการวัด ไม่ใช่ด้วยการอ่านโค้ด**: ชื่อเคสที่เขียน `` `sort` `` ทำให้
# selftest ไป **รันคำสั่ง `sort` จริง ๆ ซึ่งนั่งรอ stdin ค้างทั้งรอบ** และชื่อที่เขียน
# `` `git add` `` ก็ไป **รัน `git add` ที่รากรีโปจริง** (รอดเพราะมันไม่มี pathspec)
# ⇒ ทุกชื่อในไฟล์นี้ใช้ \` เสมอ · ฝั่งข้อความที่ส่งให้ `grep -qF` ใช้สตริงเดี่ยวอยู่แล้วจึงปลอดภัย

# ตัวช่วยอ่านผลรอบล่าสุดซ้ำ โดยไม่ต้องรันเกตใหม่
has() { grep -qF -- "$1" <<<"$GATE_OUT" && echo 1 || echo 0; }

# ⚠️ **เข็มที่มี backtick ต้องอยู่ในตัวแปร ห้ามฝังใน `$( )`** — `mask_and_strip` (ยืมมาจากใบ 314)
# **ไม่ไล่ไวยากรณ์เครื่องหมายคำพูดเดี่ยวที่อยู่ข้างใน `$( )` ซึ่งอยู่ข้างใน `"…"` อีกที**
# ⇒ เข็มที่มี backtick ฝังอยู่ในนั้นถูกอ่านว่าเป็น **โค้ด** แล้ว backtick นำหน้าทำให้มันดูเหมือน
# จุดเรียกในตำแหน่งคำสั่ง = **แดงปลอม** · เจอจริงจากการรันเกตนี้ทับไฟล์ตัวเอง (ไม่ใช่จากการอ่านโค้ด)
# ⇒ ยกเข็มออกมาเป็นตัวแปรก่อน ซึ่งอ่านง่ายกว่าด้วย · เขตบอดนี้ประกาศไว้ที่หัว
# `scripts/lib/sort-locale-scan.awk` และในการ์ด ไม่ได้ซ่อน
SITES_1='`sort` 1 จุด'
# เข็มนี้ยกออกมาด้วยเหตุผลเดียวกัน — ฝังไว้ใน `$( )` แล้วมันถูกนับเป็น "อ้างชื่อนอกตำแหน่ง
# คำสั่ง" ซึ่งไม่ทำให้แดง แต่ทำให้ **ตัวดักตัวนั้นมีฐานเป็น 1 ด้วยเหตุผลปลอม** ⇒ วันที่เลขขยับจริง
# จะไม่มีใครดู · ฐานที่ถูกคือ 0
FIX_HINT='LC_ALL=C sort'

echo "selftest: เคสพฤติกรรม — ฉากจริงในแซนด์บ็อกซ์"

# ── A · ฉากสะอาด: เขียว **และพิมพ์ตัวเลขทั้งสองตัว**
# เลข "จุดเรียก 1 จุด" คือของที่เคสฝั่ง "ต้องไม่ฟ้อง" ทุกใบข้างล่างวัดจาก ⇒ ถ้าเคสนี้พัง
# เคสพวกนั้นจะวัดความว่างเปล่าทั้งแถบโดยยังเขียวอยู่
new_sandbox
expect "A · ฉากสะอาด = เขียว" 0 "ประกาศ locale ครบทุกจุด" "FAIL"
check "A · พิมพ์จำนวนไฟล์ที่กวาด" "$(has 'กวาดเชลล์ 1 ใบ')" "ไม่ได้พิมพ์จำนวนไฟล์"
check "A · พิมพ์จำนวนจุดเรียก" "$(has "$SITES_1")" "ไม่ได้พิมพ์จำนวนจุดเรียก"

# ── B · `sort` เปล่า ๆ = แดง **พร้อมชื่อไฟล์และเลขบรรทัด**
# เลขบรรทัดคือของที่ต้องปักไว้: ฟ้องถูกไฟล์แต่ผิดบรรทัดแย่กว่าไม่ฟ้อง เพราะคนจะไปแก้บรรทัดที่ไม่ผิด
new_sandbox
add_scene tools/bare.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
names="$(printf '%s\n' "$@" | sort -u)"
EOF
expect "B · \`sort\` เปล่า = แดงพร้อมไฟล์:บรรทัด" 1 "tools/bare.sh:3"
check "B · มีทางแก้ที่พิมพ์ตามได้" "$(has "$FIX_HINT")" "ไม่ได้บอกวิธีแก้"
check "B · อ้างผลวัดของ collation" "$(has 'foo_bar')" "ไม่ได้อ้างผลวัด"

# ── C · ไฟล์ **ชื่อไทย** ที่ผิดกติกาต้องถูกเรียกชื่อ
# นี่คือทิศที่ `-z` ของคลังกลางซื้อมา และเป็นทิศที่หายไปแบบ **เงียบ** ก่อนตัวนับใด ๆ จะขยับ
new_sandbox
add_scene 'tools/เรียงไทย.sh' <<'EOF'
#!/usr/bin/env bash
printf '%s\n' a b | sort -u
EOF
expect "C · ไฟล์ชื่อไทยยังถูกเรียกชื่อ" 1 'tools/เรียงไทย.sh:2'

# ── D · คำว่า `sort` ใน **คอมเมนต์** ไม่ใช่จุดเรียก
# รีโปนี้มีคอมเมนต์แบบนี้อยู่จริงหลายใบ (กติกาของใบ 249 เขียนไว้เอง) ⇒ นับเมื่อไรคือแดงปลอม
# ในร้อยแก้ว · **วัดที่ตัวเลข ไม่ใช่ที่สี**: จุดเรียกต้องยังเป็น 1 จุดเท่าเดิม
new_sandbox
add_scene tools/comment.sh <<'EOF'
#!/usr/bin/env bash
# ⚠️ ห้ามนับตัวเลขพวกนี้ด้วย sort | uniq -c — collation ของเครื่องนี้ตัดแถวขาด
echo ok   # แล้วค่อย sort -u ทีหลัง
EOF
expect "D · \`sort\` ในคอมเมนต์ไม่ถูกนับ" 0 '`sort` 1 จุด' "FAIL"

# ── E · `sort` ใน **เครื่องหมายคำพูดเดี่ยว** (โปรแกรม sed) ไม่ใช่จุดเรียก
# รูปนี้มาจากของจริง: แถวความไวของใบ 302 เขียน `s/LC_ALL=C sort/sort/g` ไว้เป็นข้อมูล
new_sandbox
add_scene tools/sedprog.sh <<'EOF'
#!/usr/bin/env bash
sed -i 's/LC_ALL=C sort -u/sort -u/g' x
sed -i 's/| sort |/| cat |/' y
EOF
expect "E · \`sort\` ในสตริงเดี่ยวไม่ถูกนับ" 0 '`sort` 1 จุด' "FAIL"

# ── F · `sort` ใน **ร้อยแก้วไทยในเครื่องหมายคำพูดคู่** ไม่ใช่จุดเรียก
new_sandbox
add_scene tools/prose.sh <<'EOF'
#!/usr/bin/env bash
echo "อย่าเขียน sort เปล่า ๆ — ใส่ LC_ALL=C ให้มันด้วย"
EOF
expect "F · \`sort\` ในร้อยแก้วไม่ถูกนับ" 0 '`sort` 1 จุด' "FAIL"

# ── G · `sort` ที่เป็น **ข้อมูลใน heredoc** ไม่ใช่จุดเรียก
# ของจริงในรีโป: `scripts/agents.sh` ฝังสคริปต์ python ที่มี `rows.sort()` อยู่ในก้อน heredoc
new_sandbox
add_scene tools/heredoc.sh <<'OUTER'
#!/usr/bin/env bash
python3 - <<'INNER'
rows = ["b", "a"]
rows.sort()
INNER
cat > /tmp/x <<'DOC'
printf '%s\n' a b | sort -u
DOC
echo done
OUTER
expect "G · \`sort\` ในเนื้อ heredoc ไม่ถูกนับ" 0 '`sort` 1 จุด' "FAIL"

# ── H · `sort` ที่เป็น **ชิ้นส่วนของคำอื่น** ไม่ใช่จุดเรียก (`is_word`)
new_sandbox
add_scene tools/word.sh <<'EOF'
#!/usr/bin/env bash
sorted=1
tools/sort --version
resort -u a b
echo "$sorted"
EOF
expect "H · คำที่ไม่ใช่ \`sort\` เดี่ยว ๆ ไม่ถูกนับ" 0 '`sort` 1 จุด' "FAIL"

# ── I · `LC_COLLATE=` ก็คือการประกาศ — `sort` ใช้มันเรียงจริง ๆ
new_sandbox
add_scene tools/collate.sh <<'EOF'
#!/usr/bin/env bash
printf '%s\n' a b | LC_COLLATE=C sort -u
EOF
expect "I · \`LC_COLLATE=C\` ผ่าน" 0 '`sort` 2 จุด' "FAIL"

# ── J · ประกาศเป็น **ค่าอื่นที่ไม่ใช่ C** ก็ผ่าน — ด่านนี้ถามว่า *ประกาศหรือยัง*
# จุดเดียวในคลังจริงที่ทำแบบนี้คือเทสที่ **วัดเรื่อง collation เอง** ⇒ กฎ "ต้องเป็น C เท่านั้น"
# จะแดงใส่การวัดที่ถูกต้อง
new_sandbox
add_scene tools/declared.sh <<'EOF'
#!/usr/bin/env bash
cand="en_US.UTF-8"
printf 'a/b\na-c\n' | LC_ALL="$cand" sort | head -1
EOF
expect "J · ประกาศเป็นค่าอื่นก็ผ่าน (ด่านถามว่าประกาศหรือยัง)" 0 '`sort` 2 จุด' "FAIL"

# ── K · คำนำหน้าที่ **ไม่ใช่ locale** ต้องไม่ยกเว้นให้
new_sandbox
add_scene tools/othervar.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
FOO=bar sort -u < x
EOF
expect "K · คำนำหน้าที่ไม่ใช่ locale ไม่ยกเว้นให้" 1 "tools/othervar.sh:3"

# ── L · คำนำหน้าหลายตัวต้องเดินข้ามให้ครบ
# หยุดที่ตัวแรก = อ่าน `FOO=1 LC_ALL=C sort` ว่าไม่ได้ประกาศ ⇒ แดงปลอมที่แก้ตามคำแนะนำไม่ได้
# · และถ้าแขน "ตัวแปรอื่น" หายไป จุดนี้จะกลายเป็น **นอกตำแหน่งคำสั่ง** เงียบ ๆ ⇒ ปักเลขนั้นด้วย
new_sandbox
add_scene tools/multi.sh <<'EOF'
#!/usr/bin/env bash
FOO=1 LC_ALL=C sort -u < x
EOF
expect "L · คำนำหน้าหลายตัว: ข้ามครบแล้วเห็นการประกาศ" 0 '`sort` 2 จุด' "FAIL"
check "L · ไม่ได้ถูกย้ายไปกองนอกตำแหน่งคำสั่งเงียบ ๆ" "$(has 'นอกตำแหน่งคำสั่ง 0 จุด')" \
  "จุดเรียกหลุดไปกอง NOTCMD"

# ── M · `sort` ในตำแหน่ง **อาร์กิวเมนต์** = นอกขอบเขต **แต่ต้องถูกนับให้เห็น**
# เติมคำนำหน้าให้มันไม่ได้ ⇒ ทำให้แดงคือแดงที่ไม่มีทางออกถูกต้อง · เขตบอดที่ไม่มีตัวเลข
# คือเขตบอดที่ไม่มีใครเห็น
new_sandbox
add_scene tools/asarg.sh <<'EOF'
#!/usr/bin/env bash
command -v sort >/dev/null || exit 1
EOF
expect "M · \`sort\` ในตำแหน่งอาร์กิวเมนต์ถูกนับแยก ไม่ทำให้แดง" 0 "นอกตำแหน่งคำสั่ง 1 จุด" "FAIL"
check "M · ไม่ถูกนับรวมเป็นจุดเรียก" "$(has "$SITES_1")" "ถูกนับรวมเป็นจุดเรียก"

# ── N · บรรทัดที่ต่อด้วย `\` ต้องรายงานที่ **บรรทัดกายภาพแรก**
new_sandbox
add_scene tools/cont.sh <<'EOF'
#!/usr/bin/env bash
printf '%s\n' a b \
  | sort -u
EOF
expect "N · ต่อบรรทัดด้วย \\ รายงานที่บรรทัดแรกของคำสั่ง" 1 "tools/cont.sh:2"

# ── O · ไฟล์ที่ `.gitignore` กิน = นอกขอบเขต · ไฟล์ที่ยังไม่ `git add` = **ในขอบเขต**
# สองทิศนี้มาจากคลังกลาง (`-c -o --exclude-standard`) ⇒ เทสไว้ที่นี่เพื่อให้รู้ทันทีถ้ามันเปลี่ยน
new_sandbox
printf 'tools/ignored.sh\n' > "$SANDBOX/.gitignore"
add_scene tools/ignored.sh <<'EOF'
#!/usr/bin/env bash
printf '%s\n' a b | sort -u
EOF
expect "O · ไฟล์ที่ถูก ignore อยู่นอกขอบเขต" 0 '`sort` 1 จุด' "FAIL"
new_sandbox
mkdir -p "$SANDBOX/tools"
cat > "$SANDBOX/tools/untracked.sh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' a b | sort -u
EOF
expect "O · ไฟล์ที่ยังไม่ \`git add\` ยังอยู่ในขอบเขต" 1 "tools/untracked.sh:2"

# ── P · คลังว่าง = FAIL ที่ `swept` — ไม่ใช่ "ไม่มีอะไรผิด" (บทเรียนของใบ 193)
new_sandbox
git -C "$SANDBOX" ls-files -z | (cd "$SANDBOX" && xargs -0 rm -f)
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "P · คลังว่าง = FAIL ที่ตัวนับไฟล์" 1 "กวาดไฟล์เชลล์ไม่ได้เลยสักใบ"

# ── Q · คลังมีไฟล์แต่ **ไม่มีจุดเรียกเลย** = FAIL ที่ `sites` — **คนละสาเหตุ คนละข้อความ**
# ยามตัวนี้พิสูจน์ **ตัวอ่าน** ไม่ใช่ตัวคัดไฟล์: ตั้งชื่อตัวแปรใน awk ชนคำสงวนครั้งเดียว ตัวอ่าน
# จะคาย 0 บรรทัดแล้วด่านเขียวตลอดกาล (เกิดจริงกับใบ 314) · ราคาที่ประกาศไว้: วันที่คำสั่ง `sort`
# หายจากรีโปจริง ๆ ทางออกคือลบเกตทิ้ง ไม่ใช่ปิดยามตัวนี้
new_sandbox
add_scene tools/ok.sh <<'EOF'
#!/usr/bin/env bash
echo hello
EOF
expect "Q · ไม่มีจุดเรียกเลย = FAIL ที่ตัวอ่าน" 1 "ตัวอ่าน" "กวาดไฟล์เชลล์ไม่ได้เลยสักใบ"

# ── R · ตัวอ่านหาย = FAIL **ด้วยคำพูดของเกตเอง** ไม่ใช่เสียงบ่นของ awk บน stderr
new_sandbox
rm -f "$SANDBOX/$MASKLIB_REL"
expect "R · ตัวอ่านหาย = FAIL ด้วยคำพูดของเกตเอง" 1 "ห้ามอ่านว่า 'ไม่มีอะไรผิด'"

# ── S · ตัวอ่าน **พังกลางคัน** = FAIL ด้วยคำพูดของเกตเอง — ไม่ใช่ OK แบบเงียบ ๆ
# 🔴 ยามตัวนี้ปิดรู **เขียวปลอม** ที่รอบแรกของใบ 304 เขียนไว้เองจริง ๆ: `done < <(awk …)`
# ทำให้สถานะออกของ awk **ไม่ถึงเชลล์แม่** ⇒ ตัวอ่านที่ตายกลางคันได้ผลเป็น "ไฟล์นี้ไม่มีจุดเรียก"
# แล้วด่านพิมพ์ OK exit 0 ทั้งที่ไม่ได้ตรวจไฟล์ใบนั้นเลย · ต่างจากเคส R ตรงที่ **ไฟล์ยังอยู่ครบ**
# (ยาม `-r` ข้างหน้าจึงไม่ทำงาน) — คนละสาเหตุ คนละยาม ⇒ ต้องมีเคสของตัวเอง
new_sandbox
printf 'function hd_skip(x) { return\n' > "$SANDBOX/$SCAN_REL"
expect "S · ตัวอ่านพังกลางคัน = FAIL ไม่ใช่เขียวเงียบ" 1 "ทำงานไม่สำเร็จ" "OK — กวาดเชลล์"
