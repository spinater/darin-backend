---
okf_version: 0.2
---

# darin-payroll knowledge

Curated context cards. **Read the card for the area you are about to touch before grepping source.**
Each card says which file does what, its public surface, and what will bite you.

Three layers, one home per fact:

> **`darin-payroll-system.md` + `REQUIREMENTS.md` describe the system.
> `.claude/knowledge/` describes the code. `tasks/` records why.**

Cards never restate a pay rule or a rate — [darin-payroll-system.md](../../darin-payroll-system.md)
owns those, and cards link to the `§`. Cards carry no dates: **if it has a date in it, it belongs in
the spec or in `tasks/`, not here.**

Every commit that changes a file listed in a card's `sources:` must update that card in the same
commit. `bun run check:knowledge` enforces this — it is not honour-system.

Format is [OKF v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).
Links are plain relative paths so they render on GitHub and in VS Code. Card contract:
[.github/instructions/knowledge.instructions.md](../../.github/instructions/knowledge.instructions.md).

## Domain (`lib/`) — where the decisions live

- [domain/payroll-engine.md](domain/payroll-engine.md) — the pure calculator, its DB driver, and the config keys
- [domain/sheet-parsing.md](domain/sheet-parsing.md) — reading the sheet and turning cells into sessions without guessing
- [domain/sheet-sync.md](domain/sheet-sync.md) — the idempotent write path and the `reviewed` guard
- [domain/auth-and-accounts.md](domain/auth-and-accounts.md) — who can see money, and why the middleware is not the gate

## Data

- [data/schema.md](data/schema.md) — 19 models, the unique keys that make sync safe, the FK that keeps money visible

## Contracts

- [contracts/sync-stream.md](contracts/sync-stream.md) — the NDJSON progress protocol between the route and the browser

## App (`app/`) — the screens

- [app/shell.md](app/shell.md) — layout, role-based nav, and the three shared client components
- [app/pages-entry.md](app/pages-entry.md) — `/classes`, `/sales`, `/ot`: what the sheet does not contain
- [app/pages-payslip.md](app/pages-payslip.md) — `/payslips`, `/payslips/[id]`, `/me`
- [app/pages-sync.md](app/pages-sync.md) — `/sync` and the review queue
- [app/admin-config.md](app/admin-config.md) — `/admin/config` and `/account`

## Ops

- [ops/verify-gates.md](ops/verify-gates.md) — what "green" means, and what each failure message wants from you

## Suggested reading paths

| You are about to… | Read, in order |
| --- | --- |
| Change how someone is paid | [domain/payroll-engine.md](domain/payroll-engine.md) → [data/schema.md](data/schema.md) → [app/pages-payslip.md](app/pages-payslip.md) |
| Touch the sheet import | [domain/sheet-parsing.md](domain/sheet-parsing.md) → [domain/sheet-sync.md](domain/sheet-sync.md) → [app/pages-sync.md](app/pages-sync.md) |
| Add or reshape a screen | [app/shell.md](app/shell.md) → [domain/auth-and-accounts.md](domain/auth-and-accounts.md) → the card for that route group |
| Change the data model | [data/schema.md](data/schema.md) → every card whose `sources:` names an affected file |
