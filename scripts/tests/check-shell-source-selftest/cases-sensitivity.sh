#!/usr/bin/env bash
# ตารางความไวของ `scripts/tests/check-shell-source-selftest.sh` (ใบ 315)
# ⚠️ `.` (source) เท่านั้น ด้วยเหตุผลเดียวกับ `cases-behaviour.sh`
#
# 🔑 **"exit เปลี่ยน" อย่างเดียวเป็นตัววัดที่หยาบเกินไป** — ถอดยามบางตัวออกแล้ว exit ยังเท่าเดิม
# เพราะแขนอื่นไปแดงแทนด้วยสาเหตุคนละเรื่องคนละทางแก้ ⇒ ตัววัดหลักคือ **ข้อความลายเซ็น**
# (ต้องมีก่อนถอด · ต้องหายหลังถอด — หรือกลับทิศสำหรับ *ยาม* ซึ่งถอดแล้วข้อความจะ *โผล่*)
# ส่วน exit ประกาศเพิ่มเฉพาะแถวที่อ้างว่าของที่ถอดเป็น *ตัวกำหนดคำตัดสิน* ไม่ใช่ *ตัวกำหนดถ้อยคำ*
#
# ⚠️ และทุกแถว **ปฏิเสธการให้คะแนนถ้า `sed` ไม่ได้แก้อะไรเลย** — แถวที่ `sed` ไม่แมตช์คือแถวที่
# วัดความว่างเปล่า ซึ่งคือโรคเดียวกับที่ทั้งใบนี้เปิดมาปิด
#
# ⚠️ **สำเนาที่ถูกกลายพันธุ์ต้องอยู่ *ใน* แซนด์บ็อกซ์เสมอ** — ตัวเกตทำ `cd "$(dirname "$0")/.."`
# ด้วยตัวเอง ⇒ สำเนาที่จอดไว้นอกแซนด์บ็อกซ์จะวิ่งใส่ **ทรีจริง** (บทเรียนที่ใบ 277 จ่ายมาแล้ว)

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

scene_thai() {
  new_sandbox
  add_scene 'tools/ตัวช่วยไทย.sh' <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. scripts/lib/x.sh
EOF
}
# ⚠️ ไบนารีใบนี้ **ห้ามมีบรรทัด `.`** — ดูเหตุผลที่เคส G3 (GNU grep พิมพ์ `Binary file … matches`
# แทนเลขบรรทัด ⇒ หลังถอดยามไบต์ เกตจะไปตายที่ `$((lineno + 1))` แทนที่จะรายงานตัวเลขให้อ่าน)
scene_binary() {
  new_sandbox
  { printf '#!/usr/bin/env bash\nset -uo pipefail\necho '; printf '\000'; printf '\n'; } > "$SANDBOX/tools/bin.sh"
  git -C "$SANDBOX" add -A >/dev/null 2>&1
}
scene_shebang() {
  new_sandbox
  add_scene tools/hook <<'EOF'
#!/bin/sh
. scripts/lib/x.sh
EOF
}
scene_sete() {
  new_sandbox
  add_scene tools/sete.sh <<'EOF'
#!/usr/bin/env bash
set -e
. scripts/lib/x.sh
EOF
}
scene_home() {
  new_sandbox
  add_scene tools/homesrc.sh <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. "$HOME/.bashrc"
EOF
}
# 🔑 ฉากของบั๊กที่ใบนี้เจอเอง — บรรทัดที่ 3 อยู่ที่ **คอลัมน์ 0** บรรทัดที่ 4 **ย่อหน้า**
# ตัวกรองรูปเดิมยกเว้นให้เฉพาะแบบย่อหน้า ⇒ ถอดการตรึงที่ต้นคำสั่งออกเมื่อไร บรรทัดที่ 3 แดงทันที
scene_absolute() {
  new_sandbox
  add_scene tools/absolute.sh <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. /etc/profile
  . /etc/profile
EOF
}
scene_orform() {
  new_sandbox
  add_scene tools/orform.sh <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. scripts/lib/a.sh || exit 1
EOF
}
scene_rcform() {
  new_sandbox
  add_scene tools/rcform.sh <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
. scripts/lib/a.sh
rc=$?
[ "$rc" -eq 0 ] || exit 1
EOF
}
scene_empty_corpus() {
  new_sandbox
  git -C "$SANDBOX" ls-files -z | (cd "$SANDBOX" && xargs -0 rm -f)
  git -C "$SANDBOX" add -A >/dev/null 2>&1
}

echo "selftest: ตารางความไว — ถอดทีละอย่างจากสำเนาในแซนด์บ็อกซ์"

# 🔑 **สองโหมด และการเลือกผิดโหมดคือการวัดที่ไม่มีความหมาย** — `normal` = ข้อความต้อง *มีก่อน
# หายหลัง* (ใช้กับสิ่งที่ *ผลิต* ข้อความ) · `invert` = *ไม่มีก่อน โผล่หลัง* (ใช้กับ **ยาม** ซึ่ง
# ถอดแล้วความผิดจะโผล่ออกมา)

sens "S1 — \`-z\` + \`read -r -d ''\` ของคลัง (ย้อนกลับไปสำนวนก่อนใบ 314 ทั้งคู่)" \
  "s/--exclude-standard -z/--exclude-standard/; s/read -r -d '' f/read -r f/" \
  "$CORPUS_REL" scene_thai "tools/ตัวช่วยไทย.sh:3" normal 0

sens "S2 — ตัวตัดสิน **ไบนารีจากไบต์** ของคลัง (ถอดแล้ว \`.sh\` ที่เป็นไบนารีไหลเข้าคลัง)" \
  's@grep -Iq . "$f" 2>/dev/null || continue@:@' \
  "$CORPUS_REL" scene_binary "กวาดเชลล์ 1 ใบ" normal 0

sens "S3 — กติกา shebang ของคลัง (ไฟล์ไม่มีนามสกุลที่เป็นเชลล์จริง)" \
  's@head -1 "$f" 2>/dev/null | grep -qE .*continue@continue@' \
  "$CORPUS_REL" scene_shebang "tools/hook:2" normal 0

sens "S4 — ตัวกรอง \`set -e\` (ตัวที่ทำให้ด่านไม่ท่วม — ถอดแล้วต้องฟ้องไฟล์ที่ปลอดภัยอยู่แล้ว)" \
  's@^  if grep -qE @  if false \&\& grep -qE @' \
  "$GATE_REL" scene_sete "tools/sete.sh:3" invert 1

sens "S5 — ตัวกรอง 'ไฟล์นอกรีโป' (\`\$HOME\` · พาธสัมบูรณ์)" \
  's@is_repo_source "$line" || continue@true || continue@' \
  "$GATE_REL" scene_home "tools/homesrc.sh:3" invert 1

sens "S6 — การตรึงตัวกรองนั้นไว้ที่ **ต้นคำสั่ง** (บั๊กที่ใบ 315 วัดเจอและแก้)" \
  "s@'\\. /'@*' . /'@" \
  "$GATE_REL" scene_absolute "tools/absolute.sh:3" invert 1

sens "S7 — แขนที่รับรูป \`|| …\`" \
  "s%\\*'||'\\*) continue ;;%*'NOPE'*) continue ;;%" \
  "$GATE_REL" scene_orform "tools/orform.sh:3" invert 1

sens "S8 — แขนที่รับรูป \`rc=\$?\` ในบรรทัดถัดไป" \
  "s%\\*'\\\$?'\\*) continue ;;%*'NOPE'*) continue ;;%" \
  "$GATE_REL" scene_rcform "tools/rcform.sh:3" invert 1

sens "S9 — ยาม \`swept = 0\` (บทเรียนใบ 193 — คลังว่างต้องไม่อ่านว่า 'ไม่มีอะไรผิด')" \
  's%if \[ "$swept" -eq 0 \]; then%if false; then%' \
  "$GATE_REL" scene_empty_corpus "กวาดไฟล์เชลล์ไม่ได้เลยสักใบ" normal 0

# ⚠️ **แถวนี้จงใจไม่ประกาศ exit และนั่นคือผลการวัด ไม่ใช่ความขี้เกียจ** — ถอดตัวคัด `.` ออกแล้ว
# ด่าน **ยังเขียว exit 0** เพราะ `checked = 0` ไม่ใช่ความผิดในโลกที่ถูกกฎหมาย (ทุกไฟล์มี `set -e`)
# ⇒ ที่เดียวที่ความตายของตัวคัดโผล่ออกมาคือ **ตัวเลขบนบรรทัดสรุป** ⇒ แถวนี้จึงผูกกับตัวเลขนั้น
# ⇒ นี่คือคำตอบของคำถาม "ทำไมด่านนี้มีตัวนับศูนย์ตัวเดียว ไม่ใช่สองตัวแบบ `check-path-bytes.sh`"
sens "S10 — ตัวคัดบรรทัด \`.\` เอง (ตายแล้วเห็นได้ที่ *ตัวเลข* เท่านั้น ไม่ใช่ที่สี)" \
  's%done < <(grep -nE .*%done < <(grep -nE "ZZNOMATCHZZ" "$f")%' \
  "$GATE_REL" new_sandbox "คุ้ม 2 จุด" normal

# ── ใบ 318: ตัวแยก "คำสั่ง" ออกจาก "ข้อมูลในเนื้อ heredoc" ────────────────────────────────
# 📇 **ยาม "heredoc ค้างตอนจบไฟล์" (S17) เป็นคนบังคับให้สามแถวแรกคมขึ้น — การวัดเป็นคนแก้**
# รูปเดิมของ S11/S12 คือ `s/if (HD != "")/if (0)/` ซึ่ง **ฆ่าสองอย่างพร้อมกัน**: แขนข้ามเนื้อ
# *และ* ตัวรีเซ็ตสถานะ (ซึ่งอยู่ในแขนเดียวกัน) ⇒ พอยาม S17 ลงมา ทั้งคู่ไปโดนยามนั้นแทน แล้วแถว
# ก็เลิกวัดของที่มันอ้างว่าวัด · รูปที่ใช้อยู่ตอนนี้ (`return 1` → `return 0`) ถอด **แขนข้ามเนื้อ
# อย่างเดียว**: เนื้อกลายเป็นโค้ด แต่ป้ายปิดยังรีเซ็ต ⇒ ยามไม่ดัง ⇒ แถววัดของมันเองล้วน ๆ
# ⚠️ นี่คือบทเรียนเดียวกับที่ S13 สอนตอนเขียนรอบแรก มาถึงรอบที่สอง: **แถวที่ sed กว้างเกินไป
# จะวัดของเพื่อนบ้าน โดยหน้าตาเหมือนวัดของตัวเอง**
# 📇 **และ S13 เลิกประกาศ exit ด้วยเหตุผลที่ต้องอ่าน ไม่ใช่ความขี้เกียจ** — ถอดตัวรีเซ็ตแล้ว
# ไฟล์มืดจริง ⇒ ข้อความ `tools/hd-close.sh:6` หายไปตามที่อ้าง **แต่ exit ยังเป็น 1** เพราะยาม
# S17 ดังขึ้นมาแทนด้วยสาเหตุคนละเรื่อง · ก่อนมียามตัวนั้น การถอดนี้ให้ **exit 0 แบบเงียบ**
# ซึ่งคือเหตุผลทั้งหมดที่ S17 มีอยู่ ⇒ สองแถวนี้คือด้านหน้ากับด้านหลังของเหรียญเดียวกัน
#
# 🔑 **ห้าแถวแรกแบ่งเป็นสองชั้นโดยตั้งใจ และนั่นคือทั้งประเด็น**: S11–S13 ถอดจาก *ตัวแยกคำ*
# (`scripts/lib/heredoc.awk` — บ้านที่ `check-path-bytes.sh` ยืมตัวเดียวกัน) ส่วน S14–S15
# ถอดจาก *สายไฟ* ในตัวด่านเอง (ให้มันกลับไปอ่านไฟล์ดิบแทน `$view`) · ชั้นเดียวไม่พอ เพราะ
# ตัวแยกคำที่ถูกต้องซึ่งไม่มีใครเรียก กับสายไฟที่ถูกต้องซึ่งเรียกตัวแยกคำที่พัง ให้ผลเหมือนกัน
# เป๊ะ แต่คนละทางแก้ ⇒ แถวที่ผูกกับชั้นเดียวจะเขียวให้บั๊กอีกชั้นหนึ่งฟรี ๆ
scene_hd_sete() {
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
}
scene_hd_dot() {
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
}
scene_hd_close() {
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
}

sens "S11 — แขน 'บรรทัดนี้อยู่ในเนื้อ heredoc' ของตัวแยกคำ (ทิศ **เขียวเงียบ**: \`set -e\` ปลอมปิดตาทั้งไฟล์)" \
  's/HD = ""; return 1/HD = ""; return 0/' \
  "$HDLIB_REL" scene_hd_sete "tools/hd-sete.sh:8" normal 0

# 🔑 แถวนี้ใช้ **ฉากคนละใบและข้อความคนละอัน** กับ S11 ทั้งที่ถอดของชิ้นเดียวกัน — เพราะยามตัวนี้
# ล้มได้สองทิศที่มีคนละราคาและคนละทางแก้: เขียวเงียบ (S11) กับ **แดงปลอมที่แก้ตามคำแนะนำของเกต
# ไม่ได้** (S15 คือทิศเดียวกันนี้ในชั้นสายไฟ) ⇒ ผูกแถวกับ "exit เปลี่ยน" อย่างเดียวจะกลบทิศหนึ่งทิ้ง
sens "S12 — แขนเดียวกัน แต่วัดทิศ **แดงปลอม** (บรรทัด \`.\` ที่เป็นข้อมูลถูกฟ้อง)" \
  's/HD = ""; return 1/HD = ""; return 0/' \
  "$HDLIB_REL" scene_hd_dot "tools/hd-dot.sh:4" invert 1

# 🔴 ตัวปิดที่ไม่ถูกรู้จัก = ทุกบรรทัดหลังบรรทัดเปิดกลายเป็นข้อมูลตลอดกาล ⇒ **ไฟล์มืดทั้งใบ
# แบบเงียบ ๆ** ซึ่งคือโรคที่ใบ 318 เปิดมาปิด มาทางประตูใหม่ ⇒ ต้องมีแถวของตัวเอง ไม่ใช่เชื่อว่า
# S11 ครอบให้ (S11 ถอด *แขนข้าม* ส่วนแถวนี้ถอด *ตัวรีเซ็ตสถานะ* — บรรทัดเดียวกัน คนละครึ่ง)
# ⚠️ **ถอดเป็น no-op (`HD = HD`) ไม่ใช่ลบทิ้งทั้งท่อน และความต่างนี้วัดเจอตอนเขียน ไม่ใช่อ่านเจอ**:
# รูปแรกที่ลองคือ `s/HD = ""; return 1/return 1/` ซึ่งกิน `return 1` ที่เป็น **ทางออกไร้เงื่อนไข**
# ไปด้วย ⇒ บรรทัดในเนื้อกลายเป็นโค้ด = ผลของ S11 เป๊ะ ๆ ⇒ แถวนี้จะวัดซ้ำกับ S11 โดยหน้าตาเหมือน
# วัดคนละอย่าง (และมันแดงจริงตอนรันรอบแรก ซึ่งคือเหตุผลที่ตารางต้องถูก *รัน* ไม่ใช่ *เขียน*)
sens "S13 — ตัวรีเซ็ตสถานะเมื่อเจอป้ายปิด (ถอดแล้วไฟล์มืดตั้งแต่บรรทัดเปิดจนจบ)" \
  's/HD = ""; return 1/HD = HD; return 1/' \
  "$HDLIB_REL" scene_hd_close "tools/hd-close.sh:6" normal

sens "S14 — สายไฟ: ตัวกรอง \`set -e\` อ่านจาก \`\$view\` ไม่ใช่ไฟล์ดิบ" \
  's@<<<"$view"; then@< "$f"; then@' \
  "$GATE_REL" scene_hd_sete "tools/hd-sete.sh:8" normal 0

sens "S15 — สายไฟ: ตัวคัดบรรทัด \`.\` อ่านจาก \`\$view\` ไม่ใช่ไฟล์ดิบ" \
  's@<<<"$view" | grep -v@"$f" | grep -v@' \
  "$GATE_REL" scene_hd_dot "tools/hd-dot.sh:4" invert 1

scene_phantom() {
  new_sandbox
  add_scene tools/phantom.sh <<'OUTER'
#!/usr/bin/env bash
echo "วิธีเขียนคือ cat <<EOF"
. scripts/lib/x.sh
echo done
OUTER
}
scene_rcopener() {
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
}

# 🔑 **สองแถวนี้มาจากการรีวิว ไม่ได้มาจากการเขียนเทส และทั้งคู่วัดของที่ *ใบนี้เพิ่งสร้างขึ้นเอง***
# — ไม่ใช่ของเก่าที่ตกหล่น · S16 เฝ้าแดงปลอมที่รอบแรกทำขึ้น · S17 เฝ้าความเงียบที่รอบแรกย้ายที่
sens "S16 — บรรทัดถัดไปต้องอ่านจาก **ไฟล์ดิบ** ไม่ใช่ \`\$view\` (ที่เป่าบรรทัดเปิด heredoc ทิ้ง)" \
  's@sed -n "$((lineno + 1))p" "$f"@sed -n "$((lineno + 1))p" <<<"$view"@' \
  "$GATE_REL" scene_rcopener "tools/rcopener.sh:3" invert 1

sens "S17 — ยาม \`heredoc ค้างตอนจบไฟล์\` (ถอดแล้วไฟล์มืดทั้งใบแบบ **เขียวเงียบ**)" \
  's@^  if hd_open=@  if false \&\& hd_open=@' \
  "$GATE_REL" scene_phantom "tools/phantom.sh:2" normal 0
