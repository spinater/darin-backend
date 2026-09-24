# `calendarDate` validates the calendar but not the year — and one screen makes that permanent

- status: done
- commit: 373f457

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

## Decision — a configured operating window, not the screen's period

The Scope above left one question open ("decide which, and say why in the card before writing
code"). Decided: **a config'd plausible operating window**, applied at all five call sites through
one pure predicate. Four reasons, in the order they decided it:

1. 🔴 **The screen's period has no in-UI escape hatch today.** `/ot`, `/sales` and `/classes` each
   read `period` from `searchParams` and default it to `new Date().toISOString().slice(0, 7)`, and
   **none of the three renders a control that changes it** (checked — no `type="month"`, no period
   links; the only period navigation in the app is `/sync/review`'s `hrefFor`). Binding the row's
   date to that period would refuse the most ordinary entry there is — yesterday's OT row typed on
   the 1st of the next month — and leave hand-editing the URL as the only remedy. That is §2 rule 4
   in its mirror direction: hours not paid, a bill not recorded, because the guard was too tight.
2. **`parseOtPaste` has no page context at all**, and the Scope already flagged that its answer may
   differ. A window is the one shape that all five callers can take unchanged, so the predicate
   stays *one* predicate rather than a per-caller special case.
3. **§2 rule 3 wants the bounds in `PayrollConfig`, and a window has a config shape.** A period bound
   is not configurable — it is whatever the URL says — so that option answers rule 3 by dodging it.
4. **A year is enough granularity, which means `num()` reads it unchanged.** The bounds are two
   numeric keys, so no new config accessor, no new value type, no `/admin/config` rendering case.

### What that buys and what it does not

- **Closed:** every measured row of the Goal table — `0226`, `0206`, `0026`, `0001`, `9999`. The
  `/sync/review` headline (a June คาบ confirmed at year `0226` → `status:"ok", reviewed:true`, in no
  period, unrepairable ⇒ 250 ฿ paid as 0 ฿) is refused before the write, with its own flag.
- 🔴 **Not closed, and stated here so nobody reads this card as covering it:** a *plausible but
  wrong* year — `2025-06-05` typed for `2026-06-05` — passes this window and still leaves the queue
  into a period nobody is looking at. Catching that needs the row bound to the month the operator
  is looking at, which needs a month control on the three screens first. Opened as its own card
  ([088](../todo/088-three-money-screens-have-a-period-they-cannot-change.md)); it is the *reason* reason 1
  above is a "today", not a "never".
- 🔴 **Also not closed — the sheet parser, which is the path the data actually arrives by.**
  `lib/parser.ts:77-79` normalises a sheet year with `if (y < 100) y += 2000;` then
  `if (y > 2400) y -= 543;`, while `DATE_RE` accepts **2–4 digits** ⇒ a three-digit year falls
  between both arms untouched: `5/6/226` is stored as year **226** with `status: "ok"` and a
  resolved trainer, so it reaches **no** review queue and **no** period — 250 ฿ paid as 0 ฿ with
  `warnings: []`, on the highest-volume path in the product. ⚠️ **The arithmetic was re-measured in
  this card's review round** (`y = 226` survives both arms; `Date.UTC`'s `1900 +` remap covers
  `0..99` only) — **the end state was traced by reading, not run**: no sync has been run against a
  fixture, so `status: "ok"` + resolved trainer ⇒ no queue, no period ⇒ 250 ฿ → 0 ฿ is a read of
  the code, not a measurement. ใบ 089's Notes say the same. It is **pre-existing and was out of
  this card's scope** (this card guards the five
  *forms*), and it has its own card:
  [089](../todo/089-a-three-digit-year-in-the-sheet-falls-between-both-normalisation-arms.md). Said here
  because a reader of the line above would otherwise conclude "a year that cannot be real is now
  refused" full stop, which is not true of the sync.

### The shape

- `lib/date-window.ts` — new, pure, no DB and no clock of its own:
  `dateWindow(cfg: Config, now: Date): { earliest: Date; latest: Date }` and
  `withinWindow(d: Date, w): boolean`. Not inside `calendarDate`: that helper answers "does this day
  exist and is it the day that was written", and the Scope is right that a window is a different
  question with a different owner.
- Two keys in `CONFIG_DEFAULTS` (`lib/config-keys.ts`), both read with the existing `num()`:
  `date.earliestYear` and `date.futureDays`.
- A **separate `err=` flag** from `err=date` at each call site. "วันนี้ไม่มีอยู่จริง" and "ปีนี้อยู่
  นอกช่วงที่ระบบรับ" are two different mistakes and must not share one line of Thai copy.
- `parseOtPaste` takes the window as a **required** argument and rejects out-of-window rows into
  their **own bucket**, not into `invalidDates` — a well-formed date reported as "อ่านไม่ออก" is a
  warning that names the wrong cause (§2 rule 4 is about the warning being *useful*, not merely
  present).

## What shipped

- **`lib/date-window.ts`** — `dateWindow(cfg, now)` + `withinWindow(d, w)`, pure, inclusive at both
  edges. `new Date(0)` + `setUTCFullYear`, **not** `Date.UTC(year, …)`, which maps `0..99` onto
  `1900 + year` and would turn a configured `26` into 1926.
- **`lib/config-keys.ts`** — `date.earliestYear` (`2024`) and `date.futureDays` (`31`), both read by
  the existing `num()`. Nothing else needed an edit: `prisma/seed.ts` tops up missing keys from
  `CONFIG_DEFAULTS` in every mode, `/admin/config` renders every `PayrollConfig` row generically,
  and `lib/config-form.ts`'s `cfg` arm already covers a non-negative number (its "18 keys" comment
  became 20).
- **Five call sites, one new flag `err=dateRange`** (never `err=date`): `/ot` `add`, `/sales` `add`
  (this page had no `PayrollConfig` read at all and has one now), `/classes` `add`,
  `/sync/review` `resolve`, and `parseOtPaste` — which takes the window as a **required** third
  argument and fills a fifth bucket, `outOfWindowDates`, rendered as its own `WarningCard`.
- **§4**: `app/sync/review/page.tsx` was 449/500 (warn at 450) before the guard, so its five refusal
  notices moved to `_components/refusal-notice.tsx`; the page is 445 now. No other file came close.
- **Pins** (§7): `lib/date-window.test.ts` **new at 6, raised to 8 in the fix round below** ·
  `lib/ot-import.test.ts` **13 → 14**. Both
  are raises, neither is a lowering, and the reasons are in
  [.docs/knowledge/ops/junit-pin-history.md](../../.docs/knowledge/ops/junit-pin-history.md).
- **Cards** (§5): new [domain/date-window.md](../../.docs/knowledge/domain/date-window.md) + its
  index row; substantive updates to `form-refusals.md`, `ot-paste-import.md`,
  `money-input-guards.md` and `ops/junit-pin-history.md`; a dated note on the five cards that source
  a file this change touched incidentally (`colour-gap-states`, `sheet-colour-rules`, `pair-guards`,
  `money-on-screen`, `payroll-rules`, `config-form-parses`).

### Fix round — the non-blocking review findings, folded in rather than deferred

Both lanes returned PASS; these five were the findings worth doing in the same card.

1. **`dateWindow` now throws on a window that cannot work** (`payroll-auditor` 2 + 3, one guard):
   `earliest > latest` — reachable from `/admin/config`, whose `cfg` arm takes any non-negative
   finite number, so `date.earliestYear = 2027` saves cleanly and refuses **every money write in
   the app at once** (~640 ฿/day of OT alone, inside §6's three-day window) — and a bound that is
   not a representable `Date` (`date.futureDays` ≳ 1e8 ⇒ `latest` Invalid ⇒ `withinWindow` false
   for everything *and* four `renderWindow.toISOString()` sites raising `RangeError` outside any
   try/catch). Thai messages in `num()`'s own voice, each naming its own key; `earliest === latest`
   stays legal. `now` is checked separately so a caller's bad clock cannot be reported as a config
   fault. **Pin 6 → 8**, a raise.
2. **The "does not close" lists stopped overclaiming** (`payroll-auditor` 1, the one that mattered):
   the sheet parser is not behind this window at all — see the bullet above and
   [date-window.md](../../.docs/knowledge/domain/date-window.md), both now pointing at ใบ 089.
3. **Card corrections** (`code-reviewer` 2, `payroll-auditor` 4): `date.futureDays` buys
   **forward**-dating, not the back-dated case the table described (that is `date.earliestYear`);
   and a note that `/sales` and `/sync/review` had **no** config read before this card and now die
   at render on a missing key — remedy, re-run the seed — with `/sync/review` the most expensive of
   the four to have dark, being the screen whose job is making lost money visible. ⚠️ **That last
   half is no longer true**: the second fix round below tags `num()`'s throw too, so a missing key
   now reports *on* the page instead of taking it down. Left as written because it is the record of
   what the first round shipped.
4. **Spec §4** (`darin-payroll-system.md`, §3's edit order): the enumerated "ห้าม hardcode" list was
   two keys short of `lib/config-form.ts`'s 20. Item 13 added, in Thai (§2.5 — that file is
   client-facing).
5. **The remedy sentence reached `/classes` and `/sync/review`** (`code-reviewer` 1,
   `payroll-auditor` 6). 🔑 **`/sales` deliberately keeps none**: it is
   `requireRole("owner", "admin", "counter")` and `counter` cannot open `/admin/config`, so the
   sentence would name a door its reader cannot use. Written into the code as a comment, since the
   asymmetry looks like an oversight from inside any one of the four files.

### Counter-test (ใบ 067), 2026-09-24 — one mutant at a time, via `scripts/counter-test.sh`

| Mutant | Result |
| --- | --- |
| `new Date(0)` + `setUTCFullYear` → `Date.UTC(year, 0, 1)` | **1 fail** — the two-digit-year arm, and only it |
| inclusive `>=`/`<=` → exclusive `>`/`<` | **1 fail** — the edges arm, and only it (every other arm's dates are interior) |
| `outOfWindowDates.push` → `invalidDates.push` (the cheap fix) | **1 fail** — `lib/ot-import.test.ts`'s new arm, on `expect(invalidDates).toHaveLength(1)` |

Fix round, same method:

| Mutant | Result |
| --- | --- |
| the `earliest > latest` throw removed (back to refusing everything in silence) | **1 fail** — the inverted arm, and only it |
| both `Number.isNaN` bound checks removed | **1 fail** — the unrepresentable-bound arm, and only it |
| `earliest > latest` → `>=` (the plausible "tidy-up") | **1 fail** — the inverted arm, on the one-day window that must **not** throw |

### Second fix round — the regression the **first** fix round introduced

`payroll-auditor` returned PASS on the delta and found one **Major** that is not pre-existing, so it
was fixed here rather than carded. Four items.

1. 🔴 **The render-path throw took each page's correction surface down with its write surface.**
   All four screens called `dateWindow(…, new Date())` in the page body, outside any try/catch.
   Before the throw existed an inverted window left them **rendering** (both bounds were valid
   `Date`s) and refused only the dated writes, so every dateless action kept working — `del` on
   `/sales` `/classes` `/ot`, `bulkIgnore` on `/sync/review`. After, the page 500s before any of
   them reaches the screen. **Measured:** a 30,000 ฿ Premium membership entered twice on `/sales`,
   then an admin mistypes `date.earliestYear`. *Before:* the counter sees both rows, deletes the
   duplicate, the run pays `30,000 × 10%` = 3,000 ฿ once (§2.2 `comm.membership.full`). *After:*
   `/sales` is a redacted 500, the duplicate can be neither seen nor removed, and a run approved
   first pays **6,000 ฿**. Same shape, 250 ฿ a duplicate ว่ายน้ำ คาบ on `/classes` (§1.2).
   **The fix keeps the throw where refusing is correct and catches it where it is not:**
   `dateWindow` on the action path (unchanged), new `windowForRender` on the render path returning
   `{ bounds } | { fault }`. The page renders, the period table and every dateless action stay
   reachable, `WindowFaultNotice` (one component, four screens) prints the module's own sentence
   with both offending numbers and the remedy, and the dated form is disabled — a refusal that can
   be predicted belongs before the typing (§2 rule 4: the refusal has to be *useful*). On
   `/sync/review` "the form" is `editable` on `ReviewTable`: the date box and the trainer select go
   read-only while **ข้าม** and the bulk skip keep their buttons. `/ot`'s paste form takes the same
   `disabled` prop — it is a dated write too.
   ⚠️ **The catch is narrow**: a new `DateWindowError` tags every failure this module can decide on
   (including `num()`'s, via `bound`), and anything else is re-thrown to `app/error.tsx` and the
   log. `catch {}` around a render is how an unrelated fault becomes a blank table.
   🔑 Side effect worth naming: because `num()`'s throw is tagged too, the *missing-key* hole item 3
   of the first round recorded — "`/sales` and `/sync/review` now die at render" — is closed by the
   same change. [date-window.md](../../.docs/knowledge/domain/date-window.md) carries the table.
2. **`app/error.tsx` misdescribed exactly the case this card's throw exists for.** The boundary said
   the commonest cause is `ค่าตั้งค่ายังไม่ครบ` and told the admin to check every field is filled
   in — but for an inverted window **every field is filled in**, two correct-looking numbers
   contradict each other, so the admin concludes config is fine and escalates the digest while the
   Thai sentence only ever reaches the server log. Added `หรือค่าที่กรอกไว้ขัดกันเอง (เช่น
   ช่วงวันที่ที่รับ)` and `และไม่ขัดกันเอง` to the instruction below it. Rarer after item 1, not
   unreachable: `parseOtPaste`'s action path still lands here.
3. **The `now`-first ordering was the one throw of the four with no test behind it.** `now` is
   checked before the two config bounds because an invalid `now` makes `latest` NaN too, so the
   obvious tidy-up ("group the three `Number.isNaN` checks") reorders it, stays green, and silently
   reports a caller's clock fault as `config date.futureDays อยู่นอกช่วง: 31` — sending the reader
   to fix a key that is already right. Arm added, asserting the **message**.
4. **The provenance disclaimer was right in ใบ 089 and contradicted in the two places it points
   at.** The `250 ฿ paid as 0 ฿ with warnings: []` sentence ended "Re-measured … and confirmed"
   here and "Re-measured during ใบ 082's review" in the card. Only the **arithmetic** was measured
   (`y = 226` survives both arms of `lib/parser.ts:77-79`; `Date.UTC`'s remap covers `0..99` only);
   the end state was **traced by reading** — no sync has been run against a fixture. Both lines now
   say so.

**Pin: `lib/date-window.test.ts` 8 → 10**, a raise. The auditor asked for one arm (item 3); the
second pins `windowForRender` itself, because item 1's whole fix is "this call does not throw" and
nothing else would go red if someone put `dateWindow` back in a page body. The `throw e` arm has no
reachable input — every failure the module can decide on is tagged — so it is reviewed, not tested,
and the test file says so where the arm would go.

### Counter-test, second fix round (ใบ 067), 2026-09-24

| Mutant | Result |
| --- | --- |
| `windowForRender`'s try/catch removed (render path throws again — the regression itself) | **1 fail** — the `windowForRender` arm, and only it |
| the `now` check moved below the two bound checks (the "group the NaN checks" tidy-up) | **1 fail** — the ordering arm, and only it; the other nine stay green, which is the point |
| `if (e instanceof DateWindowError)` dropped (the `catch {}` direction) | **green** — no reachable input can throw anything else today, so the narrowness is a type-level guarantee, documented in the test file rather than pinned |
| `disabled={!win.bounds}` removed from `/sales`'s `<fieldset>` | **green** — `bun test` has no DOM and no DB lane (`tasks/todo/015-db-test-lane.md`); the disabled form is reviewed, not tested, exactly like the five call sites |

### Third fix round — the Minors from round 3, and one decision taken differently

Both lanes returned `VERDICT: PASS`. Six items, all in the working tree of this card.

1. 🔴 **`display: contents` removed rather than verified.** `code-reviewer` could not establish that
   a disabled `<fieldset className="contents">` preserves the grid: both bundled Chromium binaries
   fail to start here, `caniuse-lite` reports `css-display-contents` as **partial** in all three
   engines with the note text stripped, and the class applies on **every** render, not only in the
   fault state ⇒ an engine that ignores it collapses `md:grid-cols-4` / `-5` to one column on three
   money screens permanently, and `develop` auto-deploys with no browser anywhere in the pipeline.
   Decision: **do not ship an unverifiable dependency and do not ask a human to eyeball it.** The
   grid moved onto the `<fieldset>` and the `<form>` is now the plain `card` wrapper:
   `className="grid gap-2 border-0 p-0 m-0 min-w-0 md:grid-cols-N"`. `min-w-0` is load-bearing — a
   fieldset defaults to `min-inline-size: min-content`, which stops grid children shrinking and is
   the classic way one silently widens a layout; `border-0 p-0 m-0` clears its default chrome.
   `gap-2` is kept as it was on all three (the brief's snippet wrote `gap-3`; changing it would be
   an unrequested visual change). `PasteForm` took the same move in its own shape: the fieldset now
   carries `flex flex-col gap-2 …`, and the `<form>` keeps a column of its own for the four warning
   boxes, which stay **outside** the fieldset because they must remain readable while the paste is
   disabled. The three comments asserting that `contents` keeps the columns are gone; each file now
   says the grid is on the fieldset *so that* no `display: contents` behaviour is relied on.
2. **`WindowFaultNotice` told `/sync/review`'s reader to do something that screen cannot do**
   (`payroll-auditor` 1). The shared third sentence said *"ถ้าเจอรายการซ้ำ ให้ลบได้เลย"*, but that
   screen has **no delete** — its one enabled button is **ข้าม**, which writes
   `status: "ignored", reviewed: true` = this คาบ is not paid. Worked example: window inverted on
   the 29th, a queue of 12 June ว่ายน้ำ คาบ read as permission to clear duplicates ⇒
   `12 × 250 = 3,000 ฿` off the draft slip with the queue showing clean (§1.2). New
   `surface?: "rows" | "review"` prop selects that sentence only; the review copy says plainly that
   **ข้าม แปลว่า ไม่จ่ายคาบนี้ ไม่ใช่การลบรายการซ้ำ** and to leave the คาบ in the queue if unsure.
3. **The missing-key case landed in a box whose remedy does not exist** (`payroll-auditor` 2). Since
   `bound()` re-tags `num()`, a missing or blank key renders in this notice, whose remedy is *"แก้ค่า
   … ที่หน้าตั้งค่า"* — but `/admin/config` renders only rows that **exist** (ใบ 044), so a missing
   key has no field to edit. `app/error.tsx`'s sentence (*"ถ้าไม่เจอช่องที่ขาด … ให้แจ้งคนที่ดูแล
   เซิร์ฟเวอร์"*) is now printed here too, unconditionally: it is true of both causes.
4. 🔴 **`bound()`'s narrowness guarantee moved to this module's boundary** (`payroll-auditor` 3 —
   what the green `instanceof` mutant of round 2 was hiding). `num()` now throws its own
   **`ConfigError`** (`lib/config-keys.ts`, so the message keeps its single home — §2 rule 3, task
   013 item 4), and `bound()` re-tags **only** that. A `cfg` that is not the shape it claims, or a
   fault a later edit adds inside `num()`, now reaches `app/error.tsx` and the log instead of an
   amber box on four screens blaming the two date keys. **Pin: `lib/date-window.test.ts` 10 → 11**,
   a raise — the dropped-`instanceof` mutant is reachable at last and is pinned as *not* a
   `DateWindowError`, never as a bare `.toThrow()`, which would stay green if the catch were widened
   back and the re-tag re-added.
5. **`lib/config-keys.ts`'s new three-line comment translated to English** (§2.5 — new comments are
   English for token cost; the two `note:` values beside it are UI strings and stay Thai).
6. **One discriminant across all four screens.** `/sync/review` gated `editable` on `!win.fault`
   while the other three gate their `<fieldset>` on `!win.bounds`. Provably equivalent through the
   `RenderWindow` union, but a reader has to prove that first ⇒ all four now read `win.bounds`.

⛔ **Item 5's second half was NOT applied — its premise does not hold.** The round asked for
"`ต้องเป็นจำนวนเต็มวัน`" on the unrepresentable-bound message, on the reading that `MakeDay` returns
NaN for a non-integral day. **Measured 2026-09-24 on this Bun: it does not.** `MakeDay` takes
`ToIntegerOrInfinity` of each argument, so the fraction is truncated toward zero —
`setUTCFullYear(2026, 8, 24 + 0.5)` is the 24th, `date.futureDays = 31.9` is 31, `2024.9` is 2024.
Nothing fractional reaches that throw, so naming integrality there would state a cause that cannot
have produced it — the same defect the message was being corrected for, in the mirror direction. The
message is unchanged, the measurement is recorded next to it and asserted in the test file (inside
the existing unrepresentable-bound arm, so no pin moves) **as a record, not an endorsement**, so
whoever later decides a fraction should be *refused* changes that line deliberately. ⚠️ What is
actually true: a fractional `date.futureDays` silently shortens the window (`0.5` ⇒ ends today).
The bounds are printed on screen by the `dateRange` notice, so it is visible rather than silent —
left for the orchestrator to card if it is worth a guard.

### Counter-test, third fix round (ใบ 067), 2026-09-24

| Mutant | Result |
| --- | --- |
| `if (e instanceof DateWindowError)` dropped from `windowForRender` — the same mutant that came back **green** in round 2 | **1 fail** — the new re-throw arm, and only it. This is what item 4 bought |
| `bound()` back to catching everything (`catch (e) { throw new DateWindowError(…) }`) | **1 fail** — the same arm: a `TypeError` re-tagged as a `DateWindowError` becomes a printed `fault` instead of reaching the log |
| `/sales` reverted to `grid` on the `<form>` + `className="contents"` on the `<fieldset>` | **green** — `tsc`, all 246 tests and `prettier` pass. Expected and stated rather than worked around: there is no DOM lane and no browser in this pipeline (`tasks/todo/015-db-test-lane.md`), which is **the argument for item 1**, not a gap in it — an unverifiable dependency was removed instead of being asserted |

### Fourth fix round — the half of the `ConfigError` delta that carried the money

1. 🔴 **`windowForRender`'s missing/blank-key behaviour was a claim with copy written for it and no
   assertion behind it** (`payroll-auditor`, BLOCK). Round 3's arm pins only that **`dateWindow`**
   throws on a blank or missing bound. What the four screens *do* with one — land in the amber box
   rather than on the error boundary — is the precise case `ConfigError` was created for, is stated
   in prose in `app/_components/window-fault-notice.tsx`, and is why that component's heading was
   rewritten to `ค่าช่วงวันที่ที่ระบบรับ ยังใช้ไม่ได้`. Counter-tested by the auditor and re-run
   here: revert the three throws in `lib/config-keys.ts` from `ConfigError` back to `Error` — one
   word, `bound()`'s narrow catch left exactly as shipped — and the suite stays **green** while
   `windowForRender` throws again and the four screens 500 on a key that is merely absent.
   **Pin: `lib/date-window.test.ts` 11 → 12**, a raise. The new arm asserts the **message** of both
   shapes (`/ไม่พบ config/`, `/เว้นว่าง/`), because `num()`'s two sentences are two different
   remedies: a missing key has no field on `/admin/config` at all (ใบ 044), a blanked one has.
2. **A sentinel that could not fire, made real.** The non-`DateWindowError` arm's
   `try { … throw new Error("…swallowed…") } catch (e) { expect(e).not.toBeInstanceOf(…) }` is green
   in exactly the case it was written to catch: if `windowForRender` ever stops throwing, the
   sentinel `Error` lands in the same `catch` and satisfies `not.toBeInstanceOf(DateWindowError)`.
   It now asserts `toBeInstanceOf(TypeError)` with `expect.hasAssertions()`. No pin moves — same
   test, one more assertion.

⛔ **The auditor's reachability argument for item 1 is wrong, and the corrected version is what is
recorded.** It wrote that deploy is `git pull` + `docker compose up -d --build` "with no seed step in
it", so a live database can sit with `date.earliestYear` absent. Verified false:
`docker-compose.yml` gives `app` `depends_on: migrate: condition: service_completed_successfully`,
and `migrate` (`Dockerfile`) is `CMD sh -c "bunx --bun prisma db push && bun run prisma/seed.ts"`, so
the seed runs on **every** `docker compose up -d --build` and `prisma/seed.ts` backfills missing
`CONFIG_DEFAULTS` keys in every mode. It also contradicts what the same lane reported in two earlier
rounds and what `code-reviewer` reported independently. ⇒ the missing-key path is reachable on an
**unseeded developer database or a row deleted by hand**, not on the deployed site. 🔑 **The test is
required regardless**: its value is that it pins a documented behaviour against a one-word refactor,
and that does not depend on how the bad state is reached.

### Counter-test, fourth fix round (ใบ 067), 2026-09-24

| Mutant | Result |
| --- | --- |
| the three `throw new ConfigError(…)` in `lib/config-keys.ts` reverted to `throw new Error(…)`, `bound()`'s catch untouched — the one-word refactor | **1 fail** — the new `windowForRender` missing/blank arm, and only it (`243 pass / 3 skip / 1 fail` against the `243 / 3 / 0` the same mutant produced before this round). Restored via `scripts/counter-test.sh restore`, hash-verified |

### Decisions the card did not pre-decide

- **`now` is taken twice, on purpose.** Each *action* builds its window from its own `new Date()` at
  the moment of the write; the *page* builds a second one at render only to print the bounds in the
  Thai notice. Rendering the bounds rather than typing them keeps §2 rule 3 honest — a copy that
  repeated "2024" would go silently wrong the first time the key moved.
- **The parse's window argument is named `acceptWindow`, not `window`** — `window` shadows the DOM
  global in a file that is type-checked with the DOM lib.
- **`lib/ot-import.test.ts` uses a written-out window fixture**, not one derived from
  `CONFIG_DEFAULTS`: that file is about the parse, and a fixture that moves with a config default
  would make its cases fail for a reason that is not theirs. The bounds are pinned next door.

## Notes

- Found by `payroll-auditor` in the ใบ 080 audit; every line of the table above was re-run by hand
  before this card was opened.
- ⚠️ **[form-refusals.md](../../.docs/knowledge/domain/form-refusals.md) is at 169 lines of the
  170-line warn** (`scripts/check-knowledge.sh`; hard cap 200). It is a `sources:` card for the
  four screens this card touches, so the next change that lands on it must **split it by topic**
  — the split it has taken twice already, at ใบ 068 and ใบ 083 — rather than discover the warn
  mid-task and reclaim room by deleting old lines (§5, and `check-knowledge.sh`'s own comment on
  why the warn exists 30 lines early).
- [date-window.md](../../.docs/knowledge/domain/date-window.md) is at **169/170** after this
  round for the same reason; it is the next one due to split.
- The related-but-different gap on the same screen is
  [081](../todo/081-the-review-screens-queue-guard-and-its-remaining-silences.md) — that one is about queue
  membership, this one about the date. They land in the same action and should not be merged: one is
  a predicate shared by four screens, the other is one screen's own guard.
- Related: [014](014-ot-import-atomicity.md) ·
  [072](072-the-one-row-ot-form-still-stores-a-rolled-over-date.md) ·
  [080](080-three-more-money-writes-still-take-an-unguarded-date.md) ·
  [079](../todo/079-periodRange-accepts-aliases-for-one-month-and-payslips-are-keyed-by-the-string.md)
  (the same family on the period key rather than the row's day).
