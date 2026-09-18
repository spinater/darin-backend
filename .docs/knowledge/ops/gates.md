---
sources:
  - scripts/verify.sh
  - scripts/tests/check-verify-summary-selftest.sh
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
| `scripts/check-file-length.sh` | §4 เพดาน 500 บรรทัด · ขอบเขตอยู่บ้านเดียวที่ `scripts/lib/file-length-scope.sh` ซึ่ง hook ของ Claude อ่านตัวเดียวกัน |
| `scripts/check-links.sh` | ลิงก์ md ที่เน่า · ใบงานที่มีสองบ้าน · หัวใบที่อ้างสถานะขัดกับบ้านของตัวเอง |
| `scripts/check-knowledge.sh` | §5 — การ์ดที่ `sources:` ขยับแล้วการ์ดไม่ขยับตาม (STALE) · เพดานการ์ด · การ์ดที่ไม่มีแถวใน index |
| selftest ของแต่ละด่าน | **เกตของเกต** — ด่านที่โกหกได้ ทำให้ผลของด่านอื่นในรอบเดียวกันไม่มีความหมาย · **ใบ 017: รันเมื่อ `scripts/**` ขยับเท่านั้น** (ดูหัวข้อถัดไป) |

Four rows that used to sit in this table came out in ใบ 017 — `check-path-bytes.sh` ·
`check-sort-locale.sh` · `check-text-bytes.sh` · `check-card-paths.sh`. What each one watched, and
what is therefore no longer watched, is written out in
[ใบ 017](../../../tasks/done/017-shrink-gate-and-review-lanes.md) under "What stops being watched".
It is also item 6 of the open-holes list at the bottom of this card.

## ใบ 017 — สองชั้น: ด่านที่รันทุกรอบ กับ selftest ที่รันเมื่อแตะ `scripts/**`

วัดก่อนตัด (§7 "measure first", 2026-09-18): เกตทั้งก้อน **81 วินาที** · ในนั้น **~41 วินาที**
คือ selftest 15 ใบ · ด่านเนื้อหาทั้งแปดใบรวมกัน **2.3 วินาที** · `check-code.sh` **5.2 วินาที**
· เทสโดเมนทั้ง 63 ใบ (รวมเงิน) **244 มิลลิวินาที**

🔑 **ราคาไม่ได้อยู่ที่เทสของสินค้า มันอยู่ที่เทสของสคริปต์เกต** ⇒ ชั้นที่เลื่อนออกไปคือ selftest
ไม่ใช่ coverage: `check-code.sh` และทุกข้อใน §2 ไม่ถูกแตะเลยในใบนี้ (§7 ข้อ 4 — จ่ายด้วยเครื่อง
และ I/O ก่อน ค่อยจ่ายด้วย coverage)

- **`core_gates`** รันทุกรอบ · **`gate_selftests`** รันเมื่อ `scripts/**` ขยับ
- `verify.sh` ตัดสินเองด้วย `git status` **และ** `git diff` เทียบ **สอง ref** (`develop` กับ
  `origin/develop`) · **ไม่ fetch** — เกตต้องรันได้ตอนไม่มีเน็ต · ทิศที่พลาดแล้วเงียบคือ
  "สคริปต์เกตที่แก้แล้วยังไม่ commit" ซึ่ง `git diff <ref>...HEAD` มองไม่เห็น ⇒ ต้องมี `status` ด้วย
- **ข้ามแล้วต้องดัง** — บรรทัด `verify: ` บอกเองว่าข้าม selftest ไปกี่ใบและบังคับรันยังไง
  (`VERIFY_GATES=1` เปิด · `VERIFY_GATES=0` ปิด) · นี่คือเหตุผลเดียวที่การข้ามแบบอัตโนมัติยอมได้
- `check-shell-source.sh` **อยู่ชั้นที่รันทุกรอบ** แม้ selftest ของมันจะเลื่อน — มันคือเงื่อนไขที่
  ผลของด่านอื่นวางอยู่บน และมันใช้ 0.7 วินาที · ส่วน selftest ของมันตอบแค่ว่า "ด่านนั้นยังทำงานไหม"
  ซึ่งเปลี่ยนไม่ได้ตอน `scripts/**` ไม่ขยับ
- `scripts/tests/check-verify-summary-selftest.sh` อ่านรายชื่อด่าน **ออกจาก `verify.sh` ตัวจริง**
  ⇒ มันอ่านทั้งสองอาร์เรย์ และตั้ง `VERIFY_GATES=1` ให้สนามจำลองรันครบทั้งลิสต์

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

## The junit pin layer — and why no test in this repo can touch a database (task 009)

`scripts/lib/check-code-junit.sh` + `scripts/junit-pins.txt`: every test file must be **run** and
must run **exactly** the pinned number of tests. Current rows and what each is worth are in that
file's own header; task 009 raised `lib/payroll.test.ts` 21 → **24** and added
`lib/ot-import.test.ts` at **6** and `lib/next-errors.test.ts` at **6**. What each raise bought:

| Pin | Raise | What it is worth |
| --- | --- | --- |
| `lib/payroll.test.ts` | 21 → 23 | two §2-rule-4 cases — a membership sale attributed to a non-`closer`, and an unknown `sale.kind`; each asserts a warning **and** a zero commission |
| `lib/payroll.test.ts` | 23 → 24 | the OT >2-decimal case: 9:20 arrives as `9.333333333333334`, the engine pays 13.33 and 266.67 over 20 days (§2 rule 5, round once) |
| `lib/ot-import.test.ts` | new at 5 | usernames from a fingerprint paste that match nobody reach the screen instead of the floor |
| `lib/ot-import.test.ts` | 5 → 6 | `invalidHours` — a non-finite hours value is rejected by the parser, because `OtEntry.hours` is a `Float` ⇒ `double precision`, which **accepts `NaN`** |
| `lib/next-errors.test.ts` | new at 6 | telling a thrown `redirect()` apart from a real error, so the `/ot` action's `catch` cannot swallow navigation |

**Every row is a raise**; only a lowering needs a reason in the task card.

⚠️ **A pin is worth exactly what its test asserts — read the 23 → 24 row before quoting one as
proof.** It asserts `computePayslip`, whose OT block never had the defect (that was in
`app/ot/page.tsx`), so it would have gone green against the pre-fix tree: it writes the engine's
figure down **outside** the screen, making a future disagreement provable, but it does not fence
the screen. Pinning a screen needs a seam outside the component (task 011) and a lane that can
render one (task 015).

🔴 **Structural finding, not a task-local one: stage 4 has no database.** `check-code.sh` runs
`bun test` *before* `db_stage` creates the throwaway postgres, and with no `DATABASE_URL` in the
environment. `lib/db.ts` builds its `PrismaClient` at module scope, so **any test file that
transitively imports it fails at import time.** Every way around it is closed on purpose:

| attempt | why it fails |
|---|---|
| a DB-backed `*.test.ts` | runs in stage 4 with no DB ⇒ red |
| `test.skipIf(!process.env.DATABASE_URL)` | the pin counts `tests - skipped`; an env-conditional count makes the pin meaningless, and layer 2 rejects it |
| a second junit report inside `db_stage` | slips past the layer-2 corpus filter into an **unpinned** report — a gate that can vanish in silence, the exact class §7 exists to prevent |

⇒ **Consequence to plan around, not to work around:** domain logic that must be tested has to be
reachable *without* `lib/db.ts`. That is why task 009 extracted `lib/ot-import.ts` as a pure
function instead of testing the server action, and why 009 has **no** test proving warnings reach
the database — stage 5's `prisma db push` + seed proves the schema, and nothing proves the write.
Closing that needs a **second pinned `bun test` pass inside `db_stage`** after push+seed, with
`check-code-junit.sh` extended to read a second junit file — task
[015](../../../tasks/todo/015-db-test-lane.md).

## 🔴 ช่องที่รู้ตัวว่าเปิดอยู่ — อย่าอ่านตารางข้างบนว่า "ครบแล้ว"

1. **ไม่มีเกตฝั่งสิทธิ์** — หน้าใหม่ที่ลืมเรียก `requireRole()` วันนี้ไม่มีอะไรแดง
2. **`check-code.sh` ไม่ได้ build `Dockerfile`** — ตัวที่ build จริงคือตอน deploy เท่านั้น
   ⇒ ห้ามเขียนที่ไหนว่า "เกตเขียว = อิมเมจ build ผ่าน"
3. **`verify.sh` ยังไม่อยู่ใน CI** — push develop แล้ว deploy เลยโดยไม่มีเกตขวาง
4. **The formatter watches shape, never content** — `prettier --check` is green on code that is
   wrong, and it does not look at shell, SQL, YAML or Markdown at all.
5. **No test in this repo reaches a database** — see the junit-pin section above. Stage 5 proves
   the schema pushes and seeds; **no gate proves any write against it is correct.**
6. **สี่ช่องที่ใบ 017 เปิดคืน** — พาธที่ไม่ใช่ ASCII ที่ `core.quotePath` quote แล้วเกตที่เหลือ
   ข้ามไปเงียบ ๆ **ก่อนตัวนับของตัวเองจะขยับ** (วันนี้ยังไม่มีพาธแบบนั้นในรีโป ⇒ แฝงอยู่ ไม่ได้ปิด) ·
   ไฟล์ที่ตั้งใจเป็น text แต่ไบต์อ่านว่า binary ⇒ ด่านเนื้อหาข้ามทั้งไฟล์ · พาธในเครื่องหมาย
   backtick และในคอมเมนต์โค้ดที่ไม่มีรากจริง (ลิงก์ md ยังมี `check-links.sh` เฝ้า) · `sort`
   ที่ไม่ประกาศ locale
