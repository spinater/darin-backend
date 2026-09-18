# `/sync` prints a value from the query string — the one page that breaks "flag, not message"

- status: todo
- commit:

## Goal

Every error surface in this app carries a **flag** in the URL and keeps the Thai copy in the page
file, so nothing a link author controls reaches the screen (`/ot`, `/sales`, `/classes`,
`/admin/config`, and `setStatus` on `/payslips` all follow it). `app/sync/page.tsx:92` does the
opposite: it renders `{warn}` straight from `searchParams` into the notice.

React escapes it, so this is **not** an injection — it is a crafted link putting arbitrary text of
the author's choosing on an admin's screen, e.g. `?warn=1e999`, next to real sync results the admin
is about to act on. The one dialect that differs is also the one nobody re-reads.

## Scope

- Make it a flag like every other screen, or a value the page validates into a known range before
  rendering (a count is a number — `finiteNumber` from `lib/form-number.ts` already exists).
- Check the rest of `app/sync/**` for the same shape while you are there; this was found by eye,
  not by a sweep.

## Notes

- Found by `backend-dev` during task 013 item 4 (2026-09-18), out of that card's scope.
- The precedent and its reason are written in `app/ot/page.tsx`'s comment on `err` and in
  `.docs/knowledge/domain/money-input-guards.md`.
