# A card pointer that still resolves but now names the wrong owner — nothing watches this

- status: todo
- commit:

## Goal

Knowledge cards point at each other in prose — a sentence that names a subject, with a markdown
link to the card said to own it. When a card is **split**, those inbound pointers keep
resolving — the file still exists — while the claim they make about it has become false.

**Two gates look at this and neither can see it:**

- `check-links.sh` checks a link resolves to a file that exists. The target file still exists,
  so the link is green while it sends the reader to a card that no longer holds the thing named.
- `check-knowledge.sh` watches a card against its `sources:`, and **cards do not `sources:` other
  cards** ⇒ it is structurally blind to card-to-card drift.

## It has now happened twice in a row, to the same sentence

`money-input-guards.md` says the per-action table, the two parses, the `?err=` surface **and the two
guards that are a *pair* rather than a field** all live on `form-refusals.md`.

- ใบ 068 split `form-refusals.md` out of `money-input-guards.md` and **wrote that sentence true**.
- ใบ 073 moved the pair guards to `pair-guards.md` and **falsified it** — caught by `code-reviewer`
  in the review round, not by any gate.

🔑 **That one sentence is already repaired** — ใบ 073 shipped the fix in the commit that caused the
breakage, so do not open this card expecting to find it broken. What is open is the *class*: the
repair happened because a review lane read the prose, and there is nothing that would have caught it
otherwise. The next split has the same exposure and no better defence.

That is the shape worth acting on: not a typo, but a *predictable consequence of splitting a card*
that the split's own author has no mechanical reason to look for. §5 tells us to split cards as they
grow, so this will keep happening.

## Scope — decide which of these, and do not build all of them

1. **A reverse-link check.** For each card, find every other card that links to it. On a commit that
   moves content **out** of a card, that list is exactly who must be re-read. This could be a gate
   that only *reports* the list (cheap, no judgment) rather than one that tries to decide
   correctness — a gate that cannot be wrong, whose output is a to-do.
2. **A quoted-phrase check.** Narrower and mechanical: where a pointer's sentence names a thing
   (`the two guards that are a *pair*`), check that phrase still appears in the target card. Catches
   this exact instance. Fails on paraphrase, so it would need the prose to cooperate.
3. **A rule, not a gate**: §5 gains one line — *splitting a card means re-reading every card that
   links to it*, with the reverse-link command written down so it costs one paste.

🔑 **Option 3 is the honest default** and the others must beat it. This repo already carries the
lesson that a gate with no live subject is pure latency (ใบ 017) — and the counter-lesson that a
removed gate's hole is silent (ใบ 074). Whichever is chosen, the direction-of-error argument in §4
applies: a reverse-link *report* is loud and cheap to ignore when irrelevant; a missing check is
silent and fixed months later by a reader who went to the wrong card and concluded the rule does not
exist.

## Notes

- Found by `code-reviewer` during the ใบ 073 review, as a BLOCK on the commit that caused it.
- Related: [074](074-the-text-bytes-gate-came-out-and-then-the-bug-arrived.md) — the other
  "nothing watches this class" card open right now; the two should be decided together, because the
  answer to *"do we add a gate or write a rule"* should be consistent across both.
- Do not start this by writing a gate. Start by running the reverse-link query by hand over the
  cards that have been split so far (ใบ 023, ใบ 042, ใบ 068, ใบ 070, ใบ 073) and counting how many
  stale pointers are **already** in the tree. If the answer is zero outside ใบ 073, option 3 wins on
  the evidence.
