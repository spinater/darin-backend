---
description: Coding standards for the Next.js App Router surface (app/) — pages, server actions, the sync route
applyTo: 'app/**/*.ts,app/**/*.tsx,proxy.ts'
---

# App Router surface (`app/`)

Every page is a server component. There is exactly one API route
([app/api/sync/route.ts](../../app/api/sync/route.ts)) and it exists only because it streams;
everything else is a `"use server"` action defined inside the page that submits to it.

## Pre-flight (read in this order)

1. **The knowledge card for the route group** —
   [.claude/knowledge/index.md](../../.claude/knowledge/index.md).
2. [REQUIREMENTS.md](../../REQUIREMENTS.md) §6 — what each screen is for and who may see it.
3. `.github/copilot-instructions.md` §3 (hard rules) and §4a (file length).
4. The page nearest to what you are building. The pages are deliberately similar: read one, then
   match it, rather than introducing a second style.

## Hard rules

- **Authorize inside the action, not just the page.** Every `"use server"` action starts with
  `await requireAdmin()` or `await requireRole(...)`. A server action is a POST endpoint — it is
  reachable without the page ever rendering, so a check at the top of the component protects
  nothing. `proxy.ts` only checks that a cookie exists, for UX.
- **`export const dynamic = "force-dynamic"`** on every page that reads the database.
- **Actions revalidate.** End a mutating action with `revalidatePath("<the route>")`.
- **Never wrap `redirect()` in `timed()`** — Next signals redirects by throwing, so the wrapper
  records a bogus duration and obscures the control flow. Wrap only the genuinely slow work.
- **Errors and messages travel in the query string** (`?err=…` / `?msg=…`) in Thai, matching
  the existing pages. Keep them readable by a non-technical operator.
- **Compose from `app/_components/`** — `SubmitButton` (pending state), `ActionProgress`
  (shows "usually takes about N" from `JobDuration`), `Spinner`. Reach for a new shared component
  only when two routes genuinely need it.
- **Tailwind v4, no config file.** Utilities plus the shared classes in
  [app/globals.css](../../app/globals.css) (`card`, …). Do not create `tailwind.config.js`.
- **Thai UI copy, always.** `<html lang="th">`, Noto Sans Thai. No English strings in the UI.
- Client components (`"use client"`) are the exception, not the default — currently only
  `SubmitButton`, `ActionProgress` and `SyncRunner`, each because it needs browser state.
- **The sync route answers, it does not redirect.** It returns `403` JSON, because a `fetch()`
  caller cannot follow a redirect to `/login` in any useful way. Keep it that way, and keep
  `Cache-Control: no-transform` + `X-Accel-Buffering: no` — without them nginx and Cloudflare
  buffer the whole NDJSON stream and the progress bar arrives all at once at the end.

## UI quality

This is an internal tool a gym owner opens once a month to reconcile salaries. It is deliberately
plain: six utility classes, no component library, no brand expression. **Do not import a
marketing-page design vocabulary into it** — no hero sections, no signature elements, no accent
gradients. Restraint here is the design.

The floor, which is not negotiable:

- Every list page handles all four states: **loading, empty, error, populated**. An empty screen
  says what to do next, not just "no data".
- Every mutating form shows a pending state (`<SubmitButton>`), and slow ones show a measured
  estimate (`<ActionProgress>`).
- Keyboard focus stays visible. `role="status"` + `aria-live="polite"` on anything that updates
  asynchronously — `loading.tsx` and `action-progress.tsx` already do this; match them.
- The layout survives a phone.

**Copy is design material.** Write from the operator's side of the screen: name things by what
they control, not by how the system works. Active voice on controls, and the same word all the way
through a flow — the button that says "คำนวณ" produces a message that says "คำนวณแล้ว". Errors say
what happened and what to do about it; they never apologise and are never vague. Being specific
beats being clever.

## Required after edit

1. Update the knowledge card listing your file in `sources:`, and bump `verified[0].at`.
2. Update [REQUIREMENTS.md](../../REQUIREMENTS.md) §6 if a screen's purpose or audience changed.
3. Run and paste the output:

```bash
bun run check:lines
bun run check:knowledge
bunx tsc --noEmit
bun test
```

`tsc` is the real gate here — there is no test coverage of `app/`. If the change is visible,
drive it in a browser as well; see the [verify skill](../../.claude/skills/verify/SKILL.md).
