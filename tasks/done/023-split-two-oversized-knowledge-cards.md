# Two knowledge cards are at the warn line — split them before the next card lands on them

- status: done
- commit: 98f2d95

## Goal

`.docs/knowledge/ops/gates.md` and `.docs/knowledge/domain/payroll-rules.md` both crossed the
**170-line warn** during task 013 (cap is 200 — `check-knowledge.sh` prints
`warn: การ์ด N ใบเกิน 170 บรรทัด` and still exits 0). §5 is explicit that a card at the cap gets
**split, not a bigger cap**, and both reviewers on task 013 said the same thing: the additions were
load-bearing, so do not cram or omit them, but the next growth owes a split.

Splitting is cheapest **before** the work commit that would grow them again, not after
(`check-knowledge.sh`'s own comments say a split may be its own commit ahead of the work).

🔴 **Measured after task 013 item 4 (2026-09-18): `payroll-rules.md` is at 198/200 and `gates.md` at
189/200.** Two lines of headroom on the card that **nearly every money commit must update** — it
sources `lib/payroll.ts`, `lib/config-keys.ts`, `lib/payroll-run.ts`, `prisma/schema.prisma`, both
payroll test files and `app/payslips/page.tsx`. The next such commit will shave a paragraph to fit,
and shaving is how the *why* gets lost, which is the only thing these cards are for. ⇒ **pull this
card next**, as the thing standing in front of the next money change, not as housekeeping.

## Scope

- Split by **topic with a clear boundary**, not by line count.
- 🔑 **Shrink `sources:` with the split.** §5: a card that moves its prose but keeps the parent's
  whole source list goes STALE just as often as before, which is the failure the split was meant to
  fix. `payroll-rules.md` picked up two test files in its `sources:` during task 013, so it now goes
  stale on more commits than it used to — that is the concrete symptom to fix here.
- Every new card needs its row in `.docs/knowledge/index.md` (the gate checks that direction; the
  reverse is `check-links.sh`'s job and is not duplicated).
- Candidate boundaries, to be argued rather than assumed:
  - `gates.md` — what each gate watches · versus the two-tier machinery and the junit pin layer.
  - `payroll-rules.md` — the payslip lifecycle invariants (status as a lock, what a run selects,
    what is recomputed) · versus the formula-level rules that cite `REQUIREMENTS.md` §§.

## Notes

- Pure documentation: no code, no gate, no schema. `bash scripts/verify.sh` must still exit 0, and
  `check-knowledge.sh` must report **no** card over 170 when it is done.
- Do not shorten by deleting the "why": the `gates.md` paragraph added in task 013 retracts a false
  structural claim (that a test importing `lib/db.ts` fails at import time — it does not; Prisma 7
  with `@prisma/adapter-pg` connects lazily and only the first query throws). A retraction that gets
  edited away comes back as the same wrong assumption three cards later.

---

## What shipped (2026-09-19)

Both splits are **pure movement**: every moved block was cut with `sed` by line range and diffed
back against the pre-split file, and both reviewers re-cut them out of `HEAD` and confirmed it.
`gates.md`'s two blocks came out byte-identical. `payroll-rules.md`'s block differs by a 3-space
dedent (it was nested under numbered item 3) and **three re-anchors, declared here so the next
person re-running the check does not read them as an undeclared edit**: the opening sentence,
`this rule forbids` → `payroll-rules.md rule 3 forbids`, and `(rule 1)` → `payroll-rules.md
rule 1`. Two `##` headings were added to the new domain card — additive, no bullet reordered.
Nothing was shortened, and no "why" was dropped — including the task-013 retraction the Notes
above name by hand.

| Card | before | after |
| --- | --- | --- |
| `.docs/knowledge/ops/gates.md` | 189/200 | **111** — who watches what · the groove-clinic diff · the formatter stage · the open-holes list |
| `.docs/knowledge/ops/gate-tiers-and-pins.md` | — | **109** (new) — ใบ 017's two tiers · the junit pin layer · "no test here reaches a database" |
| `.docs/knowledge/domain/payroll-rules.md` | 198/200 | **149** — invariants 1–5 · the formulas · rule 4 (no screen computes money) · วันจ่าย |
| `.docs/knowledge/domain/payslip-lifecycle.md` | — | **114** (new) — `PayslipWarning` · the two-sided status lock · who a run selects · what a recompute rebuilds |

**The boundaries, argued rather than assumed.** Both are the ones the Scope section proposed, and
both hold because each side answers a different *question*: `gates.md` answers "which gate watches
what", the new ops card answers "when does it run and what is one junit pin worth";
`payroll-rules.md` answers "where does the number come from", the new domain card answers "what
happens to the slip around that number".

**`sources:` shrank with the prose (§5), and every remaining row now carries a comment naming the
claim it backs** — that comment is what makes the next shrink decidable instead of a guess.

- `payroll-rules.md` 9 → 8: dropped `lib/payroll-run.ts` and `lib/payroll-run.test.ts` (both backed
  only the moved prose), added `app/page.tsx`. The two test files task 013 added are the concrete
  symptom this card named — `lib/payroll-run.test.ts` is gone from it, and `lib/payroll.test.ts`
  stays because rule 4 still quotes its reference figure and rule 3 still leans on the
  inactive-staff pair.
  🔴 **`prisma/schema.prisma` was dropped in the first pass and put back by review** — see the
  round below. It is the counter-example to "a moved topic takes its sources with it".
- `gates.md` 7 → 5: dropped `scripts/tests/check-verify-summary-selftest.sh` and
  `scripts/junit-pins.txt`.
- **Three files are deliberately sourced by both cards of a pair** — `scripts/verify.sh` and
  `scripts/check-code.sh` by both ops cards, `app/payslips/page.tsx` by both domain cards. Each one
  backs a live claim on *both* sides (e.g. `/payslips` is the second half of the status lock **and**
  the screen that still sums `Payslip.net`, task 019). Over-claiming a source costs a STALE that is
  loud and fixable; under-claiming is silent — §4's direction-of-error rule, applied to `sources:`.

**Pointers repointed in the same change**, so no open card sends the next lane to the wrong place:
`tasks/todo/015` (the no-database finding → the new ops card), `tasks/todo/013` (invariant 3's
lifecycle half → the new domain card), `tasks/todo/018` (a `gates.md:146` line-number citation the
split would have rotted → the section name instead).

`bash scripts/verify.sh` ALL GREEN · `check-knowledge.sh` reports **warn 0** across 6 cards.

---

## Review round (2026-09-19) — `payroll-auditor` BLOCK, `code-reviewer` PASS, all findings fixed

Both lanes ran on the staged split. They agreed on the two that matter, and between them they name
the trap in this kind of change: **a split's risk is not the prose, it is the `sources:` list.**
Moving a topic out feels like moving its sources out with it — but a *surviving* claim can rest on
a file whose other claims left.

| # | Finding | Fix |
|---|---|---|
| 1 | Both lanes: `prisma/schema.prisma` dropped while rule 3's `invalidHours` bullet still rests on it alone — `OtEntry.hours` is a `Float` ⇒ accepts `NaN`, the entire reason `finiteNumber` exists. Retype the column and **no card goes STALE**; a later lane then reads a live rationale that is false and drops the guard | re-added, with a comment scoping it to that one fact |
| 2 | auditor: the pointer bullet I wrote said `lib/payroll.test.ts` is pinned at **26**. `scripts/junit-pins.txt:22` pins **30** (26 → 30 at `202b62a`). A number newly written during a split, disagreeing with the authority — §7's "lowering a pin is a declaration that coverage was removed" is exactly what that invites | reworded to name the 24 → 26 *raise* and point at `junit-pins.txt` as the authority |
| 3 | auditor: the lifecycle card sources `app/payslips/page.tsx` and says "read both before changing `lib/payroll-run.ts`" — so a task-019 lane sent to that screen meets the lock but never meets rule 4 (*no screen computes money · round once*) | intro widened to "or either payslip screen", naming rule 4 |
| 4 | reviewer: `app/payslips/[id]/page.tsx` is sourced by no card, while the lifecycle card promises warnings are "rendered above the amounts on **both** payslip screens, never collapsed" | added to that card's sources |
| 5 | both: `app/payslips/page.tsx:58` cited for the `Payslip.net` sum — the sum moved to `:70` at `1bc770a`, and `:58` is now the `setStatus` lock | corrected to `:70` |
| 6 | reviewer: `app/page.tsx` is the *other* file rule 4's residue names and was sourced by no card at all | added to `payroll-rules.md` |
| 7 | reviewer: rule 2 still names `lib/payroll-run.ts` as the config loader, no longer a source | pointer added to the card that does source it |
| 8 | reviewer: `tasks/todo-human/021` still sends its lane to `payroll-rules.md` for the leaver warning's Thai string, which moved | repointed |
| 9 | reviewer: the domain card had one `##` for nine bullets, while its title promises three topics | two headings added, nothing reordered |

**What this cost the money card:** `payroll-rules.md` came out at **149/200**, not the 136 of the
first pass — findings 1, 6 and 7 all add lines to it. That is the right trade (a source with a
comment naming its claim is what makes the *next* shrink decidable), but it is worth saying plainly:
the money card bought **21 lines of headroom to the warn**, not fifty. The next growth on it owes a
split of rule 4: `code-reviewer` measured it at **43 lines, 29% of the card**, already carrying its
own three sub-titles ("No screen computes money" · "the one residue" · "Why the deleted columns
were dangerous") — and `app/payslips/page.tsx` + `app/page.tsx` travel with it when it goes.
