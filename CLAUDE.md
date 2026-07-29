# CLAUDE.md — darin-payroll

Claude Code follows the same rules as the in-repo Copilot/AI guidance. The canonical content
lives under `.github/` — do not duplicate it here, just import and point to it.

@.github/copilot-instructions.md

## Read the knowledge cards first

[.claude/knowledge/index.md](.claude/knowledge/index.md) is a curated map of the code — which file
does what, its public surface, and what will bite you. **Read the card for the area you're touching
before grepping `lib/` or `app/`.** Cards are 40–120 lines; the specs they point into are 237 and
369.

Cards never restate a pay rule or a rate — [darin-payroll-system.md](darin-payroll-system.md) owns
those, and cards link to the `§`. Any commit that changes a file listed in a card's `sources:` must
update that card in the same commit; `bun run check:knowledge` enforces it. Card contract:
[.github/instructions/knowledge.instructions.md](.github/instructions/knowledge.instructions.md).

## The specs are the source of truth

- [darin-payroll-system.md](darin-payroll-system.md) — the gym owner's own pay rules (§1 trainers,
  §2 counter, §3 who gets commission, §4 config, §7 still-open questions).
- [REQUIREMENTS.md](REQUIREMENTS.md) — system design (§1 what the sheet really looks like,
  §3 data model, §4 the Sheets pipeline, §5 the engine, §6 screens).

Code cites these by section number (`§1.2`, `§4.3`) and that convention is load-bearing — keep it.
**Never invent a rate or a rule.** If the spec doesn't decide it, the answer is a `warnings[]`
entry, a `needs_review` row, and an open question in §7 — never a default value. `darin-payroll-system.md`
is upstream of the code: a code change is never a reason to edit it, only a decision from the owner is.

## Per-area coding standards (read before touching that area)

- **Domain (`lib/`)** — [.github/instructions/domain.instructions.md](.github/instructions/domain.instructions.md)
- **App Router (`app/`)** — [.github/instructions/app.instructions.md](.github/instructions/app.instructions.md)
- **Data (`prisma/`)** — [.github/instructions/data.instructions.md](.github/instructions/data.instructions.md)

## Language

Identifiers, types, DB columns and these AI-facing docs are **English**. Comments, UI copy, thrown
error messages and test names are **Thai** — the operators are Thai and that is the existing
convention throughout. Commit subjects keep the current style: English conventional prefix, Thai
subject (`feat: เพิ่มการตรวจสอบ…`).

## Workflow rules (every change)

Canonical list: [.github/copilot-instructions.md §6](.github/copilot-instructions.md). In short:
**commit before redeploy** · **track work as task files in `tasks/todo/`** · **cards and spec
updated in the same commit** · **one finished feature, one commit**. Read §6 for the full text.

## Verify

```bash
bun run verify   # check:lines && check:knowledge && typecheck && test
```

Both cheap checks run first, so a 600-line file or an unsynced card fails in under a second.
`typecheck` needs `bunx --bun prisma generate` to have run at least once. To see a change actually
working in the running app, use the [verify skill](.claude/skills/verify/SKILL.md).

## Sub-agent development loop

Non-trivial changes can be driven through a roster of specialized sub-agents
(`.claude/agents/`): `solution-architect`, `domain-developer`, `web-developer`, `data-developer`,
`test-engineer`, `doc-sync`, `code-reviewer`, `payroll-auditor`, `debugger`. The loop is
architect → developer(s) → test → doc-sync → review, respecting the spec-first edit order and the
verify gate. **`payroll-auditor` runs on any change that could move a baht figure** — that is the
one review this repo cannot skip.

- **Entrypoint:** the `/dev-loop` skill ([.claude/skills/dev-loop/SKILL.md](.claude/skills/dev-loop/SKILL.md)).
