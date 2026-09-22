---
sources:
  # Rule 4's `num()` rule for reading `ot.thresholdHours`/`ot.ratePerHour` outside the engine — the
  # only claim left about this file since task 011 deleted the `เป็นเงิน` column it used to also
  # document.
  - app/ot/page.tsx
  # The same `num()` claim about `class.minAttendees`/`class.halfRatio`, and what the table shows
  # now that task 011 deleted `มูลค่า` ⇒ re-adding a `?? 3` fallback (or a derived column) must go
  # STALE instead of leaving this card advertising a ratio the engine no longer agrees with.
  - app/classes/page.tsx
  # ใบ 065 moved the คาบ table out of that page and into this component, and this card states that
  # nothing in it is derived (only the stored `ที่มา` flag was added) ⇒ re-adding a `มูลค่า` column
  # has to land here as STALE, exactly as it would have before the move.
  - app/classes/_components/session-table.tsx
  # Rule 4's named residue: this screen still *sums* already-rounded `Payslip.net` in the page
  # (task 019). Closing 019 must land here rather than leave the card naming a hazard that is gone.
  # The screen's other half — `setStatus` as the second half of the status lock — belongs to
  # [payslip-lifecycle.md](payslip-lifecycle.md), which lists this file for that claim.
  - app/payslips/page.tsx
  # The other half of that residue — `/` sums `Payslip.net` in the page too, and was sourced by no
  # card at all until task 023 ⇒ closing 019 in one file only must not go unnoticed here.
  - app/page.tsx
  # Not a screen: the *"why the deleted columns were dangerous"* section quotes this file's
  # reference answer verbatim (13.33 · qty 0.33 · 266.67 over 20 days). It came across from
  # [payroll-rules.md](payroll-rules.md) with the prose at task 042, because a card that quotes a
  # test's numbers and does not list it goes green while the numbers rot (§5, and the same fix task
  # 037 made for `class.test.ts`).
  - lib/payroll/ot.test.ts
---

# Money on a screen — what a page may display, and what it may never compute

Split out of [payroll-rules.md](payroll-rules.md) at task 042, at the seam that card's own
`sources:` list already drew: the engine's rules are claims about `lib/payroll.ts`, these are claims
about its **callers** in `app/**`. Nothing was shortened in the move.

- The engine's half is **rule 4** there (`money()` rounds once, at the end) and **rule 1** (every
  rate, threshold and percentage lives in `lib/config-keys.ts` and is read at runtime).
- The **write** side — the guards a number passes before it is stored — is
  [money-input-guards.md](money-input-guards.md) (the predicate) and
  [form-refusals.md](form-refusals.md) (which action refuses what, and how it says so).

## No screen computes money (task 011 — linus's ruling, option 1)

`/ot` and `/classes` used to preview a baht column (`เป็นเงิน`, `มูลค่า`) built from a second formula
living outside `lib/payroll.ts` — a straight rule-2 violation. Task 011 deleted both columns rather
than give the duplication a shared seam: `/ot` now shows `ชั่วโมง`/`ชม. OT` as hours (a
**display-only** 2 dp formatter, never `money()` — hours are not baht), and `/classes`'s table is
`วันที่`/`คลาส`/`ผู้สอน`/`จอง`/`no-show`/`เข้าจริง` plus the delete column, with no derived amount
left in it. `money()` stays exported from `lib/payroll.ts` but as of 011 has **no caller outside
that file**.

⚠️ **ใบ 065 added a `ที่มา` column to that table** (`คีย์เอง` / `นำเข้าจาก Gymmo`, read off
`ClassSession.sourceKey`) and moved the table into `app/classes/_components/session-table.tsx`. It is
provenance, not an amount: no rate, threshold or percentage is applied, and the rule above is
unchanged — the add-form's `<option>` still shows the stored `({c.price})` and nothing else on the
screen is derived.

## The line is *computed* vs *displayed*, not "no baht on screen"

🔑 The payslip is the only place a baht figure is **computed**. Any screen may **display a stored or
configured amount unchanged** — `Payslip.net`, `Sale.netPrice`, `ClassPrice.price`, a rate out of
`PayrollConfig` — and may **not derive one** (no rate, threshold or percentage applied anywhere in
`app/**`). Read the wrong half of this and you either strip a read-only figure the counter staff
need (`/` shows `ยอดขายในงวด`/`รวมจ่ายสุทธิ`, `/payslips` a period total, `/sales` `netPrice`,
`/admin/config` the rates and ฐานเงินเดือน, `/classes`'s add-form `<option>` the stored
`({c.price})`) or you "fix" a total by computing something new, which is the actual violation.

## The one residue, named so it is not re-discovered as a scandal

`app/page.tsx:43` and `app/payslips/page.tsx:70` still **sum** already-rounded `Payslip.net` values
inside the page. No rate or threshold is applied, so it is not a second answer to *what is this
worth* — but it is arithmetic on baht in `app/**`, and it has the shape this rule tells you to
distrust: an unrounded aggregate of already-rounded parts. Carded as task **019**; do not close it
here by inventing a formula.

## Why the deleted columns were dangerous, for the record

`/ot` once fed a *rounded* intermediate into its own multiplication — `money(money(h − threshold) ×
rate)` — while the engine rounds only the final amount. A fingerprint export writes 9:20 as
`9.333333333333334`: the engine pays `money(0.3333… × 40)` = **13.33**, the screen showed
`money(0.33 × 40)` = **13.20**; over 20 such days, 266.67 ฿ paid against 264.00 ฿ shown — invisible
to a spot check because clean 2-dp hours agree either way. `lib/payroll/ot.test.ts` still carries the
engine's answer for this exact case (13.33 · qty 0.33 · 266.67 over 20 days) as a **reference
figure** — it asserts `computePayslip`, whose OT block was never wrong, so it proves a future
disagreement rather than fencing a screen; there is no screen arithmetic left to fence. A baht
preview proposed again anywhere must call `lib/payroll.ts`'s formula, never re-derive it (option 2
on the 011 card).

## Reading a rate or threshold outside the engine follows rule 1 exactly

`num(cfg, key)`, never `Number(...?.value ?? 40)`. Both `/ot` (`ot.thresholdHours`,
`ot.ratePerHour`) and `/classes` (`class.minAttendees`, `class.halfRatio`) read their explanatory
`<p>` text this way: `num()` throws when a key is missing, so the screen's copy fails the same way
the payroll run does, instead of a screen inventing a value and looking right while the run dies
on it.

🔑 **ใบ 014 rewrote `/ot`'s paste action and moved neither claim this card makes about that file.**
The write is now one `$transaction` (`deleteMany` + `createMany`) with three rejection buckets in
front of it, and the hours formatter and both `num()` reads are untouched — no baht is computed on
that screen and no rate has a fallback. The buckets themselves belong to
[form-refusals.md](form-refusals.md); recorded here only so the next reader does not go looking for
a change to the rules above that is not there.

## A screen may also be the only place a **silence** is reported

The banner blocks on `/` and `/payslips` are not arithmetic, but they are on this card because they
are the screen's half of §2 rule 4. Two of them say the run will pay **short**; ใบ 043 added the one
that says it will pay **long** — สีพื้นที่ยังไม่มีใครรับรอง, from `runBlockers().colorGaps`
([colour-gap-states.md](colour-gap-states.md)). 🔑 **It has to be a screen and cannot be a
`PayslipWarning`**: such a คาบ looks ordinary in the row, so the slip has nothing to warn about and
the engine is right not to. 🔑 And the banner must survive the owner *answering* — a colour ruled
"ไม่จ่าย" whose คาบ have not been re-synced is still being paid, which is the moment the money is
most wrong and the last moment a screen should go quiet. The copy names the direction out loud rather than borrowing
the wording of the two beside it — "จะจ่ายขาด" and "จะจ่ายเกิน" are opposite instructions to the
person reading them.

📌 **ใบ 070 changed the last clause of that banner on both screens, and only the clause.** It used to
end *"คาบที่ตรวจด้วยมือแล้ว … ยังไม่มีหน้าจอไหนแก้ได้ — ต้องรอทางแก้"*; there is a screen now, so it
names it (`/sync/review?hex=`, reached from the swatch itself). 🔑 What did **not** change is the
sentence beside it: re-ruling the colour to "จ่ายปกติ" is still forbidden as a way to make the warning
go away, on both screens, because an exit that exists does not make the wrong exit any less wrong.
