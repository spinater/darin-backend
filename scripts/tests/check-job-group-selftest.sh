#!/usr/bin/env bash
# เกตของ **ตัวฆ่างานของเกต** (task 151) — `scripts/lib/job-group.sh`
#
# สิ่งที่พิสูจน์ (สามข้อนี้คือเหตุผลที่ใบ 151 ยืนยันว่า "ของแบบนี้ต้องมีเทสของมันเอง"):
#   1. ฆ่าสคริปต์แม่ด้วย **PID ตรงตัว** แล้ว **หลานต้องตายด้วย** — อาการจริงของใบ 151 คือ
#      `cleanup` ทำงานครบ คอนเทนเนอร์ถูกลบ **ดูเหมือนสะอาด** แต่ `cargo` รอดมาถือ build lock
#   2. **โพรเซสของสายอื่นต้องไม่ถูกแตะ** — การจัดการสัญญาณที่ผิดคือ §6 rule 6 ที่กลับหัว
#      (เกตไปฆ่าของสายที่รันขนานอยู่ ซึ่งเคยเกิดจริงมาแล้วที่ใบ 121)
#   3. งานที่ **จบเอง** ต้องล้างเลขกลุ่มทิ้ง และ **exit code ต้องไม่หาย**
#
# ใช้ `sleep` เป็นตัวแทนของ `cargo` โดยตั้งใจ: สิ่งที่ทดสอบคือ **การจัดกลุ่มและการส่งสัญญาณ**
# ไม่ใช่พฤติกรรมของ cargo ⇒ ตัวแทนที่ถูกคือโพรเซสที่ **มีลูก** และอยู่นานพอให้ยิงทัน
set -euo pipefail
cd "$(dirname "$0")/../.."

scratch=".scratch/job-group-selftest-$$"
mkdir -p "$scratch"
fail=0
bystander=""
cleanup_self() {
  [ -n "$bystander" ] && kill "$bystander" 2>/dev/null || true
  rm -rf "$scratch"
}
trap cleanup_self EXIT

die() { echo "job-group-selftest: FAIL — $1"; fail=1; }

# ── สายอื่นที่ต้องรอดทุกกรณี (คนละกลุ่มกับกลุ่มที่ `job_group_run` สร้างขึ้นแน่นอน)
sleep 120 &
bystander=$!
# `disown` เพื่อไม่ให้เชลล์รายงาน "Terminated" ตอนเก็บกวาด — เกตที่พิมพ์บรรทัดที่ดูเหมือน
# ความผิดพลาดทั้งที่ทุกอย่างปกติ คือเกตที่สอนให้คนมองข้ามบรรทัดของมัน
disown "$bystander" 2>/dev/null || true

# ── สคริปต์แม่จำลอง — ใช้ lib **ตัวจริง** ไม่ใช่สำเนา
cat > "$scratch/parent.sh" <<'INNER'
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/lib/job-group.sh
JOB_GROUP_FILE="$1"
trap job_group_kill EXIT INT TERM
# `sh -c` ที่มีหลายคำสั่ง **ไม่ exec ต่อ** ⇒ ได้ชั้นลูก-หลานจริงแบบเดียวกับ `sh -c "…cargo…"`
# ของ `check-code.sh` (ถ้าเขียนคำสั่งเดียว sh จะ exec ทับตัวเองแล้วชั้นหลานหายไป = เทสอ่อนลง)
job_group_run sh -c ': ; echo $$ > '"$2"' ; exec sleep 120'
INNER

bash "$scratch/parent.sh" "$scratch/pgid" "$scratch/grandchild" &
parent=$!

# รอให้หลานเกิดจริงก่อนยิง — ยิงก่อนเกิดคือเทสที่ผ่านเพราะไม่มีอะไรให้ฆ่า
for _ in $(seq 1 100); do
  [ -s "$scratch/grandchild" ] && break
  sleep 0.1
done
grandchild="$(cat "$scratch/grandchild" 2>/dev/null || true)"
if [ -z "$grandchild" ] || ! kill -0 "$grandchild" 2>/dev/null; then
  die "หลานไม่เกิด/ไม่มีชีวิตตอนเริ่มยิง — ตัวจำลองพัง ไม่ใช่ผลของเกต"
else
  # ── ข้อ 1 + 2
  kill "$parent" 2>/dev/null || true
  wait "$parent" 2>/dev/null || true
  alive=1
  for _ in $(seq 1 50); do
    kill -0 "$grandchild" 2>/dev/null || { alive=0; break; }
    sleep 0.1
  done
  [ "$alive" = 0 ] || die "หลาน ($grandchild) รอดจากการฆ่าแม่ — อาการของใบ 151 เป๊ะ ๆ"
  kill -0 "$bystander" 2>/dev/null || die "โพรเซสของสายอื่น ($bystander) ถูกฆ่าไปด้วย — §6 rule 6 กลับหัว"
fi

# ── ข้อ 3: exit code ต้องส่งกลับตรง ๆ และเลขกลุ่มต้องถูกล้างเมื่องานจบเอง
set +e
( . scripts/lib/job-group.sh; JOB_GROUP_FILE="$scratch/pgid3"; job_group_run sh -c 'exit 7' )
got=$?
set -e
[ "$got" = 7 ] || die "exit code ของงานลูกต้องส่งกลับตรง ๆ (ได้ $got ควรเป็น 7)"
[ -s "$scratch/pgid3" ] && die "เลขกลุ่มค้างหลังงานจบเอง — สุสานที่จะทำให้ยิงใส่ pid ที่ถูกใช้ซ้ำ"

[ "$fail" = 0 ] && echo "job-group-selftest: OK"
exit "$fail"
