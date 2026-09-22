# `form-refusals.md` is at 192/200 — the split ใบ 073 named is now the next card, not a someday

- status: todo
- commit:

## Goal

Two cards are in §5's warn band (170, hard cap 200):

| Card | Lines | Why it grew |
| --- | --- | --- |
| `.docs/knowledge/domain/form-refusals.md` | **192** — 8 lines of headroom | ใบ 080 added three action rows, the per-screen cost table that makes the guard *order* decidable, and then its review round added the `err=stale` scoping |
| `.docs/knowledge/domain/sheet-colour-rules.md` | **174** | one frontmatter pointer, added by ใบ 080 for the ใบ 078 reverse-direction check |

The gate is green — this is a warn, not a failure — and it is being carded rather than crammed,
which is the precedent ใบ 013 set and ใบ 023 discharged.

## The boundary is already named, twice

`tasks/done/073-split-form-refusals-knowledge-card.md` named it when it made the first cut, and ใบ
080's implementer named the same one independently: **the ใบ 014 paste-import block** — the
four-bucket table (`unmatched` · `invalidHours` · `invalidDates` · what is skipped) plus the two
paragraphs framing it, and the `/ot` `paste` row in the action table.

That block sources `lib/ot-import.ts` and `app/ot/**` alone, and is self-contained: nothing in the
queue grows it. Moving it leaves the parent at roughly **112 + ใบ 080's additions**, back inside
the band, and leaves the parent as one topic — per-field refusals on the shared `?err=` surface.

## Requirements (§5, and the two things the last split taught)

1. **`sources:` shrinks with the prose on every card touched** — including `sheet-colour-rules.md`,
   which is over the band for a pointer and should be looked at in the same pass rather than left
   four lines under the warn. A card that moves its prose but keeps the parent's whole source list
   goes STALE just as often.
2. 🔴 **Re-read every card that links to the ones being split.** ใบ 073 falsified a sentence on a
   *third* card (`money-input-guards.md`) and no gate could see it: cards do not `sources:` other
   cards, so `check-knowledge.sh` is structurally blind, and `check-links.sh` sees only that the
   file still exists. That is [078](078-a-card-pointer-that-resolves-but-names-the-wrong-owner.md),
   and this card is the next chance to prove the reverse-link habit works before the gate question
   is even decided.
3. **A row in `.docs/knowledge/index.md`** for the new card, Thai, in the neighbours' style, naming
   the task it was split at.
4. **Prove pure movement** the way ใบ 073 did: the moved block cut from HEAD by line range must
   `diff` against the new card with only declared re-anchor hunks. ⚠️ ใบ 073's lesson — a sentence
   that was fine as rhetoric ("every row in the table above…") can become a **checkable claim that
   is false** once it crosses a card boundary. Re-read the seams, do not just move them.

## Notes

- 🔴 **Do this before anything else touches either file.** At 192/200 the headroom is **8 lines** —
  less than one action row with its reason. The next card that lands there either fails the hard cap
  or gets crammed, and §5's remedy is a split, never a shrink.
  [081](081-the-review-screens-queue-guard-and-its-remaining-silences.md) and
  [082](082-calendarDate-accepts-a-year-that-cannot-be-real.md) both land there.
  🔑 Same order as ใบ 073 before ใบ 072, and for the same reason: a docs split with a money change
  in flight makes the money diff unreadable. It was deferred out of ใบ 080 on that argument, not
  because the split could wait.
- Precedent for the mechanics: [073](../done/073-split-form-refusals-knowledge-card.md) and
  [023](../done/023-split-two-oversized-knowledge-cards.md).
