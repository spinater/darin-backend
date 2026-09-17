#!/usr/bin/env bash
# ตารางความไวของ `scripts/tests/check-path-bytes-selftest.sh` (ใบ 314)
# ⚠️ `.` (source) เท่านั้น ด้วยเหตุผลเดียวกับ `cases-behaviour.sh`
#
# 🔑 **"exit เปลี่ยน" อย่างเดียวเป็นตัววัดที่หยาบเกินไป** — ถอดยามบางตัวออกแล้ว exit ยังเท่าเดิม
# เพราะแขนอื่นไปแดงแทนด้วยสาเหตุคนละเรื่องคนละทางแก้ ⇒ ตัววัดหลักคือ **ข้อความลายเซ็น**
# (ต้องมีก่อนถอด · ต้องหายหลังถอด — หรือกลับทิศสำหรับ *ยาม* ซึ่งถอดแล้วข้อความจะ *โผล่*)
# ส่วน exit ประกาศเพิ่มเฉพาะแถวที่อ้างว่าของที่ถอดเป็น *ตัวกำหนดคำตัดสิน* ไม่ใช่ *ตัวกำหนดถ้อยคำ*
#
# ⚠️ และทุกแถว **ปฏิเสธการให้คะแนนถ้า `sed` ไม่ได้แก้อะไรเลย** — แถวที่ `sed` ไม่แมตช์คือแถวที่
# วัดความว่างเปล่า ซึ่งคือโรคเดียวกับที่ทั้งใบนี้เปิดมาปิด

# $1=ชื่อแถว $2=นิพจน์ sed $3=ไฟล์เป้าหมาย (เทียบรากแซนด์บ็อกซ์) $4=ฟังก์ชันจัดฉาก
# $5=ข้อความลายเซ็น $6=(ไม่บังคับ) "invert" ถ้าเป็นยามที่ถอดแล้วข้อความจะโผล่
# $7=(ไม่บังคับ) exit ที่คาดหลังถอด
sens() {
  local name="$1" expr="$2" target="$3" scene="$4" sig="$5" mode="${6:-normal}" want_exit="${7:-}"
  local before after tgt rc_before rc_after
  "$scene"
  run_gate; rc_before=$?
  before="$GATE_OUT"
  tgt="$SANDBOX/$target"
  cp "$tgt" "$tgt.orig"
  sed_i "$expr" "$tgt"
  if cmp -s "$tgt" "$tgt.orig"; then
    echo "  FAIL: [ความไว] $name — sed ไม่ได้แก้อะไรเลย ⇒ แถวนี้วัดความว่างเปล่า (ปฏิเสธการให้คะแนน)"
    fail=$((fail + 1)); rm -f "$tgt.orig"; return
  fi
  pass=$((pass + 1)); echo "  ok: [ความไว] $name — sed แก้สำเนาได้จริง"
  run_gate; rc_after=$?
  after="$GATE_OUT"
  if [ "$mode" = "invert" ]; then
    if ! grep -qF -- "$sig" <<<"$before" && grep -qF -- "$sig" <<<"$after"; then
      echo "  ok: [ความไว] $name (ถอดยามแล้วข้อความ \"$sig\" โผล่มา)"; pass=$((pass + 1))
    else
      echo "  FAIL: [ความไว] $name — ถอดยามแล้วข้อความ \"$sig\" ไม่ได้โผล่ (ก่อน: มี=$(grep -qF -- "$sig" <<<"$before" && echo y || echo n))"
      fail=$((fail + 1))
    fi
  else
    if grep -qF -- "$sig" <<<"$before" && ! grep -qF -- "$sig" <<<"$after"; then
      echo "  ok: [ความไว] $name (ถอดแล้วข้อความ \"$sig\" หายไป)"; pass=$((pass + 1))
    else
      echo "  FAIL: [ความไว] $name — ข้อความ \"$sig\" ไม่ได้หายหลังถอด (ก่อน: มี=$(grep -qF -- "$sig" <<<"$before" && echo y || echo n) · หลัง: มี=$(grep -qF -- "$sig" <<<"$after" && echo y || echo n))"
      fail=$((fail + 1))
      printf '    --- after ---\n%s\n    -------------\n' "$after"
    fi
  fi
  if [ -n "$want_exit" ]; then
    if [ "$rc_after" -eq "$want_exit" ]; then
      echo "  ok: [ความไว] $name — exit หลังถอด = $want_exit ตามที่ประกาศ (ยามนี้กำหนด *คำตัดสิน* ไม่ใช่แค่ถ้อยคำ)"; pass=$((pass + 1))
    else
      echo "  FAIL: [ความไว] $name — exit หลังถอด = $rc_after คาด $want_exit (ก่อนถอด $rc_before)"; fail=$((fail + 1))
    fi
  fi
  rm -f "$tgt.orig"
}

scene_thai() {
  new_sandbox
  add_scene 'tools/ตัวกวาดไทย.sh' <<'EOF'
#!/usr/bin/env bash
while IFS= read -r f; do
  echo "$f"
done < <(git ls-files -c -o --exclude-standard)
EOF
}
scene_nested() {
  new_sandbox
  add_scene tools/nested.sh <<'EOF'
#!/usr/bin/env bash
while IFS= read -r -d '' f; do
  while IFS= read -r target; do
    echo "$target"
  done < <(grep -o x "$f" || true)
done < <(git ls-files -c -o --exclude-standard -z '*.md')
EOF
}
# 🔑 บรรทัด `for … done; do` ต้องอยู่ **ข้างในลูปอ่าน** — ถ้าวางไว้ข้างนอก สแตกจะเพี้ยนแล้วหาย
# กันเองก่อนถึง `done < <(…)` ⇒ ฉากเขียวทั้งสองทิศ = แถวความไววัดความว่างเปล่า (วัดแล้ว ไม่ใช่เดา)
# รูปนี้ลอกโครงมาจาก `check-links.sh` ของจริง ซึ่งเป็นที่ที่บั๊กนี้เกิดตอนเขียนใบ 314
scene_donedata() {
  new_sandbox
  add_scene tools/donedata.sh <<'EOF'
#!/usr/bin/env bash
while IFS= read -r -d '' f; do
  for d in todo todo-human done; do
    echo "$d"
  done
done < <(git ls-files -z)
EOF
}
scene_prose() {
  new_sandbox
  add_scene tools/prose.sh <<'EOF'
#!/usr/bin/env bash
n=3
echo "อ่านแล้ว \`git add\` เอง — อย่าลืม"
echo "อ่าน 80 ไฟล์ (git track ไว้ $n) เรียบร้อย"
EOF
}
scene_procsub() {
  new_sandbox
  add_scene tools/procsub.sh <<'EOF'
#!/usr/bin/env bash
while IFS= read -r -d '' f; do
  echo "$f"
done < <(git ls-files -z)
EOF
}
scene_heredoc() {
  new_sandbox
  add_scene tools/heredoc.sh <<'OUTER'
#!/usr/bin/env bash
cat > /tmp/x <<'INNER'
while IFS= read -r f; do echo "$f"; done < <(git ls-files)
INNER
echo done
OUTER
}
scene_writes() {
  new_sandbox
  add_scene tools/writes.sh <<'EOF'
#!/usr/bin/env bash
git add -A
git mv x y
git commit -qm msg
EOF
}
# 🔑 ฉากนี้ต้องเป็นรูปที่ **มีคนกิน stdout จริง** (`$( )`) ไม่งั้นแขน `!consumed` ตัดทิ้งไปก่อน
# แล้วแถว S9 จะวัด "ถอดของที่ไม่ได้ทำงานอยู่แล้ว" ซึ่งจริงโดยโครงสร้าง · รูปนี้ลอกมาจากของจริงที่
# `scripts/tests/check-links-selftest/cases-task-move.sh` — จุดเดียวในคลัง 108 จุดที่แขนนี้ตัดสิน
scene_quiet() {
  new_sandbox
  add_scene tools/quietly.sh <<'EOF'
#!/usr/bin/env bash
r="$(git diff --quiet && echo 1 || echo 0)"
echo "$r"
EOF
}
scene_waived_over() {
  new_sandbox
  add_scene tools/waived.sh <<'EOF'
#!/usr/bin/env bash
t="$(git log -1 --format=%ct -- "$1")"
u="$(git log -1 --format=%ct -- "$2")"
echo "$t$u"
EOF
  allow_rows "tools/waived.sh	log	1	# ใบ 314 · ฉากทดสอบ"
}
scene_dead_row() { new_sandbox; allow_rows "tools/ok.sh	log	1	# ใบ 314 · ฉากทดสอบ"; }
scene_norow()    { new_sandbox; allow_rows "tools/ok.sh	log	1	# ไม่ได้อ้างใบงาน"; }
scene_dup()      { new_sandbox; allow_rows "tools/ok.sh	log	1	# ใบ 314 · หนึ่ง" "tools/ok.sh	log	2	# ใบ 314 · สอง"; }
scene_glob()     {
  new_sandbox
  add_scene tools/globby.sh <<'EOF'
#!/usr/bin/env bash
t="$(git log -1 --format=%ct -- "$1")"
echo "$t"
EOF
  allow_rows "tools/*.sh	log	1	# ใบ 314 · แถวรูป glob"
}
scene_empty_corpus() {
  new_sandbox
  git -C "$SANDBOX" ls-files -z | (cd "$SANDBOX" && xargs -0 rm -f)
  git -C "$SANDBOX" add -A >/dev/null 2>&1
}

echo "selftest: ตารางความไว — ถอดทีละอย่างจากสำเนาในแซนด์บ็อกซ์"

# 🔑 **สองโหมด และการเลือกผิดโหมดคือการวัดที่ไม่มีความหมาย** — `normal` = ข้อความต้อง *มีก่อน
# หายหลัง* (ใช้กับสิ่งที่ *ผลิต* ข้อความ) · `invert` = *ไม่มีก่อน โผล่หลัง* (ใช้กับ **ยาม** ซึ่ง
# ถอดแล้วความผิดจะโผล่ออกมา) · แถวส่วนใหญ่ข้างล่างเป็น `invert` และผูกกับ **ข้อความของสาเหตุ
# ที่เจาะจง** ไม่ใช่กับคำว่า OK ลอย ๆ ซึ่งบอกแค่ว่า "มีอะไรสักอย่างแดง"

sens "S1 — \`-z\` + \`read -r -d ''\` ของคลังเชลล์ (ย้อนกลับไปสำนวนก่อนใบ 314 ทั้งคู่)" \
  "s/--exclude-standard -z/--exclude-standard/; s/read -r -d '' f/read -r f/" \
  "$CORPUS_REL" scene_thai "tools/ตัวกวาดไทย.sh" normal 0

sens "S2 — สแตกของลูป (ปิดแขนที่ pop เจ้าของออก)" \
  "s/else if (closes) {/else if (0) {/" \
  "$SCAN_REL" scene_nested "ตัวอ่านยังอ่านทีละบรรทัด" invert 1

sens "S3 — \`done\` ต้องอยู่ในตำแหน่งคำสั่ง" \
  's|^  closes = .*|  closes = (code ~ /done/)|' \
  "$SCAN_REL" scene_donedata "ตัวอ่านยังอ่านทีละบรรทัด" invert 1

# ⚠️ **เป้าของแถวนี้ย้ายไฟล์ที่ใบ 304** — `mask_and_strip()` ไม่ได้อยู่ใน `$SCAN_REL` อีกแล้ว
# มันอยู่บ้านเดียวที่ `$MASKLIB_REL` ซึ่ง `check-sort-locale.sh` ยืมตัวเดียวกัน · ตัวแถวยังวัด
# ของเดิมเป๊ะ (ถอดการเป่าเนื้อใน `"…"` ⇒ ร้อยแก้วไทยที่อ้างคำสั่ง git กลายเป็นจุดเรียกจริง)
# และการที่มัน **ยังแดงได้จากไฟล์ใหม่** คือหลักฐานว่าการย้ายเป็นการย้ายล้วน — เหตุผลเดียวกับ
# ที่ S6 ย้ายตามก้อน heredoc ไปตอนใบ 318 · แถวความไวที่ตามเป้าไม่ทัน = แถวที่เลิกเฝ้าไปแล้ว
sens "S4 — เป่าร้อยแก้วในเครื่องหมายคำพูดคู่ (คำตัดสินอยู่บ้านเดียวที่ \`$MASKLIB_REL\` ตั้งแต่ใบ 304)" \
  's|out = out "\\001"; continue|out = out c; continue|' \
  "$MASKLIB_REL" scene_prose "tools/prose.sh" invert 1

sens "S5 — แยก \$( ) ออกจาก < ( ) (NUL รอดใน fd จริง แต่ไม่รอดใน command substitution)" \
  's/if (incmd \&\& rest/if (insubst \&\& rest/' \
  "$SCAN_REL" scene_procsub "เชลล์กลืนไบต์ NUL ทิ้ง" invert 1

# ⚠️ **เป้าของแถวนี้ย้ายไฟล์ที่ใบ 318** — ก้อน heredoc ไม่ได้อยู่ใน `$SCAN_REL` อีกแล้ว มันอยู่
# บ้านเดียวที่ `$HDLIB_REL` ซึ่ง `check-shell-source.sh` ยืมตัวเดียวกัน · ตัวแถวยังวัดของเดิมเป๊ะ
# (ถอดแขน "อยู่ในเนื้อ heredoc" ⇒ เนื้อกลายเป็นโค้ด ⇒ `git ls-files` ในฉากถูกฟ้อง) และการที่มัน
# **ยังแดงได้จากไฟล์ใหม่** คือหลักฐานว่าการย้ายเป็นการย้ายล้วน ไม่ใช่การเขียนใหม่ที่บังเอิญรัน
# ⚠️ **backtick ในสตริง `"…"` คือ command substitution ไม่ใช่เครื่องหมายคำพูดของร้อยแก้ว**
# (เจอตอนใบ 304 เขียนแถว S4 เลียนแบบ S6): ชื่อแถวจะพยายาม **รันไฟล์ awk เป็นคำสั่ง** ได้
# `Permission denied` ลง stderr แล้วพิมพ์ชื่อออกมาว่าง ⇒ escape เป็น \` ทั้งสองแถว
sens "S6 — ข้ามเนื้อ heredoc (คำตัดสินอยู่บ้านเดียวที่ \`$HDLIB_REL\` ตั้งแต่ใบ 318)" \
  's/if (HD != "")/if (0)/' \
  "$HDLIB_REL" scene_heredoc "tools/heredoc.sh" invert 1

sens "S7 — ขั้น 'ไม่มีใครกิน stdout' (ขั้นที่ตัดทิ้งมากที่สุดโดยไม่ใช้ลิสต์)" \
  's/else if (!consumed) { v = "NOTCONSUMED" }/else if (0) { v = "NOTCONSUMED" }/' \
  "$SCAN_REL" scene_writes "tools/writes.sh" invert 1

sens "S8 — ขั้น 'โยน stdout ทิ้ง'" \
  's/if (todev || quiet) { v = "DISCARD" }/if (0) { v = "DISCARD" }/' \
  "$SCAN_REL" scene_quiet "tools/quietly.sh" invert 1

sens "S9 — ด่านเทียบจำนวนที่ปักไว้เป๊ะ" \
  's/if \[ "$got" -ne "$want" \]; then/if false; then/' \
  "$GATE_REL" scene_waived_over "มีคนเพิ่มจุดใหม่ในไฟล์ที่มีแถวอยู่แล้ว" normal 0

# ⚠️ S10–S14 **ไม่ประกาศ exit หลังถอด** และนั่นคือผลการวัด ไม่ใช่ความขี้เกียจ — ถอดยามเหล่านี้
# ออกแล้ว exit ยังเป็น 1 เพราะ **แขนข้าง ๆ ไปแดงแทนด้วยสาเหตุคนละเรื่องคนละทางแก้**
# (S10 → แขนเทียบจำนวน · S11 → แขนกันสุสาน · S13 → แขนกันสุสาน เพราะคีย์ที่นับกับคีย์ของแถว
# คนละตัว · S14 → ตัวนับที่สอง `sites = 0` ซึ่งเป็น **เจตนาของการมีสองตัวนับ** พอดี)
# ⇒ ตัววัดของแถวเหล่านี้คือ **ข้อความ** ล้วน ๆ ตามบทเรียนใบ 277
sens "S10 — ด่านกันสุสาน ทิศ 'ไม่มีจุดให้ยกเว้นแล้ว'" \
  's/if \[ "$got" -eq 0 \]; then/if false; then/' \
  "$GATE_REL" scene_dead_row "ที่ต้องยกเว้นในไฟล์นี้แล้ว" normal

sens "S11 — ด่าน \`ใบ NNN\`" \
  's/\*"ใบ "\[0-9\]\[0-9\]\[0-9\]\*) ;;/*) ;;/' \
  "$GATE_REL" scene_norow "แถวต้องอ้างใบงาน" normal

sens "S12 — ด่านแถวซ้ำ" \
  's/if \[ -n "${pin_count\[$key\]+x}" \]; then/if false; then/' \
  "$GATE_REL" scene_dup "แถวซ้ำ" normal

sens "S13 — เทียบแถวเป็นสตริงตรงตัว (ห้าม case)" \
  's|^waived() .*|waived() { local k; for k in ${pin_count[@]+"${!pin_count[@]}"}; do case "$1" in $k) return 0 ;; esac; done; return 1; }|' \
  "$GATE_REL" scene_glob "tools/globby.sh:2" normal

sens "S14 — ด่าน \`swept = 0\` (ตัวนับแรก)" \
  's/if \[ "$swept" -eq 0 \]; then/if false; then/' \
  "$GATE_REL" scene_empty_corpus "กวาดไฟล์เชลล์ไม่ได้เลยสักใบ" normal
