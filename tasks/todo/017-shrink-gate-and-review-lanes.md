# Shrink the gate and the review lanes to the size of this app

- status: todo
- commit:

## Goal

This repo ported groove-clinic's rulebook whole (task 001). groove-clinic is a large product; this
is one branch, a handful of staff, and one Google Sheet. The gate and the review chain were sized
for the other product, and the cost lands on every single change.

linus's order, 2026-09-18: *"ปรับ gate และจำนวน agent ที่ต้องรีวิว ... เพราะเป็นแอปเล็ก และจะเอา
cloudflare authen ครอบแทนการ authen ปกติ อยากให้สามารถ development ได้ไวๆ"*

## Measured before cutting (§7 "measure first")

`bash scripts/verify.sh` on a clean tree, 2026-09-18:

| Layer | Wall |
|---|---|
| **whole gate** | **81s** (33s user · 55s sys) |
| the 15 gate **selftests** | **~41s** — `counter-test` 13.4 · `links` 7.8 · `code-junit` 4.3 · `card-paths` 3.3 · rest ≤ 2.3 each |
| the 8 **content** gates together | **2.3s** — every one of them ≤ 0.7s |
| `check-code.sh` (tsc + prisma validate + 63 `bun test` + throwaway postgres) | **5.2s** |

🔑 **The cost is not in the tests of the product — it is in the tests of the gate scripts.** The 63
domain tests, money included, run in 244ms. So nothing in §2 and nothing in `check-code.sh` is
touched by this card: the cut is paid with machine and I/O, not with coverage (§7 rule 4).

## Decisions (linus, 2026-09-18)

1. **Gate selftests run on demand, not every time.** They are the gate's gate ⇒ they matter exactly
   when a gate script changes. `verify.sh` runs them automatically when the change touches
   `scripts/**`, and skips them **loudly on the summary line** otherwise (§7 "skips must be loud").
   Nothing is deleted; the everyday loop just stops paying for them.
2. **Four gates come out** — nothing left in this repo for them to watch:
   `check-card-paths.sh` · `check-sort-locale.sh` · `check-path-bytes.sh` · `check-text-bytes.sh`
   (with their selftests and the libs that only they used).
3. **Reviewers: one by default, two when money moves.** `code-reviewer` on every change;
   `payroll-auditor` added when the diff touches money. `security-reviewer`, `uxui-designer`,
   `architect` and `sa-requirements` stop being mandatory and become call-by-hand.
4. **`ultracode` off** in `.claude/settings.json` — multi-agent workflows spawnable session-wide is
   not what an app this size needs, and it is billed.
5. **Auth is NOT touched in this card.** Cloudflare Access is coming, but it answers *who arrived*,
   not *whether that person is the owner* ⇒ `requireRole()` and the role item on `code-reviewer`'s
   checklist stay exactly as they are until a card of its own moves them.

Two things linus was offered and **declined**, so they stay strict: the junit pins keep their
exactly-equal condition, and `check-knowledge.sh` keeps failing red on a STALE card.

## 🔴 What stops being watched — the price of decision 2

Written down because a gate deleted silently is a hole nobody can find later (§7 rule 4).

- **`check-path-bytes.sh`** — git calls that eat stdout without `-z`. `core.quotePath` is on by
  default, so a **non-ASCII path quotes itself and the loop skips that file before the gate's own
  counter moves**. Measured today: `git ls-files -c -o --exclude-standard | grep -cP '[^\x00-\x7F]'`
  = **0** ⇒ no live subject. But the consumers are still there (`check-file-length.sh`,
  `check-links.sh`, `lib/file-length-scope.sh`, `lib/check-code-junit.sh`) ⇒ **the day someone
  commits a Thai filename, those gates skip it silently.** This is latent, not closed.
- **`check-text-bytes.sh`** — a file meant to be text whose bytes read as binary, which every other
  content gate then skips whole.
- **`check-card-paths.sh`** — backticked paths with no real root, in every file git holds. Rotten
  paths inside **markdown links** are still caught by `check-links.sh`; rotten paths inside
  **backticks and code comments** are not caught by anything after this card.
- **`check-sort-locale.sh`** — `sort` with no declared locale. Under uutils + `en_US.UTF-8`,
  punctuation weighs zero ⇒ `sort -u` can collapse two names that really differ.

## Scope

- `scripts/verify.sh` — two tiers, loud skip, and the removals.
- `scripts/tests/check-verify-summary-selftest.sh` — it reads the gate list **out of `verify.sh`**
  by `awk`, so the two-tier form breaks its parser; it must learn to read both lists, and it runs
  the simulation with every gate present.
- `CLAUDE.md` §7 (gate table) and §9 (review chain) · `.docs/knowledge/ops/gates.md`.
- `.claude/settings.json` · the agent files whose standing changes.

## Verify — measured after the change, 2026-09-18

| Path | Wall | Was |
|---|---|---|
| everyday change (selftests deferred) | **7.1s** | 81s |
| change that touches `scripts/**` (selftests run) | **45.0s** | 81s |

Both `verify: ALL GREEN`. The deferred path prints its own skip on the summary line:
`verify: ALL GREEN — selftest ของเกต 10 ใบ: ข้าม (diff ไม่แตะ scripts/**) · VERIFY_GATES=1 เพื่อบังคับรัน`

The 36s the second row still saved over the old 81s is the four deleted gates and their selftests.

**The detection was proved in an isolated git repo, not assumed** — `verify.sh` plus a fake for
every gate name it calls, so the four cases could be built on purpose:

| Case | Result |
|---|---|
| tree clean, `scripts/` committed | skipped, and said so |
| one gate script edited, **uncommitted** | ran — the case `git diff <ref>...HEAD` alone cannot see |
| that edit committed on a branch, `develop` behind | ran |
| app-only change, `scripts/` untouched | skipped, and said so |

---

## Follow-on, same day: the `claude-tekton` lane (linus order 2026-09-18)

*"ให้ใช้ claude-tekton เป็นหนึ่งใน agent ใช้ในการทำงานได้เลย ให้ opus แตกงานให้ละเอียดพอสำหรับ
qwen3.8 27B"*

Added `scripts/tekton.sh` (dispatcher) + `.claude/skills/tekton-brief/SKILL.md` (the briefing
standard), registered in §9 and in Quick Reference. Proved end to end on a real brief, twice.

**Two things the first real dispatch found, which no amount of reasoning had:**

1. **CLAUDE.md §11 collides with the lane.** It told the lane to write
   `.scratch/agent-status.json`; the lane found the developer lane's live card-009 state in it and
   **spent its entire turn stopped at the conflict** rather than overwrite. It was right to stop —
   one status file per project, owned by the session the watcher tracks. Now denied at the
   permission layer and stated in the lane's system prompt, and §11 says so.
2. **A `Write(path)` deny rule is a no-op.** Claude Code answered in the log: *"Write(...) is not
   matched by file permission checks — only Edit(path) rules are. Edit rules cover all file-editing
   tools."* The `Edit` rule is what denies `Write`; the `Write` row bought only a warning line.

Also corrected from the first run: the footprint report was `git diff --stat`, which on this repo's
normally-dirty tree emitted **17 files of task-009 work as "the lane's output"**. It now diffs
`git status` before against after and reports only the delta.
