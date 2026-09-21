# `payroll-rules.md` is at 189/200 and warning — split it at the engine/screen seam

- status: done
- commit: 6873b38

## Goal

`.docs/knowledge/domain/payroll-rules.md` is **189 lines** against `scripts/check-knowledge.sh`'s
warn at `> 170` (hard cap 200). It was 170 at HEAD and 170 through most of task 037, because that
card paid for its own additions by **shortening a `sources:` comment** rather than by making the
card smaller — parking it one line below the brake it exists to receive. The three lines the review
lanes then required (below) pushed it over, which is the brake working. §5's answer to a card near
its cap is **split it**, never raise the cap and never keep trimming comments to stay under.

## What task 037 already did, so this card does not redo it

`lib/payroll/class.test.ts` **is** in `sources:` — task 037 put it there after `code-reviewer`
(finding 1) and `payroll-auditor` (finding 3) both caught that the split had quietly narrowed the
card's staleness net: line 78 documents the task-025 negative-attendance rule (a §2 rule 4 money
rule) and quotes that file's figures, while `sources:` listed only `ot.test.ts` and `slip.test.ts`.
⇒ rewriting the three class arms while keeping the count at 6 would have left the junit pin green
(it compares counts, not content) **and** `check-knowledge` silent.

That fix is what took the card from 170 to **173**, which is why the §5 warn now fires and why this
<!-- task 063 took it to 186 (3 lines for the import seam, then 4 more for the zero-base warning its
     review round added); task 064 added one bullet ⇒ **189**. 🔴 **11 lines from the hard cap.** Every
     card that lists `prisma/schema.prisma` has to move on a schema change, and this is the one of them
     that cannot grow — so the next schema card pays for this split whether it wants to or not. -->
card exists. The warn is the honest signal, not a regression: the card was only ever at 170 because
task 037 paid for its own additions by trimming a `sources:` comment.

## Scope

1. Split the card at the seam its own `sources:` list already draws:
   - **the engine's rules** — `lib/payroll.ts` · `lib/config-keys.ts` · the three
     `lib/payroll/*.test.ts` files that pin them;
   - **what the screens may and may not do with config** — rule 4's `num()` claims about
     `app/ot/page.tsx` and `app/classes/**`, which are claims about *callers*, not about the engine.
   The second half is the smaller one and is the one that keeps growing as screens land.
2. §5's rules for a split: shrink `sources:` **with** the prose (a card that moves its text but keeps
   the parent's whole source list goes stale just as often), 40–120 lines each, and a row per card in
   [.docs/knowledge/index.md](../../.docs/knowledge/index.md).
3. Re-point anything that cites the old card by section — `grep -rn "payroll-rules" .docs .claude scripts`.

## Notes

- Raised by `code-reviewer` (findings 1 and 8) and `payroll-auditor` (findings 3 and 7)
  reviewing task 037, 2026-09-19.
- [task 023](023-split-two-oversized-knowledge-cards.md) is the worked precedent for a §5
  split in this repo, including the trap it hit: a number written fresh during a split that
  disagreed with `scripts/junit-pins.txt`, the authority. **Quote the authority, do not restate it.**
- Do **not** fold this into a card that is also changing engine behaviour. A §5 split is provable by
  reading — a card's claims moved, none invented — and burying it under a money diff costs that.

---

## What landed

The seam is the one the card named: claims about **`lib/payroll.ts`** stayed, claims about its
**callers in `app/**`** moved to a new card.

| | `payroll-rules.md` | `money-on-screen.md` (new) |
|---|---|---|
| lines | 189 → **136** | **85** |
| `sources:` | `lib/payroll.ts` · `lib/config-keys.ts` · the three `lib/payroll/*.test.ts` · `prisma/schema.prisma` | `app/ot/page.tsx` · `app/classes/page.tsx` · `app/payslips/page.tsx` · `app/page.tsx` · `lib/payroll/ot.test.ts` |
| rule 4 | `money()` ปัดครั้งเดียว, then four lines pointing at the new card | *No screen computes money* (011) · computed-vs-displayed · the task-019 residue · why the deleted columns were dangerous · `num()` outside the engine |

Nothing was shortened and nothing was invented: the five paragraphs moved verbatim apart from
cross-references that would otherwise have pointed at prose no longer in the card they name.

**`lib/payroll/ot.test.ts` is a source of both.** The prose moved and its numbers moved with it —
the 13.33 · qty 0.33 · 266.67 reference answer is now quoted only by `money-on-screen.md`, so that
card lists the file (§5, the same fix task 037 made for `class.test.ts`). It stays on the parent
because rule 4's one-rounding rule is still pinned there. `scripts/junit-pins.txt`'s comment for
that file named `payroll-rules.md` rule 4 as the card quoting the figures and now names the new
one — which is why `ops/gate-tiers-and-pins.md` moved in this commit too (that file is its source).

**Re-pointed** (`grep -rn "payroll-rules" .docs .claude scripts app lib prisma`):
`payslip-lifecycle.md:32` cited rule 4 as *"no screen computes money · round once"*, two claims that
now live in two cards, and names both.

### 136 is over §5's 40–120 band, on purpose

The gate warns at 170 and the card is well under it. The remainder is **one topic** — the engine —
and §5's remedy is a split *by a clear boundary*; below this seam there is none that does not cut
rule 3 (the `warnings` invariant, the most-cited thing in the repo) in half. Splitting it further to
hit a number would be the "แตกการ์ดแบบลวก ๆ เพื่อผ่านเกต" `check-knowledge.sh` says in its own header
it refuses to force.

### One pointer left deliberately

`lib/payroll.ts:58` still reads *"See `payroll-rules.md` rule 4"* over the comment that is now the
new card's subject. The trail is unbroken (rule 4 points on), and editing `lib/payroll.ts` here
would make this docs-only commit touch the engine and drag four more cards' `sources:` with it —
exactly what this card's Notes forbid. **Card 065 re-points it**, since it is already in that file.

- gate: `bash scripts/verify.sh` → `verify: ALL GREEN` (selftest tier ran — `scripts/**` moved)
