---
type: concern
title: Auth, sessions & accounts
description: Who can see money — cookie sessions backed by a DB row, scrypt passwords, the disabled-login sentinel, and why the middleware is not an authorization boundary.
tags: [auth, session, password, roles]
sources:
  - lib/auth.ts
  - lib/password.ts
  - lib/password.test.ts
  - lib/onboard.test.ts
  - proxy.ts
verified:
  - by: claude-code/opus-5
    at: 2026-07-29
---

# Auth, sessions & accounts

One gym, four roles: `owner`, `admin`, `counter`, `trainer`. The session cookie holds a `Session`
row id and nothing else. Every authorization decision in this app is a `requireRole()` call inside
the page or action that needs it.

## Covers

| File | Role |
| --- | --- |
| `lib/auth.ts` | login/logout, `currentStaff()`, and the `requireRole()` gate |
| `lib/password.ts` | scrypt hashing, the disabled-login sentinel, random password generation |
| `lib/password.test.ts` | hashing behaviour **and** the guard against `Bun.*` in app code |
| `lib/onboard.test.ts` | new and departing staff flows |
| `proxy.ts` | Next 16 middleware — cookie presence only |

## Public surface

- `login(username, password) → Me | null` — creates the `Session` row and sets the cookie
- `logout()`, `currentSessionId()`, `currentStaff() → Me | null`
- `requireRole(...roles) → Me` — redirects to `/login` if absent, `/me` if the role is wrong
- `requireAdmin()` — `requireRole("owner", "admin")`
- `hashPassword`, `verifyPassword`, `generatePassword`, `MIN_PASSWORD_LEN` (12), `LOGIN_DISABLED`

## Invariants & gotchas

- **`proxy.ts` is not authorization and never was.** It checks that a cookie *exists*, purely so an
  unauthenticated visitor lands on `/login` instead of an empty page. It does not read the session,
  the role, or the database. A finding of the form "middleware allows X" is not a real finding; a
  missing `requireRole()` is.
- **A server action needs its own `requireRole()`.** It is a POST endpoint reachable without the
  page ever rendering, so a check at the top of the component protects nothing. Every action in this
  codebase re-checks; keep it that way.
- **The cookie value *is* the `Session` row id.** There is no signature and no JWT — validity comes
  from the row existing. "Forging a session" would mean an `INSERT`, so never do that to test
  something; log in instead.
- **`currentStaff()` re-checks expiry *and* `staff.active` on every read.** Deactivating a staff
  member logs them out on their next request, with no session cleanup needed.
- **`LOGIN_DISABLED = "disabled"` is a sentinel, not a hash.** `verifyPassword` rejects it
  immediately because the scheme prefix is not `scrypt`, so no password can ever match. Trainers who
  submit via the Google Sheet have this: they exist to be paid and to be named in the sheet, but
  cannot log in.
- **`node:crypto` scrypt, deliberately not `Bun.password`** — Next runs on Node even when started
  with `bun`. `lib/password.test.ts` contains the regression test that enforces this repo-wide, and
  it scans app code only; `scripts/` may use Bun globals freely.
- `verifyPassword` uses `timingSafeEqual` and checks the key length before comparing, so a
  malformed stored value cannot throw.
- Sessions do not slide: `expiresAt` is fixed at login (`SESSION_TTL_DAYS`, default 30).
- Changing your own password deletes your other sessions — the account page relies on this.

## Read next

- Roles and who sees what — [REQUIREMENTS.md](../../../REQUIREMENTS.md) §6
- Staff onboarding and offboarding — [README.md](../../../README.md) "พนักงานใหม่เข้ามา / ลาออก"
- The account and admin screens — [app/admin-config.md](../app/admin-config.md)
- Why staff are deactivated and not deleted — [data/schema.md](../data/schema.md)
