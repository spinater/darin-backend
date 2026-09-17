#!/usr/bin/env bash
# ทางเข้า **เดียว** ของเกต (CLAUDE.md §7) — ใบงานย้ายไป `done/` ได้ก็ต่อเมื่อไฟล์นี้ exit 0
# พอร์ตมาจาก groove-clinic (ใบ 001) · ลำดับ stage ไม่ได้เรียงตามความสำคัญ แต่เรียงตาม
# **เงื่อนไขของกันและกัน** — ด่านที่ตอบว่า "ผลของด่านอื่นเชื่อได้ไหม" ต้องจบก่อนเสมอ:
#
#   1. `check-shell-source.sh` — สคริปต์ที่ `.` ไฟล์ของรีโปโดยไม่อ่าน `rc` จะ **เดินต่อจนจบ
#      exit 0 พร้อมแต้มที่น้อยลง** ตอนไฟล์ที่ source เข้ามาพัง ⇒ ถ้าเงื่อนไขนี้พัง ผลของ
#      selftest ทุกใบในรอบเดียวกันไม่มีความหมาย (วัดที่ groove-clinic: ผ่าน 70 → 43 พร้อมพิมพ์ OK)
#   2. selftest ของด่านนั้นเอง แล้วจึง selftest ของด่านเนื้อหาใบอื่น
#   3. ด่านที่ตอบว่า "คลังของเกตอื่นครบไหม" (`check-text-bytes` · `check-path-bytes`) — ไฟล์ที่
#      อ่านเป็น binary หรือพาธที่ git quote ไว้ ถูก **ข้ามเงียบ ๆ** โดยตัวนับของเกตไม่ขยับ
#   4. ด่านเนื้อหา แล้วปิดท้ายด้วย `check-code.sh` (ช้าที่สุด ต้องมี toolchain/docker)
#
# ⚠️ **คำนำหน้า `verify: ` ห้ามขยับ** — ทั้งคนและ agent match `^verify: ` เป็นตัวรออยู่
set -euo pipefail
cd "$(dirname "$0")"

# ── ฆ่าลูกทั้งพวงเมื่อ **ตัวเราเอง** ถูกฆ่า
# `kill <pid ของ verify.sh>` คือสิ่งที่คนและ harness ฆ่าจริง ๆ — ลูกไม่เคยได้รับสัญญาณ
# ⇒ tsc/bun/docker วิ่งต่อและถือทรัพยากรค้างไว้ให้รอบถัดไปไปค้างโดยไม่มีอะไรบอกว่าใครถือ
. lib/job-group.sh
JOB_GROUP_FILE=".scratch/verify-job-$$.pgid"
mkdir -p ../.scratch 2>/dev/null || true
JOB_GROUP_FILE="../$JOB_GROUP_FILE"
_verify_cleanup() { job_group_kill; rm -f "$JOB_GROUP_FILE"; }
trap _verify_cleanup EXIT
trap '_verify_cleanup; exit 143' TERM
trap '_verify_cleanup; exit 130' INT

# 🔑 **จำชื่อด่านที่แดงไว้พิมพ์บนบรรทัดสรุป** — ลูปนี้รู้อยู่แล้วว่าใครล้ม การทิ้งชื่อนั้น
# แล้วพิมพ์ `verify: FAILED` เปล่า ๆ แปลว่าคนที่รอเกตต้อง grep หาสาเหตุในล็อกสองพันบรรทัด
# · ทำที่นี่ที่เดียว ⇒ ด่านที่เพิ่มเข้าลิสต์วันหน้าได้ชื่อตัวเองฟรีโดยคนเพิ่มไม่ต้องรู้กติกานี้
fail=0
failed_gates=()
for c in check-shell-source.sh tests/check-shell-source-selftest.sh \
         tests/check-job-group-selftest.sh tests/check-links-selftest.sh \
         tests/check-counter-test-selftest.sh tests/check-card-paths-selftest.sh \
         tests/check-file-length-selftest.sh tests/check-text-bytes-selftest.sh \
         tests/check-path-bytes-selftest.sh tests/check-sort-locale-selftest.sh \
         tests/check-knowledge-selftest.sh tests/check-bun-pin-selftest.sh \
         tests/check-code-junit-selftest.sh tests/check-verify-summary-selftest.sh \
         check-path-bytes.sh check-sort-locale.sh check-text-bytes.sh \
         check-file-length.sh check-knowledge.sh check-links.sh check-card-paths.sh \
         check-bun-pin.sh check-code.sh; do
  if ! job_group_run bash "$c"; then fail=1; failed_gates+=("$c"); fi
done

# เกตนี้ตอบว่า "ทรีนี้สอดคล้องในตัวเองไหม" — **ไม่ได้ตอบ** ว่า "ทรีนี้ยังตรงกับปลายทางไหม"
# ⇒ สายที่ทำงานบนฐานที่ค้าง เขียวได้ทุกรอบบนโลกที่หยุดอยู่กับที่ แล้วตอนเอาไปทับ develop จริง
# กลายเป็นการถอนคอมมิตของคนอื่นทิ้ง · เทียบ **สอง ref ไม่ใช่ ref เดียว**: local `develop` ที่ค้าง
# กับ `origin/develop` ที่ค้าง เป็นคนละทิศ และ ref เดียวตอบผิดในเคสที่มันมีไว้จับพอดี
# · **ไม่ fetch** — เกตต้องรันได้ตอนไม่มีเน็ต
behind=0
behind_ref=
for ref in refs/heads/develop refs/remotes/origin/develop; do
  git rev-parse --verify --quiet "$ref" >/dev/null 2>&1 || continue
  n=$(git rev-list --count "HEAD..$ref" 2>/dev/null) || n=0
  if [ "$n" -gt "$behind" ]; then
    behind="$n"
    behind_ref="${ref#refs/heads/}"
    behind_ref="${behind_ref#refs/remotes/}"
  fi
done

# **เตือนอย่างเดียว ไม่แดง** — ทำงานระหว่างทางบนฐานเก่าเป็นเรื่องปกติ · แต่เตือน **บนบรรทัดสรุป**
# ที่ทุกคนและทุก agent grep อยู่แล้ว เพราะคำเตือนบรรทัดแยกคือคำเตือนที่ถูกข้าม
tip_note=""
if [ "$behind" -gt 0 ]; then
  tip_note=" — ⚠️ ฐานช้ากว่า $behind_ref อยู่ $behind คอมมิต ⇒ ผลนี้วัดจากฐานที่ไม่ใช่ปลายทาง"
fi

if [ "$fail" -eq 0 ]; then
  echo "verify: ALL GREEN$tip_note"
else
  echo "verify: FAILED — ด่านที่แดง: ${failed_gates[*]}$tip_note"
fi
exit "$fail"
