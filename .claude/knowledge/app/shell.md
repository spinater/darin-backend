---
type: module
title: App shell & shared UI
description: Root layout, role-based nav, the loading state, the login page, and the three shared client components that make server actions feel responsive.
tags: [layout, nav, ui, client-components]
sources:
  - app/layout.tsx
  - app/loading.tsx
  - app/page.tsx
  - app/login/page.tsx
  - app/_components/
  - next.config.ts
verified:
  - by: claude-code/opus-5
    at: 2026-07-29
---

# App shell & shared UI

The chrome every page sits in, plus the only three client components in the app. Everything else is
a server component. The shell reads the session itself, so the nav is role-aware without any page
having to think about it.

## Covers

| File | Role |
| --- | --- |
| `app/layout.tsx` | `<html lang="th">`, the role-based nav, the logout action |
| `app/loading.tsx` | route-transition state — every page is `force-dynamic`, so there is always a wait |
| `app/page.tsx` | the dashboard; redirects non-admins to `/me` |
| `app/login/page.tsx` | the one unauthenticated page |
| `app/_components/submit-button.tsx` | pending state + double-submit protection |
| `app/_components/action-progress.tsx` | measured "elapsed / roughly N left" clock next to a button |
| `app/_components/spinner.tsx` | the spinner both of the above use |
| `next.config.ts` | `output: "standalone"`, `serverExternalPackages` for the pg adapter |

## Public surface

- `<SubmitButton pendingLabel name value>` — must be **inside** the `<form>` it reports on
- `<ActionProgress baselineMs>` — `null` or a value under 1.5 s renders nothing
- `<Spinner className>`
- `ADMIN_NAV` in `layout.tsx` — the nine admin links; non-admins get `/me` and `/account` only

## Invariants & gotchas

- **The nav is UX, not authorization.** Hiding a link does not protect the route; `requireRole()`
  inside each page and action does. Adding a page means adding its own gate, not just a nav entry.
- **`<SubmitButton>` must live inside its form.** `useFormStatus()` reads the enclosing `<form>`;
  outside one, `pending` is permanently `false` and the button silently stops working.
- **One form, several buttons: compare `name`/`value` against the submitted `FormData`.** That is
  what `isMine` does. Without it every button in the form spins at once when any one is pressed —
  the payslip page (approve / mark paid / back to draft) is the case this exists for.
- **Double-submit protection is load-bearing on `/sales` and `/ot`**, where a second click creates a
  duplicate row and therefore duplicate pay. This is not a cosmetic nicety.
- **`<ActionProgress>` shows nothing when it knows nothing.** It appears only after 600 ms, only
  when the previous run took at least 1.5 s, and never shows a percentage — a plain server action
  can report only once, at the end, so claiming a percentage would be a lie. Its baseline comes from
  the measured `JobDuration` row, never from a constant, which is why the estimate stays honest as
  the data grows.
- **`app/loading.tsx` is not decoration.** Every page is `force-dynamic`, so a nav click always
  waits on the database. Without this file Next holds the old page silently and the app reads as
  unresponsive.
- `loading.tsx` and `action-progress.tsx` both use `role="status"` + `aria-live="polite"` — match
  that on anything new that updates asynchronously.
- **`serverExternalPackages: ["@prisma/adapter-pg", "pg"]`** must stay: bundling the pg adapter
  breaks the standalone build.
- The dashboard redirects `trainer` and `counter` to `/me` — they must never see the money overview.

## Read next

- Standards and the UI quality floor — [.github/instructions/app.instructions.md](../../../.github/instructions/app.instructions.md)
- Where `baselineMs` comes from — [contracts/sync-stream.md](../contracts/sync-stream.md)
- The gate behind the nav — [domain/auth-and-accounts.md](../domain/auth-and-accounts.md)
- Screen inventory — [REQUIREMENTS.md](../../../REQUIREMENTS.md) §6
