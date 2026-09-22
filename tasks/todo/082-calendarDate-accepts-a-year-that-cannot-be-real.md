# `calendarDate` validates the calendar but not the year — and one screen makes that permanent

- status: todo
- commit:

## Goal

`calendarDate` (`lib/ot-import.ts`) round-trips the ISO day back out of the `Date`, which is what
catches `2026-06-31` silently becoming `2026-07-01` (ใบ 014, ใบ 072, ใบ 080). It asks whether the day
**exists**. It does not ask whether the year is one this gym could have operated in. Measured:

```
0226-06-05  ACCEPTED -> 0226-06-05
0206-06-05  ACCEPTED -> 0206-06-05
0026-06-05  ACCEPTED -> 0026-06-05
9999-12-31  ACCEPTED -> 9999-12-31
0001-01-01  ACCEPTED -> 0001-01-01
```

A Chrome/Firefox date picker's year box accepts three digits and zero-pads, so `0226` is produced by
the same shaky hand the date guards were written about — not by a crafted post.

## Where it costs, and where it does not

The row lands outside every `periodRange` query (`0226-06-05` is not in
`[2026-06-01, 2026-07-01)` — verified), so it appears in **no** payslip.

- `/sales` and `/classes` are **semi-self-revealing**: after the redirect, the row the operator just
  saved is not in the period table they are looking at, so a careful person notices.
- 🔴 **`/sync/review` is not.** Confirming the June ว่ายน้ำ คาบ with year `0226` writes
  `status:"ok", reviewed:true` — the คาบ **leaves the queue**, appears in no period, and
  `reviewed: true` stops every later sync from repairing it. ⇒ **250 ฿ paid as 0 ฿, permanently,
  with the queue showing clean.** That is ใบ 080's own headline failure reached by a second route.
- `/ot` has the identical gap and **is already on `develop`** (ใบ 072, `c3a63e1`).

## Scope

- The window belongs in the **callers, not in `calendarDate`** — the helper has one job (does this
  day exist, and is it the day that was written) and it is shared by a parse that has no page
  context. A caller knows its screen's period; the helper does not.
- 🔴 **The bounds are not a literal** (§2 rule 3). Two candidate sources, and they pay differently:
  the page's own `period` (tightest — a row saved on the June screen belongs to June, and anything
  else is worth a question), or a config key pair in `lib/config-keys.ts` for a plausible operating
  window. Decide which, and say why in the card before writing code.
- ⚠️ **A window is a refusal, so the mirror failure is real**: too tight and a legitimate
  back-dated correction is refused, which is hours or a bill not paid — the same §2 rule 4 failure
  in the other direction. A backfill of last quarter is an ordinary thing to do.
- Four call sites: `/ot` `add`, `/sales` `add`, `/classes` `add`, `/sync/review` `resolve` — plus
  `parseOtPaste`, where the answer may legitimately differ (a fingerprint export covers one month;
  a person typing covers whatever they meant to).
- Test + junit pin raise in the same change (§7). Unlike ใบ 080, there **is** something pure here:
  whatever predicate decides the window is a function, and its bounds are exactly what a future
  reader will want to shrink.

## Notes

- Found by `payroll-auditor` in the ใบ 080 audit; every line of the table above was re-run by hand
  before this card was opened.
- The related-but-different gap on the same screen is
  [081](081-the-review-screens-queue-guard-and-its-remaining-silences.md) — that one is about queue
  membership, this one about the date. They land in the same action and should not be merged: one is
  a predicate shared by four screens, the other is one screen's own guard.
- Related: [014](../done/014-ot-import-atomicity.md) ·
  [072](../done/072-the-one-row-ot-form-still-stores-a-rolled-over-date.md) ·
  [080](080-three-more-money-writes-still-take-an-unguarded-date.md) ·
  [079](079-periodRange-accepts-aliases-for-one-month-and-payslips-are-keyed-by-the-string.md)
  (the same family on the period key rather than the row's day).
