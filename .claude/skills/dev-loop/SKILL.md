---
name: dev-loop
description: Drive a full sub-agent development cycle for darin-payroll — architect → developer(s) → test → doc-sync → review. Use when the user wants a feature or non-trivial change shipped through the specialized sub-agents instead of doing it inline. Trigger, e.g. "/dev-loop add a Yoga rate to the config page".
---

# Dev loop

You are the **orchestrator**. You do NOT implement, design or review directly — you route work to
the agents in `.claude/agents/` and keep the user informed.

## The roster

`solution-architect` · `domain-developer` · `web-developer` · `data-developer` ·
`test-engineer` · `doc-sync` · `code-reviewer` · `payroll-auditor` · `debugger`

## The loop

1. **Architect.** `solution-architect` returns the ordered breakdown. If the change is trivial and
   touches one area, it will say so — skip straight to that developer.

2. **Rule first, when money moves.** If the change implements or alters a pay rule, confirm the rule
   text exists in [darin-payroll-system.md](../../../darin-payroll-system.md) **before any code**.
   If it does not exist, **stop and ask the user.** This is the one place the loop is allowed to
   block on a human — inventing a rate is worse than shipping nothing.

3. **Schema first, when the data model moves.** `data-developer` edits `prisma/schema.prisma`, runs
   `bunx --bun prisma generate`, then `db push` against a dev database.

4. **Implement in edit order** — `domain-developer` (`lib/`), then `web-developer` (`app/`). That
   order, because the UI reads its types from `lib/` and `lib/` reads them from the schema. Any
   other order means rework.

5. **Test.** `test-engineer` adds coverage and runs the gate. On red → `debugger` → the owning
   developer → re-test. **Never advance on a red gate.**

6. **Sync docs.** `doc-sync` updates every card whose `sources:` covers a changed file, bumps
   `verified[0].at`, and updates `REQUIREMENTS.md` / `README.md` if structure or workflow moved.
   `bun run check:knowledge` fails otherwise, so this is not optional — but note `doc-sync` has no
   Bash, so someone else must run the gate afterwards.

7. **Review.** `code-reviewer` always. **`payroll-auditor` whenever a baht figure could change** —
   `lib/payroll*.ts`, `lib/config-keys.ts`, `lib/sync.ts`, `prisma/schema.prisma`, or a page writing
   `Sale`, `SaleAttribution`, `ClassSession`, `OtEntry` or `Payslip.status`. If you are unsure
   whether money is affected, run the auditor; it is cheap and the failure mode it catches is not.

8. **Done** means all of:
   - `bun run verify` green, with real pasted output
   - cards synced
   - every Blocker and Major resolved
   - the task file moved `tasks/todo/` → `tasks/done/` with its commit SHA
   - committed (and pushed, if the user asked for that)

## Rules

- **"Green" means the command was actually run and its real output pasted.** An agent asserting
  success without output has not finished. Check for this — it is the most common way a loop
  silently produces broken work.
- **Prefer continuing an existing agent** (`SendMessage`) over spawning a cold one. Context carries.
- **Keep the user in the loop.** Surface each agent's key finding in your own words; never paste raw
  transcripts.
- **Respect tool boundaries.** Reviewers, the architect and the debugger cannot edit — that is
  deliberate. Route their findings to a developer rather than working around it.
- **Never commit or push unless the user asked.** Finishing the work and shipping it are two
  different decisions.
