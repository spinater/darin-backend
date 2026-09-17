#!/usr/bin/env bash
# ตารางความไวของ `scripts/tests/check-text-bytes-selftest.sh` (ใบ 277)
# ⚠️ `.` (source) เท่านั้น ด้วยเหตุผลเดียวกับ `cases-behaviour.sh`
#
# 🔑 **"exit เปลี่ยน" อย่างเดียวเป็นตัววัดที่หยาบเกินไป** — ถอดด่านแถวซ้ำออกแล้ว exit **ยังเป็น 1**
# เพราะด่านกันสุสานไปแดงแทนด้วยสาเหตุคนละเรื่องคนละทางแก้ ⇒ แถวที่ดูแค่ exit จะรายงานว่า
# "ของที่ถอดไม่ได้เฝ้าอะไร" ทั้งที่มันเฝ้าอยู่จริง ⇒ ตัววัดหลักคือ **ข้อความลายเซ็น** ส่วน exit
# ประกาศเพิ่มเฉพาะแถวที่อ้างว่าของที่ถอดเป็น *ตัวกำหนดคำตัดสิน* ไม่ใช่ *ตัวกำหนดถ้อยคำ*
#
# ⚠️ **ยามต้องจับคู่กับฉากที่มันยิงจริง** — จับคู่กับฉากเขียวคือการวัดว่า "ถอดของที่ไม่ได้ทำงาน
# ออกแล้วไม่มีอะไรเปลี่ยน" ซึ่งจริงโดยโครงสร้าง (ความผิดที่ใบ 190 เคยเขียนลงการ์ดของตัวเองมาแล้ว)

echo "selftest: ตารางความไว — ถอดทีละข้อจากสำเนา แล้วเคสคู่ของมันต้องพลิก"

make_mutated() { # $1 = นิพจน์ sed ; return 1 = sed ไม่ได้แก้อะไรเลย
  cp "$SANDBOX/$GATE_REL" "$SANDBOX/$MUT_REL"
  sed_i "$1" "$SANDBOX/$MUT_REL"
  cmp -s "$SANDBOX/$MUT_REL" "$SANDBOX/$GATE_REL" && return 1
  return 0
}

# ทุกแถวจบด้วย assertion ที่สอง: **ถอดแล้วทรีปกติต้องยังเขียว**
# ⚠️ สิ่งที่มันซื้อคือการจับ `sed` ที่กว้างจนสคริปต์พัง **เท่านั้น** ไม่ใช่ข้อพิสูจน์ว่าการถอด
# เป็นการผ่าตัดจุดเดียว — เก็บไว้เพราะมันจับ sed ที่พลาดได้จริง และเป็นประกันของแถวที่จะเพิ่มวันหน้า
# 🔑 **ต้องมีโหมดที่สอง** — การถอดที่ขยับ *ขอบ* ทำให้ทรีปกติ **แดงโดยชอบ** ⇒ บังคับว่า
# "ต้องยังเขียว" ที่นั่นคือการวัดผิดฉาก ไม่ใช่การจับ sed ที่กว้างเกิน (บทเรียนใบ 298 · วัดซ้ำที่
# ใบ 277: แถว S10 ถอดแขนแถวรูปพาธ ⇒ ถ้า `binary-kinds.txt` **มี** แถวรูปพาธอยู่จริงเมื่อไร
# ทรีปกติต้องแดง · ตั้ง `SENS_NORMAL_MSG` ไว้ก่อนเรียก = ประกาศข้อความที่ทรีปกติต้องรายงาน
# ซึ่งแรงกว่า "ยังเขียว" เพราะมันพิสูจน์ว่าการถอดไปโดนขอบจริง ไม่ใช่ไปพังอย่างอื่น)
SENS_NORMAL_MSG=""
sens_normal_still_green() { # $1 = ชื่อแถว · อ่าน `SENS_NORMAL_MSG` แล้วล้างทิ้ง
  local g want="$SENS_NORMAL_MSG"
  SENS_NORMAL_MSG=""
  new_sandbox
  make_mutated "$SENS_EXPR" >/dev/null
  run_gate "$SANDBOX/$MUT_REL"; g=$?
  if [ -z "$want" ]; then
    check "[ความไว] $1 — ถอดแล้วทรีปกติยังเขียว (sed ไม่ได้กว้างจนสคริปต์พัง)" \
      "$([ "$g" -eq 0 ] && echo 1 || echo 0)" \
      "ทรีปกติกลายเป็น exit=$g ⇒ sed กว้างเกินจนไปทำลายอย่างอื่น แถวนี้จึงไม่ได้วัดของที่ตั้งใจวัด"
  else
    check "[ความไว] $1 — ถอดแล้วทรีปกติแดงที่ *ขอบ* ตามที่ประกาศไว้" \
      "$([ "$g" -ne 0 ] && grep -qF -- "$want" <<<"$GATE_OUT" && echo 1 || echo 0)" \
      "ทรีปกติได้ exit=$g และไม่มีข้อความ \"$want\" ⇒ การถอดไม่ได้ไปโดนขอบอย่างที่อ้าง"
  fi
}

SENS_EXPR=""
sens() { # $1=ชื่อ $2=sed $3=ฉาก $4=exit ปกติ $5=ลายเซ็นที่ต้อง **หายไป** $6=exit หลังถอด (ไม่บังคับ)
  local name="$1" expr="$2" scenario="$3" normal="$4" sig="$5" want_after="${6:-}" base_exit after_exit
  SENS_EXPR="$expr"
  "$scenario"
  run_gate; base_exit=$?
  if [ "$base_exit" -ne "$normal" ] || ! grep -qF -- "$sig" <<<"$GATE_OUT"; then
    echo "  FAIL: [ความไว] $name — ฉากตั้งต้น exit=$base_exit (คาด $normal) หรือไม่มีข้อความ \"$sig\" ⇒ ไม่มีอะไรให้หายไป"
    printf '    --- output ---\n%s\n    --------------\n' "$GATE_OUT"
    fail=$((fail + 1)); return
  fi
  # ⚠️ sed ที่ไม่แมตช์ = แถวที่ "ผ่าน" ตลอดกาลโดยไม่ได้วัดอะไรเลย (ความผิดของใบ 190)
  if ! make_mutated "$expr"; then
    check "[ความไว] $name — sed แก้สำเนาได้จริง" 0 "sed ไม่ตรงกับซอร์สจริง ⇒ แถวนี้วัดอะไรไม่ได้ (แก้ pattern ให้ตรง)"
    return
  fi
  check "[ความไว] $name — sed แก้สำเนาได้จริง" 1 ""
  run_gate "$SANDBOX/$MUT_REL"; after_exit=$?
  if grep -qF -- "$sig" <<<"$GATE_OUT"; then
    echo "  FAIL: [ความไว] $name — ถอดออกแล้วยังรายงาน \"$sig\" ⇒ ของที่ถอดไม่ได้เฝ้าข้อนี้"
    printf '    --- output ---\n%s\n    --------------\n' "$GATE_OUT"
    fail=$((fail + 1))
  else
    echo "  ok: [ความไว] $name (ถอดแล้วข้อความ \"$sig\" หายไป)"; pass=$((pass + 1))
  fi
  if [ -n "$want_after" ]; then
    check "[ความไว] $name — ถอดแล้วฉากนี้ exit $normal → $want_after (เปลี่ยนคำตัดสิน ไม่ใช่แค่ถ้อยคำ)" \
      "$([ "$after_exit" -eq "$want_after" ] && echo 1 || echo 0)" \
      "ได้ exit=$after_exit ⇒ ของที่ถอดเป็นแค่ตัวกำหนดถ้อยคำในฉากนี้ ไม่ใช่ตัวกำหนดคำตัดสิน"
  fi
  sens_normal_still_green "$name"
}

# ── วัด **กลับทิศ** สำหรับของที่เป็น *ยาม* (ตัวข้าม) — ถอดออกแล้วข้อความต้อง *โผล่มา*
sens_appears() { # $1=ชื่อ $2=sed $3=ฉาก $4=exit ปกติ $5=ข้อความที่ต้อง **โผล่** $6=exit หลังถอด
  local name="$1" expr="$2" scenario="$3" normal="$4" sig="$5" want_after="${6:-}" base_exit after_exit
  SENS_EXPR="$expr"
  "$scenario"
  run_gate; base_exit=$?
  if [ "$base_exit" -ne "$normal" ] || grep -qF -- "$sig" <<<"$GATE_OUT"; then
    echo "  FAIL: [ความไว] $name — ฉากตั้งต้น exit=$base_exit (คาด $normal) หรือมี \"$sig\" อยู่แล้ว ⇒ ไม่มีอะไรให้โผล่"
    printf '    --- output ---\n%s\n    --------------\n' "$GATE_OUT"
    fail=$((fail + 1)); return
  fi
  if ! make_mutated "$expr"; then
    check "[ความไว] $name — sed แก้สำเนาได้จริง" 0 "sed ไม่ตรงกับซอร์สจริง ⇒ แถวนี้วัดอะไรไม่ได้ (แก้ pattern ให้ตรง)"
    return
  fi
  check "[ความไว] $name — sed แก้สำเนาได้จริง" 1 ""
  run_gate "$SANDBOX/$MUT_REL"; after_exit=$?
  if grep -qF -- "$sig" <<<"$GATE_OUT"; then
    echo "  ok: [ความไว] $name (ถอดแล้วข้อความ \"$sig\" โผล่มา)"; pass=$((pass + 1))
  else
    echo "  FAIL: [ความไว] $name — ถอดแล้ว \"$sig\" ยังไม่โผล่ ⇒ ของที่ถอดไม่ได้กันข้อนี้"
    printf '    --- output ---\n%s\n    --------------\n' "$GATE_OUT"
    fail=$((fail + 1))
  fi
  if [ -n "$want_after" ]; then
    check "[ความไว] $name — ถอดแล้วฉากนี้ exit $normal → $want_after (เปลี่ยนคำตัดสิน ไม่ใช่แค่ถ้อยคำ)" \
      "$([ "$after_exit" -eq "$want_after" ] && echo 1 || echo 0)" \
      "ได้ exit=$after_exit ⇒ ของที่ถอดเป็นแค่ตัวกำหนดถ้อยคำในฉากนี้"
  fi
  sens_normal_still_green "$name"
}

# ── ฉาก (คู่กับเคสพฤติกรรมตัวอักษรเดียวกัน)
scene_E() { new_sandbox; : > "$SANDBOX/web/public-marker"; git -C "$SANDBOX" add -A >/dev/null 2>&1; }
scene_M() { new_sandbox; make_binary "$SANDBOX/fixtures/UPPER.$(tr '[:lower:]' '[:upper:]' <<<"$EXT1")"
            git -C "$SANDBOX" add -A >/dev/null 2>&1; }
scene_N() { new_sandbox; ln -s "fixtures/sample.$EXT1" "$SANDBOX/link-to-binary.ts"
            git -C "$SANDBOX" add -A >/dev/null 2>&1; }
scene_L() { new_sandbox; kinds_file_with 0 "$EXT1	# ใบ 277 · แถวที่ไม่มีไฟล์เหลือแล้ว"; }
scene_G() { new_sandbox
            git -C "$SANDBOX" ls-files -z | (cd "$SANDBOX" && xargs -0 rm -f)
            git -C "$SANDBOX" add -A >/dev/null 2>&1; }
scene_K() { new_sandbox; kinds_file_with 1 "$EXT1	# ใบ 277 · แถวแรก" "$EXT1	# ใบ 277 · แถวซ้ำ"; }
scene_J() { new_sandbox; kinds_file_with 1 "$EXT1	# ไม่ได้อ้างใบงาน"; }
scene_P() { new_sandbox; kinds_file_with 1 "$(sed "s/./?/2" <<<"$EXT1")	# ใบ 277 · แถวรูป glob"; }
scene_R() { new_sandbox; make_nul_text "$SANDBOX/web/src/บันทึก.ts"; git -C "$SANDBOX" add -A >/dev/null 2>&1; }
scene_Q() { new_sandbox; make_binary "$SANDBOX/fixtures/noext"
            printf 'fixtures/noext\t# ใบ 277 · แถวรูปพาธ\n' >> "$SANDBOX/$KINDS_REL"
            git -C "$SANDBOX" add -A >/dev/null 2>&1; }
scene_I() { new_sandbox; kinds_file_with 0 '# มีแต่คอมเมนต์'; }

# ── แถว
# S1 — ตัวข้ามไฟล์ว่างเป็น *ยาม* ⇒ วัดกลับทิศ · ถอดแล้วเกตเปลี่ยนคำตัดสิน ⇒ ประกาศ exit ด้วย
sens_appears "S1 (ตัวข้ามไฟล์ว่าง)" 's/if \[ ! -s "\$f" \]; then/if false; then/' scene_E 0 \
  "public-marker" 1

# S2 — การลดรูปนามสกุลเป็นตัวเล็ก · `.HEIC` ของกล้องลูกค้าคือเหตุผลที่มันมีอยู่
sens_appears "S2 (ลดรูปนามสกุลเป็นตัวเล็ก)" 's/  ext="\${ext,,}"/  ext="\${ext}"/' scene_M 0 \
  "fixtures/UPPER." 1

# S3 — ตัวข้าม symlink
sens_appears "S3 (ตัวข้าม symlink)" 's/if \[ -L "\$f" \]; then/if false; then/' scene_N 0 \
  "link-to-binary.ts" 1

# S4 — ด่านกันสุสานของลิสต์ · ถอดแล้วเกตเขียวสนิท ⇒ ประกาศ exit 0
sens "S4 (ด่านกันสุสานของลิสต์)" 's/\[ -n "\${kind_hit\[\$v\]+x}" \] \&\& continue/true \&\& continue/' scene_L 1 \
  "ไม่มีไฟล์ชนิดนี้ในรีโปแล้ว" 0

# S5 — ด่าน `swept = 0` · ฉากนี้ยังมีแถวสุสานแดงอยู่ ⇒ exit ไม่ขยับ ⇒ ผูกกับถ้อยคำอย่างเดียว
sens "S5 (ด่าน swept = 0)" 's/if \[ "\$swept" -eq 0 \]; then/if false; then/' scene_G 1 \
  "กวาดไป 0 ไฟล์"

# S6 — ด่านแถวซ้ำ · ถอดแล้วแถวที่สองไปโดนด่านสุสานแทน ⇒ exit ไม่ขยับ (นี่คือเหตุผลของหัวไฟล์)
sens "S6 (ด่านแถวซ้ำ)" 's/if \[ -n "\$dup" \]; then/if false; then/' scene_K 1 \
  "แถวซ้ำ"

# S7 — ด่าน `ใบ NNN` · ฉากถูกจัดให้มีสาเหตุเดียว ⇒ ถอดแล้วเขียวสนิท
sens "S7 (ด่านแถวต้องอ้างใบงาน)" 's/\*"ใบ "\[0-9\]\[0-9\]\[0-9\]\*) ;;/*) ;;/' scene_J 1 \
  "แถวต้องอ้างใบงาน" 0

# S8 — เทียบสตริงตรง → glob · ถอดแล้ว `p?f` ยกเว้นให้ `.pdf` ⇒ เขียวสนิท (บทเรียนใบ 190)
sens "S8 (เทียบนามสกุลเป็นสตริงตรง ไม่ใช่ glob)" \
  's/\[ "\$ext" = "\${v,,}" \] || continue/[[ "\$ext" == \${v,,} ]] || continue/' scene_P 1 \
  "fixtures/sample." 0

# S9 — `-z` ของคลัง · ถอดแล้วพาธไทยถูก quote ⇒ `[ -f ]` ล้ม ⇒ หายเงียบ (24 ไฟล์ในรีโปจริง)
sens "S9 (-z ของคลัง — ชื่อไทย)" \
  's/while IFS= read -r -d .. f; do/while IFS= read -r f; do/; s/--exclude-standard -z | LC_ALL=C sort -z -u/--exclude-standard | LC_ALL=C sort -u/' \
  scene_R 1 "web/src/บันทึก.ts" 0

# S10 — แขนแถวรูปพาธ · เป็นยาม ⇒ วัดกลับทิศ
# ⚠️ ตัวคั่นของ `s` ต้องไม่ใช่ `|` — นิพจน์นี้มี `||` อยู่ในตัวมันเอง (เจอจริงตอนเขียนแถวนี้)
# ⚠️ ถ้า `binary-kinds.txt` มีแถวรูปพาธอยู่จริง การถอดแขนนี้จะทำให้ **ทรีปกติแดงโดยชอบ**
# ⇒ ประกาศไว้ตรงนี้ให้ตรงกับข้อมูลที่มี แทนที่จะบังคับว่าต้องเขียว (ซึ่งจะเป็นการวัดผิดฉาก)
[ "${#KIND_PATH[@]}" -gt 0 ] && SENS_NORMAL_MSG="${KIND_PATH[0]}"
sens_appears "S10 (แขนแถวรูปพาธ)" 's@\*/\*) \[ "\$p" = "\$v" \] || continue ;;@*/*) continue ;;@' scene_Q 0 \
  "fixtures/noext" 1

# S11 — แขน "ไฟล์ข้อมูล 0 แถว" · darin (ใบ 001) กลับทิศพร้อมกับเคส I: แขนนี้ไม่ได้ทำให้แดง
# อีกต่อไป มันทำให้ **พูดออกมา** ว่าลิสต์ว่างโดยตั้งใจ ⇒ ถอดออกแล้วเกตยังเขียวเหมือนเดิม
# แต่ **เงียบ** ซึ่งคือสภาพก่อนมีแขนนี้พอดี · ⚠️ วัดด้วย *ข้อความ* ไม่ใช่ exit (exit ไม่ขยับ
# ทั้งสองทิศ — บทเรียนเดียวกับแถว S8 ของ selftest หมุด junit)
sens "S11 (แขนไฟล์ข้อมูล 0 แถว)" 's/if \[ "\$rows" -eq 0 \]; then/if false; then/' scene_I 0 \
  "ตัวข้ามว่างเปล่า" 0

# ── ฉาก + แถวของยามที่รีวิวใบ 277 สั่งให้เพิ่ม (ทั้งห้าเป็นของที่ "ลบแล้วไม่มีอะไรแดง" มาก่อน)
scene_V() { new_sandbox; printf 'abc\000' > "$SANDBOX/web/src/tailnul.ts"
            git -C "$SANDBOX" add -A >/dev/null 2>&1; }
scene_W() { new_sandbox; printf 'export const ok = 2;\n' > "$SANDBOX/web/src/locked.ts"
            git -C "$SANDBOX" add -A >/dev/null 2>&1; chmod 000 "$SANDBOX/web/src/locked.ts"; }
scene_X() { new_sandbox; make_binary "$SANDBOX/fixtures/masked.$EXT1"
            printf 'fixtures/masked.%s\t# ใบ 277 · แถวพาธที่ถูกแถวนามสกุลบัง\n' "$EXT1" >> "$SANDBOX/$KINDS_REL"
            git -C "$SANDBOX" add -A >/dev/null 2>&1; }
scene_Y() { new_sandbox; printf 'ts\t# ใบ 277 · แถวกว้างเกิน\n' >> "$SANDBOX/$KINDS_REL"
            git -C "$SANDBOX" add -A >/dev/null 2>&1; }
scene_Z() { new_sandbox
            printf '%s\t# ใบ 277 · ตัวพิมพ์ใหญ่ของแถวที่มีอยู่แล้ว\n' "$(tr '[:lower:]' '[:upper:]' <<<"$EXT1")" \
              >> "$SANDBOX/$KINDS_REL"; }

# S12 — ทิศที่สองของด่านกันสุสาน · ถอดแล้วแถวกว้างเกินเงียบสนิท ⇒ เกตเปลี่ยนคำตัดสิน
sens "S12 (ทิศที่สองของด่านกันสุสาน — แถวที่ข้ามไฟล์ text)" \
  's/    if ! flen_is_binary "\$f"; then/    if false; then/' scene_Y 1 \
  "ข้ามไฟล์ที่ไบต์เป็น text อยู่" 0

# S13 — จดทุกแถวที่แมตช์ · ถอดแล้ว (หยุดที่แถวแรก) แถวพาธที่ถูกบังโดนข้อความที่เป็นเท็จ ⇒ วัดกลับทิศ
sens_appears "S13 (จดทุกแถวที่แมตช์ ไม่ใช่แถวแรก)" \
  's/    KIND_MATCHED_ROWS+=("\$v")/    KIND_MATCHED_ROWS+=("\$v"); break/' scene_X 0 \
  "ไม่มีไฟล์ชนิดนี้ในรีโปแล้ว: fixtures/masked." 1

# S14 — ไบต์ยามของตัวหาออฟเซ็ต · ถอดแล้วได้ `-1` ซึ่งฟังก์ชันนิยามเองว่า "ไม่มี NUL" ⇒ วัดกลับทิศ
sens_appears "S14 (ไบต์ยามของ nul_first_offset)" \
  "s/{ LC_ALL=C tr '\\\\n\\\\000' '\\\\001\\\\n' < \"\\\$1\"; printf 'x'; } |/LC_ALL=C tr '\\\\n\\\\000' '\\\\001\\\\n' < \"\$1\" |/" \
  scene_V 1 "ออฟเซ็ต -1"

# S15 — ยามไฟล์อ่านไม่ได้ · ถอดแล้วเกตวินิจฉัยว่าเป็นไบต์ควบคุม ซึ่งส่งคนไปแก้ผิดที่
sens "S15 (ยามไฟล์อ่านไม่ได้)" 's/  if \[ ! -r "\$f" \]; then/  if false; then/' scene_W 1 \
  "อ่านไฟล์ไม่ได้"

# S16 — ด่านแถวซ้ำต้องเทียบด้วยกติกาเดียวกับการจับคู่ (ไม่สนตัวพิมพ์)
sens "S16 (ด่านแถวซ้ำ ไม่สนตัวพิมพ์)" 's/\*) row_key="\${row,,}" ;;/*) row_key="$row" ;;/' scene_Z 1 \
  "แถวซ้ำ"
