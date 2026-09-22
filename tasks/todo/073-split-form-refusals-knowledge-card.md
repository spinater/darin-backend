# `form-refusals.md` is 3 lines under the §5 warn and has two topics in it

- status: todo
- commit:

## Goal

`.docs/knowledge/domain/form-refusals.md` is at **167 lines**. §5's band is 40–120, the warn is
170 and the hard cap is 200. It arrived at task 014 already at 151 and took 16 more.

Nothing is red today — `check-knowledge: OK`, `warn 0` — which is the problem: the next person to
touch `/ot` or `/sales` refusals trips the warn and has to do the split under time pressure, inside
a card that was about something else.

## Scope

§5 says a card at the cap gets **split**, never a bigger cap, and that the split is by *topic with
a clear boundary* — with `sources:` shrunk alongside it, because a card that moves its prose but
keeps the parent's whole source list goes stale just as often.

The boundary is already visible in the file: the **per-field refusal table** (what `finiteNumber`
rejects and why, one row per form field) against the **paste-import four-bucket table** that task
014 added (`unmatched` · `invalidHours` · `invalidDates` · what is skipped). Those are two
subjects with two source sets — the first sources `lib/form-number.ts` and the write actions, the
second sources `lib/ot-import.ts` and `app/ot/**`.

Add a row for the new card in `.docs/knowledge/index.md` (§5 — the gate checks that direction).

## Notes

- Flagged by `code-reviewer` during the task 014 review. The brief for 014 asked the implementer to
  "say so rather than cram"; it crammed and said nothing, which is how a card reaches the warn with
  nobody having decided anything.
- `.docs/knowledge/domain/money-on-screen.md` is at **122** (band tops at 120) for a note recording
  that *nothing changed* — it sources `app/ot/page.tsx`, so task 014's diff made it `STALE` without
  moving either of its claims. Defensible as an anti-goose-chase marker; worth a look in the same
  pass, not a split of its own.
- Precedent for how to do this: [023](../done/023-split-two-oversized-knowledge-cards.md).
