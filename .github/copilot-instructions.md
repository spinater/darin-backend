# AI Context & Coding Rules — Darin Payroll

You are a senior full-stack developer working on **darin-payroll**, the payroll system for
Darin Pool & Fitness. It reads a Google Sheet that trainers keep by hand, turns it into
teaching sessions, queues anything it cannot decide for a human, and produces monthly payslips.

**This software pays real people real money.** Every rule below exists because getting it wrong
means someone is underpaid and nobody notices. When in doubt, surface the doubt — never guess.

## Quick Reference — Where to Find Things

- **START HERE — knowledge cards:** [.claude/knowledge/index.md](../.claude/knowledge/index.md) —
  per-concern context cards (what each file does, its exports, its invariants). Read the card for
  your area **before** grepping source.
- **Pay rules (source of truth):** [darin-payroll-system.md](../darin-payroll-system.md) — the gym
  owner's own document. §1 trainers, §2 counter staff, §3 who-gets-commission table, §4 config,
  §6 pay dates, §7 open questions.
- **System design (source of truth):** [REQUIREMENTS.md](../REQUIREMENTS.md) — §1 what the sheet
  actually looks like, §3 data model, §4 the Sheets pipeline, §5 the payroll engine, §6 screens.
- **Operator guide:** [README.md](../README.md) — setup, Google Sheet modes, deploy, staff onboarding.
- **Per-area coding standards:** `.github/instructions/{domain,app,data}.instructions.md`
- **Knowledge card contract:** [.github/instructions/knowledge.instructions.md](instructions/knowledge.instructions.md)
- **Source:** `lib/` (domain logic) · `app/` (App Router pages + server actions) · `prisma/` (schema + seed)
- **Tests:** `lib/*.test.ts`, run by `bun test`
- **Gates:** `scripts/check-file-length.ts`, `scripts/check-knowledge.ts`
- **Tasks:** [tasks/README.md](../tasks/README.md)

---

## 1. What the system is

Single tenant, one gym, ~5 trainers plus counter staff. There is no multi-tenancy and no billing.

```
Google Sheet (hand-kept)  →  fetch grid (serial + cell colour)  →  parse to sessions
      →  review queue for anything undecidable  →  payroll run  →  payslip + audit lines
```

Manual entry covers what the sheet does not have: group classes, sales, OT. Config (rates,
thresholds, percentages) lives in the database and is edited at `/admin/config`.

---

## 2. Technology stack

- **Next.js 16** App Router + **React 19**, all pages server components, **Tailwind v4**
  (there is no `tailwind.config.js` — do not create one)
- **Prisma 7** + **PostgreSQL 18**, via `@prisma/adapter-pg`. Client generated to `generated/prisma`
- **Bun** for tests, scripts and the package manager — but **the app itself runs on Node**,
  because `next dev` / `next start` pick the Node runtime even when launched with `bun`
- Deploy: `docker compose` (`db` → `migrate` → `app`), Next standalone on `node:22-slim`

---

## 3. Hard rules

1. **Never use `Bun.*` in code Next.js runs.** The app is on Node. Use `node:crypto`,
   `node:fs/promises`, and so on. There is a test asserting this in
   [lib/password.test.ts](../lib/password.test.ts) — it exists because this mistake is silent
   in development and fatal in the container.
2. **Always `bunx --bun prisma …`** for the Prisma CLI, so `.env` is loaded into
   [prisma.config.ts](../prisma.config.ts). Plain `bunx prisma` gets no `DATABASE_URL`.
3. **Never read the sheet as `.csv`.** Google's CSV export drops the year (`45405` → `"23/4"`)
   and the data straddles 2024–2026, so the year cannot be recovered. Use
   `spreadsheets.get?includeGridData=true`, or the `export?format=xlsx` endpoint — both return the
   date serial **and** the cell background colour, which the sheet uses to encode meaning (§1.6).
4. **No hardcoded money.** Every rate, threshold and percentage comes from
   [lib/config-keys.ts](../lib/config-keys.ts) via `num()` / `pct()`, which read the
   `PayrollConfig` table at runtime. `CONFIG_DEFAULTS` is used **at seed time only**. A numeric
   literal in [lib/payroll.ts](../lib/payroll.ts) is a bug, not a shortcut.
5. **Never silently zero, never guess.** Anything the engine cannot decide goes into
   `PayslipResult.warnings`; anything the parser cannot decide becomes `status: "needs_review"`
   with a Thai `reviewNote` explaining why. A wrong `0` is invisible; a review queue entry is not.
   The parser in particular **never guesses a trainer** — an unrecognised name is a review item.
6. **Sync never overwrites a human decision.** A `TeachSession` with `reviewed = true` is never
   updated by `syncSources()`. If the raw cell changed underneath it, sync flips it back to
   `needs_review` with a note saying what changed — it does not overwrite and it does not stay silent.
7. **Staff are deactivated, never deleted.** `TeachSession.staff` is `onDelete: Restrict`.
   `SetNull` would orphan sessions out of *both* the payslip query (which filters
   `staffId != null`) and the review queue — money would vanish with no trace. See
   `NEEDS_ATTENTION` in [lib/payroll-run.ts](../lib/payroll-run.ts), which exists to catch
   exactly that class of orphan.
8. **`proxy.ts` is not authorization.** It only checks that a session cookie exists, for UX.
   The real gate is `requireRole()` / `requireAdmin()`, called **inside every page and inside
   every server action** — an action is a POST endpoint and is reachable without ever rendering
   its page.

---

## 4. Coding guidelines

- **Strict typing.** Avoid `any`; type every payload. `tsc --noEmit` must pass.
- **Language.** Identifiers, types and DB columns in English. **Comments, UI copy, thrown error
  messages and test names in Thai** — that is the existing convention and the operators are Thai.
- **Cite the spec.** When code implements a pay rule, name the section in a comment (`§1.5`,
  `§4.3`). That cross-reference is what makes the rules auditable, and it already exists
  throughout `lib/`.
- **Comments explain why, not what.** The good ones already in this repo say what would break if
  you did the obvious thing instead — keep writing those.
- Pages are server components with `export const dynamic = "force-dynamic"`.
- `"use server"` actions live inside the page that uses them, and re-check the role themselves.
- Mutating actions end with `revalidatePath()` for the route they changed.
- Wrap genuinely slow work in `timed("<job>", …)` so `<ActionProgress>` can tell the user how long
  it usually takes. Never wrap `redirect()` — Next signals redirects by throwing.
- **File length: 500 lines, hard ceiling.** See §4a.

### 4a. File length — 500 lines max

A hand-written file must be **at most 500 lines**. A file that would exceed it gets split into
sub-modules — **raising the limit is not an option**. Checked by `bun run check:lines`, which
warns from 450.

**Split patterns — use the one that fits, don't invent a new layout:**

| Area | Pattern |
| --- | --- |
| `lib/<m>.ts` | `lib/<m>/<domain>.ts` + keep `lib/<m>.ts` as a re-export barrel |
| `app/<route>/page.tsx` | server actions → `app/<route>/_actions.ts`; UI blocks → `app/<route>/_components/`. Both are Next private folders/files, excluded from routing |
| shared UI | `app/_components/` — already holds `SubmitButton`, `ActionProgress`, `Spinner` |
| `app/api/<r>/route.ts` | move the work into `lib/`; the route keeps auth, streaming and headers only |
| `prisma/schema.prisma` | Prisma 7 multi-file schema — `prisma/schema/<domain>.prisma` |
| tests | split alongside their subject |

**Prefer the barrel**: move code into `lib/<name>/*.ts` and leave `lib/<name>.ts` re-exporting.
No import site changes, the diff is provably pure movement, and `tsc` alone is a strong gate.

**Exempt:** `**/*.d.ts`. `generated/**` needs no exemption — it is gitignored, and the checker
reads `git ls-files --exclude-standard`, so the Prisma client never reaches it. `docs/**` is out
of scope (and gitignored); prose has no sub-modules.

---

## 5. Spec & knowledge sync (required for every change)

Any change that touches a **pay rule, module structure, or data flow** updates these in the
**same commit**:

| File | Role |
| --- | --- |
| [.claude/knowledge/**](../.claude/knowledge/index.md) | Context cards for the code. **If a file you changed appears in a card's `sources:`, that card is updated in the same commit** — `bun run check:knowledge` enforces it |
| [darin-payroll-system.md](../darin-payroll-system.md) | The pay rules. Changing how money is computed means changing this first |
| [REQUIREMENTS.md](../REQUIREMENTS.md) | Data model, pipeline, screens |
| [README.md](../README.md) | Only when setup, deploy or an operator workflow changes |

**Edit order: spec → `prisma/` → `lib/` → `app/` → cards → verify.** Never invent a rate or a
rule — if the spec does not cover it, the change is out of order: ask, or record it in §7 of
`darin-payroll-system.md` as an open question and route it to the human.

---

## 6. Workflow rules (every change)

1. **Commit before redeploy.** Deploy off a commit, never a dirty tree, so the running app can
   always name its own build.
2. **Track work as task files.** Every task is a markdown file in `tasks/todo/`; when it ships it
   moves to `tasks/done/` — moved, never deleted. See [tasks/README.md](../tasks/README.md).
3. **Docs stay current per commit.** Cards and spec updates land in the same commit as the code.
   No doc drift across commits.
4. **Ship each finished feature.** One finished feature, one commit. Never batch several features
   into one deploy, or a broken deploy cannot name its cause.

## 7. Verify gate

```bash
bun run verify   # check:lines && check:knowledge && typecheck && test
```

`check:lines` and `check:knowledge` run **first**, so a 600-line file or an unsynced card fails in
under a second, before `tsc` or the tests start.

`typecheck` needs the Prisma client to exist — run `bunx --bun prisma generate` after
`bun install` on a fresh clone, or `@/generated/prisma` will not resolve.

**What does not exist here** (don't go looking, and don't reference it in new docs): no ESLint,
Prettier or Biome; no `lint` script; no CI; no `prisma/migrations/` — this project uses
`prisma db push`. `docs/` is gitignored and absent on a clean clone, so the
`describe.if(HAS_FIXTURE)` block in [lib/parser.test.ts](../lib/parser.test.ts) skips. That is
expected, not a failure.
