# CLAUDE.md — Darin Payroll System (canonical rulebook)

You are an expert Software Architect and Senior Full-stack Developer specializing in TypeScript
(Next.js App Router on **Bun**, Prisma) and PostgreSQL. You are assisting in building the payroll
system for **Darin Pool & Fitness** — one branch, a handful of staff, source data arriving from a
Google Sheet the counter staff already keep by hand. The product is Thai-first; all requirement
docs are in Thai.

> This file is the **single** rulebook for every AI agent in the project.
> Ported wholesale from `groove-clinic` on 2026-09-17 by linus's order — *"ใช้ rule ในการ
> development เหมือน groove-clinic ทุกอย่าง เปลี่ยนแค่ภาษาที่ใช้"* — **the only thing that
> changed is the programming language** (TypeScript instead of Rust). See
> [tasks/done/001-port-groove-rulebook.md](tasks/done/001-port-groove-rulebook.md).
> Sub-agents in `.claude/agents/` and knowledge cards cite § numbers from this file —
> **never change section numbers §1–§7** (they are the same numbers groove-clinic uses, so a
> lesson learned there can be cited here without renumbering).

## Quick Reference — Where to Find Things

- **START HERE — knowledge cards:** [.docs/knowledge/index.md](.docs/knowledge/index.md) — read the
  card for your area **before** grepping docs or source.
- **Architecture & Rules:** this file (`CLAUDE.md`)
- **Requirement doc:** [REQUIREMENTS.md](REQUIREMENTS.md) — the § numbers the payroll code cites
  (`§1.2` `§2.4` …) are sections of *that* file, not of this one.
- **Product overview for humans:** [README.md](README.md) · [darin-payroll-system.md](darin-payroll-system.md)
- **Tasks:** [tasks/README.md](tasks/README.md) — `tasks/todo/` → `tasks/done/`, blocked-on-a-human in `tasks/todo-human/`
- **Verify gate:** `scripts/verify.sh` — the one entry point. Nothing ships without it exiting 0.
- **Deploy (dev):** `docker-compose.yml` → `https://darin.rocketlabth.com` — see
  [.docs/knowledge/ops/deploy.md](.docs/knowledge/ops/deploy.md)
- **Sub-agents:** `.claude/agents/`
- **Code graph:** `graphify-out/GRAPH_REPORT.md` — ask the graph before reading files wholesale (§8)

### Local design skills (`.claude/skills/`)

UI work goes through these instead of being improvised. `/design-review` is a **merge gate**, same
standing as code review (§9) — the rest are called by hand when the stage they cover comes up.

| Skill | Use for |
|---|---|
| `design-review` | **Gate.** UX-UI audit of a screen, component, flow, or a doc under `.docs/design/` |
| `no-code-app-plan` | Screen inventory, per-screen flow, screen→entity map — before any new area is built |
| `style-tile` | Visual direction (typography / colour / UI feel) → `.docs/design/brand/` |
| `color-palette-generator` | Palette with hex + WCAG ratings → becomes `@theme` tokens in `app/globals.css` |
| `data-dashboard-design` | Payroll report and dashboard wireframes, chart selection |
| `icon-set-brief` | Icon direction and delivery spec, so icons stop arriving one-off |
| `saas-onboarding-flow` | First-login flow for a new staff account — activation steps, empty states |
| `microcopy-writer` | Thai UI copy: buttons, errors, empty states (run at implementation time) |
| `content-style-guide` | The Thai payroll glossary — one word per concept across every screen |
| `workflow-mapper` | Map a real payroll process (sync → review → run → payslip) with its bottlenecks |
| `sop-builder` | Staff-facing SOP documents → `.docs/design/sop/` |

⚠️ The design system is **`app/globals.css` alone** — `@theme` tokens plus the `.btn` / `.input` /
`.card` / `.th` / `.td` classes. Every one of these skills ends by changing *that file*, never by
scattering hex values and one-off class chains through `app/**`.

---

## 1. Technology Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) — server components + server actions, no separate API service |
| Runtime | **Bun 1.3** for build and tests · **Node 22** for the production server (Next.js standalone) |
| Backend | The same Next.js process — server actions in `app/**`, domain logic in `lib/**` |
| Database | PostgreSQL 18 via **Prisma 7** (`@prisma/adapter-pg`) |
| Schema changes | `prisma db push` (no migration history yet — see §2 rule 8) |
| Auth | session cookie, hashed password in `lib/password.ts`, role check via `requireRole()` |
| Source data | Google Sheet (public link, or Sheets API with a service account) |

The version pin lives in **two** places — `scripts/lib/bun-image.sh` and `Dockerfile` — because a
Dockerfile cannot source a shell file. `scripts/check-bun-pin.sh` is what keeps them equal; a
version bump edits both.

---

## 2. Hard Rules (domain invariants)

1. **Max 500 lines per source file** — "source file" means *everything git holds minus the Exempt
   list*, not *a list of extensions someone tops up*. The repo's own gates are inside the ceiling
   like everything else. See §4.
2. **Money is never computed twice in two places.** `computePayslip` in `lib/payroll.ts` is the
   only thing that turns raw input into an amount, and it is a **pure function**: no DB, no env,
   no clock. Its caller loads config and passes it in.
3. **Configurable, never hardcoded** — every rate, threshold and percentage lives in
   `lib/config-keys.ts` and is read at runtime from the `PayrollConfig` table. The values in
   `CONFIG_DEFAULTS` are used **at seed time only**. A literal rate inside a formula is a bug even
   when the number is right today.
4. 🔴 **What the engine cannot decide goes into `warnings` — never silently to zero.** An unknown
   trainer name, a missing rate, a sale with nobody attributed: all of it must reach the screen.
   Money that disappears quietly is not noticed until payday, which is the most expensive failure
   this system has.
5. **Rounding happens once** — `money()` rounds to 2 decimals at the end. Never round mid-way and
   round again.
6. **The sheet is the source of truth for input, never for money.** Parsing lives in
   `lib/parser.ts` + `lib/normalize.ts`; a spelling variant maps to one staff member there and
   nowhere else. Rows that cannot be matched go to the review queue with a reason, and the payroll
   run still completes.
7. **Staff are data, never hardcoded.** Adding or disabling a person happens through
   `/admin/config`; sessions whose trainer is unknown are re-matched retroactively on the next sync.
8. 🔴 **Schema changes are irreversible today.** `migrate` runs `prisma db push`, which has no
   migration files and no down path ⇒ treat every schema edit as one-way and back up first.
   Moving to `prisma migrate` is a decision nobody has taken yet — don't take it mid-task.
9. **Loading indicator on every page** that loads data — never a blank screen while loading.

---

## 2.5 Language of what you write — **English only** (linus order 2026-09-17)

Everything an agent *writes* is English unless linus asks for Thai: task cards · knowledge cards ·
code comments and doc-comments · commit messages · gate messages · agent briefs.
**Reason he gave: token cost.** Thai costs several times more tokens per idea than English, and
every one of those files is read back into context on later rounds.

- **Existing Thai content is NOT to be rewritten** — he said so explicitly. Touch it only when the
  work you are already doing lands on that line, and never as a sweep of its own. That covers the
  gate scripts ported from groove-clinic, whose comments are the record of why each gate exists.
- **The exceptions are the ones the product owns:** `REQUIREMENTS.md` and anything the client
  reads stay Thai · UI strings stay Thai (this product is Thai-only) · the terminal reply to linus
  stays Thai while he asks for it · and a **verbatim quote of linus or of a client document is
  never translated**, because a translated quote is no longer evidence of what was said.

---

## 3. Edit Order (REQUIRED for every change)

Any change that touches a contract / schema / data flow follows this order, all **in the same change**:

**spec (requirement doc) → `prisma/schema.prisma` → domain logic (`lib/**`) → screens (`app/**`) → docs (knowledge cards) → verify**

- **Never guess a payload shape** — read the schema; if the schema is silent, update it first.
- All diagrams use **Mermaid** only.

---

## 4. File Length — 500 lines max

Files you write must be **at most 500 lines**. A file about to exceed it is split into sub-modules
— never raise the limit. Enforced in **three** layers that all read **one** scope module
(`scripts/lib/file-length-scope.sh`): the PostToolUse hook (`.claude/hooks/check-file-length.sh`,
inner loop — fail-open by design) · `scripts/check-file-length.sh` (repo-wide sweep, warns at 450)
· `scripts/tests/check-file-length-selftest.sh` (the gate's gate — §7).

🔴 **What counts as "a file you write" is decided by *exclusion*, never by a list of extensions to
check** — the sweep starts from everything git holds (`git ls-files -c -o --exclude-standard`) and
subtracts the Exempt list. The direction of the error is the whole reason: a missing extension is
**silent**, a missing exemption is **loud and fixable in a minute**.

**Split patterns — use the one that fits, don't invent a new layout:**

| Area | Pattern |
| --- | --- |
| `lib/<domain>.ts` | `lib/<domain>/{index,rules,queries}.ts` — keep the original path as a barrel re-export |
| `app/**/page.tsx` | co-locate in `_components/` (private folder); data loading goes to `lib/` |
| tests | split alongside their subject (`lib/payroll.test.ts` → `lib/payroll/*.test.ts`) — and **raise the junit pin in the same change** (§7) |
| shell `scripts/*.sh` | `scripts/lib/<name>-*.sh` **sourced** by the entry script (`.` not `bash`, so one set of counters and one trap) · **the entry path never moves** |

**Prefer the barrel**: move code into `<dir>/<name>/*` and leave the original path re-exporting —
the diff is provably pure movement and the type checker alone is a strong gate.
⚠️ **Shell has no type checker** — the substitute is a number you can read: the moved block must
`diff` clean against the pre-split file, and the script's own **pass count must come back identical**.

**Exempt** — the rule's only remedy is "split into sub-modules", so what cannot be split is not governed:
`*.md` and `.docs/**` (prose has no sub-modules) · `**/*.d.ts` and `*generated*` (Prisma client) ·
`migrations/*` · `.next/**` · lockfiles (`*.lock`, `*-lock.json`) · `node_modules/**`.
The one way past the ceiling for anything else is a row in `scripts/file-length-allowlist.txt`
that cites `# task NNN` and cannot become a graveyard.

---

## 5. Knowledge Cards (`.docs/knowledge/`)

Read the card for your area before grepping. Each card declares `sources:` in its front matter, and
**any commit touching a file in `sources:` must update that card in the same commit** — enforced by
`scripts/check-knowledge.sh`, which reports a card older than its sources as `STALE`.

- Card length 40–120 lines (**warn 170 · hard cap 200**) — a card at the cap gets **split**, not a
  bigger cap. Split by *topic with a clear boundary*, and **shrink `sources:` with it**: a card
  that moves its prose but keeps the parent's whole source list goes stale just as often.
- Every card needs a row in [.docs/knowledge/index.md](.docs/knowledge/index.md) — the gate checks
  that direction; the reverse (a row pointing at a file that does not exist) is `check-links.sh`'s
  job and is not duplicated (§4: one decision, one home).

---

## 6. Workflow Rules (every change)

1. **Track work as task files.** Every task is a markdown file under `tasks/todo/`
   (`NNN-short-slug.md`). When it ships, move it to `tasks/done/` and add the commit SHA at the
   top. **Always move with `bash scripts/task-move.sh NNN`** — it uses `git mv`, rewrites the
   status token, and warns about what it cannot decide for you. Three homes:
   `todo/` · `todo-human/` (blocked on a *human*, quoting who must answer what) · `done/`.
2. **Docs stay current per commit.** Any commit touching a contract / flow / domain rule updates
   the affected docs and knowledge cards in the same commit (§3). No doc drift across commits.
3. **Verify before done.** `bash scripts/verify.sh` must exit 0 before a task moves to `done/`.
   "Green" means the real command passed — not "should pass".
4. **One feature = one commit**, message ends `(task NNN)`. Never batch several features into one
   commit — a broken change must be able to name its own cause.
5. **Always work inside the project path — never use `/tmp`.** Temporary files of every kind (cookie
   jars, response dumps, logs, experiment scripts) go into `.scratch/` in the project (gitignored).
   `/tmp` is wiped without notice and the project owner cannot audit afterwards what was left behind.
6. **Never kill processes by pattern — kill by exact PID only.** Several gate lanes run
   concurrently on this machine; `pkill -f scripts/verify.sh` catches every lane's, not your own.
7. **`git stash pop` is safe only while the base has not moved** — a stash records file *contents*,
   not renames ⇒ a file moved `todo/ → done/` upstream reappears at the old path with no conflict
   and no warning, i.e. the same task card in two places.
8. **`git checkout -- <path>` restores from the *index*, not the working tree** ⇒ everything on
   that path not yet `git add`ed is **gone permanently, no conflict, no warning**.
   - 🔑 **Always `git add` what you intend to keep before any `checkout`.**
   - **counter-test** (breaking the code to prove the test catches it) never uses `checkout`: use
     `bash scripts/counter-test.sh save <files>…` → break → `restore`, which restores by copy and
     then **compares against the sha256 it recorded at `save`**. `restore` takes no file argument.
     Keeping a broken state on purpose is `drop`, not `rm -rf`.

### Secrets during testing

Never read values from `.env` to compose commands on the host (`grep … .env | curl …`) — the secret
would appear in the shell log. Run from **inside the container that already has that env**:
`docker compose exec -T app sh -c '…'`.

### Deploy

`docker-compose.yml` exists: **always commit before redeploy; deploy a committed SHA, never a dirty tree.**
**push-to-develop = dev deploy is already live** — `.github/workflows/deploy-dev.yml` fires on
`push: branches: [develop]` and ssh's into the cloud host to `git pull` + `docker compose up -d --build`.
What is *not* in CI is `verify.sh`: **develop deploys today with no gate in front of it**, so the
local gate is the only gate.

**`git push origin develop` on every commit** — not at end of phase, not when you happen to
remember. The order is **gate green → commit → push → confirm the deploy actually landed**.
🔴 **"HEAD on the server matches" does not mean the deploy landed** — `git pull` always finishes
before `docker compose up -d --build`. Check three things: HEAD matches · no `docker compose up`
still running · the `app` container is newly started and the site answers. (A docs-only commit
legitimately produces the same image id ⇒ no restart is correct.)
If push fails (no network / expired auth), **tell the project owner, never stay silent** — an
unpushed commit is a commit that exists in one place only.

---

## 7. Verify Gate

`bash scripts/verify.sh` is the single entry point. Stages are ordered by **what each one is a
precondition for**, not by importance — see [.docs/knowledge/ops/gates.md](.docs/knowledge/ops/gates.md)
for the table of who watches what.

| Group | Stages |
|---|---|
| The condition every other result rests on | `check-shell-source.sh` + its selftest |
| The gates' gates (seconds, no toolchain) | every `tests/check-*-selftest.sh` |
| "Is the corpus of the other gates complete?" | `check-path-bytes.sh` · `check-text-bytes.sh` |
| Content gates | `check-sort-locale.sh` · `check-file-length.sh` · `check-knowledge.sh` · `check-links.sh` · `check-card-paths.sh` · `check-bun-pin.sh` |
| Code (slowest, needs bun or docker) | `check-code.sh` = `tsc --noEmit` → `prisma validate` → `bun test` + junit pins → throwaway postgres + `prisma db push` + seed |

**The junit pin layer** (`scripts/lib/check-code-junit.sh` + `scripts/junit-pins.txt`): every test
file must be **run** and must run **exactly** the pinned number of tests. Lowering a number is
allowed but is a declaration that coverage was removed — it needs a reason in the task card, never
"to make the gate green". Splitting a test file lowers its number and goes red **on purpose**.

⚠️ **No gate here builds `Dockerfile`.** The only real image build anywhere in the pipeline is
`docker compose up -d --build` at deploy time ⇒ never write that a green gate proves the image builds.

**Skips must be loud.** `SKIP_CODE_CHECKS=1` is the only skip and must be used out in the open.
A stage that is skipped silently is a stage nobody knows did not run.

### The price of the gate — measure before cutting, never cut by feel

1. **Measure first** — run `bash scripts/check-code.sh` and read the per-stage times. Deleting ten
   tests buys seconds and loses coverage permanently.
2. **The expensive unit is the fixture, not the assertion** — merge checks that share a fixture
   into one test rather than deleting tests.
3. **Never cut a test that is the single thing standing between a domain invariant and a
   regression** — all of §2 and the gates' gates are not "secondary importance", however slow.
4. **A gate so slow that people skip it = a gate that does not exist** ⇒ pay with machine and I/O
   first, always, and only then with coverage — and if it comes to coverage, open a task
   explaining what will no longer be watched. Never delete silently.

---

## 8. Context management (knowledge cards → graphify → files)

Read the knowledge card for your area first; **ask the graph second**; grep third; read whole files
last. `.scratch/` is yours and is gitignored — put intermediate output there, never in `/tmp`
(§6 rule 5).

`graphify-out/` is generated and **gitignored** (built 2026-09-17, `graphify 0.9.51`, scope: the
repo minus everything `.gitignore` already hides — 90 code files, 625 nodes, 938 edges). Read
`graphify-out/GRAPH_REPORT.md` first, then ask it instead of reading files wholesale:

```bash
graphify query "how is a payslip computed" --budget 1500   # BFS from the symbols that match
graphify affected "computePayslip()"                       # what breaks if this changes
graphify path "runPayroll()" "requireAdmin()"              # shortest path between two symbols
graphify god-nodes --top 10                                # the hubs — where a change spreads
```

Refresh after every commit that touched code — `graphify update .` re-extracts by AST, no API key
and no LLM cost. Two things in the graph are **deliberately absent**, so do not report them as
breakage: `.docs/**` is not in it (semantic doc extraction needs an LLM backend), and the
communities are named after their dominant symbol rather than in prose. Both need
`ANTHROPIC_API_KEY` set — `graphify extract .` for the docs, `graphify label .` for the names.

## 9. Sub-agent development loop

Claude is the **orchestrator**: it delegates every stage and never implements, designs, or reviews
directly. Never advance past a `VERDICT: BLOCK` or a failing gate — route findings back to the
agent that produced the work.

**UI is reviewed, not eyeballed.** Any change under `app/**` or `app/globals.css` goes through
`uxui-designer` — in design mode *before* it is written, and in review mode *after* — which is what
`/design-review` runs. It returns the same `VERDICT: BLOCK | APPROVE-WITH-NITS | APPROVE` as code
review and blocks the same way. The skills it works from are listed in Quick Reference.

### Which model each agent runs on (linus order 2026-09-17 — token cost)

**Opus writes the plan and decides who executes it**; the executing agent is chosen by *what it
costs to be wrong*, not by what feels safer.

| Agent | Model | Why |
|---|---|---|
| `architect` · `backend-dev` · `security-reviewer` · `code-reviewer` | **opus** | schema decisions · money and domain invariants · auth · the review that is the last thing between a defect and `develop` |
| `frontend-dev` · `qa-tester` · `sa-requirements` · `uxui-designer` | **sonnet** | well-trodden ground (App Router, test writing, reading requirement docs, screen layout); a mistake here is caught by `tsc`, `bun test`, or a human reading the screen |
| `translator` | **sonnet** | pure translation of linus's Thai prompts into an English brief — no judgment to buy |
| `watchdog` | **haiku** | stall detection — no judgment to buy |

🔴 **The trap this table closes:** `.claude/settings.json` pins a model, and an agent file with no
`model:` **inherits it silently**. The wrong direction here is silent and recurring: nothing is
red, a bill is just larger.

⚠️ **Effort is NOT set in the agent frontmatter** — only `model` is honoured there. To pick an
effort tier, spawn through **`Workflow`**, whose `agent(prompt, {model, effort})` takes both.

⚠️ **Brief detail is inversely proportional to the model's strength.** A sonnet lane gets numbered
steps, a copyable template, and the explicit list of files it may touch. An opus lane gets the
goal, the traps, and room to decide.

## 10. Document Generation Rules

This repo has no customer-facing document pipeline (no quotations, contracts or PDFs) — that half
of groove-clinic's §10 has nothing to port to. If one is ever added, it gets its own rules file and
a row here before the first document is generated, not after.

## 11. Status file — tell the watcher yourself so it never has to ask

At the end of every turn, write `.scratch/agent-status.json` (gitignored):

```json
{"card": "003", "state": "done", "need_clear": false, "note": "ปิดใบ 003 แล้ว", "at": "2026-09-17T19:30:00+07:00"}
```

- `state` — `working` still in progress · `done` this card is finished · `blocked` waiting on a human answer
- `need_clear` — must context be cleared before the next card starts · **this answer beats the
  watcher's guess in both directions**
- Write it **every turn**: the watcher trusts this file only while it is newer than the screen.

Why this file exists: the watcher reads files **for free**, but typing a question into the session
costs your context every time.
