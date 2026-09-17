#!/usr/bin/env bash
# เคสพฤติกรรมของ `scripts/tests/check-path-bytes-selftest.sh` (ใบ 314)
# ⚠️ `.` (source) เท่านั้น ห้าม `bash` — ไฟล์นี้ใช้ตัวช่วยกับตัวนับ `pass`/`fail` ของไฟล์เข้า
# ⚠️ ห้ามพิมพ์รายชื่อ subcommand ลงในไฟล์นี้เป็นความจริงของด่าน — ฉากเป็น *โค้ดเชลล์จริง*
#    ที่ให้ด่านอ่านเอง ไม่ใช่ตารางที่ต้องมีคนคอยเติมให้ตรงกับด่าน (§6 rule 1)

echo "selftest: A — ฉากสะอาด = เขียว พร้อมสองตัวนับ"
new_sandbox
expect "A1 — ฉากที่ถูกต้องทุกสำนวน = เขียว" 0 "check-path-bytes: OK"
check "A2 — พิมพ์จำนวนไฟล์เชลล์ที่กวาด" \
  "$(grep -qE 'กวาดเชลล์ [1-9][0-9]* ใบ' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"
check "A3 — พิมพ์จำนวนจุดเรียก git (ตัวนับที่สอง คนละตัวกับตัวแรก)" \
  "$(grep -qE 'จุดเรียก git [1-9][0-9]* จุด' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"
check "AB — พิมพ์ตัวดักไฟล์นอกเชลล์ทุกรอบ (ประกาศเขตบอดออกมา ไม่ใช่เงียบ)" \
  "$(grep -q 'ไฟล์นอกเชลล์ที่เอ่ยถึงการเรียก git' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"

echo "selftest: B — git ls-files ที่มีคนกิน stdout แต่ไม่มี -z = แดงเรียกชื่อ"
new_sandbox
add_scene tools/bad.sh <<'EOF'
#!/usr/bin/env bash
while IFS= read -r f; do
  echo "$f"
done < <(git ls-files -c -o --exclude-standard)
EOF
expect "B1 — แดงพร้อมชื่อไฟล์และเลขบรรทัด" 1 "tools/bad.sh:4"
check "B2 — ข้อความอธิบายว่า quote คือสาเหตุ" \
  "$(grep -q 'core.quotePath' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"

echo "selftest: C — ไฟล์เชลล์ชื่อภาษาไทยที่ผิดกติกา ต้องถูกเรียกชื่อ (ข้อ 4 ของใบ 314)"
new_sandbox
add_scene 'tools/ตัวกวาดไทย.sh' <<'EOF'
#!/usr/bin/env bash
while IFS= read -r f; do
  echo "$f"
done < <(git ls-files -c -o --exclude-standard)
EOF
expect "C — เรียกชื่อไฟล์ภาษาไทยออกมาตรง ๆ" 1 "tools/ตัวกวาดไทย.sh:4"

echo "selftest: D/E — ขั้น 'ใครกิน stdout' ตัดทิ้งโดยไม่ใช้รายชื่อ subcommand"
new_sandbox
add_scene tools/writes.sh <<'EOF'
#!/usr/bin/env bash
git add -A
git mv x y
git commit -qm msg
git config user.name t
git checkout -q -
EOF
expect "D — คำสั่งที่ไม่มีใครกิน stdout = เขียว (ไม่มีลิสต์ subcommand สักตัว)" 0 "check-path-bytes: OK"
new_sandbox
add_scene tools/quietly.sh <<'EOF'
#!/usr/bin/env bash
git ls-files -- "$1" >/dev/null 2>&1
git check-ignore -q -- "$1"
git diff --quiet -- "$1"
EOF
expect "E1 — โยน stdout ทิ้ง / -q = เขียว" 0 "check-path-bytes: OK"
new_sandbox
add_scene tools/stderronly.sh <<'EOF'
#!/usr/bin/env bash
out="$(git ls-files 2>/dev/null)"
echo "$out"
EOF
expect "E2 — 2>/dev/null ไม่ใช่การโยน stdout ทิ้ง ⇒ ยังต้องแดง" 1 "tools/stderronly.sh:2"

echo "selftest: F/G/H/I — `-z` ที่แก้ครึ่งเดียว vs ที่ถูกต้อง"
new_sandbox
add_scene tools/halfz.sh <<'EOF'
#!/usr/bin/env bash
while IFS= read -r f; do
  echo "$f"
done < <(git ls-files -z)
EOF
expect "F — มี -z แต่ตัวอ่านทีละบรรทัด = ZCONSUMER (คนละข้อความกับ NEEDZ)" 1 "ตัวอ่านยังอ่านทีละบรรทัด" "ไม่มี \`-z\`"
new_sandbox
add_scene tools/subst.sh <<'EOF'
#!/usr/bin/env bash
out="$(git ls-files -z)"
echo "$out"
EOF
expect "G — -z ใน \$( ) ที่ไม่มี tr = ZSUBST (เชลล์กลืน NUL)" 1 "เชลล์กลืนไบต์ NUL ทิ้ง"
new_sandbox
add_scene tools/substok.sh <<'EOF'
#!/usr/bin/env bash
out="$(git ls-files -z | tr '\0' '\n')"
echo "$out"
EOF
expect "H — -z ใน \$( ) ที่มี tr = เขียว" 0 "check-path-bytes: OK"
new_sandbox
add_scene tools/procsub.sh <<'EOF'
#!/usr/bin/env bash
while IFS= read -r -d '' f; do
  echo "$f"
done < <(git ls-files -z)
EOF
expect "I — < <( ) เป็น fd จริง NUL รอด ⇒ เขียว (ห้ามเหมารวมกับ \$( ))" 0 "check-path-bytes: OK"

echo "selftest: J/K — สแตกของลูป"
new_sandbox
add_scene tools/nested.sh <<'EOF'
#!/usr/bin/env bash
while IFS= read -r -d '' f; do
  while IFS= read -r target; do
    echo "$target"
  done < <(grep -o x "$f" || true)
done < <(git ls-files -c -o --exclude-standard -z '*.md')
EOF
expect "J — ตัวอ่านชั้นในต้องไม่ถูกนับเป็นเจ้าของของ done ชั้นนอก" 0 "check-path-bytes: OK"
new_sandbox
add_scene tools/donedata.sh <<'EOF'
#!/usr/bin/env bash
for d in todo todo-human done; do
  echo "$d"
done
while IFS= read -r -d '' f; do
  echo "$f"
done < <(git ls-files -z)
EOF
expect "K — คำว่า done ที่เป็นข้อมูลต้องไม่ปิดลูป" 0 "check-path-bytes: OK"

echo "selftest: L/M/N/O — ตัวแยกคำต้องไม่ฟ้องของที่ไม่ใช่คำสั่ง"
new_sandbox
add_scene tools/prose.sh <<'EOF'
#!/usr/bin/env bash
# ใช้ `git mv` เสมอ ไม่ใช่ก๊อปแล้วลบ
n=3
echo "อ่านแล้ว \`git add\` เอง — อย่าลืม"
echo "อ่าน 80 ไฟล์ (git track ไว้ $n) เรียบร้อย"
EOF
expect "L — ร้อยแก้วในคอมเมนต์และในสตริงต้องไม่ถูกฟ้อง" 0 "check-path-bytes: OK"
new_sandbox
add_scene tools/heredoc.sh <<'OUTER'
#!/usr/bin/env bash
cat > /tmp/x <<'INNER'
while IFS= read -r f; do echo "$f"; done < <(git ls-files)
INNER
echo done
OUTER
expect "M — เนื้อใน heredoc คือข้อมูล ไม่ใช่คำสั่ง" 0 "check-path-bytes: OK"
new_sandbox
add_scene tools/cont.sh <<'EOF'
#!/usr/bin/env bash
while IFS= read -r f; do
  echo "$f"
done < <(git grep --untracked -I --no-color -l -F "x" \
  -- ':!*.md' || true)
EOF
expect "N — คำสั่งที่ต่อบรรทัด รายงานที่บรรทัดกายภาพแรก" 1 "tools/cont.sh:4"
new_sandbox
add_scene tools/lookalike.sh <<'EOF'
#!/usr/bin/env bash
sbgit() { git -C /tmp "$@" >/dev/null 2>&1; }
sbgit ls-files
out="$(mygit ls-files)"
echo "$out"
EOF
expect "O — sbgit/mygit ไม่ใช่คำสั่ง git ⇒ ไม่ถูกอ่านเป็นจุดเรียก" 0 "check-path-bytes: OK"

echo "selftest: Y — คำสั่งที่เก็บไว้ในอาเรย์ = เขตบอดที่ต้องดัง"
new_sandbox
add_scene tools/arr.sh <<'EOF'
#!/usr/bin/env bash
g=(git -C /tmp -c user.name=t)
"${g[@]}" status --porcelain | head -1
EOF
expect "Y1 — อ่าน subcommand ไม่ออก = แดงด้วยข้อความของตัวเอง" 1 "อ่าน subcommand ไม่ออก"
allow_rows "tools/arr.sh	-	1	# ใบ 314 · ฉากทดสอบ"
expect "Y2 — และแถวคือทางออกตามกฎหมาย (แดงที่ไม่มีทางออก = เกตที่คนเดินข้าม)" 0 "check-path-bytes: OK"

echo "selftest: P/Q — แถวยกเว้น และจำนวนที่ปักไว้ต้องตรงเป๊ะ"
new_sandbox
add_scene tools/waived.sh <<'EOF'
#!/usr/bin/env bash
t="$(git log -1 --format=%ct -- "$1")"
echo "$t"
EOF
expect "P1 — ไม่มีแถว = แดง" 1 "tools/waived.sh:2"
allow_rows "tools/waived.sh	log	1	# ใบ 314 · ฉากทดสอบ · คายเวลา ไม่ใช่พาธ"
expect "P2 — มีแถวที่จำนวนตรง = เขียว" 0 "check-path-bytes: OK"
check "P3 — และพิมพ์เหตุผลของแถวออกมาทุกรอบ" \
  "$(grep -q 'คายเวลา ไม่ใช่พาธ' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"
allow_rows "tools/waived.sh	log	2	# ใบ 314 · ฉากทดสอบ"
expect "Q1 — ปักไว้มากกว่าของจริง = แดง บอกว่าจุดหายไป" 1 "เหลือจุด"
allow_rows "tools/waived.sh	log	1	# ใบ 314 · ฉากทดสอบ"
add_scene tools/waived.sh <<'EOF'
#!/usr/bin/env bash
t="$(git log -1 --format=%ct -- "$1")"
u="$(git log -1 --format=%ct -- "$2")"
echo "$t$u"
EOF
expect "Q2 — มีคนเพิ่มจุดใหม่ในไฟล์ที่มีแถวอยู่แล้ว = แดง คนละข้อความ" 1 "มีคนเพิ่มจุดใหม่ในไฟล์ที่มีแถวอยู่แล้ว"
check "Q3 — และบอกเลขที่ต้องเขียนแทน" \
  "$(grep -q 'แก้เลขในแถวเป็น 2' <<<"$GATE_OUT" && echo 1 || echo 0)" "output: $GATE_OUT"

echo "selftest: R/T/U/V — ไฟล์ข้อมูลห้ามเป็นสุสาน · ห้ามรูปแถวพัง"
new_sandbox
allow_rows "tools/ghost.sh	log	1	# ใบ 314 · ฉากทดสอบ"
expect "R — แถวที่ไฟล์หายไปแล้ว = แดง" 1 "ไม่มีไฟล์นี้แล้ว"
new_sandbox
allow_rows "tools/ok.sh	log	1	# ใบ 314 · ฉากทดสอบ"
expect "T — ไฟล์ยังอยู่แต่ไม่มีจุดให้ยกเว้นแล้ว = แดง คนละข้อความกับ R" 1 "ไม่มีจุด \`git log\` ที่ต้องยกเว้นในไฟล์นี้แล้ว" "ไม่มีไฟล์นี้แล้ว"
new_sandbox
allow_rows "tools/ok.sh	log	1	# ไม่ได้อ้างใบงาน"
expect "U — แถวที่ไม่อ้าง \`ใบ NNN\` = แดง" 1 "แถวต้องอ้างใบงาน"
new_sandbox
allow_rows "tools/ok.sh	log	1	# ใบ 314 · หนึ่ง" "tools/ok.sh	log	2	# ใบ 314 · สอง"
expect "V — แถวซ้ำ = แดง (แถวหนึ่งกลบอีกแถว)" 1 "แถวซ้ำ"

echo "selftest: W — ไฟล์ข้อมูลหาย vs อ่านได้ 0 แถว = คนละข้อความ"
new_sandbox
rm -f "$SANDBOX/$ALLOW_REL"
expect "W1 — ไม่มีไฟล์ข้อมูล = แดงด้วยข้อความของตัวเอง" 1 "ไม่มีไฟล์ข้อมูล"
new_sandbox
printf '# มีแต่คอมเมนต์\n' > "$SANDBOX/$ALLOW_REL"
expect "W2 — ไฟล์ข้อมูลที่มี 0 แถว = **เขียว** (หนี้เป็นศูนย์คือสภาพพักที่ถูกต้องของไฟล์นี้)" 0 "check-path-bytes: OK"
new_sandbox
printf '# หัว\ntools/ok.sh\tlog\n' > "$SANDBOX/$ALLOW_REL"
expect "W3 — แถวที่รูปผิด (ขาดช่องจำนวน) = แดงด้วยข้อความของตัวเอง" 1 "รูปแถวผิด"
new_sandbox
printf '# หัว\ntools/ok.sh\tlog\tสาม\t# ใบ 314\n' > "$SANDBOX/$ALLOW_REL"
expect "W4 — จำนวนที่ไม่ใช่ตัวเลข = แดงคนละข้อความกับ W3" 1 "จำนวนต้องเป็นเลขจำนวนเต็ม" "รูปแถวผิด"

echo "selftest: X — สองตัวนับ ไม่ใช่ตัวเดียว"
new_sandbox
git -C "$SANDBOX" ls-files -z | (cd "$SANDBOX" && xargs -0 rm -f)
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "X1 — คลังว่าง = แดงที่ swept (ไม่ใช่ 'ไม่มีอะไรผิด')" 1 "กวาดไฟล์เชลล์ไม่ได้เลยสักใบ"
new_sandbox
printf 'BEGIN { exit 0 }\n' > "$SANDBOX/$SCAN_REL"
expect "X2 — ตัวแยกคำคาย 0 จุด = แดงที่ sites (ตัวนับแรกยังเขียวอยู่)" 1 "ไม่เจอจุดเรียก git เลยสักจุด"
new_sandbox
# ⚠️ ตั้งแต่ใบ 318 ตัวสแกนต้องถูกโหลดคู่กับ `scripts/lib/heredoc.awk` เสมอ ⇒ ยามหน้าด่านโตขึ้น
# หนึ่งแขน · รีวิวใบ 318 ชี้ว่าแขนนั้น **ไม่มีเคสเลย** ขณะที่ฝาแฝดฝั่ง `check-shell-source` มี
# (เคส N) ⇒ ความไม่สมมาตรของ coverage ไม่ใช่รูที่เปิดอยู่ (ไม่มีไฟล์นี้ awk ตายทั้งรอบ แล้ว
# ยาม `sites = 0` รับไว้) แต่ **ยามที่ไม่มีเคสคือยามที่ความจำของคนเขียนเฝ้าอยู่คนเดียว**
rm -f "$SANDBOX/$HDLIB_REL"
expect "X3 — ตัวแยก heredoc หาย = แดงด้วยข้อความของยามหน้าด่าน ไม่ใช่ awk บ่นลง stderr" 1 "ไม่มีตัวอ่าน"

echo "selftest: Z — เทียบแถวเป็นสตริงตรงตัว ห้าม case (ใบ 190)"
new_sandbox
add_scene tools/globby.sh <<'EOF'
#!/usr/bin/env bash
t="$(git log -1 --format=%ct -- "$1")"
echo "$t"
EOF
allow_rows "tools/*.sh	log	1	# ใบ 314 · แถวรูป glob ต้องไม่ยกเว้นให้ใคร"
expect "Z — แถวที่มี \` * \` ต้องไม่ยกเว้นให้ tools/globby.sh" 1 "tools/globby.sh:2"

echo "selftest: AA — ไฟล์ข้อมูล **ของจริง** ต้องอ่านออกตามรูปที่ประกาศไว้"
# ⚠️ ไม่ได้บังคับว่าต้องมีแถว — 0 แถวคือสภาพพักที่ถูกต้อง (ดู W2) · ที่บังคับคือ **ถ้ามีแถว
# แถวนั้นต้องมีสี่ช่องจริง** ไม่งั้นด่านจะอ่านคีย์เพี้ยนแล้วยกเว้นให้ของที่ไม่ได้ตั้งใจยกเว้น
bad_rows=$(awk -F'\t' '!/^[[:space:]]*(#|$)/ && NF != 4 { n++ } END { print n + 0 }' "$ALLOW_REL")
real_rows=$(awk -F'\t' '!/^[[:space:]]*(#|$)/ { n++ } END { print n + 0 }' "$ALLOW_REL")
check "AA — $ALLOW_REL ของจริง $real_rows แถว · รูปผิด $bad_rows แถว" \
  "$([ "${bad_rows:-1}" -eq 0 ] && echo 1 || echo 0)" "มีแถวที่ไม่ครบสี่ช่อง"
