---
name: verify
description: Build, run and drive the darin-payroll app to observe a change actually working — dev server or docker compose, the offline .xlsx sync path, and how to exercise server actions and the NDJSON stream. Use when verifying any change under lib/, app/ or prisma/.
---

# Verify — run it for real

`bun run verify` proves the code typechecks and the pure functions behave. It proves nothing about
the app. Use this skill when a change is visible or touches the database.

## Which path to take

| You changed | Cheapest honest check |
| --- | --- |
| `lib/payroll.ts` and nothing else | `bun -e` against `computePayslip()` — it is pure, no DB needed |
| The parser or sync | The **offline `.xlsx` path** below — no Google credentials, no network |
| A page or an action | The running app in a browser |
| Schema, Dockerfile, compose | The full `docker compose` stack |

## Bring it up

**Check first — it may already be running.**

```bash
docker compose ps            # the deployed stack; app is on 127.0.0.1:${APP_PORT}
```

**A. Dev server, fastest iteration**

```bash
docker compose up -d db                 # Postgres 18 only
bunx --bun prisma db push               # sync schema
bun run prisma/seed.ts                  # prints the owner password ONCE — capture it
bun run dev                             # :3000, Node runtime
```

**B. Full stack, exactly as deployed** — for anything touching the `Dockerfile`, standalone output,
`serverExternalPackages`, or the migrate/seed ordering:

```bash
docker compose up -d --build            # db → migrate (one-shot) → app
docker compose logs migrate             # the seeded owner password, if it was generated
```

## Verify the money without running anything

`computePayslip()` is pure by design. Use it — it is far more precise than clicking through a UI:

```bash
bun -e '
import { computePayslip } from "./lib/payroll.ts";
console.log(JSON.stringify(computePayslip({
  staff: { id: "s1", name: "ทดสอบ", role: "trainer", rank: "PT", baseSalary: 0, classCredit: 0 },
  sessions: [{ date: new Date(), activity: "PT" }],
  classSessions: [], sales: [], otEntries: [],
  config: { /* only the keys your path reads */ },
  teachRates: { PT: { PT: 350 } },
}), null, 2));'
```

Assert on `warnings` as carefully as on `net` — a rule that silently pays `0` shows up there and
nowhere else.

## The offline `.xlsx` path — default for any sync work

`/sync` accepts a local file path, and `loadXlsxGrids()` takes the same code path as the live fetch,
returning date serials **and** background colours. **No Google credentials, no network, no rate
limit.** Use it unless you are specifically verifying `fetchGrids` / `fetchPublicGrids`.

Put a workbook at `docs/Darin scheduled.xlsx` (`docs/` is gitignored — it holds real customer data)
and pass that path in the `/sync` form. The same fixture un-skips the
`describe.if(HAS_FIXTURE)` block in `lib/parser.test.ts`.

## Auth — log in, never forge

The session cookie value **is** a `Session` row id, so "forging a session" means `INSERT`ing into
the database. Don't. Log in properly.

**A browser is the simple path** and usually the right one.

**If you must script it**, note that every mutation in this app is a Next server action, and a
plain form POST does **not** work — it returns `200` with an RSC payload and no cookie. Server
actions need the `Next-Action` header and Next's field encoding:

```bash
BASE=http://127.0.0.1:30100    # or :3000 for bun run dev
AID=$(curl -s $BASE/login | grep -o 'ACTION_ID_[a-f0-9]*' | head -1 | sed 's/ACTION_ID_//')
curl -s -D- -o /dev/null -c /tmp/jar.txt -X POST $BASE/login \
  -H "Next-Action: $AID" \
  -F "1_username=owner" -F "1_password=$OWNER_PW" -F '0=["$K1"]'
```

A correct login returns `303` with `x-action-redirect: /` and a `Set-Cookie: darin_session=…`.
Wrong credentials return `303` with `x-action-redirect: /login?error=1;push` — that is how you tell
"the action ran and rejected me" from "my request never reached the action".

Read-only pages need no such ceremony — they are server components, so `curl -b /tmp/jar.txt` sees
the fully rendered HTML.

## Drive the sync stream

The one thing a screenshot cannot show. This is a real API route, so it takes a normal POST:

```bash
curl -sN -b /tmp/jar.txt -X POST $BASE/api/sync \
  -H 'Content-Type: application/json' \
  -d '{"xlsxPath":"docs/Darin scheduled.xlsx"}'
```

Lines must arrive **progressively**, not in one burst at the end. A single burst means something is
buffering — check `X-Accel-Buffering: no` and `Cache-Control: no-transform` on the response, and
`proxy_buffering off` in the nginx vhost.

## Inspect the database

```bash
docker compose exec db psql -U darin darin_payroll
```

The port is deliberately not published; this is the only way in. **The database holds real customer
names and phone numbers** — never paste query results containing them into a report or a commit.
Describe the shape and cite row counts instead.

## Clean up

Delete rows you created (`Sale`, `SaleAttribution`, `OtEntry`, `ClassSession`, test `Staff`). Use
obviously-fake names so they are easy to find.

**Never leave a `Payslip` you generated with a status other than `draft`.** `runPayroll` refuses to
recompute an `approved` or `paid` slip, so an accidental status change silently freezes a real pay
period, and the next real run will skip that person without saying why.
