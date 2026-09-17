# ตัวอ่านจุดเรียก `git` ในไฟล์เชลล์หนึ่งใบ — ของ `scripts/check-path-bytes.sh` (ใบ 314)
#
# คายบรรทัดละหนึ่งจุดเรียก: <เลขบรรทัด> TAB <คำตัดสิน> TAB <subcommand> TAB <ข้อความย่อ>
#
# คำตัดสิน:
#   NOTCONSUMED  ไม่มีใครกิน stdout (ไม่ใช่ท่อ · ไม่ใช่ `$( )` · ไม่ได้เปลี่ยนทางลงไฟล์)
#   DISCARD      โยน stdout ทิ้ง (`>/dev/null`) หรือสั่งเงียบ (`-q` / `--quiet`)
#   HASZ         มี `-z`/`--null` แล้ว
#   ZCONSUMER    มี `-z` แต่ **ตัวอ่านไม่ได้อ่านแบบ NUL** ⇒ การแก้ครึ่งเดียว ซึ่งแย่กว่าบั๊กเดิม
#   ZSUBST       มี `-z` แต่อยู่ใน `$( )` ที่ไม่มี `tr`/`xargs -0` ⇒ เชลล์ **กลืน NUL ทิ้ง**
#   BADSUB       อ่าน subcommand ไม่ออก — `"$@"` ของฟังก์ชันห่อ หรือ `g=(git … )` ที่เก็บคำสั่ง
#                ไว้ในอาเรย์แล้วเรียกด้วย `"${g[@]}" <subcmd>` ทีหลัง ⇒ **เกตมองไม่ทะลุจริง ๆ**
#                ⇒ ต้องดังออกมาแล้วให้คนประกาศด้วยแถว ไม่ใช่เงียบ (subcommand คาย `-`)
#   NEEDZ        มีคนกิน stdout · ไม่มี `-z` ⇒ ผู้ต้องสงสัย (เชลล์ไปตัดสินต่อด้วยสองลิสต์)
#
# 🔑 ขั้น "ใครกิน stdout" คือขั้นที่ **ไม่ใช้ลิสต์เลย** และมันตัดจุดเรียกส่วนใหญ่ทิ้ง (`git add`
# `git mv` `git init` `git commit` …) ⇒ ลิสต์ที่เหลือจึงเล็กพอที่จะซื่อสัตย์ได้

# ── `mask_and_strip()` กับ `is_word()` **ย้ายไปอยู่บ้านเดียวที่ `scripts/lib/shell-mask.awk`
# ตั้งแต่ใบ 304** เพราะ `scripts/check-sort-locale.sh` ต้องใช้ตัวเดียวกัน (สองชั้นที่ถือสำเนา
# คำตัดสินคนละใบคือโรคที่ §4 จดไว้จากใบ 193 · เหตุผลเดียวกับที่ใบ 318 ย้ายก้อน heredoc ออกไป)
# ⇒ **ผู้เรียกต้องโหลดสามไฟล์คู่กันเสมอ**:
#   awk -f scripts/lib/heredoc.awk -f scripts/lib/shell-mask.awk -f scripts/lib/path-bytes-scan.awk <ไฟล์>
function has_flag(seg, f,   i) {
  for (i = 1; i <= length(seg); i++) if (is_word(seg, i, f)) return 1
  return 0
}
BEGIN { FS = "\n" }
{
  raw = $0
  # ── heredoc: ข้ามเนื้อทั้งก้อน — **คำตัดสินย้ายไปอยู่บ้านเดียวที่ `scripts/lib/heredoc.awk`
  # ตั้งแต่ใบ 318** เพราะ `scripts/check-shell-source.sh` ต้องใช้ตัวเดียวกัน (สองชั้นที่ถือสำเนา
  # คำตัดสินคนละใบคือโรคที่ §4 จดไว้จากใบ 193) ⇒ **ผู้เรียกต้องโหลดสองไฟล์คู่กันเสมอ**:
  #   awk -f scripts/lib/heredoc.awk -f scripts/lib/path-bytes-scan.awk <ไฟล์>
  # ⚠️ โหลดไฟล์เดียว = `hd_skip` ไม่มีตัวตน ⇒ gawk มองเป็น "เรียกฟังก์ชันที่ไม่มี" แล้วตาย
  # ทั้งรอบ ซึ่งดังพอ · แต่ด่านก็มียามอ่านไฟล์ทั้งสองไว้ข้างหน้าอีกชั้น
  if (hd_skip(raw)) next
  # ── ต่อบรรทัดที่ลงท้ายด้วย `\` — รายงานที่ **บรรทัดกายภาพแรก** เสมอ
  if (buf == "") first = NR
  line = raw
  if (line ~ /\\$/) { sub(/\\$/, " ", line); buf = buf line; next }
  line = buf line; buf = ""
  ln = first
  code = mask_and_strip(line)
  # ── จำตัวอ่านล่าสุด ไว้ตรวจคู่ของ `-z` (การแก้ครึ่งเดียว = ตัวอ่านยังอ่านทีละบรรทัด)
  # 🔴 **ต้องจำ *ก่อน* ทางออก `!~ /git/` ข้างล่าง** — บรรทัด `while … read …` แทบไม่มีคำว่า `git`
  # อยู่ในตัวเลย ⇒ วางสลับกันเมื่อไร ตัวอ่านที่ถูกต้องจะไม่เคยถูกบันทึก แล้วทุกจุด `-z` กลายเป็น
  # ZCONSUMER พร้อมกันหมด = แดงปลอมยกแผงที่ชี้สาเหตุผิด (เจอจริงตอนรันครั้งแรกของใบ 314)
  # 🔴 **ต้องเป็นสแตก ไม่ใช่ "ตัวล่าสุดที่เห็น"** — ลูปซ้อนลูปมีจริงในรีโปนี้: ชั้นที่หนึ่งของ
  # `check-links.sh` มี `while … read -r target` อยู่ **ข้างใน** `while … read -r -d '' f`
  # ⇒ ตัวล่าสุดที่เห็นตอนถึง `done < <(…)` คือตัวใน ซึ่งไม่ใช่เจ้าของ ⇒ แดงปลอมที่ชี้ผิดบรรทัด
  isrd = (code ~ /while[ \t].*read[ \t]/)
  hasd = (code ~ /read[^|;]*-d[ \t]*''/) ? 1 : 0
  # ⚠️ **`done` ต้องอยู่ในตำแหน่ง *คำสั่ง* เท่านั้น** — `for d in todo todo-human done; do` มีคำว่า
  # `done` เป็น **ข้อมูล** และรีโปนี้มีสองบรรทัดแบบนั้น (ชื่อบ้านของใบงาน) ⇒ รับว่าเป็นตัวปิดลูป
  # เมื่อไร สแตกเพี้ยนทั้งไฟล์ แล้ว `done < <(git … -z)` ที่ถูกต้องกลายเป็น ZCONSUMER (เจอจริง)
  opens = (code ~ /(^|[;|&])[ \t]*(while|until|for)[ \t(]/)
  closes = (code ~ /(^|;)[ \t]*done([ \t;]|$)/)
  if (opens && closes) { wd = hasd; wl = ln }            # ลูปบรรทัดเดียว — เจ้าของคือตัวมันเอง
  else if (opens) { sp++; st_rd[sp] = isrd; st_d[sp] = hasd; st_l[sp] = ln }
  else if (closes) {
    if (sp > 0) { wd = st_d[sp]; wl = st_l[sp]; sp-- } else { wd = 0; wl = 0 }
  }
  if (code !~ /git/) next
  for (p = 1; p <= length(code); p++) {
    if (!is_word(code, p, "git")) continue
    # command position: ต้นบรรทัด · หลัง `| & ; ( { ` !` · หรือหลังคำคุมบล็อก
    q = p - 1
    while (q >= 1 && substr(code, q, 1) ~ /[ \t]/) q--
    ch = (q >= 1) ? substr(code, q, 1) : ""
    # 📇 เคยมีตัวข้าม "\` ที่ถูก escape" อยู่ตรงนี้ · **ถอดออกเพราะวัดแล้วว่ามันเป็นโค้ดตาย**:
    # เนื้อใน `"…"` ถูกเป่าทิ้งโดย `mask_and_strip` อยู่แล้ว (backtick ที่ถูก escape ไม่เปิดโหมด
    # substitution) ⇒ `echo "… \`git mv\` …"` ไม่เหลือคำว่า git ให้เจอตั้งแต่ต้น · วัดบนคลังจริง
    # 108 จุด: ถอดออกแล้วผลเหมือนกันทุกบรรทัด ⇒ ยามที่จับคู่กับฉากที่มันไม่เคยทำงานคือยามที่
    # วัดอะไรไม่ได้เลย (บทเรียนที่ใบ 190 เขียนผิดไว้ในการ์ดตัวเองหนึ่งครั้ง)
    if (ch != "" && ch !~ /[|&;({`!]/) {
      head = substr(code, 1, q); sub(/^.*[ \t]/, "", head)
      if (head !~ /^(then|else|do|if|while|until|elif)$/) continue
    }
    # ── อยู่ใน substitution ชนิดไหน — **ต้องแยกสองชนิด**: `$( )` กับ backtick ทำให้เชลล์
    # **กลืนไบต์ NUL ทิ้ง** (ค่าที่ได้กลายเป็นก้อนเดียวติดกัน) ส่วน `<( )` เป็น fd จริง NUL รอด
    # ⇒ เหมารวมเมื่อไร `done < <(git … -z)` ซึ่งเป็นสำนวนที่ถูกต้องที่สุดในรีโปนี้จะถูกฟ้องผิด ๆ
    insubst = 0; incmd = 0
    pre = substr(code, 1, p - 1)
    d2 = 0
    for (j = p - 1; j >= 1; j--) {
      cj = substr(code, j, 1)
      if (cj == ")") { d2++; continue }
      if (cj == "(") {
        if (d2 == 0) {
          pc = (j > 1) ? substr(code, j - 1, 1) : ""
          insubst = 1
          if (pc == "$") incmd = 1
          break
        }
        d2--
      }
    }
    # ⚠️ นับเฉพาะ backtick ที่ **ไม่ถูก escape** — ร้อยแก้วไทยในรีโปนี้อ้างคำสั่งด้วย \`…\`
    # ในสตริง `echo "…"` อยู่ตลอด (วัด: 5 จุดใน `task-move.sh` กับ `check-links.sh`) ⇒ นับรวม
    # เมื่อไร ข้อความอธิบายกลายเป็น "จุดเรียก git ที่อ่าน subcommand ไม่ออก" = แดงปลอมในร้อยแก้ว
    pre2 = pre; gsub(/\\`/, "", pre2)
    nb = gsub(/`/, "&", pre2)
    if (nb % 2 == 1) { insubst = 1; incmd = 1 }
    # ── ขอบท้ายของ segment: `; | && || )` ที่ระดับบนสุดนับจากตัว git
    d = 0; term = ""; e = length(code) + 1
    for (i = p; i <= length(code); i++) {
      c = substr(code, i, 1)
      if (c == "(") d++
      else if (c == ")") { if (d == 0) { term = ")"; e = i; break } d-- }
      else if (d == 0 && c == ";") { term = ";"; e = i; break }
      else if (d == 0 && c == "|") {
        if (substr(code, i + 1, 1) == "|") { term = "||"; e = i; break }
        term = "|"; e = i; break
      }
      else if (d == 0 && c == "&" && substr(code, i + 1, 1) == "&") { term = "&&"; e = i; break }
    }
    seg = substr(code, p, e - p)
    rest = substr(code, e)
    # ── subcommand: ข้ามธงระดับโลกก่อน
    t = substr(seg, 4); sub(/^[ \t]+/, "", t)
    while (t ~ /^-/) {
      if (t ~ /^(-C|-c)[ \t]/) { sub(/^[^ \t]+[ \t]+[^ \t]+[ \t]*/, "", t); continue }
      sub(/^[^ \t]+[ \t]*/, "", t)
    }
    # ⚠️ ห้ามตั้งชื่อตัวแปรว่า `sub` — เป็นชื่อฟังก์ชันสงวนของ awk ⇒ syntax error ที่ทำให้
    # เกตคาย 0 บรรทัดพร้อม stderr (ซึ่งคือเหตุผลที่ตัวนับ `จุดเรียก` ข้างล่างต้องมีด่าน 0 = FAIL)
    scmd = t; sub(/[ \t].*$/, "", scmd); sub(/[)|;&].*$/, "", scmd)
    # ── ใครกิน stdout
    todev = (seg ~ /(^|[^0-9&2])>[ \t]*\/dev\/null/ || seg ~ /&>[ \t]*\/dev\/null/)
    quiet = (has_flag(seg, "-q") || has_flag(seg, "--quiet"))
    tofile = (seg ~ /(^|[ \t])1?>[ \t]*[^ \t&]/ && !todev)
    consumed = (insubst || term == "|" || tofile)
    zed = (has_flag(seg, "-z") || has_flag(seg, "--null"))
    snip = seg; gsub(/\001/, "x", snip); sub(/^[ \t]+/, "", snip); sub(/[ \t]+$/, "", snip)
    if (length(snip) > 90) snip = substr(snip, 1, 90) "…"
    if (todev || quiet) { v = "DISCARD" }
    else if (!consumed) { v = "NOTCONSUMED" }
    else if (scmd !~ /^[a-z][a-z0-9-]*$/) { v = "BADSUB"; scmd = "-" }
    else if (zed) {
      v = "HASZ"
      if (incmd && rest !~ /tr[ \t]/ && seg !~ /tr[ \t]/ && code !~ /xargs[ \t]+-0/) v = "ZSUBST"
      else if (code ~ /^[ \t]*done[ \t]*<[ \t]*</) { if (!(wd == 1 && wl < ln && wl > ln - 60)) v = "ZCONSUMER" }
      else if (term == "|" && rest ~ /while[ \t].*read[ \t]/ && rest !~ /-d[ \t]*''/) v = "ZCONSUMER"
    }
    else { v = "NEEDZ" }
    printf "%d\t%s\t%s\t%s\n", ln, v, scmd, snip
  }
}
