---
type: route-group
title: Manual entry pages
description: /classes, /sales and /ot — the three screens for data the Google Sheet does not contain, including the sale attributions the commission engine reads.
tags: [classes, sales, ot, attribution]
sources:
  - app/classes/page.tsx
  - app/sales/page.tsx
  - app/ot/page.tsx
verified:
  - by: claude-code/opus-5
    at: 2026-07-29
---

# Manual entry pages

The sheet records 1-on-1 teaching and nothing else. Group classes, sales and overtime are keyed in
here. Everything these pages write feeds the payroll engine directly, so a mistyped row is a
mispaid person.

## Covers

| File | Route | Writes |
| --- | --- | --- |
| `app/classes/page.tsx` | `/classes` | `ClassSession` — date, class, trainer, booked, no-show |
| `app/sales/page.tsx` | `/sales` | `Sale` + `SaleAttribution` |
| `app/ot/page.tsx` | `/ot` | `OtEntry` — one row per staff member per day |

## Invariants & gotchas

- **`/sales` is the only one a `counter` may open** (`requireRole("owner", "admin", "counter")`).
  Its delete action is stricter — `owner`/`admin` only. `/classes` and `/ot` are admin-only.
- **Attribution roles are the commission engine's entire input.** `closer`, `referrer` and
  `content_owner` on a `Sale` decide who is paid what. A sale saved with no attribution pays nobody
  and produces no warning, because the engine only ever sees sales that name the person.
- **A sale is "self-closed" only when every attribution on it is `closer`.** Adding a `referrer`
  after the fact changes the closer's rate for that bill — and, if it crosses the incentive
  threshold, for the whole month retroactively.
- **`booked` and `noShow` are both needed** — the class price tier is decided by
  `booked − noShow`, not by `booked`. Entering only `booked` overpays a class nobody attended.
- **`OtEntry` is unique on `(staffId, date)`** and OT is computed per day, so entering a week's
  hours as one row produces a different (larger) figure than the same hours spread across days.
- **`listPrice` vs `netPrice` selects the membership commission rate.** A `netPrice` below
  `listPrice` is treated as a promotional sale at the promo rate; leaving `listPrice` empty means
  "not a promo" regardless of the amount.
- `course_ext` and `freeze` sales earn **no commission for anyone** — they are recorded for revenue,
  not pay.
- Every mutating form uses `<SubmitButton>`; on these pages a double submit is a duplicate row and
  therefore duplicate pay.
- All three pages are `force-dynamic` and re-check the role inside each action body.

## Read next

- Pay rules these feed — [darin-payroll-system.md](../../../darin-payroll-system.md) §1.4 (classes),
  §1.5–§1.6 (PT commission), §2.2 (membership), §2.4 (OT), §3 (who gets commission)
- What the sheet does not contain — [REQUIREMENTS.md](../../../REQUIREMENTS.md) §1.7
- How the numbers are used — [domain/payroll-engine.md](../domain/payroll-engine.md)
- Tables written — [data/schema.md](../data/schema.md)
