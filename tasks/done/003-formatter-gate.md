# เปิดเกต formatter ฝั่ง TypeScript

- status: done
- commit: 02b7d4c (reformat) · gate commit recorded in the follow-up

## Goal

รีโปนี้ยังไม่มี formatter ที่ปักหมุดไว้ ⇒ ทรี drift ไปเรื่อย ๆ จนวันที่มีคนพิมพ์คำสั่ง format
ครั้งแรก มันจะลากไฟล์ทั้งรีโปเข้าคอมมิตของคนที่บังเอิญพิมพ์ — เกิดจริงที่ groove-clinic
(333 ไฟล์ · และสายที่โดนต้องกู้คืนด้วยมือ 204 ไฟล์)

## Notes

- ที่ groove-clinic ตัวที่ปิดช่องนี้คือ `cargo fmt --check` ใน `scripts/check-code.sh`
  พร้อม **ปักเวอร์ชัน** เพราะ formatter คนละเวอร์ชันให้ผลคนละแบบ ⇒ ที่นี่ต้องปักหมุดเหมือนกัน
  (หมุดมีบ้านอยู่แล้วที่ `scripts/lib/bun-image.sh` และ `scripts/check-bun-pin.sh` เฝ้าให้ตรงกับ `Dockerfile`)
- ทางออกที่กติกาบังคับ: ข้อความตอนแดงต้อง **พิมพ์ตามได้จากเครื่องที่ยืนอยู่** — เกตที่แดง
  แล้วบอกทางแก้ไม่ได้ คือเกตที่คนจะเรียนรู้ว่าให้ข้าม
- ⚠️ คอมมิตที่ format ทั้งทรีรอบแรกจะทำให้การ์ดความรู้ STALE พร้อมกันหลายใบ (§5 นับด้วยเวลา
  คอมมิต แยก "เนื้อเปลี่ยน" กับ "รูปแบบเปลี่ยน" ไม่ออก) — จ่ายครั้งเดียวในคอมมิตนั้น

## What was done (2026-09-17)

**Formatter: prettier `3.9.7`, pinned exactly** (no `^`, no `~`) as a devDependency. linus decided
the tool; `bun fmt` does not exist in bun 1.3.10, so that route was closed anyway.

| File | Role |
|---|---|
| `package.json` + `bun.lock` | the pin — one home, both the gate and the image install from it |
| `.prettierrc` | config: prettier defaults + `printWidth: 100` |
| `.prettierignore` | what must never be formatted (Markdown first) |
| `scripts/lib/check-code-format.sh` | the stage, sourced by `scripts/check-code.sh` |
| `scripts/check-code.sh` | sources it **first**, before `tsc` |
| `scripts/tests/check-format-selftest.sh` | the gate's gate — 18 cases |
| `scripts/verify.sh` | runs the selftest with the other gates' gates |
| `.docs/knowledge/ops/gates.md` · `.docs/knowledge/domain/payroll-rules.md` · `.docs/knowledge/index.md` | §5 |

### Decisions and why

1. **The pin needs no watcher of its own — but only after the `bunx` hole was closed.**
   `check-bun-pin.sh` exists because a `Dockerfile` cannot source a shell file, so the bun/node pin
   has two homes that must be kept equal. `package.json` + `bun.lock` are read by the gate
   (`bun install --frozen-lockfile`) **and** by `Dockerfile`'s deps stage alike ⇒ one home, nothing
   to compare, no second gate. Prettier is a devDependency, so it lands in the builder image only —
   the runner stage copies `.next/standalone` and never sees it.
   🔴 **The first version of this stage did not have one home.** It ran `bunx prettier`, and `bunx`
   is not pin-aware: measured in a sandbox where `package.json` and `bun.lock` both pinned 3.8.0 and
   `node_modules` existed but held no prettier, `bunx prettier --version` printed **3.9.7** — the
   registry's `latest`, fetched and run silently. Combined with `$deps`
   (`[ -d node_modules ] || bun install …`, i.e. it installs *only* when the directory is missing),
   any checkout with a stale `node_modules` — the other lanes in this tree, the deploy host, cached
   CI — would have run an unpinned formatter. Invisible today because `latest == 3.9.7`; on the day
   it is not, either the gate reddens a tree nobody touched, or a human obeys the red and runs the
   *fix command the stage itself printed* under the unpinned formatter, reformatting the whole TS
   surface into their commit. That is the 333-file groove-clinic incident re-entering through the
   gate's own instructions. Fixed by invoking `./node_modules/.bin/prettier` in the check and in
   both fix commands, so a missing install fails loudly instead of silently substituting a
   different formatter. Selftest case L is the regression guard; counter-tested by reintroducing
   `bunx`, which turns L red **and** turns M green-when-it-should-be-red — the sandbox with nothing
   installed reported the tree as clean, which is the failure in its purest form.
2. **`printWidth: 100`, measured not chosen.** Reformatting the 31 TS files git holds costs
   26 files/1331 lines at width 80 (prettier's default), 15 files/249 lines at 100, 19/278 at 110,
   22/326 at 120. 100 is where this code was already being written by hand. Every other option is
   left at prettier's default because the default already matches the repo (double quotes,
   semicolons, trailing commas, `arrowParens: always`) — a re-stated default is a second home for a
   decision that already has one (§4).
3. **Scope = the JS-family source surface (`ts,tsx,mjs,cjs,js,jsx`). Markdown is excluded on
   purpose** and the reason is written in
   `.prettierignore` so the next person does not widen the glob: nearly every `.md` here is
   hand-written Thai (`REQUIREMENTS.md`, task cards, knowledge cards), §2.5 forbids sweeping
   existing Thai content, and Thai has no word spaces — a reflowed paragraph breaks where the
   author did not choose it to and the diff cannot be reviewed.
4. **The stage lives in `scripts/check-code.sh`**, first in the file: it is the precedent this card
   cites from groove-clinic (`cargo fmt --check`), it needs the same toolchain as the other code
   stages, `SKIP_CODE_CHECKS=1` covers it consistently, and it is the cheapest red in the file — no
   DB, no generated Prisma client ⇒ it goes red before anything slow runs. It runs through
   `bun_run`, so it works on both the native and the docker engine.
5. **`--check`, never `--write`.** A gate that rewrites the tree it is judging can never be red.
6. **The red message is engine-aware** (the hardest requirement on this card). The fix command is
   not the same on both engines, so the stage prints the one that applies to the machine standing
   there: `./node_modules/.bin/prettier --write "<glob>"` on native, a full `docker run --rm -v
   <this tree>:/app -w /app <pinned image> sh -c '…'` on docker. The glob printed is the same string
   the check ran with — case J of the selftest fails if those two ever drift, and case F reads the
   glob out of the stage file rather than retyping it.

### Exit codes, not just "non-zero"

`prettier --check` exits 1 for unformatted files and 2 for its own errors; the shell adds 126 and
127 when the binary itself will not run. The stage answers each with a different sentence and a
different command — 127 points at `bun install --frozen-lockfile`, which is *not* the fix command,
because `$deps` (`[ -d node_modules ] || …`) walks past exactly that case. Collapsing them into
"unformatted files" would print a red with no `[warn]` lines and a fix command that cannot help,
which is the class this stage's own header argues against. Selftest cases M, N, O and P.

Measured, because "the binary will not run" is three conditions and not one:

| Condition | rc | Branch |
|---|---|---|
| absent | 127 | install command |
| present, not executable | 126 | "nothing was judged" |
| present, **no `node` on PATH** for its `#!/usr/bin/env node` shebang | 127 | install command |

⚠️ The third row is a **host requirement moving off `bunx` introduced**: the native engine now needs
`node` on PATH, while `scripts/lib/bun-image.sh` still calls an engine native on bun alone and
CLAUDE.md §1 only asks for Node on the production server. The direction is safe (red, never green)
and `env: 'node': No such file or directory` prints directly above, so the cost is one confused
round trip — which the 127 message now closes by naming both causes. Case P is the guard, and it
goes red against the old single-cause wording.

**Not fixed by running the shim through bun** (`bun ./node_modules/.bin/prettier …`): measured,
`bun <missing file>` exits **1**, which would drop the nothing-installed case straight back into the
"found unformatted files" branch and reopen what case M exists to guard. The shebang is the cheaper
problem.

### The one-time reformat

`./node_modules/.bin/prettier --write "**/*.{ts,tsx}"` → **15 files, 175 insertions / 74
deletions**. Shape only:
`bun test` ran 45 pass / 3 skip before and after, so every row of `scripts/junit-pins.txt` is
unchanged (7 · 13 · 4 · 21). The pass bumped the mtime of `lib/payroll.ts` and `lib/payroll-run.ts`,
which are `sources:` of `domain/payroll-rules.md` ⇒ that card was updated in the same change (§5).

### Not done / deliberately out of scope

- **No `.editorconfig`** — it would be a second home for the same decision (§4) with nothing keeping
  the two equal, which is exactly the class `check-bun-pin.sh` had to be written for.
- **No formatter for shell, SQL, YAML or Markdown.** The card says "formatter ฝั่ง TypeScript".
  The glob does include `mjs/cjs/js/jsx` even though the only such file today is
  `postcss.config.mjs`: an extension *inclusion* list fails silently (§4), and that file was being
  judged by nobody. It is prettier-clean, so the widening cost zero churn.
- **`prettier --check` watches shape, not content** — it is green on code that is wrong. It is not
  a linter and no lint rule was added with it.
