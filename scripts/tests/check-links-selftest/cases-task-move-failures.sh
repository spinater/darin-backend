#!/usr/bin/env bash
# เคส **ตอนตัวกวาดล้ม** (AB–AG + ความไว 14–21) — แตกออกมาจาก `cases-task-move.sh` ที่ใบ 284
# ตอนไฟล์นั้นชน 504/500 (§4: แตกเป็นโมดูลย่อย ห้ามยกเพดาน) · เส้นแบ่งเป็น **หัวข้อ ไม่ใช่ครึ่งบรรทัด**:
# ไฟล์พี่เก็บ *สัญญาตอนทุกอย่างไปได้สวย* (กวาดถึงไหน · บ้านไหน · stage ให้ใครบ้าง) ·
# ไฟล์นี้เก็บ *สิ่งที่ต้องเกิดตอนกวาดไม่สำเร็จ* — กวาดต่อจนจบ · เรียกชื่อ · เก็บ `$work` ·
# ห้ามจบ 0 · และห้ามตายก่อนจะได้รายงาน
# ⚠️ ถูก **`.` (source)** จากไฟล์เข้าเหมือนกัน ⇒ ใช้ `pass`/`fail`/`new_sandbox`/`check`/`strip` ชุดเดียวกัน
# 🔑 **ความไว 22 ไม่ได้อยู่ในนี้โดยตั้งใจ** — มันวัด assertion ของ *เคส H* ซึ่งอยู่ไฟล์พี่
#    ⇒ แถวความไวอยู่ข้างเคสที่มันเฝ้าเสมอ ไม่ใช่ข้างใบงานที่พาเข้ามา
echo "selftest: AB — เขียนไม่สำเร็จกลางการกวาด: ต้องกวาดต่อให้จบแล้ว **เรียกชื่อ** ไม่ใช่ตายคาที่ (ใบ 284)"
# 🔑 **ฉากนี้คือของเก่า ไม่ใช่ของที่ใบ 276 สร้าง** — วัดได้เหมือนกันบน `2be0e225` · เดิม
# `sed … > "$tmp"` กับ `cat "$tmp" > "$f"` ไม่มีใครอ่านสถานะ (ตัวหลังอยู่ท้าย `||` list ⇒ `set -e`
# ยังกินมันอยู่) ⇒ ล้มเมื่อไรสคริปต์ตายตรงนั้น **หลัง `git mv` ไปแล้ว** = ทรีที่ใบย้ายแล้วแต่ลิงก์
# กวาดไปครึ่งเดียว โดยมีแต่ `line NNN: Permission denied` ของ bash เป็นคำอธิบาย
# · `README.md` ถูกเลือกเพราะมันมา **ก่อน** `lib/` · `tasks/` ในลำดับของ `git ls-files`
#   ⇒ ตายที่ไฟล์นี้ = ไม่มีอะไรถูกกวาดเลยสักไฟล์ (วัดแล้ว) ⇒ ฉากนี้แยก "กวาดต่อ" ออกจาก "ตาย" ได้จริง
new_sandbox
chmod 444 "$SANDBOX/README.md"
ab_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"; ab_code=$?
check "ไฟล์ที่อยู่ **หลัง** จุดที่ล้มยังถูกกวาดครบ (ไม่ใช่หยุดคาที่)" \
  "$(grep -qF "](done/$A)" "$SANDBOX/$T/HANDOFF-selftest.md" \
     && grep -qF "$T/done/$A" "$SANDBOX/lib/demo.ts" \
     && grep -q '^- status: done' "$SANDBOX/$T/done/$A" && echo 1 || echo 0)" \
  "HANDOFF: $(cat "$SANDBOX/$T/HANDOFF-selftest.md") · demo: $(cat "$SANDBOX/lib/demo.ts") · ใบ: $(grep '^- status' "$SANDBOX/$T/done/$A" 2>&1)"
check "และ **เรียกชื่อไฟล์ที่กวาดไม่สำเร็จ** พร้อมสาเหตุจริง" \
  "$(grep -q 'กวาดไม่สำเร็จ' <<<"$ab_out" && grep -q 'README.md' <<<"$ab_out" \
     && grep -qi 'permission denied' <<<"$ab_out" && echo 1 || echo 0)" \
  "output: $ab_out"
# สัญญาเดียวกับหาง `- status:` และบรรทัด `- 🚫`: บอกทางออกที่ **พิมพ์ตามได้** ไม่ใช่แค่บอกว่าพัง
check "บอกทางออกที่พิมพ์ตามได้ (กวาดใหม่ทั้งชุดด้วยคู่แฟล็กขากลับ–ขาไป)" \
  "$(grep -qF 'task-move.sh 900 --reopen' <<<"$ab_out" && echo 1 || echo 0)" \
  "output: $ab_out"
check "ไม่ทิ้ง \$work ค้างไว้ใน .scratch/ (trap เก็บให้ทุกทางออก)" \
  "$([ -z "$(ls -d "$SANDBOX"/.scratch/task-move-* 2>/dev/null)" ] && echo 1 || echo 0)" \
  "ค้าง: $(ls -d "$SANDBOX"/.scratch/task-move-* 2>/dev/null | tr '\n' ' ')"
# ⚠️ กวาดไม่ครบแล้วจบ 0 = ความล้มเหลวที่ใส่หน้ากากความสำเร็จ (คลาสเดียวกับ `--humen` ของใบ 231)
check "exit ต้องไม่เป็นศูนย์ ทั้งที่รอบนี้ 'เดินจนจบ'" \
  "$([ "$ab_code" -ne 0 ] && echo 1 || echo 0)" \
  "exit=$ab_code · output: $ab_out"
chmod 644 "$SANDBOX/README.md"

echo "selftest: ความไว 14 — เอา \`cat\` กลับไปเป็นคำสั่งที่ไม่มีใครอ่าน rc ⇒ AB ต้องพลิกเป็น 'ตายคาที่' (ใบ 284)"
new_sandbox
chmod 444 "$SANDBOX/README.md"
strip scripts/task-move.sh 's#if ! err="$(cat -- "$tmp" 2>&1 >"$f")"; then#cat -- "$tmp" > "$f"; if false; then#' \
  "ตัวอ่าน rc ของ cat ใน edit()"
s14_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"
check "ไม่อ่าน rc ⇒ ตายกลางการกวาด: ไฟล์ที่เหลือไม่ถูกแตะ และไม่มีใครเอ่ยชื่อว่าเกิดอะไรขึ้น" \
  "$(! grep -qF "](done/$A)" "$SANDBOX/$T/HANDOFF-selftest.md" \
     && ! grep -q 'กวาดไม่สำเร็จ' <<<"$s14_out" && echo 1 || echo 0)" \
  "HANDOFF: $(cat "$SANDBOX/$T/HANDOFF-selftest.md") · output: $s14_out"
# 🔑 ครึ่งนี้แยก **สองครึ่งของการแก้** ออกจากกัน: rc-read คุม "กวาดต่อ" · trap คุม "เก็บ \$work"
# ⇒ ถอด rc-read อย่างเดียวแล้วขยะยังถูกเก็บ = ความไว 15 ข้างล่างมีฉากที่ยามของมันได้ทำงานจริง
check "แต่ \$work ยังถูกเก็บ เพราะ trap ยังอยู่ (คนละครึ่งของการแก้)" \
  "$([ -z "$(ls -d "$SANDBOX"/.scratch/task-move-* 2>/dev/null)" ] && echo 1 || echo 0)" \
  "ค้าง: $(ls -d "$SANDBOX"/.scratch/task-move-* 2>/dev/null | tr '\n' ' ')"
chmod 644 "$SANDBOX/README.md"

echo "selftest: ความไว 15 — ถอด trap ด้วย (คู่กับฉากที่สคริปต์ตายจริง) ⇒ \$work ค้างตลอดกาล (ใบ 284)"
# ⚠️ **ต้องถอดสองอย่าง** — ถอด trap เฉย ๆ บนทรีที่ยังกวาดจบ วัดอะไรไม่ได้เลย เพราะบรรทัด
# `rmdir "$work"` ท้ายรอบเก็บให้อยู่แล้ว ⇒ นั่นคือกับดัก "จับคู่ยามกับฉากที่ยามไม่ได้ทำงาน"
# ที่ rulebook §7 เตือนไว้เอง · ยามตัวนี้ทำงานเฉพาะ **ทางออกที่ไม่ใช่ทางปกติ** เท่านั้น
new_sandbox
chmod 444 "$SANDBOX/README.md"
strip scripts/task-move.sh 's#if ! err="$(cat -- "$tmp" 2>&1 >"$f")"; then#cat -- "$tmp" > "$f"; if false; then#' \
  "ตัวอ่าน rc ของ cat (ฉากของความไว 15)"
strip scripts/task-move.sh 's#^trap .*EXIT$#:#' "trap เก็บ \$work"
(cd "$SANDBOX" && bash scripts/task-move.sh 900 >/dev/null 2>&1)
check "ไม่มี trap + ตายกลางทาง ⇒ \$work ค้างใน .scratch/ (ชื่อต่อ \$\$ ⇒ ค้างสะสมโดยไม่มีใครเก็บ)" \
  "$([ -n "$(ls -d "$SANDBOX"/.scratch/task-move-* 2>/dev/null)" ] && echo 1 || echo 0)" \
  "ไม่พบไดเรกทอรีค้าง ⇒ แถวนี้วัดอะไรไม่ได้ (ฉากไม่ได้ตายจริงหรือ?)"
chmod 644 "$SANDBOX/README.md"

echo "selftest: AC — ชื่อไฟล์ที่ขึ้นต้นด้วย \`-\` ต้องไม่ถูกอ่านเป็นแฟล็ก (ทางที่สองของใบ 284)"
# ⚠️ **ไม่ตรวจ exit code ของรอบนี้โดยตั้งใจ** — `check-links.sh` (คนละไฟล์ คนละขอบเขตของใบนี้)
# ยัง `dirname "$f"` / `grep -oE … "$f"` แบบไม่มี `--` ⇒ ไฟล์ชื่อขึ้นต้น `-` ที่รากรีโปทำให้
# **ตัวเกตเอง**ตาย (วัดแล้ว: `error: unexpected argument '-d' found` จาก `dirname`) ⇒ สิ่งที่เคสนี้
# ตรึงคือ **ตัวกวาด** ซึ่งเป็นของในขอบเขต · ความไม่สมมาตรที่เหลือถูกรายงานไว้เป็นงานต่อ
new_sandbox
printf '# บันทึก\n\n[ใบ ก](%s)\n' "$T/todo/$A" > "$SANDBOX/-dash-note.md"
# ชื่อที่เป็นแฟล็กของ `echo` **เป๊ะ ๆ** — ทางเดียวที่แยก `printf '%s'` ออกจาก `echo` ได้:
# `-dash-note.md` ไม่ใช่แฟล็กที่ `echo` รู้จัก มันจึงพิมพ์ออกมาตรง ๆ และไม่พิสูจน์อะไรเลยในทิศนั้น
printf '// พอยน์เตอร์: `%s`\n' "$T/todo/$A" > "$SANDBOX/-n"
git -C "$SANDBOX" add -Af >/dev/null
ac_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"
check "ไฟล์ .md ที่ชื่อขึ้นต้นด้วย \`-\` ถูกกวาดจริง (sed ต้องมี \`--\`)" \
  "$(grep -qF "$T/done/$A" "$SANDBOX/-dash-note.md" && echo 1 || echo 0)" \
  "-dash-note.md: $(cat "$SANDBOX/-dash-note.md") · output: $ac_out"
check "ไฟล์โค้ดที่ชื่อเป็นแฟล็กของ echo (\`-n\`) ก็ถูกกวาดจริง (ชื่อ temp ต้องมาจาก printf)" \
  "$(grep -qF "$T/done/$A" "$SANDBOX/-n" && echo 1 || echo 0)" \
  "-n: $(cat "$SANDBOX/-n") · output: $ac_out"
check "และไม่มีไฟล์ไหนเข้ากอง ⛔ เลย (ทางที่สองปิดจริง ไม่ใช่แค่ไม่ตาย)" \
  "$(grep -q 'กวาดไม่สำเร็จ' <<<"$ac_out" && echo 0 || echo 1)" \
  "output: $ac_out"

echo "selftest: ความไว 16 — ถอด \`--\` ออกจาก sed ⇒ AC ข้อแรกต้องพลิก (ใบ 284)"
new_sandbox
printf '# บันทึก\n\n[ใบ ก](%s)\n' "$T/todo/$A" > "$SANDBOX/-dash-note.md"
git -C "$SANDBOX" add -Af >/dev/null
strip scripts/task-move.sh 's#sed "$@" -- "$f"#sed "$@" "$f"#' "\`--\` ของ sed ใน edit()"
s16_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"
check "ไม่มี \`--\` ⇒ sed กินชื่อไฟล์เป็นแฟล็ก ⇒ ไฟล์ไม่ถูกกวาด **แต่ต้องยังถูกเรียกชื่อ**" \
  "$(grep -q 'กวาดไม่สำเร็จ' <<<"$s16_out" && grep -q -- '-dash-note.md' <<<"$s16_out" \
     && ! grep -qF "$T/done/$A" "$SANDBOX/-dash-note.md" && echo 1 || echo 0)" \
  "-dash-note.md: $(cat "$SANDBOX/-dash-note.md") · output: $s16_out"

echo "selftest: ความไว 17 — เอา \`printf '%s'\` กลับไปเป็น \`echo\` ⇒ AC ข้อสองต้องพลิก (ใบ 284)"
new_sandbox
printf '// พอยน์เตอร์: `%s`\n' "$T/todo/$A" > "$SANDBOX/-n"
git -C "$SANDBOX" add -Af >/dev/null
strip scripts/task-move.sh 's#printf .%s. "$f" | tr#echo "$f" | tr#' "printf ของชื่อ temp"
s17_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"
check "\`echo \"-n\"\` พิมพ์ค่าว่าง ⇒ ชื่อ temp กลายเป็นตัว \$work เอง ⇒ เขียนไม่ได้ และไฟล์ไม่ถูกกวาด" \
  "$(grep -q 'กวาดไม่สำเร็จ' <<<"$s17_out" && ! grep -qF "$T/done/$A" "$SANDBOX/-n" && echo 1 || echo 0)" \
  "-n: $(cat "$SANDBOX/-n") · output: $s17_out"

echo "selftest: AD — กวาดไม่สำเร็จในไฟล์ที่ **ไม่มีชั้นไหนของเกตเฝ้า** ⇒ เกตเขียว แต่ห้ามจบ 0 (ใบ 284)"
# 🔑 ฉากนี้คือฉากเดียวที่ **ตัวบังคับ exit ของกอง ⛔ เป็นคนตัดสินคำตอบ** — ในเคส AB เกตแดงอยู่แล้ว
# จากลิงก์ที่พัง ⇒ exit ไม่เป็นศูนย์ไม่ว่าจะมีตัวบังคับหรือไม่ (จับคู่ยามกับฉากที่ยามไม่ได้ทำงาน
# = วัดอะไรไม่ได้ · rulebook §7 เตือนไว้เอง) · พาธใบงานที่เขียนใน **แบ็กทิก** ไม่ใช่รูปลิงก์
# markdown คือสิ่งที่ชั้นที่หนึ่ง *ยังไม่* ปิด (การ์ด check-links-gate จดตัวเลขไว้เอง) ⇒ กวาดพลาด
# ที่นั่นเงียบสนิทต่อ **เกตที่เครื่องมือนี้เรียก** · ปล่อยให้จบ 0 = ความล้มเหลวที่ใส่หน้ากากความสำเร็จ
# ⚠️ **ไม่ใช่ "ทั้งรีโปไม่มีใครเฝ้าพาธในแบ็กทิก"** — `check-card-paths.sh` เฝ้าคลาสนั้น (ยกเว้นไฟล์
# ที่ *อยู่ใน* `tasks/**` ไม่ใช่พาธที่ *ชี้ไป* หา) แต่ `task-move.sh` ไม่ได้เรียกมัน ⇒ เหตุผลที่ถูกคือ
# rc ของเครื่องมือต้องไม่อ้างความสำเร็จแทนเกตที่มันไม่ได้รัน
new_sandbox
printf '# บันทึกภายใน\n\nอ้างใบ `%s` ในแบ็กทิก ไม่ใช่ลิงก์\n' "$T/todo/$A" > "$SANDBOX/notes.md"
git -C "$SANDBOX" add -Af >/dev/null
chmod 444 "$SANDBOX/notes.md"
ad_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"; ad_code=$?
check "เกตเขียวจริงในฉากนี้ (ถ้าเกตแดง แถวนี้จะวัดตัวบังคับ exit ไม่ได้)" \
  "$(grep -q 'check-links: OK' <<<"$ad_out" && echo 1 || echo 0)" \
  "output: $ad_out"
check "แต่ ⛔ เรียกชื่อไฟล์นั้น **และ exit ต้องไม่เป็นศูนย์** ทั้งที่เกตเขียว" \
  "$([ "$ad_code" -ne 0 ] && grep -q 'กวาดไม่สำเร็จ' <<<"$ad_out" \
     && grep -q 'notes.md' <<<"$ad_out" && echo 1 || echo 0)" \
  "exit=$ad_code · output: $ad_out"
chmod 644 "$SANDBOX/notes.md"

echo "selftest: ความไว 18 — ถอดตัวบังคับ exit ของกอง ⛔ ⇒ AD ต้องจบ 0 ทั้งที่กวาดไม่ครบ (ใบ 284)"
new_sandbox
printf '# บันทึกภายใน\n\nอ้างใบ `%s` ในแบ็กทิก ไม่ใช่ลิงก์\n' "$T/todo/$A" > "$SANDBOX/notes.md"
git -C "$SANDBOX" add -Af >/dev/null
chmod 444 "$SANDBOX/notes.md"
# ⚠️ ตัวคั่นของ `sed` ต้องไม่ใช่ `#` — บรรทัดที่จะถอดมี `${#failed[@]}` อยู่ในตัวเอง (วัดแล้ว:
# ใช้ `#` แล้วได้ `unknown option to s` แล้วแถวนี้ก็รายงานตามสัญญาว่า "sed ไม่ตรงกับซอร์สจริง")
strip scripts/task-move.sh 's|^if .*gate_rc=1; fi$|:|' "ตัวบังคับ exit ของกอง ⛔"
s18_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"; s18_code=$?
check "ไม่มีตัวบังคับ ⇒ จบ 0 ทั้งที่เพิ่งพิมพ์ว่ากวาดไม่สำเร็จ (ล้มเหลวในหน้ากากความสำเร็จ)" \
  "$([ "$s18_code" -eq 0 ] && grep -q 'กวาดไม่สำเร็จ' <<<"$s18_out" && echo 1 || echo 0)" \
  "exit=$s18_code · output: $s18_out"
chmod 644 "$SANDBOX/notes.md"

echo "selftest: AE — \`cat\` ที่ล้ม **หลัง** \`>\` ตัดไฟล์ทิ้งแล้ว: ⛔ ต้องเรียกชื่อครั้งเดียว ไม่ใช่สองกอง (ใบ 284)"
# 🔑 **ฉากนี้คือทิศที่ AB/AD ให้ไม่ได้** — ที่นั่น `chmod 444` ทำให้ `>` **เปิดไม่ผ่านตั้งแต่ต้น**
# ⇒ ไฟล์ไม่เคยถูกแตะ ⇒ ไม่โผล่ใน `git diff` ⇒ ไม่เคยเดินไปถึงลูปทานท้ายรอบเลย ⇒ บรรทัดที่เอา
# `failed` เข้าบัญชี `known` **ถอดออกแล้วทุกเคสยังเขียว** = การแก้ที่ไม่มีอะไรเฝ้า (รอบรีวิวทักไว้)
# · ทางเดียวที่ทำให้ทิศนี้เกิดจริงคือให้ `>` เปิด*สำเร็จ* แล้ว `cat` ล้มทีหลัง (ดิสก์เต็ม/IO error)
# ⇒ shim ของ `cat` ใน PATH ของ **รอบนั้นรอบเดียว** (ไม่ export ออกนอกคำสั่ง ⇒ `strip`/`check`
# ของเทสเองยังใช้ `cat` จริง) · `check-links.sh` ไม่ได้เรียก `cat` สักจุด (วัดแล้ว) ⇒ shim ไม่ไป
# เปลี่ยนคำตัดสินของเกต · เลือก `README.md` ด้วยเหตุผลเดียวกับ AB: มันมาก่อนไฟล์อื่นในลำดับกวาด
# shim ตัวเดียว **บ้านเดียว** ใช้ทั้ง AE และความไว 19 — ก๊อปสองที่เมื่อไรก็แก้ที่เดียวไม่พอ
# (§6 rule 1) และความไว 19 จะกลายเป็นแถวที่วัดคนละ shim กับเคสที่มันอ้างว่าเฝ้า
failing_cat_shim() {
  mkdir -p "$SANDBOX/bin"
  # ชื่อ temp ของ task-move คือพาธที่ `/` ถูกแทนด้วย `_` ⇒ ของ `README.md` คือ `<work>/README.md`
  cat > "$SANDBOX/bin/cat" <<'SHIM'
#!/usr/bin/env bash
# เขียนไฟล์ไม่ครบแล้วคืน 1 — จำลอง "ดิสก์เต็ม/IO error กลางการเขียน" ซึ่งเป็นทางเดียวที่ `>`
# เปิดสำเร็จ (ตัดไฟล์ทิ้งแล้ว) แต่ `cat` ล้มทีหลัง · ไฟล์อื่นส่งต่อให้ `cat` จริงทั้งหมด
f=""
for a in "$@"; do case "$a" in --) ;; *) f="$a" ;; esac; done
case "$f" in
  */README.md) head -c 1 -- "$f"; echo "cat: จำลอง I/O error กลางการเขียน" >&2; exit 1 ;;
esac
exec /bin/cat "$@"
SHIM
  chmod 755 "$SANDBOX/bin/cat"
}

new_sandbox
failing_cat_shim
ae_out="$(cd "$SANDBOX" && PATH="$PWD/bin:$PATH" bash scripts/task-move.sh 900 2>&1)"; ae_code=$?
# ข้อแรกคือ **ตัวพิสูจน์ว่าฉากเกิดจริง** — ถ้าไฟล์ไม่ถูกตัด สามข้อที่เหลือวัดอะไรไม่ได้เลย
check "AE: ไฟล์ถูก \`>\` ตัดทิ้งจริงก่อน \`cat\` ล้ม (ทิศที่ AB ไม่มี)" \
  "$([ "$(wc -c < "$SANDBOX/README.md" | tr -d ' ')" -lt 10 ] && echo 1 || echo 0)" \
  "README.md เหลือ $(wc -c < "$SANDBOX/README.md" | tr -d ' ') ไบต์ (คาดว่าถูกตัดเหลือไม่กี่ไบต์)"
check "AE: ⛔ เรียกชื่อไฟล์นั้นพร้อมบอกว่า **เนื้ออาจหายไปแล้ว** (ไม่ใช่ 'ไฟล์ไม่ถูกแตะ')" \
  "$(grep -q 'กวาดไม่สำเร็จ' <<<"$ae_out" && grep -q 'README.md' <<<"$ae_out" \
     && grep -q 'ตัดทิ้งไปแล้วบางส่วน' <<<"$ae_out" && echo 1 || echo 0)" \
  "output: $ae_out"
# 🔴 คือกองของ "เครื่องมือไม่รู้ว่าตัวเองแก้" ⇒ ไฟล์ที่ ⛔ เพิ่งอธิบายสาเหตุจริงไปแล้วต้องไม่มาซ้ำ
# ที่นี่ด้วยสาเหตุที่ผิด — สองข้อความสำหรับสาเหตุเดียวคือความสับสนที่ต้องแก้ด้วยการอ่านโค้ด
check "AE: และ **ไม่ถูกเรียกชื่อซ้ำ** ในกอง 🔴 ด้วยสาเหตุที่ผิด" \
  "$(grep -qE '^ +! README\.md$' <<<"$ae_out" && echo 0 || echo 1)" \
  "output: $ae_out"
check "AE: ไฟล์ที่เหลือยังถูกกวาดครบ และ exit ไม่เป็นศูนย์" \
  "$(grep -qF "](done/$A)" "$SANDBOX/$T/HANDOFF-selftest.md" \
     && grep -qF "$T/done/$A" "$SANDBOX/lib/demo.ts" \
     && [ "$ae_code" -ne 0 ] && echo 1 || echo 0)" \
  "exit=$ae_code · HANDOFF: $(cat "$SANDBOX/$T/HANDOFF-selftest.md")"

echo "selftest: ความไว 19 — ถอด \`failed\` ออกจากบัญชี \`known\` ⇒ AE ข้อสามต้องพลิก (ใบ 284)"
new_sandbox
failing_cat_shim
strip scripts/task-move.sh 's|[$]{failed\[@\]+"[$]{failed\[@\]}"} ||' "ชื่อกอง failed ในบัญชี known"
s19_out="$(cd "$SANDBOX" && PATH="$PWD/bin:$PATH" bash scripts/task-move.sh 900 2>&1)"
check "ไม่นับ ⇒ ไฟล์เดียวกันถูกเรียกชื่อสองรอบ สาเหตุคนละเรื่อง (⛔ จริง · 🔴 ผิด)" \
  "$(grep -q 'กวาดไม่สำเร็จ' <<<"$s19_out" && grep -qE '^ +! README\.md$' <<<"$s19_out" \
     && echo 1 || echo 0)" \
  "output: $s19_out"

echo "selftest: AF — การเก็บกวาดท้ายรอบต้องไม่ฆ่ารอบเสียเอง (ใบ 284)"
# 🔑 `rmdir "$work" … || rm -rf "$work"` คือ `||` list ที่คำสั่ง **ตัวท้าย** ยังถูก `set -e` กินอยู่
# ⇒ ลบไม่สำเร็จเมื่อไร สคริปต์ตาย **ก่อน** บล็อกรายงาน staged/left/🔴/⛔ และก่อนเกต = กลืนรายงาน
# ความล้มเหลวที่ใบนี้ทั้งใบมีไว้พิมพ์ · เป็นบั๊กเดิมของใบ 284 ที่กลับมาทางไฟล์ข้างเคียง
# · ฉากต้องให้ **ทั้ง `rmdir` และ `rm -rf` ล้ม** — ล้มตัวเดียวจะตกไปตัวที่สองซึ่งสำเร็จ แล้วแถวนี้
#   จะกลายเป็น "จับคู่ยามกับฉากที่ยามไม่ได้ทำงาน" (§7 เตือนไว้เอง) · `check-links.sh` ไม่เรียก
#   `rm`/`rmdir` สักจุด (วัดแล้ว) ⇒ shim ไม่ไปเปลี่ยนคำตัดสินของเกต
new_sandbox
cleanup_fail_shim() {
  mkdir -p "$SANDBOX/bin"
  printf '%s\n' '#!/usr/bin/env bash' 'echo "rmdir: จำลองลบไม่สำเร็จ" >&2' 'exit 1' > "$SANDBOX/bin/rmdir"
  cat > "$SANDBOX/bin/rm" <<'SHIM'
#!/usr/bin/env bash
# ล้มเฉพาะตอนลบไดเรกทอรีงานของ task-move — `rm -f -- "$tmp"` ใน edit() ส่งต่อให้ของจริงตามปกติ
for a in "$@"; do
  case "$a" in *task-move-*) echo "rm: จำลองลบไม่สำเร็จ" >&2; exit 1 ;; esac
done
exec /bin/rm "$@"
SHIM
  chmod 755 "$SANDBOX/bin/rmdir" "$SANDBOX/bin/rm"
}
cleanup_fail_shim
af_out="$(cd "$SANDBOX" && PATH="$PWD/bin:$PATH" bash scripts/task-move.sh 900 2>&1)"
check "AF: ลบ \$work ไม่สำเร็จ ⇒ รอบยังเดินไปถึง **บล็อกรายงานและเกต** (ไม่ตายเงียบก่อนหน้านั้น)" \
  "$(grep -q 'task-move: กวาด \.md' <<<"$af_out" && grep -q 'git add ให้แล้ว' <<<"$af_out" \
     && grep -q 'check-links:' <<<"$af_out" && echo 1 || echo 0)" \
  "output: $af_out"

echo "selftest: ความไว 20 — ถอด \`|| :\` ท้ายบรรทัดเก็บกวาด ⇒ AF ต้องพลิกเป็น 'ตายก่อนรายงาน' (ใบ 284)"
new_sandbox
cleanup_fail_shim
strip scripts/task-move.sh 's#^\(rmdir .*\) || :$#\1#' "\`|| :\` ท้ายบรรทัดเก็บกวาด"
s20_out="$(cd "$SANDBOX" && PATH="$PWD/bin:$PATH" bash scripts/task-move.sh 900 2>&1)"
check "ไม่มี \`|| :\` ⇒ set -e ฆ่ารอบตรงนั้น: ไม่มีบรรทัดกวาด ไม่มีรายงาน ไม่มีเกต" \
  "$(grep -q 'task-move: กวาด \.md' <<<"$s20_out" && echo 0 \
     || { grep -q 'check-links:' <<<"$s20_out" && echo 0 || echo 1; })" \
  "output: $s20_out"

echo "selftest: AG — \`.scratch/\` ที่เขียนไม่ได้ ต้องหยุด **ก่อน** ใบถูกย้าย ไม่ใช่หลัง (ใบ 284)"
# 🔑 `mkdir -p "$work"` อยู่ใต้ `set -e` เหมือนกันหมด ⇒ คำถามเดียวคือ **มันอยู่ก่อนหรือหลัง `git mv`**
# · หลัง = รอบตายทันทีที่ใบเพิ่งถูกย้าย โดยมีแต่ error ของ `mkdir` เปล่า ๆ ไม่มีกอง ⛔ ไม่มีใครเก็บ
#   `$work` = ทรีที่ "ใบย้ายแล้ว ลิงก์ยังไม่ถูกแตะสักเส้น" ซึ่งคืออาการของใบนี้เป๊ะ ๆ ผ่านไฟล์ข้างเคียง
# · ก่อน = ล้มแล้ว **ทรีเหมือนเดิมทุกประการ** ⇒ คนที่มาเจอแค่ `chmod u+w .scratch` แล้วสั่งใหม่
# ⚠️ ฉากนี้พึ่ง `chmod` ⇒ ใต้ root มันจะไม่ล้ม และข้อแรกจะ **FAIL ดัง ๆ** (ไม่ใช่ผ่านแบบว่างเปล่า)
new_sandbox
mkdir -p "$SANDBOX/.scratch"
chmod 500 "$SANDBOX/.scratch"
ag_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"; ag_code=$?
check "AG: รอบล้มจริง (ถ้าไม่ล้ม ข้อถัดไปวัดอะไรไม่ได้ — เช่นตอนรันด้วย root)" \
  "$([ "$ag_code" -ne 0 ] && echo 1 || echo 0)" \
  "exit=$ag_code · output: $ag_out (รันด้วย uid=$(id -u)?)"
check "AG: และ **ใบยังไม่ถูกย้าย** — ทรีเหมือนเดิม ไม่ใช่ย้ายแล้วค้างครึ่งทาง" \
  "$([ -e "$SANDBOX/$T/todo/$A" ] && [ ! -e "$SANDBOX/$T/done/$A" ] \
     && grep -qF "$T/todo/$A" "$SANDBOX/lib/demo.ts" && echo 1 || echo 0)" \
  "ใบอยู่ที่: $(ls "$SANDBOX/$T"/*/ | tr '\n' ' ') · demo.ts: $(cat "$SANDBOX/lib/demo.ts")"
chmod 700 "$SANDBOX/.scratch"

echo "selftest: ความไว 21 — ย้าย \`mkdir -p \$work\` กลับไปไว้หลัง \`git mv\` ⇒ AG ข้อสองต้องพลิก (ใบ 284)"
new_sandbox
mkdir -p "$SANDBOX/.scratch"
chmod 500 "$SANDBOX/.scratch"
strip scripts/task-move.sh '/^mkdir -p "\$work"$/d; /^git mv /a mkdir -p "$work"' \
  "ลำดับ \`mkdir \$work\` ก่อน \`git mv\`"
s21_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"
check "mkdir ล้มหลัง git mv ⇒ ใบถูกย้ายไปแล้วแต่ลิงก์ไม่ถูกแตะเลย = ทรีที่แย่กว่าตอนเริ่ม" \
  "$([ -e "$SANDBOX/$T/done/$A" ] && grep -qF "$T/todo/$A" "$SANDBOX/lib/demo.ts" \
     && echo 1 || echo 0)" \
  "output: $s21_out · demo.ts: $(cat "$SANDBOX/lib/demo.ts")"
chmod 700 "$SANDBOX/.scratch"
