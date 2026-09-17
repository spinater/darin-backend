#!/usr/bin/env bash
# ตารางความไวของ `scripts/tests/check-code-junit-selftest.sh` (ใบ 303)
# ⚠️ `.` (source) เท่านั้น ด้วยเหตุผลเดียวกับ `cases-behaviour.sh`
#
# 🔑 **"exit เปลี่ยน" อย่างเดียวเป็นตัววัดที่หยาบเกินไป** — วัดจริงตอนเขียนใบนี้: ถอดเงื่อนไข
# `n != f` ออก แล้ว exit **ยังเป็น 1 เท่าเดิม** เพราะทิศกลับ (`comm -13`) ไปแดงแทนด้วยสาเหตุคนละ
# เรื่องคนละทางแก้ ⇒ แถวที่ดูแค่ exit จะรายงานว่า "ของที่ถอดไม่ได้เฝ้าอะไร" ทั้งที่มันเฝ้าอยู่จริง
# ⇒ ตัววัดคือ **ข้อความลายเซ็น**: ก่อนถอดต้องมี · หลังถอดต้องไม่มี (หรือกลับทิศสำหรับข้อยกเว้น)
echo "selftest: ตารางความไว — ถอดทีละข้อจากสำเนา แล้วเคสคู่ของมันต้องพลิก"

# ถอดการแก้ทีละข้อจาก **สำเนา** ที่อยู่นอกแซนด์บ็อกซ์ (ไฟล์จริงไม่ถูกแตะ)
make_mutated() { # $1 = นิพจน์ sed
  cp "$GATE_REL" "$MUT"
  sed -i.bak "$1" "$MUT" && rm -f "$MUT.bak"
  cmp -s "$MUT" "$GATE_REL" && return 1
  return 0
}

# ทุกแถวจบด้วย assertion ที่สองเสมอ: **ถอดแล้วทรีปกติต้องยังเขียว**
# ⚠️ **สิ่งที่มันซื้อคือการจับ `sed` ที่กว้างจนทำสคริปต์พัง เท่านั้น — ไม่ใช่ข้อพิสูจน์ว่าการถอด
# เป็นการผ่าตัดจุดเดียว** (วัดในรีวิวของใบ 303: ทั้งห้า strip ของวันนี้เป็น no-op เชิงความหมายบน
# ทรีสะอาด ⇒ แถวนี้ล้มด้วยเหตุอื่นไม่ได้เลย) · เก็บไว้เพราะมันเคยจับจริงตอนตัวแยกคำพัง และเป็น
# ประกันของแถวที่ใบ 298/302 จะเพิ่มเข้ามา ซึ่งอาจไม่ใช่ no-op
# `$2` (ไม่บังคับ) = ข้อความที่ทรีปกติ **ต้องรายงาน** หลังถอด · ไม่ใส่ = ต้องยังเขียว
# 🔑 **ทำไมต้องมีโหมดที่สอง — วัดเจอตอนเขียนแถว S7 ของใบ 298** · การกลายพันธุ์ที่ขยับ *ขอบ*
# (`-lt` → `-le`) ทำให้ **ทรีปกติแดงโดยชอบ** เพราะสภาพปกติของทุกหมุดคือ `รันจริง == หมุด` ซึ่งคือ
# ตัวขอบพอดี ⇒ บังคับว่า "ต้องยังเขียว" ที่นี่คือการวัดผิดฉาก ไม่ใช่การจับ sed ที่กว้างเกิน
# ⇒ แถวแบบนั้นประกาศ **ข้อความที่ทรีปกติต้องรายงาน** แทน ซึ่งแรงกว่า "ยังเขียว" ด้วยซ้ำ:
# มันพิสูจน์ว่าการกลายพันธุ์ไปโดนขอบจริง ไม่ใช่ไปพังอย่างอื่น
sens_normal_after() { # $1 = ชื่อแถว · $2 = ข้อความที่ทรีปกติต้องรายงาน (ว่าง = ต้องเขียว)
  local g want_msg="${2:-}"
  new_sandbox
  run_gate "$MUT"; g=$?
  if [ -z "$want_msg" ]; then
    check "[ความไว] $1 — ถอดแล้วทรีปกติยังเขียว (sed ไม่ได้กว้างจนสคริปต์พัง)" \
      "$([ "$g" -eq 0 ] && echo 1 || echo 0)" \
      "ทรีปกติกลายเป็น exit=$g ⇒ sed กว้างเกินจนไปทำลายอย่างอื่น แถวนี้จึงไม่ได้วัดของที่ตั้งใจวัด"
  else
    check "[ความไว] $1 — ถอดแล้วทรีปกติแดงที่ *ขอบ* ตามที่ประกาศไว้" \
      "$([ "$g" -ne 0 ] && grep -qF -- "$want_msg" <<<"$GATE_OUT" && echo 1 || echo 0)" \
      "ทรีปกติได้ exit=$g และไม่มีข้อความ \"$want_msg\" ⇒ การกลายพันธุ์ไม่ได้ไปโดนขอบอย่างที่อ้าง"
  fi
}
sens_normal_still_green() { sens_normal_after "$1"; }

# `$6` (ไม่บังคับ) = exit ที่ต้องได้ **หลังถอด** — ใส่เมื่อของที่ถอดเป็น *ตัวกำหนดคำตัดสิน*
# ไม่ใช่แค่ *ตัวกำหนดคุณภาพข้อความ* · แถว S1/S5 ใส่ `0` เพราะฉาก E/F ถูกเลือกมาให้เกตที่ถูกทุบ
# **เขียวสนิท** ไม่ใช่แค่เปลี่ยนข้อความ — ซึ่งเป็นความต่างระหว่างฉาก F กับฉาก I
sens() { # $1=ชื่อแถว $2=sed $3=ฟังก์ชันฉาก $4=exit ปกติ $5=ลายเซ็นที่ต้อง **หายไป** $6=exit หลังถอด
  local name="$1" expr="$2" scenario="$3" normal="$4" sig="$5" want_after="${6:-}" base_exit after_exit
  "$scenario"
  run_gate; base_exit=$?
  if [ "$base_exit" -ne "$normal" ] || ! grep -qF -- "$sig" <<<"$GATE_OUT"; then
    echo "  FAIL: [ความไว] $name — ฉากตั้งต้น exit=$base_exit (คาด $normal) หรือไม่มีข้อความ \"$sig\" ⇒ ไม่มีอะไรให้หายไป"
    fail=$((fail + 1)); return
  fi
  # ⚠️ sed ที่ไม่แมตช์ = แถวที่ "ผ่าน" ตลอดกาลโดยไม่ได้วัดอะไรเลย (ความผิดของใบ 190)
  if ! make_mutated "$expr"; then
    check "[ความไว] $name — sed แก้สำเนาได้จริง" 0 "sed ไม่ตรงกับซอร์สจริง ⇒ แถวนี้วัดอะไรไม่ได้ (แก้ pattern ให้ตรง)"
    return
  fi
  check "[ความไว] $name — sed แก้สำเนาได้จริง" 1 ""
  run_gate "$MUT"; after_exit=$?
  if grep -qF -- "$sig" <<<"$GATE_OUT"; then
    echo "  FAIL: [ความไว] $name — ถอดออกแล้วยังรายงาน \"$sig\" ⇒ ของที่ถอดไม่ได้เฝ้าข้อนี้"
    printf '    --- output ---\n%s\n    --------------\n' "$GATE_OUT"
    fail=$((fail + 1))
  else
    echo "  ok: [ความไว] $name (ถอดแล้วข้อความ \"$sig\" หายไป)"; pass=$((pass + 1))
  fi
  # แถวที่ประกาศ exit หลังถอดไว้ = แถวที่อ้างว่าของที่ถอดเป็น **ตัวกำหนดคำตัดสิน** ⇒ ต้องพิสูจน์
  if [ -n "$want_after" ]; then
    check "[ความไว] $name — ถอดแล้วฉากนี้ exit $normal → $want_after (เกตเปลี่ยนคำตัดสิน ไม่ใช่แค่ข้อความ)" \
      "$([ "$after_exit" -eq "$want_after" ] && echo 1 || echo 0)" \
      "ได้ exit=$after_exit ⇒ ของที่ถอดเป็นแค่ตัวกำหนดคุณภาพข้อความในฉากนี้ ไม่ใช่ตัวกำหนดคำตัดสิน"
  fi
  sens_normal_still_green "$name"
}

# ── วัด **กลับทิศ** สำหรับของที่ทำให้ฉาก *ไม่* แดง (ตัวกรอง) — ถอดออกแล้วข้อความ *โผล่มา*
# ใช้ `sens` เดิมไม่ได้ เพราะมันบังคับว่าฉากตั้งต้นต้อง **มี** ลายเซ็นอยู่ก่อน
sens_appears() { # $1=ชื่อแถว $2=sed $3=ฉาก $4=exit ปกติ $5=ข้อความที่ต้อง **โผล่มา** $6=ทรีปกติหลังถอด
  local name="$1" expr="$2" scenario="$3" normal="$4" sig="$5" normal_after="${6:-}" base_exit
  "$scenario"
  run_gate; base_exit=$?
  if [ "$base_exit" -ne "$normal" ] || grep -qF -- "$sig" <<<"$GATE_OUT"; then
    echo "  FAIL: [ความไว] $name — ฉากตั้งต้น exit=$base_exit (คาด $normal) หรือมีข้อความ \"$sig\" อยู่แล้ว ⇒ ไม่มีอะไรให้โผล่"
    fail=$((fail + 1)); return
  fi
  if ! make_mutated "$expr"; then
    check "[ความไว] $name — sed แก้สำเนาได้จริง" 0 "sed ไม่ตรงกับซอร์สจริง ⇒ แถวนี้วัดอะไรไม่ได้ (แก้ pattern ให้ตรง)"
    return
  fi
  check "[ความไว] $name — sed แก้สำเนาได้จริง" 1 ""
  run_gate "$MUT"
  if grep -qF -- "$sig" <<<"$GATE_OUT"; then
    echo "  ok: [ความไว] $name (ถอดแล้วข้อความ \"$sig\" โผล่มา)"; pass=$((pass + 1))
  else
    echo "  FAIL: [ความไว] $name — ถอดออกแล้วข้อความ \"$sig\" ยังไม่โผล่ ⇒ ของที่ถอดไม่ได้กันข้อนี้"
    printf '    --- output ---\n%s\n    --------------\n' "$GATE_OUT"
    fail=$((fail + 1))
  fi
  sens_normal_after "$name" "$normal_after"
}

# ── ฉากของแต่ละแถว — รูปเดียวกับเคสพฤติกรรมที่มันคู่กัน (ผลิตจาก `PINS[@]` เหมือนกันทั้งหมด)
scene_I() { # คู่กับเคส I — describe ปลอมชื่อเป็นหมุด ในไฟล์อื่น + ไฟล์จริงถูกลบ
  new_sandbox
  rm -f "$SANDBOX/${PINS[0]}"
  git -C "$SANDBOX" add -Af >/dev/null 2>&1
  junit_open; junit_default_suites "${PINS[0]}"
  junit_suite "${PINS[0]}" "${PINS[1]:-$EXTRA}" "${PIN_WANT[${PINS[0]}]}" 0
  junit_close
}
scene_E() { # คู่กับเคส E — ไฟล์ของหมุดถูกเปลี่ยนชื่อ `.ts` → `.tsx` โดยหมุดไม่ได้ตามไป
  new_sandbox
  mv "$SANDBOX/${PINS[0]}" "$SANDBOX/${PINS[0]}x"
  git -C "$SANDBOX" add -Af >/dev/null 2>&1
  junit_open; junit_default_suites "${PINS[0]}"
  junit_suite "${PINS[0]}x" "${PINS[0]}x" "${PIN_WANT[${PINS[0]}]}" 0
  junit_close
}
scene_F() { # คู่กับเคส F — หมุดยังอยู่ในคอร์ปัส แต่ไม่คาย suite ของตัวเอง + describe ปลอมในไฟล์อื่น
  new_sandbox
  junit_open; junit_default_suites "${PINS[0]}"
  # จำนวนต้องเท่ากับหมุดเป๊ะ — ไม่งั้นแขนนับจำนวน (ใบ 298) ไปแดงแทน แล้วแถวนี้วัดคนละอย่าง
  junit_suite "${PINS[0]}" "${PINS[1]:-$EXTRA}" "${PIN_WANT[${PINS[0]}]}" 0
  junit_close
}
scene_L() { # คู่กับเคส L — ลบจาก worktree เท่านั้น index ยังถือไว้
  new_sandbox
  rm -f "$SANDBOX/${PINS[0]}"
  junit_open; junit_default_suites "${PINS[0]}"; junit_close
}
scene_K() { # คู่กับเคส K — ชุดใน junit ที่ไม่อยู่ในคอร์ปัส
  new_sandbox
  junit_open; junit_default_suites; junit_suite "$GHOST" "$GHOST" 1 0; junit_close
}
scene_M() { # คู่กับเคส M — ชุดที่อ่าน attribute ไม่ครบ
  new_sandbox
  junit_open; junit_default_suites
  junit_raw "<testsuite name=\"$BROKEN\" file=\"$BROKEN\" tests=\"1\" time=\"0.01\">"
  junit_close
}

# S1 — หลักยึด `"\t"` ของตัวหาหมุด คือสิ่งเดียวที่กันไม่ให้ชื่อหมุดกลายเป็น *คำนำหน้า*
# ⇒ ถอดแล้วไฟล์ที่ถูกเปลี่ยนชื่อ `.ts` → `.tsx` จะถูกจับว่า "รันแล้ว" และเกต **เขียวสนิท**
sens "S1 (หลักยึด tab ของตัวหาหมุด)" 's/index(\$0, s "\\t") == 1/index($0, s) == 1/' scene_E 1 \
  "${PINS[0]} ไม่ได้ถูกรัน (ถูกลบ/เปลี่ยนชื่อ?)" 0

# S5 — เงื่อนไข `n != f` ใน awk (ใบ 215) คือสิ่งเดียวที่ปิดรูปลอม describe
# ⚠️ **ผูกกับฉาก F ไม่ใช่ I** — ในฉาก I (ไฟล์จริงถูกลบ) ถอดแล้วยัง exit 1 เพราะแขน `comm -13`
# ไปแดงแทนด้วยสาเหตุคนละเรื่อง ⇒ ที่นั่นมันเป็นแค่ *ตัวกำหนดคุณภาพข้อความ* · ในฉาก F ไฟล์ยังอยู่
# ในคอร์ปัส ⇒ ถอดแล้วทั้งสองชั้นเงียบพร้อมกัน **เขียวสนิท** = *ตัวกำหนดคำตัดสิน*
sens "S5 (เงื่อนไข n != f ของ awk)" 's/if (n != f) next//' scene_F 1 \
  "${PINS[0]} ไม่ได้ถูกรัน (ถูกลบ/เปลี่ยนชื่อ?)" 0

# S6 — ตัวกรอง `[ -f ]` ของคอร์ปัส (ใบ 215) กันข้อความเท็จที่ชี้ผิดทาง ⇒ ถอดแล้ว L ต้องได้ข้อความนั้น
sens_appears "S6 (ตัวกรอง [ -f ] ของคอร์ปัส)" 's/if \[ -f "\$f" \]; then/if true; then/' scene_L 1 \
  "${PINS[0]} มีอยู่จริงแต่ไม่มีเทสไหนทำงาน"

# S9 — แขน `comm -13` คือทิศกลับของใบ 215 ⇒ ถอดแล้ว K เงียบสนิท (รูปชื่อไฟล์ที่ไม่มีใครกวาด)
sens "S9 (แขน comm -13 — ทิศกลับ)" 's/comm -13 "\$JUNIT_SUITES.corpus" "\$JUNIT_SUITES.seen"/true/' scene_K 1 \
  "junit มีชุด $GHOST ที่ไม่อยู่ในคอร์ปัส"

# S10 — แขน `!unreadable` คือด่าน "อ่านของที่ต้องตรวจไม่ออก = แดง" ⇒ ถอดแล้ว M เขียวสนิท
sens "S10 (แขน !unreadable)" "s/grep -q '\\^!unreadable' \"\\\$JUNIT_SUITES\"/false/" scene_M 1 \
  "อ่าน name/file/tests/skipped จาก junit ไม่ได้ (รูปรายงานเปลี่ยน?)"

# ── ฉากของใบ 302
scene_O() { # คู่กับเคส O — คอร์ปัสว่าง (ไฟล์หายจากดิสก์ index ยังถือไว้)
  new_sandbox
    # darin: คอร์ปัสมีรากเป็น **รากรีโป** ⇒ "ไดเรกทอรีหายทั้งก้อน" กลายเป็น
  # "ไฟล์เทสหายจากดิสก์ทุกใบ" — ฉากเดียวกัน (index ยังถือไว้) ข้อความ FAIL เดียวกัน
  for _p in "${ALL[@]}"; do rm -f "$SANDBOX/$_p"; done
}
scene_Q() { # คู่กับเคส Q — บังคับ locale ที่เรียงสลับลำดับไบต์ แล้วให้มีไฟล์ที่ควรแดงปนอยู่
  new_sandbox
  GATE_LC="$(pick_collation_locale || true)"
  # คู่ชื่อที่สองลำดับไม่ตรงกัน — ต้องมีในฉากนี้ด้วย ไม่ใช่แค่ในเคส Q: ถ้าคลังไม่มีคู่แบบนั้น
  # `comm` จะเดินคู่กันไปจนจบโดยไม่ทันเจอความไม่เรียง ⇒ แถวนี้เขียวโดยไม่ได้วัดอะไร
  # (เหตุผลเต็มอยู่ที่เคส Q ใน cases-behaviour.sh — ห้ามแก้ที่เดียว)
  mkdir -p "$SANDBOX/lib/zz"
  printf 'test("stub", () => { expect(1).toBe(1); });\n' > "$SANDBOX/lib/zz-c.test.ts"
  printf 'test("stub", () => { expect(1).toBe(1); });\n' > "$SANDBOX/lib/zz/b.test.ts"
  git -C "$SANDBOX" add -Af >/dev/null 2>&1
  junit_open; junit_default_suites "$EXTRA"
  junit_suite "lib/zz-c.test.ts" "lib/zz-c.test.ts" 1 0
  junit_suite "lib/zz/b.test.ts" "lib/zz/b.test.ts" 1 0
  junit_close
}

# S4 — `LC_ALL=C` ทั้งสามชุด · ถอดออกแล้ว `sort` กลับไปเรียงตาม locale ขณะที่ `comm` ยังเทียบไบต์
# ⇒ เสียง `comm: file 1 is not in sorted order` **โผล่มา** · วัดกลับทิศเพราะมันเป็นยาม
# ⚠️ แถวนี้มีความหมายเฉพาะตอน `scene_Q` หา locale ได้จริง — ซึ่งเคส Q ยืนยันไว้ให้แล้วเป็น
# assertion ของตัวเอง ⇒ เครื่องที่หาไม่ได้จะเห็นเคส Q แดงก่อน ไม่ใช่เห็นแถวนี้เขียวเปล่า ๆ
sens_appears "S4 (LC_ALL=C ของสามชุด)" 's/LC_ALL=C sort/sort/g' scene_Q 1 "comm:"

# S8 — แขน "คอร์ปัสว่าง = FAIL" · ถอดออกแล้วกลับไปเป็นพฤติกรรมก่อนใบ 302 เป๊ะ:
# ลูป `comm` สองชุดเดินบนคอร์ปัสว่าง ⇒ ได้น้ำท่วม "ไม่อยู่ในคอร์ปัส" ที่เรียกชื่อสาเหตุผิด
# แทนข้อความใบเดียวที่ชี้ตัวคัดไฟล์ · ⚠️ **exit ไม่เปลี่ยน (1 เท่าเดิม)** ⇒ แถวนี้จึงผูกกับ
# **ข้อความ** เท่านั้น ตามบทเรียนใบ 192 — ถ้าวัดด้วย exit จะรายงานว่า "ของที่ถอดไม่ได้เฝ้าอะไร"
sens "S8 (แขนคอร์ปัสว่าง = FAIL)" 's/if \[ ! -s "\$JUNIT_SUITES.corpus" \]; then/if false; then/' scene_O 1 \
  "กวาดไฟล์เทสได้ 0 ใบ"

scene_R() { # คู่กับเคส R — merge conflict จริง ⇒ index ถือสามสเตจ ⇒ คลังมีบรรทัดซ้ำ
  new_sandbox
  local g=(git -C "$SANDBOX" -c user.email=selftest@example.invalid -c user.name=selftest -c commit.gpgsign=false)
  "${g[@]}" commit -qm base            >/dev/null 2>&1
  "${g[@]}" checkout -qb other         >/dev/null 2>&1
  printf 'other\n' > "$SANDBOX/${PINS[0]}"; "${g[@]}" commit -qam other >/dev/null 2>&1
  "${g[@]}" checkout -q -              >/dev/null 2>&1
  printf 'mine\n'  > "$SANDBOX/${PINS[0]}"; "${g[@]}" commit -qam mine  >/dev/null 2>&1
  "${g[@]}" merge other                >/dev/null 2>&1
}
scene_T() { # คู่กับเคส T — ไม่มีชุดระดับไฟล์เลยสักใบ ⇒ `.seen`/`.ran` ว่าง
  new_sandbox
  local p
  junit_open
  for p in "${ALL[@]}"; do junit_suite "บล็อก describe ของ $p" "$p" 3 0; done
  junit_close
}

# S11 — `-u` ของทั้งสามชุด · ถอดออกแล้วบรรทัดซ้ำจาก merge conflict ทะลุเข้า `comm`
# ⇒ ข้อความเท็จ "มีอยู่จริงแต่ไม่มีเทสไหนทำงาน" **โผล่มา** ทั้งที่ไฟล์นั้นรันแล้ว (วัดกลับทิศ)
sens_appears "S11 (-u ของสามชุด)" 's/LC_ALL=C sort -u/LC_ALL=C sort/g' scene_R 0 \
  "${PINS[0]} มีอยู่จริงแต่ไม่มีเทสไหนทำงาน"

# S12 — แขน "junit ไม่มีชุดระดับไฟล์" · ถอดออกแล้วกลับไปเป็นน้ำท่วมที่เรียกชื่อสาเหตุผิด
# ⚠️ **exit ไม่ขยับ (1 เท่าเดิม)** ด้วยเหตุผลเดียวกับ S8 ⇒ ผูกกับ *ข้อความ* เท่านั้น
sens "S12 (แขน junit ไม่มีชุดระดับไฟล์)" 's/elif \[ ! -s "\$JUNIT_SUITES.seen" \]; then/elif false; then/' scene_T 1 \
  "junit ไม่มีชุดระดับไฟล์เลยสักใบ"

# ── ฉากของใบ 298 — ผลิตจาก `PIN_WANT` ของสำเนาเอง ไม่มีเลขพิมพ์มือสักตัว
scene_G() { # รันจริง = หมุด + 1
  new_sandbox
  junit_open; junit_default_suites "${PINS[0]}"
  junit_suite "${PINS[0]}" "${PINS[0]}" $(( PIN_WANT[${PINS[0]}] + 1 )) 0
  junit_close
}
scene_N() { # รันจริง = หมุด − 1
  new_sandbox
  junit_open; junit_default_suites "${PINS[0]}"
  junit_suite "${PINS[0]}" "${PINS[0]}" $(( PIN_WANT[${PINS[0]}] - 1 )) 0
  junit_close
}
scene_U() { # รันจริง = หมุดพอดี ผ่านเส้นทาง tests = หมุด + 2 · skipped = 2
  new_sandbox
  junit_open; junit_default_suites "${PINS[0]}"
  junit_suite "${PINS[0]}" "${PINS[0]}" $(( PIN_WANT[${PINS[0]}] + 2 )) 2
  junit_close
}

# S2 — **ถอดการเทียบจำนวนทั้งอัน** (ทั้งสองแขน) ⇒ กลับไปเป็นพฤติกรรมก่อนใบ 298
# ⚠️ **แถวนี้เป็นเซตคลุมของ S3+S7 โดยโครงสร้าง** — ถอดทั้งอันแล้วทั้ง G และ N เงียบพร้อมกัน
# ⇒ มันไม่ใช่แถวที่ "แดงเดี่ยว" และไม่ควรเขียนว่าเป็น · หน้าที่ของมันคือตอบว่า **ถ้าไม่มีฟีเจอร์นี้
# เลย อะไรหายไป** ส่วนแถวที่พลิกทีละแขนคือ S3 กับ S7 ซึ่งเป็นเหตุผลที่โค้ดต้องเป็นสองแขนแยกกัน
sens "S2 (การเทียบจำนวนทั้งอัน)" \
  's/if \[ "\$ran" -gt "\$want" \]; then/if false; then/; s/elif \[ "\$ran" -lt "\$want" \]; then/elif false; then/' \
  scene_N 1 "${PINS[0]} รันจริง" 0

# S3 — ถอด **เฉพาะแขนทิศโต** (`-gt`) = "ยอมให้โตได้" ⇒ G เงียบ · N ยังแดงเหมือนเดิม
sens "S3 (แขนทิศโต -gt)" 's/if \[ "\$ran" -gt "\$want" \]; then/if false; then/' scene_G 1 \
  "${PINS[0]} รันจริง" 0

# S7 — off-by-one ที่แขนทิศหด (`-lt` → `-le`) ⇒ **ฉากที่รันจริงเท่าหมุดพอดีต้องพลิกจากเขียวเป็นแดง**
# วัดกลับทิศ เพราะฉาก U เป็นฉากเขียว ⇒ ถอดแล้วข้อความ *โผล่มา*
# ⚠️ **ทรีปกติต้องแดงหลังถอด ไม่ใช่เขียว** — สภาพปกติของทุกหมุดคือ `รันจริง == หมุด` ซึ่งคือตัวขอบ
# พอดี ⇒ off-by-one ที่ขอบทำให้ทรีปกติแดงโดยชอบ · ประกาศข้อความนั้นไว้ตรง ๆ แรงกว่า "ยังเขียว"
sens_appears "S7 (off-by-one ที่แขนทิศหด)" 's/-lt "\$want"/-le "\$want"/' scene_U 0 \
  "${PINS[0]} รันจริง $(( PIN_WANT[${PINS[0]}] )) เทส แต่หมุดไว้ $(( PIN_WANT[${PINS[0]}] ))" \
  "${PINS[0]} รันจริง $(( PIN_WANT[${PINS[0]}] )) เทส แต่หมุดไว้ $(( PIN_WANT[${PINS[0]}] ))"
