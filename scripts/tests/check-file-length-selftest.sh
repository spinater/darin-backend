#!/usr/bin/env bash
# เกตของ `scripts/check-file-length.sh` + `.claude/hooks/check-file-length.sh` (task 193)
#
# รูปเดียวกับพี่น้องในโฟลเดอร์นี้ (ใบ 095 · 151 · 168 · 187 · 190): ก๊อปตัวเกตลงแซนด์บ็อกซ์ใน
# `.scratch/` แล้วรันบนทรีปลอมที่เราคุมทุกไบต์ — ไม่แตะไฟล์จริงของรีโปสักใบ
#
# ## ทำไมเกตนี้ต้องมีเกตของตัวเอง
#
# ก่อนใบ 193 ตาข่าย §4 เลือกไฟล์ด้วย **รายชื่อสกุล** (`*.ts|*.tsx|*.js|*.jsx|*.rs|*.sql|*.css`)
# ⇒ `.sh` `.mjs` `.py` `.awk` `.yml` ไม่เคยถูกกวาดเลยสักรอบตั้งแต่คอมมิตแรก และ **ไม่มีอะไรบอก**
# — วัดวันเปิดใบพบของที่ไม่มีใครเห็นอยู่สี่ไฟล์: **เกินเพดานสามใบ** (591 · 567 · 503) และอีกใบ
# พอดี 500 ซึ่งเกตใบเดียวกันนี้บอกเองว่าไม่ผิด (เคส B) — รวมถึงตัวเกตเองสองใบ
# ⇒ นี่คือคลาส "เกตที่ยังเขียวอยู่ได้ตอนที่มันไม่ได้ตรวจอะไรเลย" เหมือนใบ 190 เป๊ะ
# ⇒ ของที่ต้องเฝ้าไม่ใช่ "มันจับไฟล์ยาวได้ไหม" แต่คือ **ขอบเขตที่มันมองเห็น**
#
# ## กติกาสองข้อที่ห้ามลืมตอนแก้ไฟล์นี้
#
# 1. ทุกการยกเว้นต้องคู่กับ **ฉากที่การยกเว้นนั้นทำงานจริง** — จับคู่ตัวกันกับฉากที่มันไม่ได้วิ่ง
#    คือการวัดว่า "ถอดของที่ไม่ได้ทำงานออกแล้วไม่มีอะไรเปลี่ยน" ซึ่งจริงโดยโครงสร้าง (ใบ 190 เขียน
#    ผิดมาแล้วหนึ่งรอบในการ์ดของตัวเอง) ⇒ ฉาก GREEN จึง **ยัดไฟล์เกินเพดานที่อยู่นอกขอบเขตไว้
#    ครบทุกชนิด** (`.md` · `.docs/` · binary · lockfile · gitignored · vendored · migration)
#    ถอดการยกเว้นข้อไหนออก ฉาก GREEN ต้องแดง **พร้อมชื่อไฟล์ของข้อนั้น**
# 2. "exit เปลี่ยน" อย่างเดียวหยาบเกินไป (ใบ 190) — ฉาก RED แดงอยู่แล้วด้วยหลายเหตุพร้อมกัน
#    ⇒ ทุกแถวในตารางความไวผูกกับ **ข้อความลายเซ็น** ที่ต้องมี/ต้องหาย ไม่ใช่กับเลข exit
#    · และแถวที่ `sed` แล้วไฟล์ไม่เปลี่ยนสักไบต์ = แถวที่ไม่ได้วัดอะไร ⇒ ปฏิเสธการให้คะแนน
set -uo pipefail
cd "$(dirname "$0")/../.."

pass=0
fail=0
ok() { pass=$((pass + 1)); }
bad() {
  fail=$((fail + 1))
  echo "FAIL: $*"
}

SANDBOX=".scratch/file-length-selftest-$$"
trap 'rm -rf "$SANDBOX"' EXIT
mkdir -p "$SANDBOX"

mkfile() { # $1=พาธ $2=จำนวนบรรทัด — เนื้อไม่สำคัญ สำคัญที่จำนวน `\n`
  mkdir -p "$(dirname "$1")"
  awk -v n="$2" 'BEGIN{for(i=1;i<=n;i++) print "x"}' > "$1"
}
mkbin() { # $1=พาธ $2=จำนวนบรรทัด — มีไบต์ NUL ⇒ `grep -I` ถือว่าเป็น binary
  mkdir -p "$(dirname "$1")"
  awk -v n="$2" 'BEGIN{for(i=1;i<=n;i++) print "aQb"}' | tr 'Q' '\000' > "$1"
}
install_scripts() { # $1=รากแซนด์บ็อกซ์ — วางเกต/โมดูลขอบเขต/hook ไว้ตำแหน่งเดียวกับของจริง
  mkdir -p "$1/scripts/lib" "$1/.claude/hooks"
  cp scripts/check-file-length.sh "$1/scripts/"
  cp scripts/lib/file-length-scope.sh "$1/scripts/lib/"
  cp .claude/hooks/check-file-length.sh "$1/.claude/hooks/"
}
run_gate() { # $1=รากแซนด์บ็อกซ์ ; ตั้ง OUT/RC
  OUT=$(cd "$1" && bash scripts/check-file-length.sh 2>&1)
  RC=$?
}
has() { case "$OUT" in *"$1"*) return 0 ;; esac; return 1; }
want_has() { has "$1" && ok || bad "$2 — ไม่พบข้อความ: $1"; }
want_hasnt() { has "$1" && bad "$2 — เจอข้อความที่ไม่ควรมี: $1" || ok; }
want_rc() { [ "$RC" = "$1" ] && ok || bad "$2 — exit=$RC คาด $1"; }

# ── ฉาก GREEN: ทรีที่ **ต้องเขียว** ทั้งที่เต็มไปด้วยไฟล์เกินเพดานซึ่งอยู่นอกขอบเขต §4
G="$SANDBOX/green"
install_scripts "$G"
git -C "$G" init -q 2>/dev/null || { echo "FAIL: git init ในแซนด์บ็อกซ์ไม่สำเร็จ"; exit 1; }
printf '.scratch/\nbuilt/\n' > "$G/.gitignore"
mkfile "$G/README.md" 620                          # ร้อยแก้ว (§4)
mkfile "$G/.docs/technical/big.txt" 620            # ทุกอย่างใต้ .docs/
mkbin "$G/assets/photo.HEIC" 620                   # binary — ตรวจจากเนื้อ ไม่ใช่จากนามสกุล
mkfile "$G/api/Cargo.lock" 620                     # lockfile = เครื่องเขียน
mkfile "$G/built/bundle.js" 620                    # .gitignore กินไว้
mkfile "$G/web/src/components/ui/table.tsx" 620    # vendored shadcn
mkfile "$G/web/src/api.d.ts" 620                   # generated
mkfile "$G/api/migrations/0001_init.sql" 620       # แตกแล้วความหมายเปลี่ยน
mkfile "$G/scripts/fine.sh" 500                    # พอดีเพดาน = ไม่ผิด
mkfile "$G/scripts/near.sh" 451                    # 450–500 = warn
mkfile "$G/web/src/messages/th.json" 620           # ยกหนี้ไว้ใน allowlist
printf 'web/src/messages/th.json  # task 001 — เหตุผล\n' > "$G/scripts/file-length-allowlist.txt"

run_gate "$G"
want_rc 0 "GREEN (ทรีที่ต้องเขียว)"
want_has "check-file-length: OK" "GREEN (บรรทัดสรุปบอกจำนวนที่กวาดจริง)"
want_has "near.sh — 451" "C (450–500 = warn ไม่ใช่ FAIL)"
want_hasnt "FAIL" "GREEN (ห้ามมี FAIL สักบรรทัด)"
want_hasnt "FAIL: scripts/fine.sh" "B (500 พอดี = ยังไม่ผิด · warn ได้ FAIL ไม่ได้)"
want_has "ยกหนี้ไว้ใน" "J (แถวยกหนี้ที่ถูกต้อง = เขียวแต่ยังพูดออกมา)"

# ── ฉาก RED: ทุกชนิดของการละเมิดในทรีเดียว — ยืนยันด้วย **ข้อความ** ไม่ใช่เลข exit
R="$SANDBOX/red"
install_scripts "$R"
git -C "$R" init -q
printf '.scratch/\n' > "$R/.gitignore"
# หัวใจของใบ 193 — สกุลที่ตาข่ายเดิมมองไม่เห็นเลยสักรอบ
mkfile "$R/scripts/long.sh" 501
mkfile "$R/scripts/long.mjs" 501
mkfile "$R/tools/long.py" 501
mkfile "$R/scripts/lib/long.awk" 501
mkfile "$R/.github/workflows/long.yml" 501
mkfile "$R/api/Dockerfile" 501
# allowlist ต้องเทียบ **สตริงตรงตัว** — `[abc]` ห้ามถูกอ่านเป็น glob (พาธจริงของ Next.js
# มี `[locale]` กับ `(app)` อยู่ ⇒ อ่านเป็น glob = ยกเว้นเกินจริงแบบเงียบ ๆ · ใบ 190 คำต่อคำ)
mkfile "$R/web/x[abc].ts" 501
mkfile "$R/web/xa.ts" 501
mkfile "$R/web/nocite.ts" 501
mkfile "$R/web/shrunk.ts" 120
mkfile "$R/notes.md" 501
# W: **หนึ่งแถวต้องยกหนี้ให้ไฟล์เดียว ไม่ใช่ทั้งตระกูลที่พาธลงท้ายเหมือนกัน** — แขน `*/"$a"` ของ
# `flen_waived` มีไว้ให้ hook ตอนได้พาธสัมบูรณ์ แต่การกวาดส่งพาธสัมพัทธ์เข้ามาเสมอ ⇒ ถ้าไม่กั้นด้วย
# `/*` แถวเดียวจะยกหนี้ให้ไฟล์ที่ไม่มีใครใส่ไว้ในลิสต์ **โดยที่ด่านกันสุสานมองไม่เห็น** (มันเดินตามแถว
# ไม่ได้เดินตามไฟล์) · รีวิวสายค้านของใบ 193 วัดเจอ
mkfile "$R/sub/deep.ts" 501
mkfile "$R/extra/sub/deep.ts" 501
# K2: **ตัวปลดหนี้ต้องเทียบทั้งเซกเมนต์** — `waived_hit` ที่หลวมเป็น `*"$path"*` จะอ่านว่า `a/b.ts`
# ถูกปลดไปแล้วเพราะสตริง `xa/b.ts` มีมันอยู่ข้างใน ⇒ **แถวสุสานจริงหายไปเงียบ ๆ**
mkfile "$R/xa/b.ts" 501
mkfile "$R/a/b.ts" 10
{
  printf 'web/x[abc].ts  # task 001 — เทียบตรงตัว\n'
  printf 'web/shrunk.ts  # task 002 — ลดลงต่ำกว่าเพดานแล้ว\n'
  printf 'web/gone.ts  # task 003 — ไฟล์หายไปแล้ว\n'
  printf 'notes.md  # task 004 — อยู่นอกขอบเขตอยู่แล้ว\n'
  printf 'sub/deep.ts  # task 005 — ยกหนี้ให้ตัวมันเอง ห้ามลามไปทั้งตระกูล\n'
  printf 'xa/b.ts  # task 006 — ยกหนี้จริง (ใช้คู่กับแถวล่างเพื่อวัดตัวปลดหนี้)\n'
  printf 'a/b.ts  # task 007 — ต่ำกว่าเพดานแล้ว ⇒ ต้องแดงเสมอ\n'
  printf 'web/nocite.ts\n'
} > "$R/scripts/file-length-allowlist.txt"

run_gate "$R"
want_rc 1 "RED (ทรีที่ต้องแดง)"
for f in scripts/long.sh scripts/long.mjs tools/long.py scripts/lib/long.awk \
  .github/workflows/long.yml api/Dockerfile; do
  want_has "FAIL: $f — 501" "A/D ($f — สกุลที่เกตเดิมมองไม่เห็น)"
done
want_has "FAIL: web/xa.ts — 501" "S (allowlist ห้ามถูกอ่านเป็น glob)"
want_hasnt "FAIL: web/x[abc].ts" "S (แถวที่เทียบตรงตัวต้องยกหนี้ได้จริง)"
want_has "ไม่เกินเพดานแล้ว" "K (สุสานทิศ 'ลดลงแล้วแต่ยังอยู่ในลิสต์')"
want_has "ไม่มีไฟล์นี้แล้ว" "L (สุสานทิศ 'ไฟล์หายไปแล้ว')"
want_has "อยู่นอกขอบเขตกติกา" "M (สุสานทิศ 'ปลดไม่ได้เชิงตรรกะ')"
want_has "ต้องอ้างใบงาน" "N (แถวที่ไม่อ้าง \`# task NNN\`)"
want_has "FAIL: extra/sub/deep.ts — 501" "W (แถวเดียวห้ามยกหนี้ให้ไฟล์ที่พาธลงท้ายเหมือนกัน)"
want_hasnt "FAIL: sub/deep.ts —" "W (แถวที่ลิสต์ไว้เองต้องยังยกหนี้ได้)"
want_has "ไม่เกินเพดานแล้ว (10 บรรทัด): a/b.ts" "K2 (ตัวปลดหนี้ต้องเทียบทั้งเซกเมนต์)"

# ── สองชั้นต้องตัดสินตรงกัน — ข้อที่ใบ 193 เปิดมาเพื่อปิด (เดิมเป็น `case` สองสำเนา
# ⇒ แก้ที่เดียวแล้วอีกที่เงียบ) · ⚠️ วัดจาก **พฤติกรรม** ไม่ใช่จากการ grep หาบรรทัด `source`
# — สำเนาที่สองกลับมาในรูปโค้ดที่ก๊อป *หลัง* จาก source ก็ได้ และการ grep มองไม่เห็น
hook_rc() { # $1=ราก $2=พาธสัมพัทธ์ → exit code ของ hook
  printf '{"tool_input":{"file_path":"%s"}}' "$(cd "$1" && pwd)/$2" \
    | (cd "$1" && bash .claude/hooks/check-file-length.sh) >/dev/null 2>&1
  echo $?
}
agree() { # $1=ราก $2=พาธ $3=exit ที่คาดจาก hook (0 = ผ่าน, 2 = ละเมิด)
  local got
  got=$(hook_rc "$1" "$2")
  [ "$got" = "$3" ] && ok || bad "O (hook ไม่ตรงกับการกวาด: $2 → exit=$got คาด $3)"
}
agree "$R" scripts/long.sh 2
agree "$R" scripts/long.mjs 2
agree "$R" api/Dockerfile 2
agree "$R" "web/x[abc].ts" 0   # ยกหนี้แล้ว ⇒ ห้ามตะโกนซ้ำทุกครั้งที่มีคนแตะไฟล์
agree "$G" README.md 0
agree "$G" .docs/technical/big.txt 0
agree "$G" assets/photo.HEIC 0
agree "$G" api/Cargo.lock 0
agree "$G" built/bundle.js 0
agree "$G" scripts/fine.sh 0
agree "$G" web/src/components/ui/table.tsx 0
agree "$G" api/migrations/0001_init.sql 0

echo "── เคสพฤติกรรม: ผ่าน $pass · ไม่ผ่าน $fail"

# ── ตารางความไว: ถอดการแก้ **ทีละอย่าง** ออกจากสำเนา แล้วดูว่าคู่ของมันพลิกจริงไหม
sens_n=0
sens_bad=0
sens() { # $1=ชื่อ $2=gate|lib $3=สคริปต์sed $4=G|R $5=ข้อความลายเซ็น $6=gone|appear
  local name="$1" root tgt
  case "$4" in G) root="$G" ;; R) root="$R" ;; esac
  case "$2" in
    gate) tgt="$root/scripts/check-file-length.sh" ;;
    lib) tgt="$root/scripts/lib/file-length-scope.sh" ;;
  esac
  sens_n=$((sens_n + 1))
  cp "$tgt" "$tgt.orig"
  sed "$3" "$tgt.orig" > "$tgt"
  if cmp -s "$tgt.orig" "$tgt"; then
    sens_bad=$((sens_bad + 1))
    echo "  $name — ❌ sed ไม่เปลี่ยนไฟล์สักไบต์ (แถวนี้ไม่ได้วัดอะไร)"
    mv -f "$tgt.orig" "$tgt"
    return
  fi
  run_gate "$root"
  if [ "$6" = gone ]; then
    if has "$5"; then
      sens_bad=$((sens_bad + 1)); echo "  $name — ❌ ถอดแล้วลายเซ็นยังอยู่"
    else echo "  $name — ✅ ลายเซ็นหายตามคาด"; fi
  else
    if has "$5"; then echo "  $name — ✅ ลายเซ็นโผล่ตามคาด"
    else sens_bad=$((sens_bad + 1)); echo "  $name — ❌ ถอดแล้วไม่มีอะไรเปลี่ยน"; fi
  fi
  mv -f "$tgt.orig" "$tgt"
}

echo "── ความไวที่วัดจริง (ถอดทีละอย่าง):"
# ฝั่ง "ยกเว้นกว้างเกินไป" — ถอดออกแล้ว **ฉาก GREEN ต้องแดง** พร้อมชื่อไฟล์ของข้อนั้น
sens "S1  จุดเรียกตัวคัดขอบเขต" gate '/flen_path_excluded "\$f" && continue/d' G "FAIL: README.md" appear
sens "S2  --exclude-standard (เคารพ .gitignore)" gate 's/ --exclude-standard//' G "FAIL: built/bundle.js" appear
sens "S3  ตัวตรวจ binary จากเนื้อไฟล์" gate '/flen_is_binary "\$f" && continue/d' G "FAIL: assets/photo.HEIC" appear
sens "S4  การยกหนี้ตาม allowlist" gate 's/if flen_waived "\$f"; then/if false; then/' G "FAIL: web/src/messages/th.json — 620" appear
sens "S5  การปลดหนี้ (waived_hit)" gate '/) continue ;;/d' G "ไม่เกินเพดานแล้ว" appear
sens "S6  เพดาน WARN" gate 's/^WARN="\$FLEN_WARN"/WARN=600/' G "near.sh — 451" gone
sens "S7  ยกเว้นร้อยแก้ว (*.md/.docs)" lib '/\*\.md | \.docs\/\*/d' G "FAIL: README.md" appear
sens "S8  ยกเว้น lockfile" lib '/\*\.lock | \*-lock\.json/d' G "FAIL: api/Cargo.lock" appear
sens "S9  ยกเว้น vendored shadcn" lib '/components\/ui\/\*/d' G "FAIL: web/src/components/ui/table.tsx" appear
sens "S10 ยกเว้น generated/.d.ts" lib '/\*\.d\.ts | \*generated\*/d' G "FAIL: web/src/api.d.ts" appear
sens "S11 ยกเว้น migration" lib '/^    migrations\/\* | \*\/migrations\/\*/d' G "FAIL: api/migrations/0001_init.sql" appear
# ฝั่ง "ตรวจน้อยเกินไป" — ถอดออกแล้วของที่ควรแดงต้องเงียบ (ลายเซ็นหาย)
sens "S12 เพดาน HARD" gate 's/^HARD="\$FLEN_HARD"/HARD=9999/' R "FAIL: scripts/long.sh" gone
sens "S13 สุสานทิศ 'ลดลงแล้ว'" gate '/ไฟล์นี้ไม่เกินเพดานแล้ว/d' R "ไม่เกินเพดานแล้ว" gone
sens "S14 สุสานทิศ 'ไฟล์หาย'" gate '/ไม่มีไฟล์นี้แล้ว/d' R "ไม่มีไฟล์นี้แล้ว" gone
sens "S15 สุสานทิศ 'นอกขอบเขต'" gate '/อยู่นอกขอบเขตกติกา/d' R "อยู่นอกขอบเขตกติกา" gone
sens "S16 ด่าน '# task NNN'" gate '/แถว allowlist ต้องอ้างใบงาน/d' R "ต้องอ้างใบงาน" gone
sens "S17 เทียบ allowlist เป็นสตริงตรงตัว" lib \
  's|\[ "\$p" = "\$a" \] && return 0|case "$p" in $a) return 0 ;; esac|' R "FAIL: web/xa.ts" gone
sens "S18 แขนลงท้าย ยิงเฉพาะพาธสัมบูรณ์" lib \
  's|^    case "\$p" in /\*) case "\$p" in \*/"\$a") return 0 ;; esac ;; esac|    case "$p" in */"$a") return 0 ;; esac|' \
  R "FAIL: extra/sub/deep.ts" gone
sens "S19 ตัวปลดหนี้เทียบทั้งเซกเมนต์" gate '/) continue ;;/c\    *"$path"*) continue ;;' \
  R "ไม่เกินเพดานแล้ว (10 บรรทัด): a/b.ts" gone

echo "── ความไว: $((sens_n - sens_bad))/$sens_n แถวพลิกตามคาด"
[ "$sens_bad" -eq 0 ] || fail=$((fail + sens_bad))

if [ "$fail" -eq 0 ]; then
  echo "check-file-length-selftest: OK — $pass ข้อ + ความไว $sens_n แถว"
  exit 0
fi
echo "check-file-length-selftest: FAILED — ไม่ผ่าน $fail"
exit 1
