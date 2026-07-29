---
description: Coding standards for the domain layer (lib/) — parsing, sync, the payroll engine, auth
applyTo: 'lib/**/*.ts'
---

# Domain layer (`lib/`)

`lib/` holds everything that is not a page. It is the only place where a pay rule is allowed to
live, and the only place worth writing a unit test against.

## Pre-flight (read in this order)

1. **The knowledge card for what you are touching** —
   [.claude/knowledge/index.md](../../.claude/knowledge/index.md). It names the files, their
   exports and the invariants you cannot see from the signatures. Grep source only for what the
   card does not answer.
2. **The spec section the code implements** — [darin-payroll-system.md](../../darin-payroll-system.md)
   for pay rules, [REQUIREMENTS.md](../../REQUIREMENTS.md) §4 for the sheet pipeline and §5 for the
   engine. Existing comments cite these by number; follow the citation rather than re-deriving.
3. `.github/copilot-instructions.md` §3 (hard rules) and §4a (file length).
4. The existing test for the module — `lib/*.test.ts`. The tests are organised by spec section and
   are the fastest description of intended behaviour.

## Hard rules

- **No numeric literals for money.** Rates, thresholds and percentages come from
  `num(cfg, key)` / `pct(cfg, key)` in `lib/config-keys.ts`. Adding a rule means adding a key to
  `CONFIG_DEFAULTS` **and** documenting it in §4 of `darin-payroll-system.md`. `CONFIG_DEFAULTS`
  seeds the table; runtime always reads `PayrollConfig`.
- **`lib/payroll.ts` stays pure.** No `db` import, no `Date.now()`, no I/O — it takes a plain input
  object and returns `PayslipResult`. Anything needing the database belongs in `lib/payroll-run.ts`.
  This is what makes the money testable without a database.
- **Undecidable never becomes `0`.** In the engine, push to `warnings[]` and skip the line. In the
  parser, set `status: "needs_review"` with a Thai `reviewNote` saying exactly what was ambiguous.
  Both surfaces are shown to a human; a silent `0` is not.
- **Never guess a trainer.** `normalizeTrainer()` then a `TrainerAlias` lookup. A miss is a review
  item quoting the raw spelling (`ไม่รู้จักเทรนเนอร์ "…"`), so an admin can add the alias and
  re-sync — old sessions are then matched retroactively.
- **A guessed year is always downgraded.** `parseGrid` infers a missing year from surrounding
  anchor dates, but the result is `needs_review` regardless of confidence.
- **`reviewed = true` is final.** `syncSources()` must never overwrite such a row. If the raw cell
  changed, flip it back to `needs_review` with a note quoting old → new.
- **Sheet reads must preserve the serial and the background colour.** Never add a `.csv` path and
  never switch to `values.get` — both lose the year (§1.1), and colour carries meaning (§1.6).
- **Node stdlib only** — the app runs on Node. `node:crypto`, not `Bun.password`.
- **Thai** for comments, thrown error messages and test names. English for identifiers.
- Cite the spec section in a comment when implementing a rule (`§1.5`).

## Required after edit

1. Update the knowledge card that lists your file in `sources:`, and bump `verified[0].at`.
2. If a pay rule changed, update `darin-payroll-system.md` **first** — code follows the spec, not
   the other way round.
3. Add or extend the test in the matching `lib/*.test.ts`, grouped under its spec section.
4. Run and paste the output:

```bash
bun run check:lines
bun run check:knowledge
bunx tsc --noEmit
bun test
```
