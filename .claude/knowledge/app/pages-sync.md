---
type: route-group
title: Sync & review pages
description: /sync triggers a sheet import with live progress; /sync/review is the queue of sessions the parser refused to guess about, which must be empty before payday.
tags: [sync, review-queue, xlsx]
sources:
  - app/sync/page.tsx
  - app/sync/review/page.tsx
verified:
  - by: claude-code/opus-5
    at: 2026-07-29
---

# Sync & review pages

`/sync` pulls the Google Sheet in; `/sync/review` is where a human resolves everything the parser
would not decide. The queue is the safety valve for the whole system — an unreviewed row is a
session nobody gets paid for.

## Covers

| File | Route | Role |
| --- | --- | --- |
| `app/sync/page.tsx` | `/sync` | hosts `<SyncRunner>`, the no-JS fallback action, and the run history |
| `app/sync/review/page.tsx` | `/sync/review` | paginated queue (`PAGE_SIZE = 50`) with per-row resolution |

## Invariants & gotchas

- **Both pages are `requireAdmin()`**, in the page and again in every action.
- **Resolving a row sets `reviewed = true`**, and sync then refuses to overwrite it. That is the
  contract between this screen and `lib/sync.ts`: a human decision is final, and the only thing that
  can reopen it is the raw cell in the sheet actually changing.
- **The queue is not only `needs_review`.** It uses `NEEDS_ATTENTION`, which also catches
  `status: "ok"` rows with no trainer — otherwise those would be invisible to both the queue and the
  payslip query.
- **Rows with a null date are in the queue too.** Payroll filters by date range, so an undated
  session can never appear on a slip; the queue is the only place it exists.
- **The `.xlsx` path field is an offline escape hatch**, not a legacy leftover: it takes the same
  code path as the live fetch and needs no Google credentials, which makes it the cheapest honest
  way to exercise the whole pipeline.
- **`<SyncRunner>` is a client component and `/sync` is not.** The page passes it the previous run's
  timings and a `fallbackAction`; with JavaScript disabled the plain server action still runs, just
  without progress. The button is never dead.
- **Fixing an unknown trainer belongs on `/admin/config`, not here.** Adding the alias and
  re-syncing matches every affected past session at once; resolving them one by one in the queue is
  the slow path.
- The run history table is a server component, which is why `<SyncRunner>` calls `router.refresh()`
  when the stream finishes.

## Read next

- What fills the queue — [domain/sheet-parsing.md](../domain/sheet-parsing.md)
- The write path and the `reviewed` guard — [domain/sheet-sync.md](../domain/sheet-sync.md)
- The progress protocol — [contracts/sync-stream.md](../contracts/sync-stream.md)
- Adding an alias — [app/admin-config.md](admin-config.md)
- Why the queue must be empty — [app/pages-payslip.md](pages-payslip.md)
