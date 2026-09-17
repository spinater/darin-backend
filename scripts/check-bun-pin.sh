#!/usr/bin/env bash
# ด่าน: **เลขเวอร์ชัน bun/node มีสองบ้าน และสองบ้านนั้นต้องตรงกัน** (CLAUDE.md §7)
#
# ## ทำไมต้องเป็นเกต ไม่ใช่ "จำไว้ว่าแก้สองที่"
# `scripts/lib/bun-image.sh` คือหมุดที่ **เกต** รันอยู่ · `Dockerfile` คือหมุดที่ **ของจริง**
# รันอยู่ · Dockerfile source ไฟล์เชลล์ไม่ได้ ⇒ สำเนาสองชุดเป็นสิ่งที่เลี่ยงไม่ได้จริง ๆ
# (ต่างจากกรณีอื่นในรีโปนี้ที่ §4 สั่งให้มีบ้านเดียว) · แต่ "เลี่ยงไม่ได้" ไม่เท่ากับ "ปล่อยได้":
# ทิศที่มันผิดคือ **เงียบสนิท** — เกตเขียวบน bun 1.3 ขณะที่อิมเมจ build ด้วย 1.4
# ⇒ สิ่งที่เกตพิสูจน์ กับสิ่งที่ deploy ออกไป เป็นคนละต้นไม้ โดยไม่มีอะไรส่งเสียง
#
# ## ทิศของความผิดพลาด
# อ่านไฟล์ไม่ได้ / สกัดเลขไม่ได้ = **FAIL** ไม่ใช่ข้าม — ตัวสกัดที่แมตช์ศูนย์แถวแล้วเงียบ
# คือเกตที่ยังเขียวอยู่ตอนที่มันไม่ได้ตรวจอะไรเลย (บทเรียน `swept = 0` ของ groove-clinic ใบ 193)
set -uo pipefail
cd "$(dirname "$0")/.."

LIB="scripts/lib/bun-image.sh"
DOCKERFILE="Dockerfile"
fail=0

for f in "$LIB" "$DOCKERFILE"; do
  if [ ! -r "$f" ]; then
    echo "check-bun-pin: FAIL — อ่าน $f ไม่ได้ ⇒ รอบนี้ **ไม่ได้ตรวจ** ว่าหมุดสองบ้านตรงกัน"
    exit 1
  fi
done

# shellcheck source=/dev/null
. "$LIB"
rc=$?
if [ "$rc" -ne 0 ]; then
  echo "check-bun-pin: FAIL — source $LIB ไม่สำเร็จ (rc=$rc) ⇒ ไม่มีหมุดฝั่งเกตให้เทียบ"
  exit 1
fi
if [ -z "${BUN_VERSION:-}" ] || [ -z "${NODE_VERSION:-}" ]; then
  echo "check-bun-pin: FAIL — $LIB ไม่ได้ตั้ง BUN_VERSION/NODE_VERSION ⇒ หมุดฝั่งเกตหายไป"
  exit 1
fi

# สกัดจาก Dockerfile: ทุกแถว `FROM oven/bun:<ver>` และ `FROM node:<ver>`
bun_tags="$(grep -oE '^[[:space:]]*FROM[[:space:]]+oven/bun:[^[:space:]]+' "$DOCKERFILE" \
  | sed -E 's#.*oven/bun:##' | LC_ALL=C sort -u)"
node_tags="$(grep -oE '^[[:space:]]*FROM[[:space:]]+node:[^[:space:]]+' "$DOCKERFILE" \
  | sed -E 's#.*node:##' | LC_ALL=C sort -u)"

if [ -z "$bun_tags" ]; then
  echo "check-bun-pin: FAIL — สกัดแถว 'FROM oven/bun:…' จาก $DOCKERFILE ไม่ได้สักแถว"
  echo "             (ตัวสกัดพัง หรือ Dockerfile เลิกใช้ bun — ทั้งสองอย่างต้องมีคนตัดสิน ไม่ใช่ข้าม)"
  fail=1
fi
if [ -z "$node_tags" ]; then
  echo "check-bun-pin: FAIL — สกัดแถว 'FROM node:…' จาก $DOCKERFILE ไม่ได้สักแถว"
  fail=1
fi

# เทียบ **คำนำหน้าเป็นเซกเมนต์** — `1.3-slim` และ `1.3.14` ตรงกับหมุด `1.3`; `1.34` ไม่ตรง
pin_matches() { # $1 = tag ใน Dockerfile ; $2 = หมุด
  case "$1" in
    "$2" | "$2".* | "$2"-*) return 0 ;;
  esac
  return 1
}

for t in $bun_tags; do
  if ! pin_matches "$t" "$BUN_VERSION"; then
    echo "check-bun-pin: FAIL — $DOCKERFILE ใช้ oven/bun:$t แต่หมุดที่ $LIB คือ $BUN_VERSION"
    echo "             ⇒ เกตกับอิมเมจรันคนละเวอร์ชัน · แก้ให้ตรงกัน **ทั้งสองที่**"
    fail=1
  fi
done
for t in $node_tags; do
  if ! pin_matches "$t" "$NODE_VERSION"; then
    echo "check-bun-pin: FAIL — $DOCKERFILE ใช้ node:$t แต่หมุดที่ $LIB คือ $NODE_VERSION"
    fail=1
  fi
done

# ⚠️ **tag ลอยคือความผิดคนละข้อกับ "ไม่ตรงหมุด"** — `oven/bun:latest` ตรงกับหมุดไม่ได้อยู่แล้ว
# แต่ข้อความต้องบอกสาเหตุที่ถูก ไม่งั้นคนแก้จะไปไล่แก้เลขที่ไม่มีอยู่
for t in $bun_tags $node_tags; do
  case "$t" in
    latest | latest-*)
      echo "check-bun-pin: FAIL — $DOCKERFILE มี tag ลอย ':$t' ⇒ วันหนึ่งอิมเมจจะเปลี่ยนเองโดยไม่มีคอมมิต"
      fail=1 ;;
  esac
done

if [ "$fail" -eq 0 ]; then
  echo "check-bun-pin: OK — bun=$BUN_VERSION node=$NODE_VERSION ตรงกันทั้ง $LIB และ $DOCKERFILE"
fi
exit "$fail"
