# `payroll-rules.md` is at 186/200 and warning — split it at the engine/screen seam

- status: todo
- commit:

## Goal

`.docs/knowledge/domain/payroll-rules.md` is **186 lines** against `scripts/check-knowledge.sh`'s
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
<!-- task 063 took it to **186** (3 lines for the import seam, then 4 more for the zero-base warning
     its review round added). 14 lines from the hard cap ⇒ nothing else may be added before this split. -->
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
- [task 023](../done/023-split-two-oversized-knowledge-cards.md) is the worked precedent for a §5
  split in this repo, including the trap it hit: a number written fresh during a split that
  disagreed with `scripts/junit-pins.txt`, the authority. **Quote the authority, do not restate it.**
- Do **not** fold this into a card that is also changing engine behaviour. A §5 split is provable by
  reading — a card's claims moved, none invented — and burying it under a money diff costs that.
