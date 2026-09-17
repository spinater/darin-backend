#!/usr/bin/env bash
# เกตของ **"สคริปต์อ่านไบต์พาธจาก git ตามที่ git คายออกมาจริงไหม"** (ใบ 314)
#
# ## อาการที่มันเกิดมาปิด — วัดแล้ว ไม่ใช่การเผื่อเหนียว
#
# `core.quotePath` มีค่าเริ่มต้นเป็น `true` ⇒ คำสั่ง git ที่ **คายพาธ** ใส่เครื่องหมายคำพูดให้
# พาธที่ไม่ใช่ ASCII เสมอ (วัดบน git 2.53.0 วันที่เปิดใบ):
#
#   git ls-files              → ".docs/artifact/\340\270\225…"       quote
#   git diff --name-only      → เหมือนกัน                              quote
#   git grep -l               → เหมือนกัน                              quote
#   git grep -n               → quote **เฉพาะช่องชื่อไฟล์**
#   git check-ignore --stdin  → quote **ของที่คายกลับออกมา**
#   git status --porcelain    → เหมือนกัน
#
# ⇒ ลูปที่ได้สตริงขึ้นต้นด้วย `"` ⇒ `[ -f "$f" ]` ล้มทุกใบ ⇒ `continue` เงียบ ๆ · วัดในรีโปจริง
# วันเปิดใบ: **24 จาก 2,489 ไฟล์** หายจากทุกเกตที่ใช้สำนวนเปล่า ๆ · และที่แพงกว่านั้นคือทิศที่
# **แดงปลอม**: `check-sql-coverage.sh` เทียบคลังจาก glob (ไบต์ดิบ) กับคลังจาก git (quote) ⇒
# ไฟล์ชื่อไทยใบเดียวทำให้เกตหยุดทั้งใบด้วยข้อความ "ไฟล์ที่ git ติดตามไว้ไม่ได้ถูกสแกน" **ทั้งที่
# มันถูกสแกนไปแล้ว** และแก้ไม่ได้เลยนอกจากเปลี่ยนชื่อไฟล์
#
# 🔑 **ทำไมต้องเป็น *เกต* ไม่ใช่การแก้สิบสามจุด** — คำเตือนเรื่องนี้เขียนไว้ในรีโปตั้งแต่ใบ 195
# ที่หัว `check-card-paths.sh` แต่การแก้ไปอยู่ที่เกตใบเดียว ⇒ พี่น้องยังตาบอดต่อมาอีก 119 ใบงาน
# ⇒ บทเรียนเดียวกับ §6 rule 1 คำต่อคำ: *"การแก้ที่ไม่มีเกตเฝ้า คือความจำของคนเขียน"*
#
# ## มันตัดสินยังไง — ขั้นที่ตัดทิ้งมากที่สุด **ไม่ใช้ลิสต์เลย**
#
#   1. คลัง = ไฟล์เชลล์ทุกใบที่ git ถือ (`scripts/lib/shell-corpus.sh` — บ้านเดียวกับใบ 239)
#   2. ทุกจุดเรียก `git` ถูกถามก่อนว่า **มีใครกิน stdout ไหม** (ท่อ · `$( )` · `<( )` · เปลี่ยน
#      ทางลงไฟล์) และ **โยนทิ้งหรือเปล่า** (`>/dev/null` · `-q`) — ขั้นนี้ตัดไป 72 จาก 108 จุด
#      **โดยไม่มีรายชื่อ subcommand สักตัว** ⇒ `git add` `git mv` `git init` `git commit` หายไป
#      ด้วยเหตุผลเชิงโครงสร้าง ไม่ใช่เพราะมีคนพิมพ์ชื่อมันไว้ (§6 rule 1)
#   3. ที่เหลือต้องมี `-z`/`--null` — และถ้ามีแล้ว **ตัวอ่านต้องอ่านแบบ NUL ด้วย**
#      (`read -r -d ''`) · การแก้ครึ่งเดียวคือ **ลูปวนศูนย์รอบ** ซึ่งเงียบกว่าบั๊กเดิมที่ข้ามแค่
#      ไฟล์ชื่อไทย ⇒ คนละข้อความ คนละทางแก้
#   4. ทางออกตามกฎหมายทางเดียว = แถวใน `scripts/path-bytes-allowlist.txt` ที่อ้าง `ใบ NNN`
#      **และปักจำนวนจุดไว้** ⇒ เพิ่มจุดใหม่ในไฟล์เดิมไม่ได้ฟรี (บทเรียนหมุด junit ใบ 298)
#
# ## ที่ด่านนี้ **มองไม่เห็น** — เขียนไว้เพราะเกตที่ตัดสินด้วยตัวข้ามต้องประกาศเขตบอดของตัวเอง
#
# · **ผู้เรียก git ที่ไม่ใช่เชลล์** (`execSync('git …')` ใน `.mjs` · `Command::new("git")`) —
#   วันนี้มี **ศูนย์ราย** (วัดแล้ว) ⇒ ด่านพิมพ์จำนวนไฟล์นอกเชลล์ที่เอ่ยถึงคำสั่งคายพาธเป็น
#   **ตัวดัก ไม่ใช่ด่าน** · วันที่มีรายแรก ไม่มีอะไรแดง — ยอมรับความเสี่ยงนี้อย่างเปิดเผย
# · **git ที่เรียกผ่านตัวแปร/อาเรย์** — ด่านคายคำตัดสิน `BADSUB` ให้ดังไว้ก่อน แล้วให้คนประกาศ
#   ด้วยแถว · ตัวแถวเองไม่มีอะไรพิสูจน์ว่าคำอธิบายในนั้นยังจริง ⇒ **พิมพ์ทุกแถวพร้อมเหตุผลทุกรอบ**
#   สัญญาเดียวกับหาง `- status:` ของ `task-move.sh` (§6 rule 1)
# · **`-z` ที่เป็น no-op กับธงที่ให้มา** (`diff -z --stat`) — ด่านเห็นว่า "มี `-z` แล้ว" และเขียว
#   ⇒ ทางที่ถูกคือแถว ไม่ใช่เติม `-z` ให้ผ่าน ๆ (แถว `--stat` ของ `cases-task-move.sh` เขียนไว้แล้ว)
set -euo pipefail
cd "$(dirname "$0")/.."

. scripts/lib/shell-corpus.sh
rc=$?
if [ "$rc" -ne 0 ]; then
  echo "FAIL: โหลด scripts/lib/shell-corpus.sh ไม่สำเร็จ (rc=$rc) — คลังของรอบนี้ไม่มีความหมาย"
  exit 1
fi

SCAN="scripts/lib/path-bytes-scan.awk"
# **บ้านเดียวของคำตัดสิน "บรรทัดนี้เป็นคำสั่งหรือเป็นข้อมูลใน heredoc"** (ใบ 318) — ก่อนใบนั้น
# ก้อนนี้อยู่ในตัว `$SCAN` และ `check-shell-source.sh` ไม่มีเลย ⇒ ย้ายออกมาให้ทั้งสองด่านยืมตัวเดียวกัน
HDLIB="scripts/lib/heredoc.awk"
# **บ้านเดียวของคำถาม "ส่วนไหนของบรรทัดนี้เป็นโค้ด"** (ใบ 304) — ก่อนใบนั้น `mask_and_strip()`
# กับ `is_word()` อยู่ในตัว `$SCAN` และ `scripts/check-sort-locale.sh` ต้องใช้ตัวเดียวกัน
MASKLIB="scripts/lib/shell-mask.awk"
ALLOW="scripts/path-bytes-allowlist.txt"
fail=0
swept=0
sites=0
declare -A pin_count pin_line pin_why seen_count
nrows=0

if [ ! -r "$SCAN" ] || [ ! -r "$HDLIB" ] || [ ! -r "$MASKLIB" ]; then
  echo "FAIL: ไม่มีตัวอ่าน $SCAN หรือ $HDLIB หรือ $MASKLIB — ด่านนี้ตรวจอะไรไม่ได้เลย"
  exit 1
fi

# ── อ่านไฟล์ข้อมูล · ห้าห้อง ห้าข้อความ ห้าทางแก้ (รูปเดียวกับ `check-text-bytes.sh` ใบ 277)
if [ ! -r "$ALLOW" ]; then
  echo "FAIL: ไม่มีไฟล์ข้อมูล $ALLOW — ตัวข้ามที่หายไปคือตัวข้ามที่ไม่มีใครเห็น"
  exit 1
fi
rows=0
while IFS= read -r line || [ -n "$line" ]; do
  rows=$((rows + 1))
  case "$line" in '' | '#'*) continue ;; esac
  IFS=$'\t' read -r rpath rsub rcnt rwhy <<<"$line"
  if [ -z "${rpath:-}" ] || [ -z "${rsub:-}" ] || [ -z "${rcnt:-}" ]; then
    echo "FAIL: $ALLOW:$rows — รูปแถวผิด ต้องเป็น <พาธ><TAB><subcommand><TAB><จำนวน><TAB># ใบ NNN · เหตุผล"
    fail=1; continue
  fi
  case "$rcnt" in ''|*[!0-9]*) echo "FAIL: $ALLOW:$rows — จำนวนต้องเป็นเลขจำนวนเต็ม: \"$rcnt\""; fail=1; continue ;; esac
  [ "$rcnt" -gt 0 ] || { echo "FAIL: $ALLOW:$rows — จำนวนต้องมากกว่า 0 (แถวที่ยกเว้น 0 จุดคือแถวที่ไม่มีเหตุผลจะอยู่)"; fail=1; continue; }
  case "${rwhy:-}" in
    *"ใบ "[0-9][0-9][0-9]*) ;;
    *) echo "FAIL: $ALLOW:$rows — แถวต้องอ้างใบงาน: \`# ใบ NNN · เหตุผล\` (แถวที่ไม่บอกที่มา = แถวที่ไม่มีใครรื้อได้อีก)"; fail=1; continue ;;
  esac
  key="$rpath	$rsub"
  if [ -n "${pin_count[$key]+x}" ]; then
    echo "FAIL: $ALLOW:$rows — แถวซ้ำ (\"$rpath\" + \"$rsub\" มีอยู่แล้วที่บรรทัด ${pin_line[$key]})"
    echo "      (แถวหนึ่งกลบอีกแถว ⇒ ด่านกันสุสานปลดแถวที่ตายแล้วไม่ลง)"
    fail=1; continue
  fi
  pin_count[$key]="$rcnt"; pin_line[$key]="$rows"; pin_why[$key]="$rwhy"
  nrows=$((nrows + 1))
done < "$ALLOW"
# ⚠️ **0 แถว = ถูกกฎหมาย และเป็นสภาพพักที่ถูกต้องของไฟล์นี้** — ต่างจาก `scripts/binary-kinds.txt`
# ของใบ 277 ที่แถวเป็น *ข้อเท็จจริงของโลก* (ไฟล์ binary มีอยู่จริง ⇒ 0 แถวแปลว่าอ่านไม่ออก)
# ที่นี่แถวคือ **หนี้** แบบเดียวกับ `scripts/file-length-allowlist.txt` ซึ่ง §4 บอกเองว่าว่างคือ
# สภาพที่ถูกต้อง ⇒ ทำให้ 0 แถวแดง = สั่งให้คนสร้างหนี้ขึ้นมาหนึ่งก้อนเพื่อให้เกตเขียว

# เทียบเป็น **สตริงตรงตัว ห้าม `case`** — `web/src/app/[locale]/(app)/…` เป็นไดเรกทอรีจริง (ใบ 190)
waived() { [ -n "${pin_count[$1]+x}" ]; }

# ── กวาด
d_notconsumed=0; d_discard=0; d_hasz=0; d_waived=0
while IFS= read -r -d '' f; do
  swept=$((swept + 1))
  while IFS=$'\t' read -r ln verdict scmd snip; do
    [ -n "${ln:-}" ] || continue
    sites=$((sites + 1))
    case "$verdict" in
      NOTCONSUMED) d_notconsumed=$((d_notconsumed + 1)); continue ;;
      DISCARD) d_discard=$((d_discard + 1)); continue ;;
      HASZ) d_hasz=$((d_hasz + 1)); continue ;;
    esac
    key="$f	$scmd"
    if waived "$key"; then
      seen_count[$key]=$(( ${seen_count[$key]:-0} + 1 ))
      d_waived=$((d_waived + 1)); continue
    fi
    case "$verdict" in
      ZCONSUMER)
        echo "FAIL: $f:$ln — มี \`-z\` แล้วแต่ **ตัวอ่านยังอ่านทีละบรรทัด** ⇒ ลูปนี้วนศูนย์รอบ"
        echo "      $snip"
        echo "      แก้: \`while IFS= read -r -d '' x; do … done < <(… -z)\` — การแก้ครึ่งเดียว"
        echo "      เงียบกว่าบั๊กเดิม เพราะบั๊กเดิมข้ามแค่ไฟล์ชื่อไทย อันนี้ข้ามทั้งคลัง"
        ;;
      ZSUBST)
        echo "FAIL: $f:$ln — \`-z\` อยู่ใน \`\$( )\` ⇒ **เชลล์กลืนไบต์ NUL ทิ้ง** ได้ก้อนเดียวติดกัน"
        echo "      $snip"
        echo "      แก้: ต่อ \`| tr '\\0' '\\n'\` ท้ายคำสั่ง หรือเปลี่ยนไปใช้ \`< <( )\` + \`read -r -d ''\`"
        ;;
      BADSUB)
        echo "FAIL: $f:$ln — อ่าน subcommand ไม่ออก ⇒ ด่านนี้มองไม่ทะลุจุดนี้"
        echo "      $snip"
        echo "      (คำสั่งถูกเก็บไว้ในอาเรย์/\`\"\$@\"\` ของฟังก์ชันห่อ — เขตบอดจริง ไม่ใช่บั๊กของโค้ด)"
        echo "      แก้: ประกาศออกมาด้วยแถวใน $ALLOW พร้อมเหตุผล — ห้ามปล่อยให้เงียบ"
        ;;
      *)
        echo "FAIL: $f:$ln — \`git $scmd\` คายพาธและมีคนกิน stdout แต่ไม่มี \`-z\`"
        echo "      $snip"
        echo "      ⇒ พาธที่ไม่ใช่ ASCII จะถูก quote (\`core.quotePath\`) ⇒ เทียบ/ทดสอบไฟล์ล้มเงียบ ๆ"
        echo "      แก้: เติม \`-z\` แล้วอ่านด้วย \`read -r -d ''\` · ถ้า \`-z\` ช่วยไม่ได้จริง"
        echo "      (คายเวลา · คายเนื้อไฟล์ · คายตารางให้คนอ่าน) ที่ของมันคือแถวใน $ALLOW"
        ;;
    esac
    fail=1
  done < <(awk -f "$HDLIB" -f "$MASKLIB" -f "$SCAN" "$f")
done < <(shell_corpus)

# ── ตัวข้ามห้ามเป็นสุสาน — **สามทิศ คนละข้อความ คนละทางแก้**
for key in ${pin_count[@]+"${!pin_count[@]}"}; do
  rpath="${key%%	*}"; rsub="${key##*	}"
  got="${seen_count[$key]:-0}"; want="${pin_count[$key]}"
  if [ ! -e "$rpath" ]; then
    echo "FAIL: $ALLOW:${pin_line[$key]} — ไม่มีไฟล์นี้แล้ว: $rpath (ถอดแถวออก — ตัวข้ามห้ามเป็นสุสาน)"
    fail=1; continue
  fi
  if [ "$got" -eq 0 ]; then
    echo "FAIL: $ALLOW:${pin_line[$key]} — ไม่มีจุด \`git $rsub\` ที่ต้องยกเว้นในไฟล์นี้แล้ว: $rpath"
    echo "      (แก้ไปแล้ว · ย้ายไปไฟล์อื่น · หรือไฟล์หลุดจากคลังเชลล์ ⇒ ถอดแถวออก)"
    fail=1; continue
  fi
  if [ "$got" -ne "$want" ]; then
    if [ "$got" -gt "$want" ]; then
      echo "FAIL: $ALLOW:${pin_line[$key]} — $rpath มีจุด \`git $rsub\` ที่ต้องยกเว้น $got จุด แต่ปักไว้ $want"
      echo "      (มีคนเพิ่มจุดใหม่ในไฟล์ที่มีแถวอยู่แล้ว ⇒ แถวเดิมจะยกเว้นให้ฟรีโดยไม่มีใครเห็น)"
      echo "      ⇒ ตรวจจุดใหม่ด้วยตาก่อน แล้วค่อยแก้เลขในแถวเป็น $got"
    else
      echo "FAIL: $ALLOW:${pin_line[$key]} — $rpath เหลือจุด \`git $rsub\` แค่ $got จุด แต่ปักไว้ $want"
      echo "      (จุดหายไป — แก้แล้วหรือถูกลบ ⇒ ลดเลขลงเป็น $got ได้ แต่ใบงานต้องเขียนว่าทำไม)"
    fi
    fail=1
  fi
done

# ── ตัวดัก (ไม่ใช่ด่าน): ผู้เรียก git ที่ไม่ใช่ไฟล์เชลล์ — วันนี้ควรเป็น 0
# ⚠️ **ตัวมันเองก็ต้องอยู่ใต้กติกาของตัวเอง** — รอบแรกที่รันด่านนี้ มันแดงใส่บรรทัดนี้เอง
# เพราะเขียน `git grep -l` เปล่า ๆ · เกตที่ไล่จับ output ที่ถูก quote ขณะที่ตัวเองอ่านแบบ quote
# คือเรื่องตลกรุ่นหนึ่งของตัวมันเอง ⇒ นับจำนวน NUL ไม่ใช่จำนวนบรรทัด
# `|| true` เพราะ `git grep` คืน 1 เมื่อไม่เจอ ซึ่งภายใต้ `pipefail` + `set -e` = สคริปต์ตาย
# เงียบ ๆ ด้วย rc=1 โดยไม่พิมพ์อะไรเลย (เกิดจริงในรอบถัดมาจากคอมเมนต์ข้างบน)
outside=$( { git grep -z -l -E "(execSync|spawnSync|spawn|subprocess|Command::new)[^\n]*git" \
  -- ':!*.md' ':!.docs/*' ':!scripts/*' 2>/dev/null || true; } | tr -cd '\0' | wc -c | tr -d ' ')

# ── สองตัวนับ ไม่ใช่ตัวเดียว: ตัวแรกพิสูจน์ *ตัวเลือกไฟล์* ตัวที่สองพิสูจน์ *ตัวแยกคำ*
# (ตั้งชื่อตัวแปร awk ทับชื่อสงวนครั้งเดียว ตัวอ่านก็คาย 0 บรรทัดพร้อม stderr แล้วรอบนั้นเขียว)
if [ "$swept" -eq 0 ]; then
  echo "FAIL: check-path-bytes กวาดไฟล์เชลล์ไม่ได้เลยสักใบ — ตัวคัดไฟล์พัง ไม่ใช่รีโปสะอาด"
  fail=1
elif [ "$sites" -eq 0 ]; then
  echo "FAIL: check-path-bytes กวาดเชลล์ $swept ใบแต่ไม่เจอจุดเรียก git เลยสักจุด — ตัวแยกคำพัง"
  fail=1
fi

# ── พิมพ์ทุกแถวพร้อมเหตุผลทุกรอบ — ทิศเดียวที่เครื่องตรวจไม่ได้คือ "เหตุผลในแถวกลายเป็นเท็จ"
# ⇒ เอาไปวางตรงหน้าคนทุกรอบ แทนที่จะพิมพ์แค่จำนวน
if [ "$nrows" -gt 0 ]; then
  echo "check-path-bytes: ยกเว้นไว้ $nrows แถว (อ่านเหตุผลทุกรอบ — ไม่มีเครื่องไหนตรวจได้ว่ามันยังจริง)"
  while IFS= read -r line; do
    case "$line" in '' | '#'*) continue ;; esac
    IFS=$'\t' read -r rpath rsub rcnt rwhy <<<"$line"
    [ -n "${rpath:-}" ] && printf '           · %s · git %s × %s %s\n' "$rpath" "$rsub" "$rcnt" "$rwhy"
  done < "$ALLOW"
fi

if [ "$fail" -eq 0 ]; then
  echo "check-path-bytes: OK — กวาดเชลล์ $swept ใบ · จุดเรียก git $sites จุด"
  echo "           (ไม่มีใครกิน stdout $d_notconsumed · โยนทิ้ง $d_discard · มี -z แล้ว $d_hasz · ยกเว้น $d_waived)"
  echo "           · ไฟล์นอกเชลล์ที่เอ่ยถึงการเรียก git $outside ใบ (ตัวดัก ไม่ใช่ด่าน — ดูหัวไฟล์)"
fi
exit "$fail"
