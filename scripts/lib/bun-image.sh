#!/usr/bin/env bash
# บ้าน **เดียว** ของเลขเวอร์ชัน bun ที่เกตใช้ + ตัวเลือกเครื่องยนต์ native/docker
# (คู่ขนานกับ lib/rust-image.sh ของ groove-clinic — รีโปนี้ไม่มี Rust ⇒ ตัวที่ถูก
#  ปักหมุดคือ bun/node แทน · เหตุผลของการปักหมุดไม่เปลี่ยน ดู CLAUDE.md §7)
#
# ## ทำไมต้องปักหมุดเวอร์ชัน — และทำไมหมุดต้องมีบ้านเดียว
# `bun test`/`bunx tsc` เปลี่ยนพฤติกรรมข้ามเวอร์ชัน ⇒ tag ลอย (`oven/bun:latest`) แปลว่า
# วันหนึ่งเกตจะแดงโดยที่ **ไม่มีใครแก้อะไรเลย** · และรีโปนี้ deploy ด้วย image ที่ `Dockerfile`
# ปักไว้เอง ⇒ เกตที่รันคนละเวอร์ชันกับ image คือเกตที่พิสูจน์คนละต้นไม้
# ⇒ เลขนี้มีสองที่เท่านั้น: ไฟล์นี้ กับ `Dockerfile` (Dockerfile source ไฟล์เชลล์ไม่ได้)
# ⚠️ **ขยับเวอร์ชัน = แก้สองที่** — และ `scripts/tests/check-bun-pin-selftest.sh` เฝ้าให้ตรงกัน

BUN_VERSION="1.3"
BUN_IMAGE="oven/bun:$BUN_VERSION-slim"
NODE_VERSION="22"

# เครื่องยนต์: native เมื่อ bun บนโฮสต์ **ตรงหมุด** เท่านั้น — "มี bun" ไม่พอ
# (บทเรียนคำต่อคำจาก groove-clinic: `command -v` ผ่านได้ด้วยเวอร์ชันที่ผิด
#  ซึ่งขัดกับเหตุผลทั้งหมดของการปักหมุด) · ไม่ตรง = docker **พร้อมบอกว่าทำไม**
bun_engine() {
  GATE_ENGINE="docker"
  GATE_ENGINE_WHY=""
  local v=""
  if command -v bun >/dev/null 2>&1; then v="$(bun --version 2>/dev/null || true)"; fi
  case "$v" in
    "$BUN_VERSION" | "$BUN_VERSION".*) GATE_ENGINE="native"; GATE_BUN_VERSION="$v" ;;
    "") GATE_ENGINE_WHY="ไม่มี bun บนโฮสต์" ;;
    *) GATE_ENGINE_WHY="bun บนโฮสต์เป็น '$v' ไม่ตรงหมุด $BUN_VERSION" ;;
  esac
  if [ "$GATE_ENGINE" = "docker" ] && ! command -v docker >/dev/null 2>&1; then
    GATE_ENGINE="none"
  fi
}

# เกตที่สลับเครื่องยนต์เงียบ ๆ คือเกตที่อ่านผลย้อนหลังไม่ได้ ⇒ ประกาศทุกรอบ
# **พร้อมเหตุผลเมื่อมันตกลงมาใช้ docker** (บทเรียนใบ 150 ของ groove-clinic)
bun_engine_banner() { # $1 = ชื่อเกตที่พิมพ์นำหน้า
  case "$GATE_ENGINE" in
    native) echo "$1: engine=native (bun ${GATE_BUN_VERSION:-?})" ;;
    docker) echo "$1: engine=docker ($BUN_IMAGE) — ${GATE_ENGINE_WHY:-ไม่ระบุ}" ;;
    none) echo "$1: engine=none — ${GATE_ENGINE_WHY:-ไม่ระบุ} และไม่มี docker ให้ถอยไปใช้" ;;
  esac
}
