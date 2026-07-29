---
type: module
title: Sheet sync
description: Idempotent write path from parsed sessions into the database — applies colour rules, reports progress, and never overwrites a row a human has reviewed.
tags: [sync, idempotent, review, progress]
sources:
  - lib/sync.ts
verified:
  - by: claude-code/opus-5
    at: 2026-07-29
---

# Sheet sync

The only writer of `SheetRowRaw` and `TeachSession`. Fetches every active `SheetSource`, parses all
of them, then writes — reporting progress as it goes. Re-running it is always safe; that is its
central design goal and the reason for every unique key it depends on.

## Covers

| File | Role |
| --- | --- |
| `lib/sync.ts` | `syncSources()`, plus the `SyncProgress` / `SyncEvent` / `SyncResult` types |

## Public surface

- `syncSources(opts?, onProgress?) → SyncResult[]` — `opts.xlsxPath` switches to a local workbook
- `SyncResult` — per sheet: `created`, `updated`, `skippedReviewed`, `ok`, `needsReview`, `ignored`
- `SyncProgress` — `{ phase: "fetch" | "process", sheetName?, sheetIndex?, sheetCount?, done, total }`
- `SyncEvent` — the NDJSON wire type; declared here so the route and the client share one definition

## Invariants & gotchas

- **A row with `reviewed = true` is never overwritten.** If the raw cell changed underneath it, sync
  flips it back to `needs_review` with a note quoting `"old" → "new"` and counts it in
  `skippedReviewed`. It does not overwrite, and it does not stay silent — both would lose a human
  decision.
- **The upsert key is `(sourceId, rowIndex, colIndex)`.** That is what makes re-running safe.
  Removing or changing that unique constraint turns every re-sync into duplicate sessions and
  double pay.
- **Everything is parsed before anything is written.** This looks wasteful and is deliberate: it is
  the only way to know `total` up front. Parsing as you write means the progress bar cannot show a
  percentage until it is already half done.
- **Raw rows for one sheet go in a single `$transaction`.** Chunking it would make the progress bar
  smoother and would also allow the raw data to be left half-written after a crash. The comment in
  the file says so; do not "optimise" it away.
- **Colour rules are applied here, not in the parser.** `skip` forces `ignored`; `review` downgrades
  `ok` to `needs_review`. Colours are matched lower-cased. A colour with no rule does nothing.
- **The fetch mode is chosen by environment, not configuration:** with `GOOGLE_SA_EMAIL` **and**
  `GOOGLE_SA_PRIVATE_KEY` set it uses the Sheets API, otherwise the public export endpoint. An
  `xlsxPath` overrides both.
- **`PROGRESS_EVERY = 50`** throttles events; `lastEmit` is reset to `-PROGRESS_EVERY` when a new
  sheet starts so the sheet name updates immediately rather than up to 50 units late.
- Sources with no matching grid are skipped silently — a renamed sheet tab disappears from the run
  rather than erroring.
- `lastSyncAt` is stamped per source only after that source's rows are written.

## Read next

- Where the sessions come from — [domain/sheet-parsing.md](sheet-parsing.md)
- How progress reaches the browser — [contracts/sync-stream.md](../contracts/sync-stream.md)
- The colour question (§1.6 is still partly open) — [REQUIREMENTS.md](../../../REQUIREMENTS.md) §1.6
- The tables written — [data/schema.md](../data/schema.md)
