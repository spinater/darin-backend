#!/usr/bin/env bash
# ด่านโค้ดของรีโปนี้ (CLAUDE.md §7) — คู่ขนานกับ `scripts/check-code.sh` ของ groove-clinic
# แต่สแตกเป็น **TypeScript ล้วน** ⇒ ไม่มี stage rust; ชั้นที่เหลือเป็นชั้นเดียวกันทุกชั้น:
#
#   1. format  `prettier --check`                 — fastest, needs no DB and no generated client
#                                                    ⇒ goes red before anything slow runs
#                                                    (task 003 — see `scripts/lib/check-code-format.sh`)
#   2. types   `tsc --noEmit`                     — เร็ว ไม่ต้องมี DB ⇒ แดงก่อนทุกอย่างที่ช้า
#   3. schema  `prisma validate`                  — schema พังจับได้ในวินาที ไม่ใช่ตอน deploy
#   4. tests   `bun test` + หมุด junit            — ดู `scripts/lib/check-code-junit.sh`
#   5. db      postgres ใช้แล้วทิ้ง + `prisma db push` + seed — run **twice** (task 040)
#
# ## ทำไม stage 5 ถึงต้องมีทั้งที่ยังไม่มีเทสที่ใช้ DB
# `prisma db push` กับ seed คือสิ่งที่ **รันจริงตอน deploy** (compose service `migrate`) และ
# ก่อนมีด่านนี้ ไม่มีอะไรในรีโปพิสูจน์มันเลยสักชั้นจนกว่าคอนเทนเนอร์จะขึ้นบนคลาวด์ ⇒ schema
# ที่ push ไม่ผ่านจะถูกจับ **หลัง** push ไป develop เสมอ (คลาสเดียวกับใบ 159 ของ groove-clinic
# ที่อิมเมจตายอยู่ห้าชั่วโมง) · postgres เป็นตัวใช้แล้วทิ้ง ชื่อ+รหัสสุ่มต่อรอบ ⇒ หลายสายรันขนานกันได้
#
# ⚠️ **ด่านนี้ไม่ได้ build `Dockerfile`** — เหมือน groove-clinic เป๊ะ (ใบ 163 ที่นั่น): ตัวที่
# build จริงคือ `docker compose up -d --build` ตอน deploy เท่านั้น ⇒ ห้ามเขียนว่ารอบนี้พิสูจน์อิมเมจ
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd -P)"

if [ "${SKIP_CODE_CHECKS:-0}" = "1" ]; then
  echo "check-code: SKIPPED (SKIP_CODE_CHECKS=1)"
  exit 0
fi

. scripts/lib/bun-image.sh
bun_engine
if [ "$GATE_ENGINE" = "none" ]; then
  echo "check-code: FAIL — ${GATE_ENGINE_WHY:-} และไม่มี docker ⇒ รันด่านโค้ดไม่ได้เลย"
  echo "             (ติดตั้ง bun $BUN_VERSION หรือ docker สักอย่าง — เกตที่รันไม่ได้ ห้ามเขียว)"
  exit 1
fi
bun_engine_banner check-code

PG_IMAGE="postgres:18-alpine"
RUN_PID="$$"
RUN_ID="$RUN_PID-${RANDOM}"
PG_NAME="darinverify-pg-$RUN_ID"
NET_NAME="darinverify-net-$RUN_ID"

. scripts/lib/job-group.sh
JOB_GROUP_FILE=".scratch/check-code-job-$RUN_ID.pgid"
DB_LOG=".scratch/check-code-db-$RUN_ID.log"
SEED2_LOG=".scratch/check-code-seed2-$RUN_ID.log"
TEST_LOG=".scratch/check-code-test-$RUN_ID.log"
# ชื่อตัวแปรยังเป็น `WEB_JUNIT` เพราะ `scripts/lib/check-code-junit.sh` อ่านชื่อนี้ (ก้อนเดียวกับ
# ของ groove-clinic ⇒ เปลี่ยนชื่อ = สองสำเนาที่ต้องตามกันเอง ซึ่งเป็นสิ่งที่ §4 ห้ามไว้)
WEB_JUNIT=".scratch/check-code-test-$RUN_ID.junit.xml"
fail=0
mkdir -p .scratch

OWN_LABELS=(--label owner=check-code --label "pid=$RUN_PID" --label "run=$RUN_ID")
OWN_FILTER=(--filter label=owner=check-code --filter "label=run=$RUN_ID")

cleanup() {
  job_group_kill
  local ids
  if command -v docker >/dev/null 2>&1; then
    ids="$(docker ps -aq "${OWN_FILTER[@]}" 2>/dev/null || true)"
    [ -n "$ids" ] && docker rm -f $ids >/dev/null 2>&1 || true
    ids="$(docker network ls -q "${OWN_FILTER[@]}" 2>/dev/null || true)"
    [ -n "$ids" ] && docker network rm $ids >/dev/null 2>&1 || true
    docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
    docker network rm "$NET_NAME" >/dev/null 2>&1 || true
  fi
  rm -f "$JOB_GROUP_FILE"
}
# แยก EXIT ออกจาก INT/TERM ด้วยเหตุผลเดียวกับ `verify.sh` — handler ที่ไม่จบตัวเอง
# แปลว่าเกตที่ถูกสั่งหยุดจะเดินไป stage ถัดไปต่อ
trap cleanup EXIT
trap 'cleanup; exit 143' TERM
trap 'cleanup; exit 130' INT

DOCKER_NET="bridge"

# รันคำสั่งหนึ่งบรรทัดในเครื่องยนต์ที่เลือกไว้ · docker mount ทรีทั้งก้อนเข้า /app
bun_run() { # $1 = คำสั่ง sh
  if [ "$GATE_ENGINE" = "native" ]; then
    job_group_run sh -c "$1"
  else
    job_group_run docker run --rm "${OWN_LABELS[@]}" --network "$DOCKER_NET" \
      -v "$ROOT":/app -w /app -e DATABASE_URL="${DATABASE_URL:-}" \
      "$BUN_IMAGE" sh -c "$1"
  fi
}

deps='[ -d node_modules ] || bun install --frozen-lockfile'

# Formatter stage first (task 003) — it is the cheapest red in this file. Sourced with `.` for the
# same reason the junit layer is: it reads `$deps`/`$RUN_ID`/`$GATE_ENGINE`/`$BUN_IMAGE` and the
# `bun_run` function from this shell, and travels back through `fail`.
. scripts/lib/check-code-format.sh

echo "check-code: types (tsc --noEmit)"
# `prisma generate` มาก่อน tsc เสมอ — ไคลเอนต์ที่ generate แล้วคือ *ที่มาของ type* ของ
# ทุกไฟล์ที่แตะ DB ⇒ ทรีที่ยังไม่ generate จะแดงด้วยข้อความที่ชี้ผิดที่ (module not found)
if ! bun_run "$deps
  DATABASE_URL=\${DATABASE_URL:-postgresql://gate:gate@127.0.0.1:1/gate} bunx --bun prisma generate >/dev/null
  bunx tsc --noEmit"; then
  echo "check-code: FAIL — tsc --noEmit ไม่ผ่าน"
  fail=1
fi

echo "check-code: schema (prisma validate)"
if ! bun_run "$deps
  DATABASE_URL=\${DATABASE_URL:-postgresql://gate:gate@127.0.0.1:1/gate} bunx --bun prisma validate"; then
  echo "check-code: FAIL — prisma/schema.prisma ไม่ผ่าน validate"
  fail=1
fi

echo "check-code: tests (bun test + หมุด junit)"
if ! bun_run "$deps
  bun test --reporter=junit --reporter-outfile='$WEB_JUNIT'" 2>&1 | tee "$TEST_LOG"; then
  echo "check-code: FAIL — bun test ไม่ผ่าน"
  fail=1
fi
# ชั้นหมุด: ก้อนเดียวกับ groove-clinic ทุกบรรทัด — มัน `.` เข้ามาแล้วเดินทางกลับทาง `fail`
. scripts/lib/check-code-junit.sh

db_stage() {
  local password
  password="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"

  if [ "$GATE_ENGINE" = "docker" ]; then
    docker network create "${OWN_LABELS[@]}" "$NET_NAME" >/dev/null || return 1
    DOCKER_NET="$NET_NAME"
  fi
  # 🔴 PG18 ย้าย PGDATA ไป `/var/lib/postgresql/18/docker` — mount tmpfs ที่ `.../data`
  # แบบเดิมไม่พัง ไม่เตือน และ **ไม่เร็วขึ้น** (บทเรียนที่ groove-clinic จ่ายไปแล้ว)
  docker run -d --name "$PG_NAME" --network "$DOCKER_NET" "${OWN_LABELS[@]}" \
    -p 127.0.0.1::5432 \
    --tmpfs /var/lib/postgresql/18/docker:rw,size=1g \
    -e POSTGRES_PASSWORD="$password" -e POSTGRES_DB=postgres \
    "$PG_IMAGE" -c fsync=off -c full_page_writes=off \
    -c synchronous_commit=off >/dev/null || return 1

  local ready=0 attempt
  for attempt in $(seq 1 60); do
    if docker exec "$PG_NAME" pg_isready -U postgres -q >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
  done
  if [ "$ready" -ne 1 ]; then
    echo "check-code: FAIL — throwaway postgres ($PG_IMAGE) ไม่พร้อมภายใน 60 วินาที"
    docker logs --tail 20 "$PG_NAME" 2>&1 || true
    return 1
  fi

  if [ "$GATE_ENGINE" = "native" ]; then
    local hostport
    # พอร์ตปล่อยให้ docker เลือก แล้วอ่านกลับ — พอร์ตตายตัว = ชนตัวเองเมื่อรันหลายสายขนาน
    hostport="$(docker port "$PG_NAME" 5432/tcp 2>/dev/null | sed -n 1p)"
    if [ -z "$hostport" ]; then
      echo "check-code: FAIL — อ่านพอร์ตที่ publish ของ $PG_NAME ไม่ได้"
      return 1
    fi
    export DATABASE_URL="postgresql://postgres:$password@$hostport/postgres"
  else
    export DATABASE_URL="postgresql://postgres:$password@$PG_NAME:5432/postgres"
  fi

  # ── ความยินยอมของเจ้าของสำหรับยามของ Prisma 7
  # prisma 7 ปฏิเสธ `db push` เมื่อรู้ว่าถูกเรียกโดย AI agent จนกว่าจะมีตัวแปรนี้ ซึ่งค่าของมัน
  # ต้องเป็น **ข้อความที่เจ้าของพิมพ์ยินยอมเอง** · linus ยินยอมเมื่อ 2026-09-17 หลังอ่านว่า
  # ปลายทางคืออะไร (คอนเทนเนอร์ใช้แล้วทิ้ง ชื่อ+รหัสสุ่ม ผูก 127.0.0.1 ลบทิ้งทุกรอบ)
  #
  # 🔴 **ขอบเขตของความยินยอมนี้คือ *ฐานที่เกตสร้างเอง* เท่านั้น** — ตัวแปรถูกตั้ง **ในบรรทัด
  # ของคำสั่งนี้บรรทัดเดียว** ไม่ใช่ `export` ทั้งสคริปต์ ⇒ คำสั่ง prisma ที่ใครเพิ่มเข้ามาทีหลัง
  # ในไฟล์นี้ **ไม่ได้รับความยินยอมนี้ไปด้วยฟรี ๆ** และจะโดนยามของ prisma เหมือนเดิม
  # ⚠️ **ห้ามย้ายไปไว้ใน `.env`, ใน compose, หรือ export ที่ระดับเชลล์** — นั่นคือการยกความยินยอม
  # ที่ให้ไว้กับฐานใช้แล้วทิ้ง ไปครอบฐานจริงบนคลาวด์ ซึ่งเป็นสิ่งเดียวที่ยามตัวนี้มีไว้กัน
  local consent="ยินยอม — เปิด stage นี้"

  # 🔴 **`&&` ไม่ใช่ขึ้นบรรทัดใหม่** — `sh -c` ที่ไม่มี `set -e` จะเดินต่อเมื่อคำสั่งแรกล้ม
  # ⇒ push ที่พังแล้ว seed วิ่งต่อ ได้ข้อความ `TableDoesNotExist` ซึ่งชี้สาเหตุผิดใบ
  # (เกิดจริงตอนเขียนด่านนี้: prisma 7 ถอด `--skip-generate` ออก แต่ข้อความที่ได้พูดถึง seed)
  bun_run "$deps
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='$consent' bunx --bun prisma db push --accept-data-loss \
      && bun run prisma/seed.ts" 2>&1 | tee "$DB_LOG" || return 1

  # ── task 040, step 1 of 3: break the two rows that cost money ─────────────────────────
  # Then the seed runs a second time, then the grep below and these two rows are read back.
  #
  # 🔴 **Assert the invariant, not a counter.** `created=0` further down is a number the seed
  # increments by hand at seven `writes++` sites: an `update`-shaped regression never touches it
  # (change the `note` refresh to `data: { value, note }` and every deploy restores the developer's
  # default over the owner's rate, `created=0`, green), and a re-creating one that forgets its
  # `writes++` reports 0 while re-planting the rate this card exists to protect. So the two rows
  # that cost money are **broken on purpose here**, between the two runs, and read back after.
  #
  # ⚠️ Every step of this fails **closed**: `psql` that cannot connect, a query that errors, and an
  # empty result are all red — `pg_sql` returns non-zero for each, and its callers `return 1`.
  # ⚠️ `local x="$(…)"` would **swallow** that: `local` is a command and its own exit status wins.
  # Declare first, assign on its own line — that is why the three `local`s stand apart below.
  pg_sql() { # $1 = SQL returning exactly one non-empty value
    local out
    if ! out="$(docker exec -e PGPASSWORD="$password" "$PG_NAME" \
                  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc "$1" 2>&1)"; then
      echo "check-code: FAIL — psql did not answer on the throwaway postgres (task 040)" >&2
      echo "             SQL: $1" >&2
      echo "             $out" >&2
      return 1
    fi
    if [ -z "$out" ]; then
      echo "check-code: FAIL — psql returned no row, so nothing was asserted (task 040)" >&2
      echo "             SQL: $1" >&2
      return 1
    fi
    printf '%s' "$out"
  }

  echo "check-code: db (deleting the pt × PT rate and setting comm.pt.selfClosed=8, task 040)"
  local deleted edited before
  deleted="$(pg_sql "WITH d AS (DELETE FROM \"TeachRate\" WHERE activity = 'pt' AND \"rank\" = 'PT'
                                RETURNING 1) SELECT count(*) FROM d")" || return 1
  if [ "$deleted" != "1" ]; then
    echo "check-code: FAIL — expected exactly one pt × PT teach rate to delete before the second"
    echo "             seed run, deleted $deleted ⇒ the first run did not plant the matrix and the"
    echo "             assertion below would pass over an empty table (task 040)"
    return 1
  fi
  # 🔴 **What the config arm depends on, stated where it breaks.** The read-back at step 3 requires
  # `'8'`, so it discriminates only while `CONFIG_DEFAULTS["comm.pt.selfClosed"]`
  # (`lib/config-keys.ts`) is **not** `8`: the day the default becomes the same string this gate
  # writes, a seed restoring the default over the owner's value passes green — the exact
  # `update`-shaped regression step 3 exists to catch, back and silent. Anchored on "the default is
  # not the mutant value" rather than pinned to `10`, so an ordinary rate change stays green and
  # only a collision goes red. Fails closed: `pg_sql` is already red on a missing key.
  before="$(pg_sql "SELECT value FROM \"PayrollConfig\" WHERE key = 'comm.pt.selfClosed'")" || return 1
  if [ "$before" = "8" ]; then
    echo "check-code: FAIL — CONFIG_DEFAULTS[\"comm.pt.selfClosed\"] is now '8', the same value this"
    echo "             gate writes as its mutant, so the read-back below could no longer tell the"
    echo "             owner's edit from the seed restoring the default and would pass over the"
    echo "             regression it exists to catch. Pick a mutant value the default is not, and"
    echo "             change it in both places (the UPDATE here and the read-back, task 040)"
    return 1
  fi
  edited="$(pg_sql "WITH u AS (UPDATE \"PayrollConfig\" SET value = '8'
                               WHERE key = 'comm.pt.selfClosed' RETURNING 1) SELECT count(*) FROM u")" ||
    return 1
  if [ "$edited" != "1" ]; then
    echo "check-code: FAIL — expected exactly one PayrollConfig row 'comm.pt.selfClosed' to edit"
    echo "             before the second seed run, edited $edited (task 040)"
    return 1
  fi

  # ── task 040, step 2 of 3: the seed must be re-runnable without writing anything ──────
  # `prisma/seed.ts` runs on **every** deploy (compose service `migrate`) and used to upsert the whole reference fixture
  # back each time ⇒ a rate the owner deliberately deleted came back on the next push and paid
  # silently. The run above only ever meets an empty database, so it exercises `initialize` alone:
  # this second run is the only place in the repo where "plants once" is actually asserted.
  #
  # Three mutants die on this one grep: dropping the `SeedMark` write (the second run says
  # `adopt`), inverting the probe (it says `initialize`), and moving any fixture write out of the
  # `plantsFixture` branch (`created>0`).
  #
  # ⚠️ **Log first, grep the file second.** Piping the run straight into `grep` masks a failure of
  # the seed itself — the red would then name the missing line instead of the real cause, with no
  # output left to read. (And `… | grep -q` closes the pipe early: SIGPIPE upstream, 141 under
  # `pipefail` — the trap `scripts/counter-test.sh`'s header documents.)
  echo "check-code: db (seed a second time — it must write nothing, task 040)"
  bun_run "$deps
    bun run prisma/seed.ts" 2>&1 | tee "$SEED2_LOG" || return 1
  if ! grep -qF "seed: mode=already-initialized created=0" "$SEED2_LOG"; then
    echo "check-code: FAIL — the seed's second run did not report"
    echo "             'seed: mode=already-initialized created=0' ⇒ it writes reference data to a"
    echo "             database it did not create (task 040). What that run actually said:"
    grep -F "seed: mode=" "$SEED2_LOG" ||
      echo "             (no 'seed: mode=' line at all — it did not get that far)"
    return 1
  fi

  # ── task 040, step 3 of 3: read the two broken rows back ──────────────────────────────
  # This is what the grep above cannot see: it reads the seed's own report of itself, and an
  # `update`-shaped regression reports `created=0` honestly while overwriting an owner's rate.
  local rate value
  rate="$(pg_sql "SELECT count(*) FROM \"TeachRate\" WHERE activity = 'pt' AND \"rank\" = 'PT'")" ||
    return 1
  if [ "$rate" != "0" ]; then
    echo "check-code: FAIL — the seed re-created the teach rate pt × PT that was deleted before it"
    echo "             ran ($rate row(s) back). A rate the owner blanked at /admin/config comes"
    echo "             back at 200 ฿ on the next deploy and pays 40 คาบ × 200 = 8,000 ฿ with"
    echo "             warnings: [] — this card's headline bug (task 040)"
    return 1
  fi
  value="$(pg_sql "SELECT value FROM \"PayrollConfig\" WHERE key = 'comm.pt.selfClosed'")" || return 1
  if [ "$value" != "8" ]; then
    echo "check-code: FAIL — the seed overwrote PayrollConfig 'comm.pt.selfClosed': set to 8 before"
    echo "             the run, now '$value'. CONFIG_DEFAULTS values are seed-time only (CLAUDE.md"
    echo "             §2 rule 3) — restoring 10 over the owner's 8 pays a self-closed PT trainer"
    echo "             20,000 ฿ instead of 16,000 ฿ on a 200,000 ฿ month, every deploy (task 040)"
    return 1
  fi
  echo "check-code: db (the deleted rate stayed deleted, the edited config value stayed edited)"
}

if command -v docker >/dev/null 2>&1; then
  echo "check-code: db (prisma db push + seed บน $PG_IMAGE ใช้แล้วทิ้ง)"
  if ! db_stage; then
    echo "check-code: FAIL — db stage รันไม่สำเร็จ (schema push หรือ seed พัง)"
    fail=1
  fi
else
  # ⚠️ **ข้ามแล้วต้องส่งเสียง** — stage ที่หายไปเงียบ ๆ คือ stage ที่ไม่มีใครรู้ว่าไม่ได้รัน
  echo "check-code: db stage ถูกข้าม — ไม่มี docker บนเครื่องนี้ (ปลายทางยังไม่ถูกพิสูจน์รอบนี้)"
fi

if [ "$fail" -eq 0 ]; then
  echo "check-code: OK"
fi
exit "$fail"
