---
sources:
  # The predicate and its pin. Both are this card's whole subject.
  - lib/date-window.ts
  - lib/date-window.test.ts
  # The render-path surface of the same predicate, shared by all four screens. The `?err=` notices
  # beside it stay [form-refusals.md](form-refusals.md)'s — this one is not a field refusal, it is
  # the window itself reporting that it cannot be built.
  - app/_components/window-fault-notice.tsx
  # The two keys the window is made of. ⚠️ Shared with [money-input-guards.md](money-input-guards.md)
  # (which owns `num()` and counts the key set) — two cards, one file, one claim each, and they go
  # stale together. The same arrangement `form-refusals.md` and `sheet-colour-rules.md` have on
  # `app/sync/review/page.tsx`.
  - lib/config-keys.ts
---

# ช่วงวันที่ที่ระบบยอมรับ — ด่านที่สองของวันที่ ที่ `calendarDate` ตอบให้ไม่ได้

Opened at ใบ 082. Read [form-refusals.md](form-refusals.md) first for the `?err=` surface these
five call sites report through, and [ot-paste-import.md](ot-paste-import.md) for the paste's
buckets; this card owns the **predicate** and the two keys behind it, nothing else.

## The hole, measured

`calendarDate` (`lib/ot-import.ts`, ใบ 014 / 072 / 080) round-trips the ISO day back out of the
`Date`, which is what catches `2026-06-31` silently becoming `2026-07-01`. It asks whether the day
**exists**. It does not ask whether the year is one this gym could have operated in — and every one
of these was **ACCEPTED**, round-tripping back exactly as typed:

```
0226-06-05   0206-06-05   0026-06-05   9999-12-31   0001-01-01
```

A Chrome/Firefox date picker's year box takes three digits and zero-pads, so `0226` comes from an
ordinary slip of the hand, not from a crafted post. The row then lands outside **every**
`periodRange` (`0226-06-05` is not in `[2026-06-01, 2026-07-01)`) ⇒ it is in **no** payslip at all,
which is worse than the wrong month the ใบ 080 guards were written for.

🔴 **`/sync/review` is where it is permanent.** ยืนยัน on a June ว่ายน้ำ คาบ retyped with year
`0226` writes `status: "ok", reviewed: true` — the คาบ **leaves the queue**, reaches no period, and
`reviewed: true` stops every later sync repairing it ⇒ **250 ฿ paid as 0 ฿, for ever, with the queue
showing clean.** `/sales` and `/classes` are semi-self-revealing (the row is missing from the period
table the operator is looking at); `/ot` and the paste are not.

## The decision — a configured operating window, not the screen's period

ใบ 082 weighed the page's own `period` against a config'd window and chose the window:

1. 🔴 **The screen's period has no in-UI escape hatch today.** `/ot`, `/sales` and `/classes` read
   `period` from `searchParams` and default it to the clock, and **none of them renders a control
   that changes it**. Binding the row's date to that period would refuse the most ordinary entry
   there is — yesterday's OT typed on the 1st of the next month — leaving a hand-edited URL as the
   only remedy. That is §2 rule 4 in its **mirror** direction: hours not paid because the guard was
   too tight. (The month controls are ใบ 088; this is a "today", not a "never".)
2. **`parseOtPaste` has no page context at all**, so a window is the one shape all five callers take
   unchanged ⇒ one predicate, not a per-caller special case.
3. **§2 rule 3 wants the bounds in `PayrollConfig`**, and a window has a config shape. A period
   bound is whatever the URL says — that option answers rule 3 by dodging it.
4. **A year is enough granularity** ⇒ two numeric keys, read with the existing `num()`: no new
   accessor, no new value type, no `/admin/config` rendering case (that screen renders every
   `PayrollConfig` row generically, and `prisma/seed.ts` tops up missing keys in every mode).

| Key | default | what it bounds |
| --- | --- | --- |
| `date.earliestYear` | `2024` | 1 January of this year is the earliest day accepted |
| `date.futureDays` | `31` | days past **today** still accepted — a month of **forward** grace, so a คาบ or an OT row entered before the day it falls on is not refused |

⚠️ The two keys cover the two directions and are not interchangeable: `date.earliestYear` is what
buys **back**-dating (the 31st typed on the 1st, a backfill of last quarter), `date.futureDays` buys
**forward**-dating. An earlier draft of this table described `futureDays` with the back-dated case,
which would send whoever needs a longer backfill to move the wrong key.

## The shape, and the three traps in it

`lib/date-window.ts`, two exports, both pure — no DB, no clock of its own, `now` from the caller:
`dateWindow(cfg, now) → {earliest, latest}` and `withinWindow(d, w) → boolean`.

- ⚠️ **Not folded into `calendarDate`.** That helper answers *does this day exist, and is it the day
  that was written*, and is shared by a parse with no page context. A window is a different question
  with a different owner, and `0226-06-05` is the proof: `calendarDate` is **right** about it.
- 🔴 **Both edges are inclusive.** 1 January of the earliest year is an ordinary working day, and
  `now + futureDays` is the last day the grace was bought to cover. Both edges and both neighbours
  are pinned (`lib/date-window.test.ts`) because the bounds are exactly what a future reader will
  want to shrink.
- 🔴 **`new Date(0)` + `setUTCFullYear`, never `Date.UTC(year, …)`** — `Date.UTC` maps `0..99` onto
  `1900 + year`, so an `earliestYear` of `26` would silently become **1926** and the window would
  swallow this whole class of defect. Pinned by its own arm.
- **A blank or missing key throws** (`num()`, task 013 item 4) rather than defaulting to 0. A silent
  zero here is the guard running backwards: `earliest` at year 0 and `latest` at today ⇒ tomorrow
  refused, the year 226 accepted.
- 🔴 **An *empty* or unrepresentable window throws too, in `num()`'s own voice** (added in ใบ 082's
  fix round). Nothing checked `earliest <= latest`, and `/admin/config`'s `cfg` arm accepts any
  non-negative finite number ⇒ `date.earliestYear = 2027` saves cleanly and **every money write in
  the app is refused at once** — the fingerprint paste, every bill, every คาบ, every ยืนยัน
  (~640 ฿/day of OT alone, inside §6's three-day window for variable pay), with nothing on screen
  saying why. Same throw for a bound that is not a representable `Date` (`date.futureDays` above
  ~1e8 ⇒ `latest` is an **Invalid Date**), which additionally made the four pages'
  `renderWindow.toISOString()` raise `RangeError` outside any try/catch — a server error page with
  the Thai cause redacted in production. Each message **names its own key**, and `earliest ===
  latest` (a one-day window: tight, but honest) is deliberately *not* refused.
  🔑 **The throw cannot lock anyone out of its own remedy**: `/admin/config` is the one screen that
  never calls `dateWindow` (checked — the five callers are `/ot`, `/sales`, `/classes`,
  `/sync/review` and `parseOtPaste`), so a window configured inverted is still editable back.

⚠️ **Each of the five callers builds the window from its own `new Date()` at the moment of the
write, but from the `Config` its *page* loaded.** So a bound edited in `/admin/config` while a
`/sync/review` tab sits open is one page load behind for that tab. Stated rather than fixed: the
window is a month wide and a year deep, so a stale bound cannot change a verdict that is not already
at the edge — and re-reading `PayrollConfig` inside every action would buy a DB round trip per write
for it. Revisit if the window is ever tightened.

## The throw refuses the **write**; the render is caught — `dateWindow` vs `windowForRender`

🔴 **This split is a fix of the fix** (`payroll-auditor`, ใบ 082 second review round). The first
round put the throw on both paths, and on the render path that was a regression: it took each
page's *correction* surface down with its write surface. Before the throw, an inverted window left
all four screens **rendering** — both bounds were valid `Date`s — and refused only the dated writes,
so everything taking no date kept working. With `dateWindow(cfg, new Date())` at the top of a page
body, the page 500s before any of it reaches the screen.

**Measured, and it is the reason the split exists.** A 30,000 ฿ Premium membership is entered twice
on `/sales`; that evening an admin mistypes `date.earliestYear`. *Before:* the counter opens
`/sales`, sees both rows, deletes the duplicate, the run pays `30,000 × 10%` = 3,000 ฿ once
(§2.2 `comm.membership.full`). *With the throw on render:* `/sales` is a redacted 500, the duplicate
can be neither seen nor removed, and a run approved before somebody fixes the key pays **6,000 ฿**.
Same shape, 250 ฿ a duplicate ว่ายน้ำ คาบ on `/classes` (§1.2).

| Path | Call | Behaviour when the window cannot be built |
| --- | --- | --- |
| server action (`add`, `resolve`, `paste`) | `dateWindow` | **throws** — refusing a dated write is correct |
| page body (all four screens) | `windowForRender` | `{ bounds: null, fault }` — page renders, `WindowFaultNotice` prints the module's own sentence with both numbers and the remedy, the dated form is a `<fieldset disabled>` **that carries the grid itself** (ใบ 082 third round: `display: contents` is only partially supported and nothing in this pipeline renders a browser, so a `className="contents"` that an engine ignored would collapse those columns on *every* render, not only in the fault state), and `del` / `bulkIgnore` / the period table stay reachable. All four screens gate on **`win.bounds`** — one discriminant, not two |

- ⚠️ **The catch is narrow on purpose**: only `DateWindowError`, everything else re-thrown to
  `app/error.tsx` and the log — a `catch {}` around a render is how an unrelated fault becomes a
  blank table nobody investigates. 🔑 **`bound()` narrowed to match at ใบ 082's third round**:
  `num()` has its own `ConfigError` and only that is re-tagged ⇒ a `cfg` that is not the shape it
  claims reaches the log as a `TypeError`, not an amber box blaming the two keys. Now pinned.
- 🔑 **`num()`'s throw is tagged too** (via `bound`), so a *missing* key now reports on the page
  instead of taking it down — closing the hole this card used to record here: `/sales` and
  `/sync/review` had no config read at all before ใบ 082, so a database that never got the two keys
  took all four screens with it, **`/sync/review`** — the screen whose whole job is making lost
  money visible — included. Remedy is still re-running the seed, and **the box says so**, because
  `/admin/config` renders only rows that *exist* (ใบ 044) ⇒ a missing key has no field to fix.
- `/sync/review`'s disabled surface is `editable` on `ReviewTable`: date box and trainer select go
  read-only, **ข้าม** and the bulk skip keep working (`.input` owns the `disabled:` tokens in
  `app/globals.css`, never a per-screen chain). 🔴 **Its notice takes `surface="review"`** — the
  other three say "ลบรายการซ้ำได้เลย" and this screen has **no delete**: its one live button writes
  `status: "ignored"` = *not paid* ⇒ 12 คาบ cleared that way is 3,000 ฿ off the slip, queue clean.

## What this does **not** close

🔴 A *plausible but wrong* year — `2025-06-05` typed for `2026-06-05` — passes this window, and on
`/sync/review` still leaves the queue into a period nobody is looking at. Catching that needs the
row bound to the month the operator is looking at, which needs a month control on the three screens
first: [ใบ 088](../../../tasks/todo/088-three-money-screens-have-a-period-they-cannot-change.md).
Stated here so nobody reads this card as covering it.

🔴 **The sheet parser — the path the data actually arrives by — is not behind this window at all.**
`lib/parser.ts` normalises a sheet year with `if (y < 100) y += 2000; if (y > 2400) y -= 543;` while
`DATE_RE` accepts **2–4 digits**, so a three-digit year falls between both arms untouched:
`5/6/226` is stored as year **226** with `status: "ok"` and a resolved trainer ⇒ it is in no review
queue and in no period, i.e. **250 ฿ paid as 0 ฿ with `warnings: []`**, on the highest-volume path
in the product. ⚠️ **The arithmetic was re-measured during ใบ 082's review; the end state was
traced by reading, not run** — `y = 226` survives both arms, but no sync has been run against a
fixture, so "no queue, no period, 250 ฿ → 0 ฿" is a read of the code. See ใบ 089's Notes. It is
pre-existing and was out of ใบ 082's scope; the card for it is
[ใบ 089](../../../tasks/todo/089-a-three-digit-year-in-the-sheet-falls-between-both-normalisation-arms.md).
Until that lands, "a year that cannot be real is now refused" is true of the **five forms**, not of
the sync.
