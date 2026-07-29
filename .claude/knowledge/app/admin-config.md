---
type: page
title: Admin config & account pages
description: /admin/config holds every rate, threshold, class price, trainer alias and colour rule; /account handles passwords. The largest hand-written file in the repo lives here.
tags: [config, admin, aliases, passwords]
sources:
  - app/admin/config/page.tsx
  - app/account/page.tsx
verified:
  - by: claude-code/opus-5
    at: 2026-07-29
---

# Admin config & account pages

`/admin/config` is the reason there are no hardcoded numbers anywhere else: every rate, threshold
and percentage the engine reads is edited here. `/account` handles passwords for a system where
most staff cannot log in at all.

## Covers

| File | Route | Role |
| --- | --- | --- |
| `app/admin/config/page.tsx` | `/admin/config` | 6 server actions over 8 card sections — **449 lines** |
| `app/account/page.tsx` | `/account` | change own password; admins set a staff password |

## What the config page edits

`TeachRate` (activity × rank) · `PayrollConfig` (the 19 keys) · `ClassPrice` · `ColorRule`
(sheet colour → `pay` / `skip` / `review`) · `Staff` (add, deactivate) · `TrainerAlias`.

## Invariants & gotchas

- **`app/admin/config/page.tsx` is 449 lines — one line under the 450 warn tier and 51 under the
  hard ceiling.** The next feature added here should split it first: actions to
  `app/admin/config/_actions.ts`, the eight `<section className="card">` blocks to
  `app/admin/config/_components/`. Both are Next private paths, so no URL changes. See §4a.
- **Adding a trainer alias retroactively fixes past sessions.** Sessions parked in the review queue
  as `ไม่รู้จักเทรนเนอร์ "…"` are matched on the next sync — you do not resolve them one by one.
  This is the documented onboarding path for a new trainer.
- **Deactivate, never delete.** The FK is `Restrict`, so deleting a staff member with sessions is
  blocked at the database. `active = false` preserves every past session and payslip and logs them
  out on their next request.
- **A new config key needs three things**, not one: the `PayrollConfig` row, the `CONFIG_DEFAULTS`
  entry in `lib/config-keys.ts`, and a line in §4 of the pay-rules spec. Miss the code entry and
  `num()` throws a Thai "ไม่พบ config" at payroll time.
- **Colour rules are the riskiest setting on the page** (§1.6). Marking a colour `skip` silently
  removes those sessions from pay for every past and future sync. §1.6 is still partly an open
  question in the spec — do not invent a meaning for a colour.
- **Yoga rates are deliberately unseeded.** A missing rate produces a payroll warning naming the
  activity, which is correct behaviour — not a bug to patch with a default.
- **`/account` enforces `MIN_PASSWORD_LEN` (12)**, and changing your own password invalidates your
  other sessions. Admins can set another staff member's password but not their own through that
  form.
- Most trainers have `LOGIN_DISABLED` as their `passwordHash` — they exist to be paid and to be
  named in the sheet, not to log in. Giving one access is a deliberate act on this page.
- Every action re-checks `requireAdmin()` and ends with `revalidatePath()`. The save action is
  wrapped in `timed("config-save", …)`.

## Read next

- The config catalogue — [darin-payroll-system.md](../../../darin-payroll-system.md) §4
- Colour semantics (open question) — [REQUIREMENTS.md](../../../REQUIREMENTS.md) §1.6, §7
- Staff onboarding / offboarding — [README.md](../../../README.md) "พนักงานใหม่เข้ามา / ลาออก"
- Passwords and the sentinel — [domain/auth-and-accounts.md](../domain/auth-and-accounts.md)
- The split pattern — [.github/copilot-instructions.md](../../../.github/copilot-instructions.md) §4a
