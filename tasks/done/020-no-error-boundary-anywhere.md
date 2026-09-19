# A missing config key is loud in the log and silent in Thai — there is no `error.tsx` anywhere

- status: done
- commit: 0b27e9e

## Goal

`find app -name "error.tsx" -o -name "global-error.tsx" -o -name "not-found.tsx"` returns **nothing**.
`app/loading.tsx` exists and covers §2 rule 9; there is no equivalent for the failure direction.

So when `num()` throws — which is the behaviour §2 rule 3 asks for and which task 009 gave `/ot` and
task 011 gave `/classes` — production renders Next's generic English "Application error: a
server-side exception has occurred", and the Thai message that names the key
(`ไม่พบ config: class.minAttendees`, `lib/config-keys.ts:32`) reaches the **server log only**.

Both review lanes raised this independently during the task 011 review and both ruled it out of that
diff's scope.

## Why it is worth its own card

The rule it half-satisfies is §2 rule 4 — what the system cannot decide must reach the screen. Today
the failure *is* loud (nothing is invented, nothing becomes a silent zero), which is the expensive
half. What is missing is that it is not **informative**: the person looking at the screen is a
counter staffer at Darin, and "Application error: a server-side exception has occurred" tells them
neither what broke nor who can fix it, in a language the product otherwise never uses.

The reach grew on 2026-09-18. Before task 011, `/classes` invented `?? 3` / `?? 0.5` and never threw;
now it throws exactly as `/ot` does. Closing the rule-3 hole moved the cost onto this one.

## Scope

1. **An `app/error.tsx`** (client component, per App Router) with Thai copy: what happened, that
   nothing was saved, and what to do — for a config failure that is "ตั้งค่าที่ `/admin/config` ยังไม่ครบ",
   with the key named if it can be surfaced safely.
   ⚠️ A production build **redacts** server-error messages before they reach the client `error`
   boundary (the same redaction `app/ot/page.tsx:139-141` already documents for server actions), so
   decide deliberately whether the key is passed through a typed thrown value or whether the copy
   stays generic and points at `/admin/config`. Do not assume `error.message` will arrive.
2. **A `not-found.tsx`** while the file is open — same reasoning, much smaller.
3. Decide whether a **route-level** boundary is wanted anywhere (`app/classes/error.tsx`,
   `app/ot/error.tsx`) or whether one root boundary is enough for a one-branch product.

## How to reach it, for whoever tests this

Not trivially: `/admin/config` can only `update` config rows, never delete them, so an actual missing
key needs a direct DB edit or a partial seed. Use a throwaway Postgres (the same lane
`scripts/check-code.sh` uses) rather than the dev database.

## Notes

- Found by `code-reviewer` and `payroll-auditor` during the task 011 review, both as an operational
  note rather than a finding on that diff.
- Related: [task 019](../todo/019-dashboard-sums-baht-in-a-page.md) came out of the same review round.
- Design input worth buying before writing the copy: `microcopy-writer` for the Thai, and
  `uxui-designer` if the boundary gets any layout beyond a `.card-error` block.

---

## What shipped (0b27e9e)

`app/error.tsx` (90) · `app/global-error.tsx` (60) · `app/not-found.tsx` (23). `verify.sh` ALL GREEN,
`code-reviewer` **PASS**.

### 🔴 One line of the Scope above was deliberately overruled — read this before citing it

Scope item 1 asks for copy saying **"nothing was saved"**. That was **not** shipped, on purpose. An
uncaught server-action throw reaches this boundary *after* it may already have written rows, so the
sentence would be a claim about the database that nobody checked — the exact trap
`app/ot/page.tsx:135-141` documents (its old "previous rows are already saved" copy was a lie at
`imported === 0`). The shipped copy instead tells the reader to **check whether the save went
through before pressing save again**. Scope item 1 is otherwise satisfied.

### The four decisions, and where each is recorded

| | Decision | Recorded in |
|---|---|---|
| 1 | `error.message` is never rendered (production redacts it) — `error.digest` is printed instead, and the copy names the likely cause | `app/error.tsx` doc-comment |
| 2 | the copy never claims "nothing was saved" (above) | `app/error.tsx` doc-comment |
| 3 | `global-error.tsx` **is** included — `app/error.tsx` does not catch a throw from `app/layout.tsx`, which `await`s `currentStaff()` on every request | `app/global-error.tsx` doc-comment |
| 4 | **no** route-level boundaries (scope item 3's open question, now closed) — one branch, two failure modes, and the root boundary keeps the nav reachable | `app/error.tsx` doc-comment |

Scope item 1's other open question — *"whether the key is passed through a typed thrown value"* — is
answered **no** by decision 1. The key stays server-side; the digest is the handle that ties the
screen to the log line.

### Two facts the review established against the real build, not from memory

- **`import "./globals.css"` inside a `"use client"` `global-error.tsx` works.** Next resolves the
  `global-error` module's CSS explicitly (`getGlobalErrorStyles()`), and a production build of this
  tree emits a CSS chunk for `app/global-error` containing `.btn` and `.card-error`. ⚠️ In
  `next dev` the error overlay pre-empts `global-error`, so it must be eyeballed against a
  production build or the deployed host — never `bun run dev`.
- **`error.digest` is populated** for a `num()` throw during a server-component render *and* for an
  uncaught server-action throw (both go through `create-error-handler.js`, which is not
  `NODE_ENV`-gated). It is absent only for a throw originating in the browser. It is a hash of
  message+stack ⇒ it identifies the **fault**, not the incident; the operator still finds the log
  line by time.
- The new boundary does **not** swallow `notFound()` or the `redirect("/login")` that
  `requireRole()` throws — Next's `error-boundary.js` rethrows router errors before delegating.

### Two copy defects review found, both fixed before the commit

1. `/admin/config` renders one input per **existing** config row (`app/admin/config/page.tsx:380`),
   so the `ไม่พบ config` arm of `num()` (a **missing row**, not a blank value) leaves nothing on that
   page to fill in. Copy that only said "go check every field is filled" left the staffer seeing a
   full form and stuck. The copy now says so and escalates to the digest.
2. `ไปหน้าตั้งค่า` is a dead end for a `counter`/`trainer` — `requireAdmin()` redirects them to
   `/me` with no message, and the card names a counter staffer as this screen's reader. The
   paragraph now opens `ถ้าคุณเป็นผู้ดูแลระบบ`, naming the actor, since a client boundary cannot
   check the role itself.

Then one more, found reading the diff here: the escalation clause pointed at
`รหัสอ้างอิงด้านล่าง` while the digest line below it is conditional ⇒ with no digest the copy sends
someone looking for a code that was never printed. **One instruction, one condition, the same
condition** — the clause now lives inside the same `error.digest &&` check. Same class as
`/ot`'s `ตรวจบรรทัดนั้น` and `WarningCard`'s count-versus-list.

### Not done here, deliberately

- No `uxui-designer` / `microcopy-writer` pass on tone, button order, or a `<title>` for
  `global-error`. `code-reviewer` raised it and did not block; task
  [006](../todo-human/006-ui-design-pass.md) is where a real design pass belongs.
- **Nobody has seen these screens render.** The gate does not build `Dockerfile` (§7) and a
  production build is the only way `global-error` shows at all ⇒ first eyeball is on the deployed
  host, which is still blocked behind [002](../todo-human/002-deploy-host-setup.md) /
  [008](../todo-human/008-merge-sync-progress-then-deploy-develop.md).
