---
sources:
  - scripts/verify.sh
  - scripts/check-code.sh
  - scripts/check-bun-pin.sh
  - scripts/lib/bun-image.sh
  - scripts/lib/check-code-format.sh
  - scripts/junit-pins.txt
---

# เกตของรีโปนี้ — ใครเฝ้าอะไร และอะไร *ไม่ได้* ถูกเฝ้า

ทางเข้าเดียวคือ `bash scripts/verify.sh` (CLAUDE.md §7) · ลำดับ stage ไม่ได้เรียงตามความสำคัญ
แต่เรียงตาม **เงื่อนไขของกันและกัน**: ด่านที่ตอบว่า "ผลของด่านอื่นเชื่อได้ไหม" ต้องจบก่อนเสมอ

## พอร์ตมาจาก groove-clinic ทั้งก้อน (ใบ 001)

| ด่าน | เฝ้าอะไร |
|---|---|
| `scripts/check-shell-source.sh` | สคริปต์ที่ `.` ไฟล์ของรีโปโดยไม่อ่าน `rc` — ถ้าไฟล์ที่ source พัง มันจะ **เดินต่อจนจบ exit 0 พร้อมแต้มที่น้อยลง** ⇒ เงื่อนไขที่ทำให้ selftest ทุกใบพูดความจริงได้ |
| `scripts/check-path-bytes.sh` | จุดเรียก git ที่กิน stdout แต่ไม่มี `-z` — `core.quotePath` ทำให้พาธไม่ใช่ ASCII ถูก quote ⇒ ลูปข้ามไฟล์นั้นเงียบ ๆ **ก่อนตัวนับของตัวเองจะขยับ** (รีโปนี้ชื่อไฟล์/เนื้อไฟล์เป็นไทยเยอะ ⇒ ไม่ใช่ฉากสมมติ) |
| `scripts/check-sort-locale.sh` | `sort` ที่ไม่ประกาศ locale — uutils ใต้ `en_US.UTF-8` ให้เครื่องหมายวรรคตอนน้ำหนักศูนย์ ⇒ `sort -u` ยุบชื่อที่ต่างกันจริง |
| `scripts/check-text-bytes.sh` | ไฟล์ที่ตั้งใจให้เป็น text แต่ไบต์อ่านว่า binary ⇒ เกตอื่น **ข้ามมันทั้งหมดโดยไม่มีใครรู้** |
| `scripts/check-file-length.sh` | §4 เพดาน 500 บรรทัด · ขอบเขตอยู่บ้านเดียวที่ `scripts/lib/file-length-scope.sh` ซึ่ง hook ของ Claude อ่านตัวเดียวกัน |
| `scripts/check-links.sh` | ลิงก์ md ที่เน่า · ใบงานที่มีสองบ้าน · หัวใบที่อ้างสถานะขัดกับบ้านของตัวเอง |
| `scripts/check-card-paths.sh` | พาธในเครื่องหมาย backtick **ทุกไฟล์ที่ git ถือ** ที่ไม่มีรากจริง |
| `scripts/check-knowledge.sh` | §5 — การ์ดที่ `sources:` ขยับแล้วการ์ดไม่ขยับตาม (STALE) · เพดานการ์ด · การ์ดที่ไม่มีแถวใน index |
| selftest ของแต่ละด่าน | **เกตของเกต** — ด่านที่โกหกได้ ทำให้ผลของด่านอื่นในรอบเดียวกันไม่มีความหมาย |

## ที่ต่างจาก groove-clinic — และเหตุผล

**ต่างเพราะภาษาโปรแกรม ไม่ใช่เพราะมาตรฐานคนละชุด** (linus 2026-09-17: เอากติกาเดิมทุกข้อ เปลี่ยนแค่ภาษา)

| groove-clinic | ที่นี่ | ทำไม |
|---|---|---|
| `check-code.sh` = cargo fmt + clippy + test + tsc/bun | `check-code.sh` = tsc + prisma validate + bun test + db push/seed | ไม่มี Rust ในรีโปนี้ |
| `scripts/lib/rust-image.sh` (หมุด Rust 1.98) | `scripts/lib/bun-image.sh` + `scripts/check-bun-pin.sh` | เหตุผลของการปักหมุดเหมือนเดิมทุกตัวอักษร — เปลี่ยนแค่ว่าปักหมุดอะไร · และที่นี่ **มีเกตเทียบสองบ้าน** (lib กับ `Dockerfile`) ซึ่ง groove ไม่มี |
| `check-sql-coverage.sh` (trigger/constraint ต้องมีเทส) | — | schema ที่นี่เป็น Prisma + `db push` ไม่มีไฟล์ migration ให้กวาดชื่อ constraint · **ช่องนี้เปิดอยู่จริง ไม่ได้ปิดไปด้วยเหตุผล** |
| `check-txn-discharge.sh` (ทุก txn ปิดทางเดียว) | — | เป็นของ sqlx โดยเฉพาะ (`Drop` แค่ *คิว* ROLLBACK) — Prisma `$transaction` ไม่มีรูปนั้น |
| `check-authz.sh` (route ที่เกิดนอก ScreenRouter) | — | ที่นี่สิทธิ์เช็คด้วย `requireRole()` ในแต่ละหน้า/action · **ยังไม่มีเกตไหนเฝ้าว่าหน้าที่เกิดใหม่เรียกมันจริง** |
| `cargo fmt --check` ใน `check-code.sh` | stage `format` = `prettier --check` (ใบ 003) | Same gate, different language. See the section below for where the pin lives and why it needs no watcher of its own |

## The formatter stage (task 003) — what it is and what it deliberately is not

Stage `format` is the **first** stage of `check-code.sh` (`scripts/lib/check-code-format.sh`,
sourced with `.` like the junit layer): fastest red, needs no DB and no generated Prisma client.

- **Scope is the source surface prettier understands** — the glob `**/*.{ts,tsx,mjs,cjs,js,jsx}`,
  plus `.prettierignore` holding the same line if anyone widens that glob later. The extension list
  is an *inclusion* list, the direction §4 calls out as failing silently, so it names every
  JS-family extension rather than only the two the app happens to use today: `postcss.config.mjs`
  was judged by nobody while the glob said `{ts,tsx}`.
- 🔴 **Markdown is out of scope on purpose.** Almost every `.md` here is hand-written Thai prose
  (`REQUIREMENTS.md`, the task cards, these knowledge cards) and CLAUDE.md §2.5 forbids sweeping
  existing Thai content. Thai has no word spaces, so a reflowed paragraph breaks in places the
  author did not choose and the diff is unreviewable. Do not "helpfully" widen the glob.
- 🔴 **The stage runs `./node_modules/.bin/prettier`, never `bunx prettier`.** `bunx` is not
  pin-aware: with `node_modules` present but holding no prettier it fetches the registry's `latest`
  and runs it silently (measured: lock and `package.json` both pinning 3.8.0, `bunx` ran 3.9.7), and
  `$deps` is `[ -d node_modules ] || bun install …`, so a stale `node_modules` — another lane, the
  deploy host, cached CI — is exactly the tree that skips the install. That combination puts the
  pin's second home in the npm registry, and a human obeying the resulting red would reformat the
  whole surface with an unpinned formatter. The binary path fails loudly instead.
- **With that closed, the pin has one home.** `prettier` is an exact devDependency in `package.json`
  and the real pin is `bun.lock`, which both the gate (`bun install --frozen-lockfile`) and
  `Dockerfile`'s deps stage install from ⇒ **no `check-bun-pin.sh`-style watcher is needed here**:
  the "a Dockerfile cannot source a shell file" problem that forces that gate to exist does not
  arise. Prettier is a devDependency, so it reaches the builder image only — the runner stage copies
  `.next/standalone`.
- **`--check`, never `--write`.** A gate that rewrites the tree it is judging can never go red.
- **The red message is engine-aware** — the fix command differs between the native and docker
  engine, and the stage prints the one that applies on the machine standing there. It also splits
  the exit codes: `1` is "unformatted files" (fix command), `127` is "no formatter this machine can
  execute" (install command), anything else — including `126`, a binary present but not executable —
  is "nothing was judged this round".
- ⚠️ **The native engine now needs `node` on PATH**, because `node_modules/.bin/prettier` is a
  `#!/usr/bin/env node` shim. `scripts/lib/bun-image.sh` still calls an engine "native" on bun alone,
  so a host with bun and no node exits `127` with `env: 'node': No such file or directory` above it
  — which is why the 127 message names *both* causes instead of sending the reader to install
  something that is already there. (The docker engine is unaffected: `oven/bun:1.3-slim` ships a
  node fallback shim, verified by running the stage's command inside it.)
  `scripts/tests/check-format-selftest.sh` runs the **native** fix command it printed and checks the
  sandbox goes green; the docker form is asserted as text only, and only the native cases run at all
  when the host bun is off the pin.

## 🔴 ช่องที่รู้ตัวว่าเปิดอยู่ — อย่าอ่านตารางข้างบนว่า "ครบแล้ว"

1. **ไม่มีเกตฝั่งสิทธิ์** — หน้าใหม่ที่ลืมเรียก `requireRole()` วันนี้ไม่มีอะไรแดง
2. **`check-code.sh` ไม่ได้ build `Dockerfile`** — ตัวที่ build จริงคือตอน deploy เท่านั้น
   ⇒ ห้ามเขียนที่ไหนว่า "เกตเขียว = อิมเมจ build ผ่าน"
3. **`verify.sh` ยังไม่อยู่ใน CI** — push develop แล้ว deploy เลยโดยไม่มีเกตขวาง
4. **The formatter watches shape, never content** — `prettier --check` is green on code that is
   wrong, and it does not look at shell, SQL, YAML or Markdown at all.
