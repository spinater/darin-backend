#!/usr/bin/env bash
# เคสของ **ตัวกวาด `scripts/task-move.sh`** (H · I · K–O) — แตกออกมาจาก `scripts/tests/check-links-selftest.sh` ที่ใบ 276 (§4 เพดาน 500)
# ⚠️ ไฟล์นี้ถูก **`.` (source)** จากไฟล์เข้า ไม่ใช่รันเอง ⇒ ใช้ตัวแปร/ฟังก์ชันของไฟล์นั้นร่วมกัน
# (ตัวนับ `pass`/`fail` · `new_sandbox` · `expect` · `check` · `strip` และ trap ต้องเป็นชุดเดียว
#  — รูปเดียวกับ `scripts/tests/check-card-paths-selftest/` และ `check-counter-test-selftest/`)

echo "selftest: H — task-move.sh กวาดพอยน์เตอร์ในไฟล์โค้ดด้วย"
new_sandbox
mv_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"; mv_code=$?
check "task-move จบด้วยเกตเขียว" \
  "$([ "$mv_code" -eq 0 ] && grep -q 'check-links: OK' <<<"$mv_out" && echo 1 || echo 0)" \
  "exit=$mv_code · output: $mv_out"
check "พอยน์เตอร์ในไฟล์โค้ดตามใบไปด้วย" \
  "$(grep -qF "$T/done/$A" "$SANDBOX/lib/demo.ts" && echo 1 || echo 0)" \
  "demo.ts ยังชี้บ้านเก่า: $(cat "$SANDBOX/lib/demo.ts")"
# ── **มันบอกด้วยว่ากวาดคลังไปกี่ใบ** (ใบ 284 ข้อ 1) — ตัวคัดที่พังเงียบคือรอบที่หน้าตาปกติ
# ทุกประการแต่ไม่ได้แตะอะไรเลย · ⚠️ **เลขที่คาดต้องคำนวณจากแซนด์บ็อกซ์ ห้ามพิมพ์ค่าคงที่** —
# ค่าคงที่จะเน่าเงียบวันที่ `new_sandbox` มีไฟล์เพิ่ม แล้วแถวนี้ก็กลายเป็นแถวที่ต้องแก้ตามโดย
# ไม่ได้วัดอะไร (บทเรียนเดียวกับ pin ของ junit ที่ §7 สั่งให้อ่านเลขจากไฟล์ข้อมูล ไม่ใช่จากร้อยแก้ว)
# 🔴 **`-z` + `read -r -d ''` ทั้งสองจุด (ใบ 314)** — ไม่ใช่พิธีกรรม: ที่นี่คือ *ตัวคาดหวัง* ของ
# assertion ⇒ ถ้ามันนับคนละแบบกับตัวกวาด แถวนี้จะแดง/เขียวด้วยเหตุที่ไม่ใช่เรื่องที่มันเฝ้า
# · และลูปนี้จงใจ **ซ้ำรูปลูปของตัวกวาดเป๊ะ ๆ** รวมทั้งการข้าม `.scratch/` ⇒ เลขที่คาดมาจาก
# วิธีนับเดียวกัน ไม่ใช่จากวิธีที่ *น่าจะ* เท่ากัน
exp_md=0
while IFS= read -r -d '' f; do
  case "$f" in .scratch/*) continue ;; esac
  exp_md=$((exp_md + 1))
done < <(cd "$SANDBOX" && git ls-files -c -o --exclude-standard -z '*.md')
exp_code=0
while IFS= read -r -d '' f; do
  exp_code=$((exp_code + 1))
done < <(cd "$SANDBOX" && git grep -z --untracked -I --no-color -l -F "$T/done/$A" \
  -- ':!*.md' ':!prisma/migrations/*' || true)
got_md="$(sed -nE 's/^task-move: กวาด \.md ([0-9]+) ใบ · ไฟล์โค้ด ([0-9]+) ใบ$/\1/p' <<<"$mv_out")"
got_code="$(sed -nE 's/^task-move: กวาด \.md ([0-9]+) ใบ · ไฟล์โค้ด ([0-9]+) ใบ$/\2/p' <<<"$mv_out")"
check "พิมพ์ขนาดคลังที่กวาดจริงทั้งสองลูป และตรงกับที่นับจากแซนด์บ็อกซ์" \
  "$([ -n "$got_md" ] && [ "$got_md" = "$exp_md" ] && [ "$got_code" = "$exp_code" ] \
     && [ "$exp_md" -gt 0 ] && [ "$exp_code" -gt 0 ] && echo 1 || echo 0)" \
  "พิมพ์ .md=$got_md code=$got_code · นับจากแซนด์บ็อกซ์ได้ .md=$exp_md code=$exp_code · output: $mv_out"

echo "selftest: I — ความไวของ H: ถอด glob ไฟล์โค้ดออกจาก task-move.sh แล้ว H ต้องแดง"
new_sandbox
sed -i.bak 's#^  edit "$f" -e "s\#tasks/\$from/\$esc\##  : #' \
  "$SANDBOX/scripts/task-move.sh" && rm -f "$SANDBOX/scripts/task-move.sh.bak"
check "แก้ task-move.sh ในแซนด์บ็อกซ์ได้จริง" \
  "$(grep -qF '  : ' "$SANDBOX/scripts/task-move.sh" && echo 1 || echo 0)" \
  "sed ไม่ตรงกับของจริง ⇒ เคส I วัดอะไรไม่ได้เลย (แก้ pattern ให้ตรงกับ task-move.sh)"
mv_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"; mv_code=$?
check "ถอด glob แล้วเกตของ task-move ต้องแดง" \
  "$([ "$mv_code" -ne 0 ] && echo 1 || echo 0)" \
  "ยังเขียวทั้งที่ไม่ได้กวาดไฟล์โค้ด ⇒ เคส H ไม่ได้ตรึงอะไร"


echo "selftest: ความไว 22 — ถอดตัวนับคลัง ⇒ ข้อ 'กวาดไปกี่ใบ' ของเคส H ต้องพลิก (ใบ 284)"
new_sandbox
strip scripts/task-move.sh 's#^  swept_md=.*#  :#' "ตัวนับคลัง .md"
s22_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"
s22_md="$(sed -nE 's/^task-move: กวาด \.md ([0-9]+) ใบ · ไฟล์โค้ด ([0-9]+) ใบ$/\1/p' <<<"$s22_out")"
check "ไม่นับ ⇒ พิมพ์ 0 ทั้งที่กวาดจริงหลายใบ (เลขที่โกหกแทนเลขที่หายไป)" \
  "$([ "$s22_md" = "0" ] && echo 1 || echo 0)" \
  "พิมพ์ .md=$s22_md · output: $s22_out"

echo "selftest: K — task-move.sh ต้องไม่กิน exec bit ของไฟล์ที่มันแก้"
new_sandbox
(cd "$SANDBOX" && bash scripts/task-move.sh 900 >/dev/null 2>&1)
check "พอยน์เตอร์ใน .sh ตามใบไปด้วย" \
  "$(grep -qF "$T/done/$A" "$SANDBOX/scripts/tool.sh" && echo 1 || echo 0)" \
  "tool.sh ยังชี้บ้านเก่า"
check "exec bit ของ .sh ที่ถูกแก้ยังอยู่" \
  "$([ -x "$SANDBOX/scripts/tool.sh" ] && echo 1 || echo 0)" \
  "mode กลายเป็น $(ls -l "$SANDBOX/scripts/tool.sh" | cut -c1-10) — ตัวเขียนกลับใช้ mv แทน cat อีกแล้ว"

echo "selftest: L — task-move.sh --human ย้ายเข้าบ้านที่สาม แล้วพอยน์เตอร์ตามไปครบ"
new_sandbox
mv_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 --human 2>&1)"; mv_code=$?
check "task-move --human จบด้วยเกตเขียว" \
  "$([ "$mv_code" -eq 0 ] && grep -q 'check-links: OK' <<<"$mv_out" && echo 1 || echo 0)" \
  "exit=$mv_code · output: $mv_out"
check "ใบไปอยู่บ้านที่สามจริง" \
  "$([ -e "$SANDBOX/$T/todo-human/$A" ] && [ ! -e "$SANDBOX/$T/todo/$A" ] && echo 1 || echo 0)" \
  "ใบไม่ได้อยู่ $T/todo-human/ (หรือยังค้างที่ $T/todo/ ⇒ ใบเดียวสองบ้าน)"
check "พอยน์เตอร์ในไฟล์โค้ดตามไปบ้านที่สาม" \
  "$(grep -qF "$T/todo-human/$A" "$SANDBOX/lib/demo.ts" && echo 1 || echo 0)" \
  "demo.ts ยังชี้บ้านเก่า: $(cat "$SANDBOX/lib/demo.ts")"
check "ลิงก์ markdown ตามไปบ้านที่สาม" \
  "$(grep -qF "$T/todo-human/$A" "$SANDBOX/README.md" && echo 1 || echo 0)" \
  "README.md ยังชี้บ้านเก่า: $(cat "$SANDBOX/README.md")"

echo "selftest: M — ไป–กลับบ้านที่สามแล้วทรีต้องเหมือนเดิมเป๊ะ (รูปบัญญัติของลิงก์)"
new_sandbox
# 🔑 **ใบเพื่อนบ้านที่ลิงก์กันเองแบบเปล่า ๆ — วัดแล้วว่าถ้าไม่มี เคสนี้ตรึงอะไรไม่ได้เลย**
# แซนด์บ็อกซ์มาตรฐานไม่มีลิงก์ระหว่างใบงานสองใบสักเส้น ⇒ ตัวยุบรูปบัญญัติไม่มีอะไรให้ยุบ
# ⇒ ถอดมันออกทั้งก้อนแล้ว M **ยังเขียว** (วัดจริง ไม่ใช่คาดเดา) ซึ่งคือกับดัก "จับคู่ยามกับ
# ฉากที่ยามไม่ได้ทำงาน" ที่ rulebook §7 เตือนไว้เอง · สองเส้นนี้จับคู่กับสองคำสั่งของตัวยุบ
# คนละคำสั่ง: ขาเข้า (ลูป `for f in tasks/$to/*.md`) กับ ขาออกของใบที่เพิ่งย้าย (`edit "$moved"`)
printf '# ใบสมมติ ค\n\n- status: todo\n\n[ใบ ก](%s)\n' "$A" > "$SANDBOX/$T/todo/$C"
printf '# ใบสมมติ ก\n\n- status: todo\n\n[ใบ ค](%s)\n' "$C" > "$SANDBOX/$T/todo/$A"
# `git write-tree` = แฮชของทั้งทรี **รวม mode** ⇒ แรงกว่า `diff` รายไฟล์ที่ต้องเลือกเองว่าดูไฟล์ไหน
tree_hash() { git -C "$SANDBOX" add -Af >/dev/null 2>&1; git -C "$SANDBOX" write-tree; }
before_m="$(tree_hash)"
(cd "$SANDBOX" && bash scripts/task-move.sh 900 --human >/dev/null 2>&1)
check "ขาไป: ใบอยู่บ้านที่สาม และลิงก์เปล่าของเพื่อนบ้านถูกเขียนใหม่จริง" \
  "$([ -e "$SANDBOX/$T/todo-human/$A" ] \
     && grep -qF "](../todo-human/$A)" "$SANDBOX/$T/todo/$C" \
     && grep -qF "](../todo/$C)" "$SANDBOX/$T/todo-human/$A" && echo 1 || echo 0)" \
  "ขาไปไม่ได้เกิดขึ้นจริง ⇒ ครึ่งหลังของ M เทียบแฮชของทรีที่ไม่เคยถูกแตะ = เขียวโดยเปล่าประโยชน์"
(cd "$SANDBOX" && bash scripts/task-move.sh 900 --answered >/dev/null 2>&1)
after_m="$(tree_hash)"
check "ขากลับ: ทรีแฮชเท่าเดิม (ไม่ทิ้ง diff ไว้)" \
  "$([ -n "$before_m" ] && [ "$before_m" = "$after_m" ] && echo 1 || echo 0)" \
  "ก่อน=$before_m หลัง=$after_m · ต่างกันที่: $(git -C "$SANDBOX" diff --stat "$before_m" "$after_m" 2>&1 | tail -5)"

echo "selftest: N — แฟล็กที่พิมพ์ผิดต้องไม่ย้ายใบ (เดิมกลืนเงียบแล้วส่งเข้า done/)"
new_sandbox
out_n="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 --humen 2>&1)"; n_code=$?
check "แฟล็กที่ไม่รู้จัก = exit 2 พร้อมบอกวิธีใช้" \
  "$([ "$n_code" -eq 2 ] && grep -q 'ใช้: bash scripts/task-move.sh' <<<"$out_n" && echo 1 || echo 0)" \
  "exit=$n_code · output: $out_n"
check "และใบต้องไม่ขยับไปไหนเลย" \
  "$([ -e "$SANDBOX/$T/todo/$A" ] && [ ! -e "$SANDBOX/$T/done/$A" ] && echo 1 || echo 0)" \
  "ใบถูกย้ายทั้งที่แฟล็กพิมพ์ผิด — นี่คือกับดักที่ใบ 231 เปิดมาปิด"

echo "selftest: O — รูปที่สี่: ไฟล์ใน tasks/ เองที่ลิงก์ลงบ้านแบบ todo/NNN-slug.md"
new_sandbox
o_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 --human 2>&1)"; o_code=$?
check "ย้ายใบแล้วลิงก์รูปที่สี่ตามไปด้วย + เกตเขียว" \
  "$([ "$o_code" -eq 0 ] && grep -qF "](todo-human/$A)" "$SANDBOX/$T/HANDOFF-selftest.md" && echo 1 || echo 0)" \
  "exit=$o_code · HANDOFF: $(cat "$SANDBOX/$T/HANDOFF-selftest.md") · output: $o_out"
(cd "$SANDBOX" && bash scripts/task-move.sh 900 --answered >/dev/null 2>&1)
check "ขากลับก็กวาดรูปที่สี่เหมือนกัน" \
  "$(grep -qF "](todo/$A)" "$SANDBOX/$T/HANDOFF-selftest.md" && echo 1 || echo 0)" \
  "HANDOFF ค้างที่บ้านกลาง: $(cat "$SANDBOX/$T/HANDOFF-selftest.md")"


echo "selftest: Y — task-move ต้อง git add สิ่งที่มันแก้ ⇒ **คอมมิตที่ได้ต้องเขียวที่ HEAD** (ใบ 276)"
new_sandbox
y_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"; y_code=$?
check "จบเขียว และรายงานว่า git add ให้กี่ไฟล์ (ห้ามแตะ index ของคนแบบเงียบ ๆ)" \
  "$([ "$y_code" -eq 0 ] && grep -q 'git add ให้แล้ว' <<<"$y_out" && echo 1 || echo 0)" \
  "exit=$y_code · output: $y_out"
check "ไม่มีไฟล์ไหนค้าง unstaged เลย" \
  "$(git -C "$SANDBOX" diff --quiet && echo 1 || echo 0)" \
  "ยังค้าง: $(git -C "$SANDBOX" diff -z --name-only | tr '\0' ' ')"
# 🔑 ข้อชี้ขาด — **ไม่ใช่** "working tree เขียว" เพราะอาการของบั๊กคือเขียวตรงนั้นพอดี
make_head_tree
y_head="$(cd "$HEAD_TREE" && bash scripts/check-links.sh 2>&1)"; y_h=$?
check "คอมมิตที่ได้ (index อย่างเดียว) เขียวที่ HEAD ด้วย ไม่ใช่แค่บนเครื่องคนย้าย" \
  "$([ "$y_h" -eq 0 ] && grep -q 'check-links: OK' <<<"$y_head" && echo 1 || echo 0)" \
  "HEAD แดง: $y_head"
rm -rf "$HEAD_TREE"

echo "selftest: Z — ไฟล์ที่มีงานค้างของคนอยู่ก่อน: ห้าม stage ให้ แต่ต้องเรียกชื่อ (ใบ 276)"
new_sandbox
# สายที่มีงานค้างในไฟล์เดียวกับที่ตัวกวาดต้องแตะ = กรณี **ปกติ** ของรีโปนี้ ไม่ใช่กรณีพิเศษ
printf '// งานค้างของสายอื่นที่ยังไม่ได้ add\n' >> "$SANDBOX/lib/demo.ts"
z_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"; z_code=$?
check "ยังกวาดลิงก์ในไฟล์นั้นตามปกติ (ไม่ใช่ข้ามไฟล์ทิ้ง)" \
  "$(grep -qF "$T/done/$A" "$SANDBOX/lib/demo.ts" && echo 1 || echo 0)" \
  "demo.ts ไม่ถูกกวาด: $(cat "$SANDBOX/lib/demo.ts")"
check "แต่ต้องเรียกชื่อไฟล์นั้นออกมาว่าไม่ได้ stage ให้" \
  "$(grep -q 'ไม่ได้ stage ให้' <<<"$z_out" && grep -q 'lib/demo.ts' <<<"$z_out" && echo 1 || echo 0)" \
  "exit=$z_code · output: $z_out"
check "งานค้างของคนต้องไม่ถูกลากเข้า index (เหตุผลของเส้นแบ่งทั้งเส้น)" \
  "$(git -C "$SANDBOX" show ":lib/demo.ts" 2>/dev/null | grep -q 'งานค้างของสายอื่น' && echo 0 || echo 1)" \
  "index มีงานค้างของคนติดไปด้วย: $(git -C "$SANDBOX" show ":lib/demo.ts" 2>/dev/null)"

echo "selftest: ความไว 10 — ถอด \`git add\` ออกจาก edit() ⇒ Y ข้อที่สามต้องแดง (ใบ 276)"
new_sandbox
strip scripts/task-move.sh 's#&& git add -- "$f" 2>/dev/null#\&\& false#' "git add ของ edit()"
(cd "$SANDBOX" && bash scripts/task-move.sh 900 >/dev/null 2>&1)
make_head_tree
out_s10="$(cd "$HEAD_TREE" && bash scripts/check-links.sh 2>&1)"; s10=$?
# ⚠️ **ข้อความประจำเคส ไม่ใช่ exit code เปล่า ๆ** — ทรีว่างก็ "ไม่เป็นศูนย์" ได้ (127) และ
# ความแดงจากบรรทัด `- status:` ที่ไม่ถูก stage ก็ "ไม่เป็นศูนย์" เหมือนกัน คนละสาเหตุคนละทางแก้
# ⇒ ต้องเป็นชั้นที่สาม (พอยน์เตอร์ในไฟล์โค้ดที่ไม่ถูก stage) ซึ่งมีแต่การไม่ `git add` ที่ทำให้เกิด
check "ไม่ stage ให้ ⇒ HEAD แดง **ด้วยพอยน์เตอร์ในไฟล์โค้ด** ทั้งที่ working tree เขียว" \
  "$([ "$s10" -ne 0 ] && grep -q 'พาธใบงานชี้ผิดบ้าน' <<<"$out_s10" && echo 1 || echo 0)" \
  "exit=$s10 · output: $out_s10"
rm -rf "$HEAD_TREE"

echo "selftest: ความไว 11 — ถอดเส้นแบ่ง \`stageable\` ⇒ Z ข้อที่สามต้องพลิก (ใบ 276)"
new_sandbox
printf '// งานค้างของสายอื่นที่ยังไม่ได้ add\n' >> "$SANDBOX/lib/demo.ts"
strip scripts/task-move.sh 's#^  if stageable "$f"; then safe=1; fi#  safe=1#' "เส้นแบ่ง stageable"
(cd "$SANDBOX" && bash scripts/task-move.sh 900 >/dev/null 2>&1)
check "stage ทุกไฟล์โดยไม่ดู ⇒ งานค้างของคนติดเข้า index ไปด้วย" \
  "$(git -C "$SANDBOX" show ":lib/demo.ts" 2>/dev/null | grep -q 'งานค้างของสายอื่น' && echo 1 || echo 0)" \
  "index: $(git -C "$SANDBOX" show ":lib/demo.ts" 2>/dev/null)"

echo "selftest: AA — เขียนทะลุ symlink: ของจริงเปลี่ยนแต่ stage ไม่ได้ ⇒ ต้อง **เรียกชื่อ** (ใบ 276)"
# ⚠️ ตัวแทนอยู่ในเคสนี้ ไม่ใช่ใน `new_sandbox` **โดยตั้งใจ** (ต่างจากรูปที่สี่ของใบ 232):
# ไฟล์ปลายลิงก์ถูกเขียนแล้ว stage ไม่ได้ **โดยชอบ** ⇒ ถ้าใส่ไว้ในแซนด์บ็อกซ์มาตรฐาน
# ข้อ "ไม่มีไฟล์ไหนค้าง unstaged เลย" ของเคส Y จะเป็นเท็จตลอดกาล และ Y คือเคสของสำมะโนจริง
new_sandbox
mkdir -p "$SANDBOX/.docs/billing/maintenance"
# พาธแบบรูปที่ 1 ในแบ็กทิก ไม่ใช่ลิงก์ markdown — ตัวกวาดแก้ให้เหมือนกัน แต่ชั้นที่หนึ่งไม่ต้อง
# ตามไปแก้พาธสัมพัทธ์ที่อ่านผ่านสองตำแหน่งแล้วให้ผลต่างกัน (นั่นเป็นคนละเรื่องกับที่เคสนี้วัด)
printf '# MA\n\nดูใบ `%s`\n' "$T/todo/$A" > "$SANDBOX/.docs/billing/maintenance/MA.md"
ln -s maintenance/MA.md "$SANDBOX/.docs/billing/MA.md"
git -C "$SANDBOX" add -Af >/dev/null
aa_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"; aa_code=$?
check "ของจริงปลายลิงก์ถูกกวาดจริง (sed อ่านทะลุ symlink)" \
  "$([ "$aa_code" -eq 0 ] && grep -qF "$T/done/$A" "$SANDBOX/.docs/billing/maintenance/MA.md" && echo 1 || echo 0)" \
  "exit=$aa_code · MA: $(cat "$SANDBOX/.docs/billing/maintenance/MA.md")"
# ⚠️ **ห้ามใช้หน้าต่าง `grep -A2`** — รายชื่อถูก `sort -u` ⇒ ตำแหน่งของบรรทัดขึ้นกับ collation
# และจำนวนไฟล์ที่กวาด ⇒ เติมไฟล์ให้แซนด์บ็อกซ์อีกใบเดียว ข้อนี้ก็เขียวปลอมทั้งที่ถอดตัวปฏิเสธ
# symlink ออกแล้ว (วัดจริงในรอบรีวิวของใบ 276) · `+` เป็นของกอง staged กองเดียว ⇒ จับทั้งกองได้เลย
# 🔑 และข้อนี้เป็น **ผู้เฝ้าตัวปฏิเสธ symlink เพียงรายเดียว** — ถอด `[ -L ]` ออกแล้ว AA ข้อสาม
# กับความไว 12 ยังเขียว (ตัวทานท้ายรอบยังพิมพ์ `!` ให้อยู่) ⇒ ข้อนี้พลาดเมื่อไรไม่มีใครเห็นเลย
check "ตัว symlink ต้องไม่ถูกอ้างว่า \`git add\` ให้แล้ว (add มันเป็น no-op — blob ไม่เปลี่ยน)" \
  "$(grep -qE '^ +\+ \.docs/billing/MA\.md$' <<<"$aa_out" && echo 0 || echo 1)" \
  "output: $aa_out"
# 🔑 ข้อที่เป็นเหตุผลของเคส: ของจริงเปลี่ยน ไม่ถูก stage **และต้องไม่เงียบ**
check "ไฟล์ปลายลิงก์ต้องถูกเรียกชื่อในกอง 'เครื่องมือไม่รู้ว่าตัวเองแก้'" \
  "$(grep -q 'เครื่องมือไม่รู้ว่าตัวเองแก้' <<<"$aa_out" \
     && grep -q '.docs/billing/maintenance/MA.md' <<<"$aa_out" && echo 1 || echo 0)" \
  "output: $aa_out"

echo "selftest: ความไว 12 — ถอดตัวทานกับ \`git diff --name-only\` ⇒ AA ข้อที่สามต้องเงียบ (ใบ 276)"
new_sandbox
mkdir -p "$SANDBOX/.docs/billing/maintenance"
printf '# MA\n\nดูใบ `%s`\n' "$T/todo/$A" > "$SANDBOX/.docs/billing/maintenance/MA.md"
ln -s maintenance/MA.md "$SANDBOX/.docs/billing/MA.md"
git -C "$SANDBOX" add -Af >/dev/null
strip scripts/task-move.sh 's#^done < <(git diff -z --name-only)#done < <(:)#' "ตัวทานกับ git diff"
s12_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"
check "ไม่ทาน ⇒ ไฟล์ที่ถูกเขียนทะลุ symlink หายไปจากรายงานทั้งใบ (ทิศเงียบ)" \
  "$(grep -q '.docs/billing/maintenance/MA.md' <<<"$s12_out" && echo 0 || echo 1)" \
  "output: $s12_out"
check "และของจริงก็ยัง unstaged อยู่ (⇒ HEAD แดงโดยไม่มีใครบอก)" \
  "$(git -C "$SANDBOX" diff -z --name-only | tr '\0' '\n' | grep -q 'maintenance/MA.md' && echo 1 || echo 0)" \
  "diff: $(git -C "$SANDBOX" diff -z --name-only | tr '\0' ' ')"

echo "selftest: ความไว 13 — ถอดตัวปฏิเสธ symlink (\`[ -L ]\`) ⇒ AA ข้อสองต้องแดง (ใบ 276)"
new_sandbox
mkdir -p "$SANDBOX/.docs/billing/maintenance"
printf '# MA\n\nดูใบ `%s`\n' "$T/todo/$A" > "$SANDBOX/.docs/billing/maintenance/MA.md"
ln -s maintenance/MA.md "$SANDBOX/.docs/billing/MA.md"
git -C "$SANDBOX" add -Af >/dev/null
strip scripts/task-move.sh 's#^  \[ -L "$1" \] && return 1#  :#' "ตัวปฏิเสธ symlink"
s13_out="$(cd "$SANDBOX" && bash scripts/task-move.sh 900 2>&1)"
# ⚠️ ต้องจับ **ทั้งกอง** ไม่ใช่หน้าต่าง `-A2` — รายชื่อ `sort -u` ⇒ ตำแหน่งขึ้นกับจำนวนไฟล์ที่กวาด
check "ไม่ปฏิเสธ ⇒ ตัวลิงก์ถูกอ้างว่า \`git add\` ให้แล้ว ทั้งที่ add มันไม่เกิดผลอะไร" \
  "$(grep -qE '^ +\+ \.docs/billing/MA\.md$' <<<"$s13_out" && echo 1 || echo 0)" \
  "output: $s13_out"
