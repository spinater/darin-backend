---
type: module
title: Sheet reading & parsing
description: Reads the Google Sheet as a raw grid (date serials + cell colours) and turns it into teaching sessions, sending everything ambiguous to the review queue instead of guessing.
tags: [sheets, parser, review-queue, aliases]
sources:
  - lib/sheets.ts
  - lib/parser.ts
  - lib/normalize.ts
  - lib/parser.test.ts
verified:
  - by: claude-code/opus-5
    at: 2026-07-29
---

# Sheet reading & parsing

Three ways in (Sheets API, public export, local `.xlsx`) all produce the same `RawGrid`, which
`parseGrid()` turns into `ParsedSession[]`. The sheet is kept by hand by trainers, so roughly 3% of
cells are not dates at all — the parser's real job is deciding what it cannot decide.

## Covers

| File | Role |
| --- | --- |
| `lib/sheets.ts` | `RawCell`/`RawGrid`, the three fetchers, `serialToDate` |
| `lib/parser.ts` | `parseGrid()` — grid → sessions, and every ambiguity rule |
| `lib/normalize.ts` | name and phone normalisation before alias lookup |
| `lib/parser.test.ts` | cell-reading rules; a fixture-gated block for a real workbook |

## Public surface

- `fetchGrids(spreadsheetId, sheetNames)` — Sheets API with a service account; also returns cell notes
- `fetchPublicGrids(spreadsheetId, sheetNames?)` — the `export?format=xlsx` endpoint, no credentials
- `loadXlsxGrids(path, sheetNames?)` — a local workbook, for tests and offline work
- `serialToDate(serial)`, `sheetIdFromLink(link)`
- `parseGrid(grid, colMap, headerRows, aliases) → ParsedSession[]`
- `normalizeTrainer(raw)`, `normalizePhone(raw)`

## Invariants & gotchas

- **Never read this sheet as CSV, and never use `values.get`.** Both return `"23/4"` instead of the
  serial `45405`, and the data straddles 2024–2026 so the year cannot be recovered. Both also drop
  the background colour, which the sheet uses to encode meaning. `includeGridData=true` and the
  xlsx export are the only two acceptable sources.
- **A guessed year is always downgraded to `needs_review`**, however confident the inference. Cells
  without a year are held in `pending` and resolved at `flush()` against the anchor date that was
  current *when the cell was seen* — not the anchor at flush time, which has already moved on.
  Dates within a package are assumed ascending; with no earlier date, the first anchor is used and
  the guess runs backwards.
- **The parser never guesses a trainer.** `normalizeTrainer()` strips whitespace, a leading `pt` and
  a leading `พี่` — collapsing ~21 spellings onto ~5 people — then looks up `TrainerAlias`. A miss
  becomes a review item quoting the raw spelling, which is what lets an admin add the alias and
  re-sync to match old sessions retroactively.
- **A row with no name and no phone but with session cells is a continuation** of the row above —
  about 30% of the PT sheet. A wholly blank row is skipped **without** breaking that chain.
- **`SERIAL_MIN`/`SERIAL_MAX` (20000–60000) is a sanity window, not a format check.** It exists to
  reject stray numbers like `837` that are technically valid serials but obviously not dates here.
- **`LABEL_RE` and `SUSPECT_RE` do opposite things.** A package label (`platinum`, `โปร`, `แถม`…)
  becomes `ignored` and never troubles a human. A suspect word (`หัก`, `ลืม`, `ยกเลิก`, `แทน`…)
  becomes `needs_review` and always does.
- **Text left over after a date is not discarded.** It is matched against the aliases: a hit means a
  substitute trainer for that session only; anything else is a review item quoting the text.
- **A sheet may have no trainer column at all** (`colMap.trainer === null`, the swimming sheet).
  Every session from it is a review item — the parser will not attribute those hours to anyone.
- Years above 2400 are treated as Buddhist Era and reduced by 543; two-digit years get `+2000`.
- `parseGrid` knows nothing about colour rules — those are applied later, in sync.

## Read next

- What the sheet actually looks like — [REQUIREMENTS.md](../../../REQUIREMENTS.md) §1.1–§1.6
- The pipeline — [REQUIREMENTS.md](../../../REQUIREMENTS.md) §4
- What happens to the output — [domain/sheet-sync.md](sheet-sync.md)
- The review screen — [app/pages-sync.md](../app/pages-sync.md)
- Standards — [.github/instructions/domain.instructions.md](../../../.github/instructions/domain.instructions.md)
