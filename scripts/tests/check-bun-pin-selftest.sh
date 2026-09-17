#!/usr/bin/env bash
# เทสของ **`scripts/check-bun-pin.sh`** (ใบ 001) — "เกตของเกต" ตามกติกา CLAUDE.md §7
#
# ## ทำไมด่านนี้ต้องมีเทส
# `check-bun-pin.sh` ตัดสินด้วย **ตัวสกัดข้อความ** (grep + sed บน Dockerfile) ซึ่งเป็นคลาสที่
# groove-clinic จ่ายค่าเรียนไปแล้วสองรอบ (`check-path-bytes` · `check-sort-locale`): ตัวสกัด
# พังได้ **สองทิศและเงียบทั้งคู่** — แคบไปก็ปล่อยของผิดผ่าน, กว้างไปก็แดงใส่ทรีที่ถูกต้อง
# ⇒ เคสต้องมีทั้งฉากสะอาด (เขียว) และฉากที่ทุบทีละจุด (แดง **พร้อมข้อความที่ชี้สาเหตุถูกใบ**)
#
# ## เคส
#   A. ทรีสะอาด (หมุดตรงกันทั้งสองบ้าน)                 → exit 0 + บรรทัด OK ที่บอกเลขทั้งคู่
#   B. Dockerfile ใช้ bun คนละเวอร์ชันกับหมุด            → FAIL ที่เรียกชื่อ **ทั้งสองบ้าน**
#   C. Dockerfile ใช้ node คนละเวอร์ชันกับหมุด           → FAIL ฝั่ง node
#   D. tag ลอย (`latest`)                                → FAIL ที่เรียกสาเหตุว่า "tag ลอย"
#   E. Dockerfile ไม่มีแถว `FROM oven/bun:` เลย          → FAIL "สกัดไม่ได้สักแถว" (ไม่ใช่เขียว)
#   F. อ่าน Dockerfile ไม่ได้ (ไฟล์หาย)                  → FAIL ที่บอกว่า **รอบนี้ไม่ได้ตรวจ**
#   G. lib ไม่ได้ตั้ง BUN_VERSION                        → FAIL ที่เรียกชื่อหมุดฝั่งเกต
#   H. `1.3-slim` และ `1.3.14` ต้อง **ตรง** กับหมุด 1.3 · `1.34` ต้อง **ไม่ตรง**
#      🔑 นี่คือแถวที่แยก "เทียบเป็นเซกเมนต์" ออกจาก "เทียบเป็นคำนำหน้าสตริงดิบ" — ถอด
#      เงื่อนไขเซกเมนต์ออกแล้ว `1.34` จะผ่านเงียบ ๆ ซึ่งคือทิศที่ด่านนี้มีไว้จับพอดี
set -uo pipefail
cd "$(dirname "$0")/../.."

GATE_REL="scripts/check-bun-pin.sh"
LIB_REL="scripts/lib/bun-image.sh"
SANDBOX="$PWD/.scratch/bun-pin-selftest-$$"
trap 'rm -rf "$SANDBOX"' EXIT
pass=0
fail=0

new_sandbox() { # $1 = เนื้อ Dockerfile ; $2 (ไม่บังคับ) = เนื้อ lib แทนของจริง
  rm -rf "$SANDBOX"
  mkdir -p "$SANDBOX/scripts/lib"
  cp "$GATE_REL" "$SANDBOX/$GATE_REL"
  if [ -n "${2:-}" ]; then printf '%s\n' "$2" > "$SANDBOX/$LIB_REL"
  else cp "$LIB_REL" "$SANDBOX/$LIB_REL"; fi
  printf '%s\n' "$1" > "$SANDBOX/Dockerfile"
}

OUT=""
run_gate() { OUT="$(cd "$SANDBOX" && bash "$GATE_REL" 2>&1)"; }

expect() { # $1=ชื่อเคส $2=exit ที่คาด $3=ข้อความที่ต้องมี $4=ข้อความที่ต้องไม่มี
  local name="$1" want="$2" msg="${3:-}" deny="${4:-}" got ok=1
  run_gate; got=$?
  if [ "$got" -ne "$want" ]; then echo "  FAIL: $name — exit=$got คาด $want"; ok=0; fi
  if [ -n "$msg" ] && ! grep -qF -- "$msg" <<<"$OUT"; then
    echo "  FAIL: $name — ไม่พบข้อความ \"$msg\""; ok=0
  fi
  if [ -n "$deny" ] && grep -qF -- "$deny" <<<"$OUT"; then
    echo "  FAIL: $name — เจอข้อความที่ต้องไม่มี \"$deny\""; ok=0
  fi
  if [ "$ok" -eq 1 ]; then echo "  ok: $name"; pass=$((pass + 1))
  else printf '    --- output ---\n%s\n    --------------\n' "$OUT"; fail=$((fail + 1)); fi
}

# อ่านหมุดจาก **ไฟล์จริง** ไม่ใช่เลขที่พิมพ์มือไว้ในนี้ — ไม่งั้นวันที่หมุดขยับ เทสจะแดงทั้งที่
# ทรีถูกต้อง (และคนแก้จะเรียนรู้ว่าแก้เทสให้ผ่านคือทางออก ซึ่งเป็นนิสัยที่แพงกว่าบั๊ก)
# shellcheck source=/dev/null
. "$LIB_REL"
rc=$?
if [ "$rc" -ne 0 ] || [ -z "${BUN_VERSION:-}" ] || [ -z "${NODE_VERSION:-}" ]; then
  echo "check-bun-pin-selftest: FAIL — อ่านหมุดจาก $LIB_REL ไม่ได้ ⇒ ทุกเคสข้างล่างวัดอะไรไม่ได้"
  echo "check-bun-pin-selftest: ผ่าน 0 · ล้ม 1"
  exit 1
fi
B="$BUN_VERSION"
N="$NODE_VERSION"

clean="FROM oven/bun:$B-slim AS deps
FROM oven/bun:$B-slim AS builder
FROM node:$N-slim AS runner"

new_sandbox "$clean"
expect "A ทรีสะอาด" 0 "check-bun-pin: OK" "FAIL"

new_sandbox "FROM oven/bun:9.9-slim AS deps
FROM node:$N-slim AS runner"
expect "B bun คนละเวอร์ชัน" 1 "แต่หมุดที่ $LIB_REL คือ $B"

new_sandbox "FROM oven/bun:$B-slim AS deps
FROM node:99-slim AS runner"
expect "C node คนละเวอร์ชัน" 1 "ใช้ node:99-slim"

new_sandbox "FROM oven/bun:latest AS deps
FROM node:$N-slim AS runner"
expect "D tag ลอย" 1 "tag ลอย"

new_sandbox "FROM node:$N-slim AS runner"
expect "E ไม่มีแถว bun เลย" 1 "ไม่ได้สักแถว"

new_sandbox "$clean"
rm -f "$SANDBOX/Dockerfile"
expect "F อ่าน Dockerfile ไม่ได้" 1 "**ไม่ได้ตรวจ**"

new_sandbox "$clean" "# lib ที่ลืมตั้งหมุด
BUN_IMAGE=\"oven/bun:x\""
expect "G lib ไม่มีหมุด" 1 "หมุดฝั่งเกตหายไป"

# H — สามรูปแบบในฉากเดียว: `-slim` และ `.14` ต้องผ่าน, `1.34` (เซกเมนต์คนละตัว) ต้องแดง
new_sandbox "FROM oven/bun:$B.14 AS deps
FROM oven/bun:$B-slim AS builder
FROM node:$N AS runner"
expect "H1 หางเวอร์ชัน/แท็กย่อยยังตรงหมุด" 0 "check-bun-pin: OK" "FAIL"

new_sandbox "FROM oven/bun:${B}4 AS deps
FROM node:$N-slim AS runner"
expect "H2 เลขที่ต่อท้ายติดกันต้องไม่ตรง" 1 "ใช้ oven/bun:${B}4"

echo "check-bun-pin-selftest: ผ่าน $pass · ล้ม $fail"
[ "$fail" -eq 0 ]
