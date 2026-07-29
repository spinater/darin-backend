---
description: Contract for the OKF context cards in .claude/knowledge/
applyTo: '.claude/knowledge/**/*.md'
---

# Knowledge card contract (`.claude/knowledge/`)

Cards exist so an agent reads ~100 lines instead of opening every file in `lib/` and `app/`. That
only pays off if they stay small, stay current, and never become a second copy of the spec. These
rules are what keep that true — `bun run check:knowledge` enforces the mechanical half.

## The seam — one home per fact

> **`darin-payroll-system.md` + `REQUIREMENTS.md` describe the system.
> `.claude/knowledge/` describes the code. `tasks/` records why.**

| Content | Home | Never in a card |
| --- | --- | --- |
| Pay rules, rates, percentages, thresholds | `darin-payroll-system.md` | ✅ link to the `§` instead |
| Data model rationale, pipeline design, screen list | `REQUIREMENTS.md` | ✅ link |
| Setup, deploy, operator workflows | `README.md` | ✅ link |
| Rationale for a past decision | `tasks/done/NNN-*.md` | ✅ link |
| **Which file does what · its exports · its invariants** | **the card** | — |

**The one-second test: if it has a date in it, it does not belong in a card.** Cards are
present-tense descriptions of current code, not history. And a card must never restate a rate —
`10%` written in a card is a second source of truth that will drift from the database.

## Frontmatter

```yaml
---
type: module                    # REQUIRED (OKF). One of the 7 below.
title: Payroll engine           # REQUIRED
description: One line, <=200 chars, usable WITHOUT reading the body.   # REQUIRED
tags: [payroll, money, pure]    # optional
status: draft | deprecated      # optional; omit when stable
sources:                        # REQUIRED unless stale_after is set
  - lib/payroll.ts              # CODE FILES ONLY — see below
verified:
  - by: claude-code/opus-5      # or human:<name>, process:doc-sync
    at: 2026-07-29              # SINGLE entry, overwritten — never an append-only list
---
```

**Types — closed set of 7:** `module`, `feature`, `route-group`, `page`, `contract`, `concern`,
`runbook`.

**`sources` lists code files only.** Never `REQUIREMENTS.md` or `darin-payroll-system.md` — doc
links go in **Read next**. If docs were sources, one spec edit would mark half the bundle stale,
the gate would be noise within a week, and someone would delete it.

Entry forms: a trailing `/` means the whole directory; a `*` globs; anything else is a literal
path that **must exist** — that error is what forces a card update when a file is split or renamed.

A card with no code behind it must set `stale_after: YYYY-MM-DD` instead. Do not put
`stale_after` on a code-backed card — it fires on cards that are perfectly correct, which trains
people to ignore the gate.

## Body — fixed section order

```md
# <title>
<1–3 sentences, present tense. What it is, who calls it, what it owns.>

## Covers            | File | Role | table
## Public surface    exported symbols, one line each
## Invariants & gotchas   what you CANNOT see from the signatures
## Read next         spec sections · instructions file · tasks/done/NNN-*.md
```

Target **40–120 lines**. Hard fail at 200.

"Invariants & gotchas" is the section that earns the card its keep. A list of exports is
recoverable by grep in seconds; *"a guessed year is always downgraded to `needs_review`, however
confident the guess"* is not. In this repo the gotchas that matter most are the ones where the
obvious change silently costs someone money — write those first.

## New card, or a section in an existing one?

A **new card** is warranted when an agent would otherwise read more than ~300 lines of source to
answer *"what is this and what will bite me"*, **and** no existing card is the natural home.

- Under ~15 lines of content → a **row or section** in the nearest card. Never a new file.
- Over 200 lines → split it, or move the detail into the spec.
- Granularity is **per concern, not per file**.
- **Name cards after the concern, never the file** — `domain/sheet-parsing.md`, not
  `domain/parser-ts.md`. The name then survives every future split.
- Every source file is claimed by **exactly one** card. Two claims is an error: two places to
  update and a coin-flip about which one an agent reads.

## Keeping a card current

1. Change the source.
2. Update the card body if the change is material (new export, changed invariant, moved file).
3. **Always** bump `verified[0].at`.
4. Commit code and card **together** — identical commit time is what makes the check pass.

For a change that genuinely doesn't affect the card, bumping `verified[0].at` alone is the
intended escape hatch. There is deliberately no "accept without editing" flag: silently accepting
drift is the failure mode this whole mechanism exists to prevent.

## Links

Plain relative paths (`../../REQUIREMENTS.md`), **not** OKF's leading-`/` form, so they render on
GitHub and in VS Code. Every card must be linked from
[.claude/knowledge/index.md](../../.claude/knowledge/index.md) — the checker verifies both
directions.
