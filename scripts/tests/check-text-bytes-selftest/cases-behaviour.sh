#!/usr/bin/env bash
# เคสพฤติกรรมของ `scripts/tests/check-text-bytes-selftest.sh` (ใบ 277)
# ⚠️ `.` (source) เท่านั้น ห้าม `bash` — ไฟล์นี้ใช้ตัวช่วยกับตัวนับ `pass`/`fail` ของไฟล์เข้า
# ⚠️ ห้ามพิมพ์รายชื่อชนิด binary ลงในไฟล์นี้ — ทุกฉากผลิตจาก `KIND_EXT[@]`/`KIND_PATH[@]`
#    ที่อ่านมาจาก `binary-kinds.txt` ของสำเนาเอง (รายชื่อที่พิมพ์ไว้ = รายการที่ต้องมีคนเติม)

echo "selftest: เคสพฤติกรรม — พฤติกรรมของ check-text-bytes.sh วันนี้"

OK_LINE="check-text-bytes: OK"

# ── U. ลิสต์ชนิดต้องมีของจริง — ไม่งั้นทุกเคสข้างล่างผลิตจากความว่างเปล่า
new_sandbox
check "U — binary-kinds.txt มีชนิดให้ใช้อย่างน้อยหนึ่งแถว (${#KIND_EXT[@]} นามสกุล · ${#KIND_PATH[@]} พาธ)" \
  "$([ $(( ${#KIND_EXT[@]} + ${#KIND_PATH[@]} )) -ge 1 ] && echo 1 || echo 0)" \
  "อ่านได้ 0 แถว ⇒ ฉากทุกฉากข้างล่างวัดอะไรไม่ได้"
check "U — ลิสต์มีแถวรูปนามสกุลอย่างน้อยหนึ่งแถว (ฉาก D/M/P ต้องใช้)" \
  "$([ "${#KIND_EXT[@]}" -ge 1 ] && echo 1 || echo 0)" \
  "ไม่มีแถวรูปนามสกุลเลย ⇒ ฉาก D/M/P ไม่มีของให้ยกเว้น"

# ── A. ทรีสะอาด
new_sandbox
expect "A — ทรีสะอาดเขียว และบอกจำนวนที่กวาด" 0 "$OK_LINE" "FAIL:"
swept_n="$(sed -n 's/.*กวาด \([0-9]\+\) ไฟล์.*/\1/p' <<<"$GATE_OUT")"
check "A — จำนวนที่กวาดมากกว่า 0 (ได้ ${swept_n:-<ไม่พบ>})" \
  "$([ -n "$swept_n" ] && [ "$swept_n" -gt 0 ] && echo 1 || echo 0)" \
  "เกตที่ไม่บอกว่าตรวจกี่ไฟล์ คือเกตที่ยังเขียวได้ตอนที่มันไม่ได้ตรวจอะไรเลย (บทเรียนใบ 193)"

# ── B. `.ts` ที่มีไบต์ NUL ดิบ — ของจริงของใบนี้
new_sandbox
printf 'line1\nline2\nconst sep = "\000";\n' > "$SANDBOX/web/src/poisoned.ts"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "B — .ts ที่มี NUL ดิบ แดงและเรียกชื่อไฟล์" 1 "web/src/poisoned.ts"
check "B — บอกเลขบรรทัดที่ถูกต้อง (บรรทัด 3)" \
  "$(grep -qF 'ตัวแรกที่บรรทัด 3' <<<"$GATE_OUT" && echo 1 || echo 0)" \
  "ข้อความไม่ได้ชี้บรรทัดที่ถูก ⇒ คนอ่านต้องไปหาเอง ทั้งที่ดิฟอ่านไม่ออกอยู่แล้ว"
check "B — บอกว่าอยู่นอกสายตาเกตอื่น (นั่นคือราคาที่จ่ายอยู่)" \
  "$(grep -qF 'check-file-length.sh' <<<"$GATE_OUT" && echo 1 || echo 0)" \
  "ไม่ได้บอกผลกระทบ ⇒ คนอ่านไม่รู้ว่าทำไมต้องรีบแก้"

# ── C. `.md` ก็ต้องโดน — §4 ยกเว้นร้อยแก้ว แต่ใบนี้ไม่
new_sandbox
make_nul_text "$SANDBOX/docs/poisoned.md"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "C — .md ที่มี NUL ดิบ แดงเหมือนกัน (ไม่ได้ยืมข้อยกเว้นร้อยแก้วของ §4)" 1 "docs/poisoned.md"

# ── D. binary จริงของชนิดที่ประกาศไว้
new_sandbox
expect "D — ไฟล์ binary ของชนิดที่ประกาศไว้ ($EXT1) ไม่ถูกเรียกชื่อ" 0 "$OK_LINE" "fixtures/sample.$EXT1"

# ── E. ไฟล์ว่าง — `grep -Iq .` ตอบ "ไม่แมตช์" ให้ 0 ไบต์เหมือนกับไฟล์ binary
new_sandbox
: > "$SANDBOX/web/public-marker"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "E — ไฟล์ว่างไม่ถูกเรียกชื่อ (ของจริง: web/public/.gitkeep)" 0 "$OK_LINE" "public-marker"

# ── F. ของที่ `.gitignore` กิน = นอกขอบเขตทั้งสองทิศ
new_sandbox
mkdir -p "$SANDBOX/build"
make_nul_text "$SANDBOX/build/out.ts"
printf 'build/\n' > "$SANDBOX/.gitignore"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "F — ไฟล์ที่ .gitignore กิน ไม่ถูกเรียกชื่อ (มีหรือไม่มีขึ้นกับเครื่อง ⇒ ไม่ใช่หลักฐาน)" \
  0 "$OK_LINE" "build/out.ts"

# ── G. คลังว่าง
new_sandbox
git -C "$SANDBOX" ls-files -z | (cd "$SANDBOX" && xargs -0 rm -f)
rm -f "$SANDBOX/.gitignore"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "G — คลังว่าง = FAIL ด้วยข้อความของตัวเอง (ไม่ใช่ 'ไม่มีอะไรผิด')" 1 "กวาดไป 0 ไฟล์"

# ── H. ไม่มีไฟล์ข้อมูล
new_sandbox
rm -f "$SANDBOX/$KINDS_REL"
expect "H — ไม่มี binary-kinds.txt = FAIL ด้วยข้อความของตัวเอง" 1 "ไม่มีไฟล์ scripts/binary-kinds.txt"

# ── I. ไฟล์ข้อมูลอ่านได้ 0 แถว
# 🔴 **darin (ใบ 001) กลับทิศของเคสนี้จาก groove-clinic — และนี่คือจุดเดียวที่กลับทิศ**
# ที่นั่น "0 แถว" แปลว่าตัวอ่านพังเสมอ เพราะลิสต์ของมันไม่มีวันว่าง (มี pdf/xlsx/HEIC ของลูกค้า)
# ที่นี่ลิสต์ว่างคือ **สภาพที่ถูกต้อง**: รีโปนี้ยังไม่มีไฟล์ binary ที่ git ถือไว้เลยสักใบ
# ⇒ เกตแยกสองกรณีด้วยหลักฐานในไฟล์เอง: มีบรรทัดที่ไม่ใช่คอมเมนต์แต่อ่านได้ 0 แถว = ตัวอ่านพัง
# · ไฟล์ที่มีแต่คอมเมนต์ = ลิสต์ว่างโดยตั้งใจ ⇒ เขียว **พร้อมพูดออกมา** ห้ามเงียบ
# · แขน "ตัวอ่านพัง" มีเคส J · K · L เฝ้าอยู่แล้วโดยปริยาย — ทั้งสามใบมีแถวจริงในฉาก
#   ⇒ ตัวอ่านที่พังทำให้ทั้งสามใบแดงทันที (ทดสอบตรง ๆ ไม่ได้ เพราะทุกบรรทัดที่ตัวอ่านทิ้ง
#   ก็เป็นบรรทัดที่ตัวนับเนื้อทิ้งเหมือนกันโดยโครงสร้าง)
new_sandbox
kinds_file_with 0 '# มีแต่คอมเมนต์'
expect "I — ลิสต์ว่างโดยตั้งใจ = เขียว และต้องพูดออกมา" 0 "ตัวข้ามว่างเปล่า" "FAIL"

# ── J. แถวที่ไม่อ้างใบงาน
new_sandbox
kinds_file_with 1 "$EXT1	# ไม่ได้อ้างใบงาน"
expect "J — แถวที่ไม่อ้าง \`ใบ NNN\` = FAIL" 1 "แถวต้องอ้างใบงาน"

# ── K. แถวซ้ำ
new_sandbox
kinds_file_with 1 "$EXT1	# ใบ 277 · แถวแรก" "$EXT1	# ใบ 277 · แถวซ้ำ"
expect "K — แถวซ้ำ = FAIL (แถวหนึ่งกลบอีกแถว ด่านกันสุสานจึงปลดไม่ลง)" 1 "แถวซ้ำ"

# ── L. แถวที่ไม่มีไฟล์ชนิดนั้นเหลือแล้ว = สุสาน
new_sandbox
rm -f "$SANDBOX/fixtures/sample.$EXT1"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "L — แถวที่ไม่มีไฟล์ชนิดนั้นแล้ว = FAIL (ตัวข้ามห้ามเป็นสุสาน)" 1 "ไม่มีไฟล์ชนิดนี้ในรีโปแล้ว: $EXT1"

# ── M. นามสกุลตัวใหญ่ — เคสจริงของรีโป (`.HEIC` จากกล้องลูกค้า)
new_sandbox
make_binary "$SANDBOX/fixtures/UPPER.$(tr '[:lower:]' '[:upper:]' <<<"$EXT1")"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "M — นามสกุลตัวใหญ่ตรงกับแถวตัวเล็ก = เขียว" 0 "$OK_LINE" "fixtures/UPPER."

# ── N. symlink — ไบต์ที่เห็นเป็นของปลายทาง ซึ่งถูกตรวจที่พาธจริงของมันเองอยู่แล้ว
new_sandbox
ln -s "fixtures/sample.$EXT1" "$SANDBOX/link-to-binary.ts"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "N — symlink ที่ชี้ไป binary ไม่ถูกเรียกชื่อ" 0 "$OK_LINE" "link-to-binary.ts"

# ── O. ไฟล์ใหม่ที่ยังไม่ `git add` (ธง `-o`)
new_sandbox
make_nul_text "$SANDBOX/web/src/unstaged.ts"
expect "O — ไฟล์ที่ยังไม่ git add ก็ถูกตรวจ (ธง -o)" 1 "web/src/unstaged.ts"

# ── P. เทียบสตริงตรง ๆ ไม่ใช่ `case` (ใบ 190 คำต่อคำ)
new_sandbox
glob_row="$(glob_row_for "$EXT1")"
kinds_file_with 1 "$glob_row	# ใบ 277 · แถวรูป glob ที่ต้องไม่ยกเว้นให้ใคร"
expect "P — แถว \`$glob_row\` ต้องไม่ยกเว้นให้ .$EXT1 (เทียบสตริงตรง ห้าม case)" 1 "fixtures/sample.$EXT1"

# ── Q. ไฟล์ไม่มีนามสกุล — แดงได้ **และต้องมีทางออกตามกฎหมาย** (แถวรูปพาธ)
new_sandbox
make_binary "$SANDBOX/fixtures/noext"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "Q1 — ไฟล์ binary ที่ไม่มีนามสกุล = แดงและเรียกชื่อ" 1 "fixtures/noext"
printf 'fixtures/noext\t# ใบ 277 · แถวรูปพาธ\n' >> "$SANDBOX/$KINDS_REL"
expect "Q2 — แถวรูป **พาธ** ยกเว้นให้ได้ = เขียว (แดงที่ไม่มีทางออกคือเกตที่คนเดินข้าม)" \
  0 "$OK_LINE" "fixtures/noext"

# ── R. ไฟล์ชื่อภาษาไทย — `git ls-files` เปล่า ๆ quote พาธที่ไม่ใช่ ASCII ⇒ หายเงียบ 24 ใบในรีโปจริง
new_sandbox
make_nul_text "$SANDBOX/web/src/บันทึก.ts"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "R — ไฟล์ชื่อไทยที่มี NUL ถูกเรียกชื่อ (ต้องใช้ -z ไม่งั้นหายเงียบ)" 1 "web/src/บันทึก.ts"

# ── T. binary ที่ไม่มี NUL — แขนข้อความที่สอง · ถามสภาพแวดล้อมก่อนแล้ว assert ให้ตรงทิศ
new_sandbox
printf 'hello \377\376 world\n' > "$SANDBOX/web/src/badenc.ts"
git -C "$SANDBOX" add -A >/dev/null 2>&1
if grep -Iq . "$SANDBOX/web/src/badenc.ts"; then
  # 🔑 ทิศนี้ไม่ใช่ "ไม่มีอะไรให้วัด" — มันวัดว่าเกต **ไม่เข้มกว่า §4** · เกตที่ไล่หา NUL เอง
  # แทนที่จะถาม `flen_is_binary` จะแดงใส่ไฟล์นี้ ทั้งที่ `check-file-length.sh` ตรวจมันอยู่ปกติ
  # = แดงปลอมที่ไม่มีทางแก้ · (วัด 2026-09-15: เกตรันด้วย `/usr/bin/grep` ของ GNU ซึ่งตีตรา
  # binary จาก NUL เท่านั้น — ต่างจาก `grep` ในเชลล์โต้ตอบของเครื่องนี้ที่ชี้ไป ugrep และตอบ binary)
  expect "T — สภาพแวดล้อมนี้อ่านไบต์ UTF-8 พังเป็น text ⇒ เกตต้องปล่อยผ่าน (กว้างเท่า §4 เป๊ะ ไม่เข้มกว่า)" \
    0 "$OK_LINE" "web/src/badenc.ts"
else
  expect "T — binary ที่ไม่มี NUL = แดงด้วยข้อความแขนที่สอง" 1 "ไม่พบ NUL"
  check "T — แขนที่สองยังเรียกชื่อไฟล์ และชี้ทางออกไปที่ไฟล์ข้อมูล" \
    "$(grep -qF 'web/src/badenc.ts' <<<"$GATE_OUT" && grep -qF "$KINDS_REL" <<<"$GATE_OUT" && echo 1 || echo 0)" \
    "ข้อความแขนที่สองไม่ได้บอกชื่อไฟล์หรือไม่ได้ชี้ทางออก"
fi

# ── V. NUL เป็น **ไบต์สุดท้าย** ของไฟล์ — ออฟเซ็ตต้องไม่ใช่ -1 (ค่าที่แปลว่า "ไม่มี NUL")
new_sandbox
printf 'abc\000' > "$SANDBOX/web/src/tailnul.ts"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "V — NUL ไบต์สุดท้าย: แดงเรียกชื่อ และ **ไม่** พิมพ์ออฟเซ็ตติดลบ" 1 "web/src/tailnul.ts" "ออฟเซ็ต -1"
check "V — ออฟเซ็ตที่บอกคือ 3 (ไบต์ก่อนหน้าสามตัว)" \
  "$(grep -qF 'ตัวแรกที่บรรทัด 1 (ออฟเซ็ต 3)' <<<"$GATE_OUT" && echo 1 || echo 0)" \
  "ตัวชี้ตำแหน่งคำนวณผิดเมื่อ NUL อยู่ไบต์สุดท้าย ⇒ ข้อความบอกที่ผิดบนบรรทัดที่บอกว่ามี NUL"

# ── W. ไฟล์ที่อ่านไม่ได้ — `grep` คืน non-zero เหมือนไฟล์ binary ⇒ ต้องแยกสาเหตุ คนละทางแก้
new_sandbox
printf 'export const ok = 2;\n' > "$SANDBOX/web/src/locked.ts"
git -C "$SANDBOX" add -A >/dev/null 2>&1
chmod 000 "$SANDBOX/web/src/locked.ts"
expect "W — ไฟล์อ่านไม่ได้ = FAIL คนละข้อความ (ห้ามบอกว่าไบต์เป็น binary)" \
  1 "อ่านไฟล์ไม่ได้" "web/src/locked.ts — ตั้งใจให้เป็น text"
chmod 644 "$SANDBOX/web/src/locked.ts"

# ── X. แถวรูป **พาธ** ที่ถูกแถวนามสกุลบังไว้ ต้องไม่โดนด่านสุสานด้วยเหตุผลที่เป็นเท็จ
new_sandbox
make_binary "$SANDBOX/fixtures/masked.$EXT1"
printf 'fixtures/masked.%s\t# ใบ 277 · แถวพาธที่ถูกแถวนามสกุลบัง\n' "$EXT1" >> "$SANDBOX/$KINDS_REL"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "X — แถวพาธที่ถูกบัง ต้องถูกนับว่า 'ถูกใช้' (ไม่ใช่ FAIL ที่บอกสาเหตุผิด)" \
  0 "$OK_LINE" "ไม่มีไฟล์ชนิดนี้ในรีโปแล้ว: fixtures/masked."

# ── Y. **ทิศที่สองของด่านกันสุสาน** — แถวที่ข้ามไฟล์ซึ่งไบต์เป็น text คือตัวปิดตา ไม่ใช่ตัวข้าม
#    ทิศแรก ("แถวนี้ถูกใช้ไหม") ตอบผ่านเสมอสำหรับแถวกว้างเกิน ⇒ ถ้าไม่มีทิศนี้ เติมแถว `ts` แถวเดียว
#    ก็ลบไฟล์ทั้งภาษาออกจากคลังได้เงียบ ๆ (รีวิวใบ 277 วัดได้: แถว `rs` ปิดตา 725 ไฟล์)
new_sandbox
printf 'ts\t# ใบ 277 · แถวกว้างเกินที่ไม่ควรมีใครเขียน\n' >> "$SANDBOX/$KINDS_REL"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "Y1 — แถวนามสกุลที่ข้ามไฟล์ text = FAIL เรียกชื่อทั้งแถวและไฟล์ตัวอย่าง" \
  1 "ข้ามไฟล์ที่ไบต์เป็น text อยู่: web/src/clean.ts"
new_sandbox
printf 'web/src/clean.ts\t# ใบ 277 · แถวพาธที่ชี้ไฟล์ text\n' >> "$SANDBOX/$KINDS_REL"
git -C "$SANDBOX" add -A >/dev/null 2>&1
expect "Y2 — แถวรูปพาธก็ต้องโดนทิศเดียวกัน (ไม่ใช่เฉพาะแถวนามสกุล)" \
  1 "ข้ามไฟล์ที่ไบต์เป็น text อยู่: web/src/clean.ts"

# ── Z. แถวที่ต่างกันแค่ตัวพิมพ์ = แถวซ้ำจริง เพราะการจับคู่ไม่สนตัวพิมพ์ (เคส M เป็นคู่ของมัน)
new_sandbox
printf '%s\t# ใบ 277 · ตัวพิมพ์ใหญ่ของแถวที่มีอยู่แล้ว\n' "$(tr '[:lower:]' '[:upper:]' <<<"$EXT1")" >> "$SANDBOX/$KINDS_REL"
expect "Z — แถวที่ต่างแค่ตัวพิมพ์ = 'แถวซ้ำ' ไม่ใช่ 'ไม่มีไฟล์ชนิดนี้แล้ว' (ข้อความหลังเป็นเท็จ)" \
  1 "แถวซ้ำ" "ไม่มีไฟล์ชนิดนี้ในรีโปแล้ว"
