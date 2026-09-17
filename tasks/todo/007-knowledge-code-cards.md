# Knowledge cards: open the `code/` leg

- status: todo
- commit:

## Goal

`.docs/knowledge/` has the machinery ported from groove-clinic — the card contract (§5), the
staleness gate (`scripts/check-knowledge.sh`), the index registry — but only three cards, all of
them `domain/` and `ops/`. **There is no `.docs/knowledge/code/` at all**, which is the half that
carries the most weight at groove-clinic (120 cards there against 20 domain cards).

The consequence is concrete: an agent asked to touch `lib/payroll-run.ts` today has no card to read
first, so §8's "card → graph → grep → files" order starts one step late every time.

## Notes

- The graph built at task-time makes this cheaper than it was at groove-clinic: `graphify query`,
  `graphify affected` and `graphify god-nodes` name the real clusters instead of a human guessing
  them. The hubs it reports are `requireAdmin()` (32 edges), `db`, `periodRange()`,
  `currentStaff()` — those are card boundaries, not a coincidence.
- Start small and honest. Suggested first cards, one commit each:
  `code/payroll-engine.md` (`lib/payroll.ts` · `lib/payroll-run.ts` · `lib/config-keys.ts`) ·
  `code/auth-and-roles.md` (`lib/auth.ts` · `lib/password.ts`) ·
  `code/sheet-sync.md` (`lib/sheets.ts` · `lib/sync.ts` · `lib/parser.ts` · `lib/normalize.ts`) ·
  `code/screens.md` (`app/**`).
- `sources:` is the whole point — narrow it to the files the card actually summarises. A card that
  lists every file it mentions goes stale every week and teaches everyone to ignore the gate (§5
  records that failure at groove-clinic in detail).
- Every card needs a row in `.docs/knowledge/index.md`; `check-knowledge.sh` fails without it.
