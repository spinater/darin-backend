---
sources:
  # The parse itself: the five buckets (ใบ 082), the one-line skip, the dedup, and `calendarDate`.
  - lib/ot-import.ts
  # The pin on all of it (14 since ใบ 082) — the only lane that asserts these buckets.
  - lib/ot-import.test.ts
  # The action that calls the parse and wraps the write in one `$transaction`.
  # ⚠️ **Only the paste half of this file is this card's.** `/ot`'s one-row `add` form is
  # [form-refusals.md](form-refusals.md)'s, which lists this same file for that — two cards, one
  # file, one claim each, and they go stale together.
  - app/ot/page.tsx
  # Where the four boxes are rendered, one bullet per line — the claim that no new error surface
  # was needed rests on this file, not on the parse.
  - app/ot/_components/paste-form.tsx
---

# การวางทับ OT ทีละหลายบรรทัด — ห้าถัง และทำไมทรานแซกชันต้องมาทีหลังด่าน

Split out of [form-refusals.md](form-refusals.md) at ใบ 083 (it had reached 192/200). That card owns
the **per-field** refusals of the one-row forms and the shared `?err=` surface they report through;
`/ot`'s `add` is one of its rows. This one owns the **other** path OT arrives by — the fingerprint
paste, which refuses **per line** into four boxes instead of one `?err=` slot, and whose write is
all-or-nothing.

Read that card first for the surface; nothing here re-states it.

| Action | Fields | Blank means | Flag |
| --- | --- | --- | --- |
| `/ot` `paste` | `hours`, `date` and the username — per line | **only a wholly blank line is skipped** (`!line.trim()`, ใบ 014); a blank hours cell is refused, not dropped, and a line with hours but **no** identity field reaches `unmatched` rather than the floor | `unmatched` · `invalidHours` · `invalidDates` · `outOfWindowDates` boxes |

🔑 **The paste path is on the same predicate** (`lib/ot-import.ts` → `invalidHours`, one bullet per
line, no new surface needed). It has to be: the one-row form
([form-refusals.md](form-refusals.md)) refusing `-5` while the paste imported it left the door open
on the path OT actually arrives by, and `-5` is the quiet one — finite, so it stores, and
`Math.max(0, -5 − threshold)` then pays nothing.

🔴 **ใบ 014 — the paste refuses in two layers.** Its write is `deleteMany` + `createMany` inside one
`db.$transaction` ⇒ **all-or-nothing**: `imported` is `rows.length` or `0`, never between, and the
error copy names no failing row because none exists. A transaction is only an improvement if every
*per-line* problem is refused **before** it — one typo at line 85 of 220 would otherwise roll back the
other 219 where it used to strand 84 committed ⇒ four buckets, not two:

| Bucket | The line has | Why it is not just "it fails at the write" |
| --- | --- | --- |
| `unmatched` | a username nobody owns (a header row lands here, and so does a line with **no** username, as `(บรรทัดไม่มีชื่อผู้ใช้)`) | deduped by the normalized key — one fix recovers a whole month |
| `invalidHours` | an hours cell that is non-finite, negative, **or empty/absent** | the empty cell was in *no* bucket before ใบ 014: a fingerprint export writes `somchai<TAB>2026-07-01<TAB>` for a missed scan-out, so the paste reported "นำเข้าแล้ว 219 รายการ" with zero warnings while that person's OT was short |
| `invalidDates` | a date that is not a real calendar day | 🔴 the quiet half: `new Date("2026-06-31")` answers **`2026-07-01`**, no `NaN` anywhere, so that day's OT is counted in the **next month's period**. Validated by round-trip (`toISOString().slice(0,10)` must equal the text), which also pins the `YYYY-MM-DD` shape |
| `rows` | everything else, deduped by `staffId + date`, **last line wins**, position preserved | `@@unique([staffId, date])` would make `createMany` throw on a repeat and roll back the paste; last-wins is what the old upsert-per-row loop did in silence |

🔴 **ใบ 082 made it five, and the fifth is not a variant of the fourth.** `parseOtPaste` now takes
the plausible operating window as a **required** argument — required, because the parse has no page
context to derive one from and an optional parameter is the one a caller forgets, which would leave
the path OT actually arrives by open while the one-row form beside it stayed shut.

| Bucket | The line has | Why it is not `invalidDates` |
| --- | --- | --- |
| `outOfWindowDates` | a **real** day whose year is outside the window (`0226-06-05`, `9999-12-31`) | `calendarDate` is *right* about these — they round-trip exactly as typed. Reporting them as "วันที่อ่านไม่ออก" names the **wrong cause** and sends the operator after a malformed cell that is not there; §2 rule 4 asks for a warning that is *useful*, not merely present. Its own `WarningCard` on `/ot`, capped at 20 like its two neighbours |

The window itself — the two `PayrollConfig` keys, why it is deliberately generous, and the
plausible-but-wrong year it does **not** catch — is [date-window.md](date-window.md)'s. ⚠️ Do not
confuse `outOfWindowDates` (a row the window **judged**) with the window failing to be *built* at
all: that one disables the paste box entirely — `PasteForm`'s `disabled` prop, set from the page —
and reports above the form instead of in a bucket.

⚠️ What can still fail the write is then **infrastructure only**, which is what makes one flat Thai
line honest instead of a guess. No `bun test` proves the rollback (no DB) — `tasks/todo/015-db-test-lane.md`.
