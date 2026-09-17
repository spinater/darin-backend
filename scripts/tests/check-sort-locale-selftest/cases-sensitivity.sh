#!/usr/bin/env bash
# ตารางความไวของ `scripts/tests/check-sort-locale-selftest.sh` (ใบ 304)
# ⚠️ `.` (source) เท่านั้น ด้วยเหตุผลเดียวกับ `cases-behaviour.sh`
#
# 🔑 **"exit เปลี่ยน" อย่างเดียวเป็นตัววัดที่หยาบเกินไป** — ถอดยามบางตัวออกแล้ว exit ยังเท่าเดิม
# เพราะแขนอื่นไปแดงแทนด้วยสาเหตุคนละเรื่องคนละทางแก้ ⇒ ตัววัดหลักคือ **ข้อความลายเซ็น**
# (ต้องมีก่อนถอด · ต้องหายหลังถอด — หรือกลับทิศสำหรับ *ยาม* ซึ่งถอดแล้วข้อความจะ *โผล่*)
# ส่วน exit ประกาศเพิ่มเฉพาะแถวที่อ้างว่าของที่ถอดเป็น *ตัวกำหนดคำตัดสิน* ไม่ใช่ *ตัวกำหนดถ้อยคำ*
#
# ⚠️ ทุกแถว **ปฏิเสธการให้คะแนนถ้า `sed` ไม่ได้แก้อะไรเลย** — แถวที่ `sed` ไม่แมตช์คือแถวที่วัด
# ความว่างเปล่า ซึ่งคือโรคเดียวกับที่ทั้งใบนี้เปิดมาปิด

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
      printf '    --- after ---\n%s\n    -------------\n' "$after"
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

# ── ฉากสำหรับตารางความไว — คนละชุดกับเคสพฤติกรรม เพราะแต่ละแถวต้องจับคู่กับฉากที่
# **ยามตัวนั้นทำงานจริง** · ยามที่จับคู่กับฉากที่มันไม่เคยทำงานคือยามที่วัดอะไรไม่ได้เลย
scene_thai() {
  new_sandbox
  add_scene 'tools/เรียงไทย.sh' <<'EOF'
#!/usr/bin/env bash
printf '%s\n' a b | sort -u
EOF
}
# 🔑 **ร้อยแก้วต้องอ้าง *ท่อ* ด้วย ไม่ใช่แค่คำว่า `sort`** — วัดแล้วแก้: รูป `echo "… sort …"`
# เฉย ๆ พอถอดยามออก จะได้คำตัดสิน `NOTCMD` (คำข้างหน้าเป็นร้อยแก้วไทย) ไม่ใช่ FAIL ⇒ แถวจะวัด
# ผิดตัว · รูปที่รีโปนี้เขียนจริงคือการอ้าง **ท่อ** (`… | sort -u`) ซึ่งพอถอดยามแล้วอ่านเป็น
# ตำแหน่งคำสั่งเต็มตัว = แดงปลอมของจริงที่ยามตัวนี้กันอยู่
scene_prose() {
  new_sandbox
  add_scene tools/prose.sh <<'EOF'
#!/usr/bin/env bash
echo "อย่าเขียน printf x | sort -u เปล่า ๆ — ใส่ LC_ALL=C ให้มันด้วย"
EOF
}
# เหตุผลเดียวกับ `scene_prose` — คอมเมนต์ต้องอ้างท่อ ไม่งั้นถอดยามแล้วได้ `NOTCMD` ไม่ใช่ FAIL
scene_comment() {
  new_sandbox
  add_scene tools/comment.sh <<'EOF'
#!/usr/bin/env bash
echo ok   # ห้ามนับด้วย cat x | sort -u
EOF
}
scene_heredoc() {
  new_sandbox
  add_scene tools/heredoc.sh <<'OUTER'
#!/usr/bin/env bash
cat > /tmp/x <<'DOC'
printf '%s\n' a b | sort -u
DOC
echo done
OUTER
}
# `is_word` มีสองครึ่ง (ตัวหน้า/ตัวหลัง) และ **ถอดคนละครึ่งให้ผลคนละแบบ** ⇒ สองฉาก สองแถว
# · `sorted=1` — ครึ่ง *ตัวหลัง* ถือไว้ · ถอดแล้วมันกลายเป็นจุดเรียกที่ต้นบรรทัด = FAIL
# · `tools/sort` — ครึ่ง *ตัวหน้า* ถือไว้ · ถอดแล้วมันกลายเป็น `NOTCMD` (คำข้างหน้าคือพาธ)
#   ⇒ ไม่แดง แต่ **ตัวเลขขยับ** ซึ่งเป็นลายเซ็นที่วัดได้จริงและตรงกับสิ่งที่เกิด
scene_word() {
  new_sandbox
  add_scene tools/word.sh <<'EOF'
#!/usr/bin/env bash
sorted=1
echo "$sorted"
EOF
}
scene_word_path() {
  new_sandbox
  add_scene tools/wordpath.sh <<'EOF'
#!/usr/bin/env bash
tools/sort --version
EOF
}
scene_asarg() {
  new_sandbox
  add_scene tools/asarg.sh <<'EOF'
#!/usr/bin/env bash
command -v sort >/dev/null || exit 1
EOF
}
scene_multi() {
  new_sandbox
  add_scene tools/multi.sh <<'EOF'
#!/usr/bin/env bash
FOO=1 LC_ALL=C sort -u < x
EOF
}
scene_empty_corpus() {
  new_sandbox
  git -C "$SANDBOX" ls-files -z | (cd "$SANDBOX" && xargs -0 rm -f)
  git -C "$SANDBOX" add -A >/dev/null 2>&1
}
scene_nosort() {
  new_sandbox
  add_scene tools/ok.sh <<'EOF'
#!/usr/bin/env bash
echo hello
EOF
}

echo "selftest: ตารางความไว — ถอดทีละอย่างจากสำเนาในแซนด์บ็อกซ์"

sens "S1 — \`-z\` + \`read -r -d ''\` ของคลังเชลล์ (ย้อนกลับไปสำนวนก่อนใบ 314 ทั้งคู่)" \
  "s/--exclude-standard -z/--exclude-standard/; s/read -r -d '' f/read -r f/" \
  "$CORPUS_REL" scene_thai 'tools/เรียงไทย.sh' normal 0

sens "S2 — แขนที่รู้จักคำนำหน้า \`LC_ALL=\`/\`LC_COLLATE=\`" \
  's|if (w ~ /\^(LC_ALL\|LC_COLLATE)=/) { saw = 1; continue }|if (0) { saw = 1; continue }|' \
  "$SCAN_REL" scene_multi "ที่ไม่ได้บอกว่าเรียงด้วย locale ไหน" invert 1

sens "S3 — แขนที่ข้ามคำนำหน้าตัวแปร **อื่น** (หยุดที่ตัวแรก = อ่านการประกาศไม่เจอ)" \
  's|if (w ~ /\^\[A-Za-z_\]\[A-Za-z0-9_\]\*=/) continue|if (0) continue|' \
  "$SCAN_REL" scene_multi "นอกตำแหน่งคำสั่ง 1 จุด" invert 0

sens "S4 — เป่าร้อยแก้วในเครื่องหมายคำพูดคู่ (บ้านเดียวที่ \`$MASKLIB_REL\`)" \
  's|out = out "\\001"; continue|out = out c; continue|' \
  "$MASKLIB_REL" scene_prose "tools/prose.sh" invert 1

sens "S5 — ตัดคอมเมนต์ท้ายบรรทัด (บ้านเดียวที่ \`$MASKLIB_REL\`)" \
  's|if (!indq \&\& c == "#"|if (0 \&\& c == "#"|' \
  "$MASKLIB_REL" scene_comment "tools/comment.sh" invert 1

sens "S6 — ข้ามเนื้อ heredoc (บ้านเดียวที่ \`$HDLIB_REL\` ตั้งแต่ใบ 318)" \
  's/if (HD != "")/if (0)/' \
  "$HDLIB_REL" scene_heredoc "tools/heredoc.sh" invert 1

sens "S7 — \`is_word\` ครึ่ง *ตัวหลัง* (\`sorted\` ต้องไม่ใช่คำว่า \`sort\`)" \
  's|if (after ~ /\[A-Za-z0-9_-\]/) return 0|if (0) return 0|' \
  "$MASKLIB_REL" scene_word "tools/word.sh" invert 1

sens "S8 — \`is_word\` ครึ่ง *ตัวหน้า* (\`tools/sort\` ต้องไม่ใช่คำว่า \`sort\`)" \
  's|if (before ~ /\[A-Za-z0-9_.\\/-\]/) return 0|if (0) return 0|' \
  "$MASKLIB_REL" scene_word_path "นอกตำแหน่งคำสั่ง 1 จุด" invert 0

sens "S9 — แขน NOTCMD (\`sort\` ที่เป็นอาร์กิวเมนต์ต้องไม่ถูกฟ้อง)" \
  's|verdict = "NOTCMD"|verdict = "BARE"|' \
  "$SCAN_REL" scene_asarg "tools/asarg.sh" invert 1

# ⚠️ **S10 ไม่ประกาศ exit หลังถอด และนั่นคือผลการวัด ไม่ใช่ความขี้เกียจ** (วัดรอบแรกแล้วแก้
# ตารางตามผล): คลังว่าง ⇒ `sites` เป็น 0 ไปด้วย ⇒ ถอดยาม `swept` ออกแล้ว **ยาม `sites` แดงแทน**
# ด้วยสาเหตุคนละเรื่องคนละทางแก้ ⇒ exit ยังเป็น 1 · ยามตัวนี้จึงกำหนด **ถ้อยคำ** (ชี้ว่าตัวคัด
# ไฟล์พัง ไม่ใช่ตัวอ่านพัง) ไม่ใช่คำตัดสิน — ซึ่งเป็นเหตุผลว่าทำไมตัววัดหลักต้องเป็นข้อความลายเซ็น
# · ทิศกลับกันของ S11 **ไม่สมมาตร**: ฉาก "มีไฟล์แต่ไม่มีจุดเรียก" มี `swept` = 1 ⇒ ยามอีกตัว
# ไม่ทำงาน ⇒ ถอดแล้ว exit ตกจาก 1 เป็น 0 จริง จึงปักเลขนั้นไว้ได้
sens "S10 — ยาม \`swept = 0\` (ตัวนับไฟล์ — กำหนด *ถ้อยคำ* ไม่ใช่คำตัดสิน ดูหมายเหตุข้างบน)" \
  's/if \[ "$swept" -eq 0 \]; then/if false; then/' \
  "$GATE_REL" scene_empty_corpus "กวาดไฟล์เชลล์ไม่ได้เลยสักใบ" normal

sens "S11 — ยาม \`sites = 0\` (ตัวอ่าน — **คนละตัวกับยามข้างบน**)" \
  's/if \[ "$sites" -eq 0 \]; then/if false; then/' \
  "$GATE_REL" scene_nosort "ตายอยู่ ไม่ใช่รีโปสะอาด" normal 0
