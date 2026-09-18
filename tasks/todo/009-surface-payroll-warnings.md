# Surface `warnings` — the engine's "I could not decide" must reach the screen

- status: todo
- commit:

## Goal

🔴 **This is a live violation of CLAUDE.md §2 rule 4, in production today.** `computePayslip`
returns `{ lines, warnings, ...totals }`. `runPayroll` throws `warnings` away:

```ts
// lib/payroll-run.ts:89
const { lines, warnings, ...totals } = result;   // ← warnings destructured out, never used again
```

There is **no** `warnings` column on `Payslip` or `PayslipLine` (`prisma/schema.prisma:212-241`),
and `grep -rn warnings app/` returns **zero hits** — the payslip a staff member actually opens
(`app/payslips/[id]/page.tsx`) has no warnings block at all. `app/payslips/page.tsx` calls
`runPayroll(p)` and discards its return value before redirecting.

Meanwhile `app/admin/config/page.tsx:204` promises the opposite to the user, in Thai, on screen:
*"…จะไม่ถูกคิดเงินและขึ้นเตือนในสลิป"*. The product makes a promise the code does not keep.

Found by `uxui-designer` and `code-reviewer` during the task 008 merge review. **Pre-existing since
the first commit `cdc580e` — not a regression from that merge**, which is why it did not block the
fast-forward and gets its own card instead.

## Why this is the expensive one

§2 rule 4 exists because money that disappears quietly is not noticed until payday. Every case the
engine cannot decide — an unknown trainer, a missing rate, a sale with nobody attributed — is
currently computed, turned into a warning, and then deleted before anyone can see it. The failure
is invisible by construction: nothing is red, a payslip is just wrong.

## Scope

Follow §3 edit order — schema → domain → screens → docs → verify.

1. **Schema.** Persist warnings against the payslip they belong to. ⚠️ §2 rule 8: `prisma db push`
   has no down path — back up before pushing. Decide with `architect` whether this is a
   `String[]` column on `Payslip` or its own model; a separate model is the better bet if a warning
   ever needs to point at the row that caused it.
2. **`lib/payroll-run.ts`** — stop discarding, write them in the same transaction as the lines.
   `computePayslip` itself stays pure (§2 rule 2) — it already returns them.
3. **Screens** — `app/payslips/[id]/page.tsx` (the one staff read) and `app/payslips/page.tsx`
   (the run summary). Route through `uxui-designer` (§9); the banner classes card 010 adds to
   `app/globals.css` are the right home for the styling.
4. **Same shape, same card: `app/ot/page.tsx:55`** collects `errors` (usernames from the
   fingerprint-scan paste that matched nobody) and never surfaces them either.
5. **Also same shape: `lib/sync.ts:86`** — `if (!grid) return []` inside the `plan` builder means
   an active sheet whose grid is missing contributes nothing and says nothing. Pre-existing (the
   old code did `if (!grid) continue`), still a silent drop.
6. **Tests** — `lib/payroll.test.ts` already asserts warning paths inside the engine; add the
   assertion that they survive `runPayroll` and reach the DB. Raise the junit pin in the same
   change (§7).
   > ⚠️ **Renegotiated during the build, and only half of this shipped.** The junit pins were
   > raised (`lib/payroll.test.ts` 21 → 23, new `lib/ot-import.test.ts` at 5). The "reaches the DB"
   > assertion is **unwritable today**: `scripts/check-code.sh` runs `bun test` at stage 4, before
   > stage 5 starts the throwaway postgres, so stage 4 has no `DATABASE_URL` — and every way around
   > that either goes red or creates an unpinned second junit report, which is the failure class §7
   > exists to prevent. The reasoning is recorded in `.docs/knowledge/ops/gates.md`, which outlives
   > this card, and the gate change itself is **task 015**.

## Notes

- `payroll-auditor` is the agent whose whole focus area 2 is this rule — run it on the result.
- Do not add a config default to "fix" an undecided rule. `darin-payroll-system.md` §7 lists the
  rules that are genuinely still open (Yoga rates, sheet colours, membership commission for a
  non-`closer` role); routing those to `warnings[]` is the **correct** behaviour. This card is
  about showing them, not about deciding them.

---

## Decisions and review record (2026-09-18)

Design: `architect` + `uxui-designer` (kept in `.scratch/009-design.md` and
`.scratch/009-ui-design.md`). Review: `code-reviewer` **BLOCK**, `payroll-auditor` **BLOCK**,
`uxui-designer` APPROVE-WITH-NITS — all findings either fixed in this card or given a card below.

**Shape shipped.** `PayslipWarning` is its own model, not a `String[]` on `Payslip` — under §2 rule
8 a `String[]` cannot gain a `sourceKind`/`sourceId` later without dropping the column, and
`runPayroll` refuses non-`draft` slips, so those warnings would not be recomputable. Rewritten
wholesale on every recompute, in the same per-staff interactive transaction as the lines, keyed
`@@unique([payslipId, seq])`. **No severity, no acknowledge/resolve state, no `/admin/warnings`
inbox** — this card shows the undecided cases, it does not decide them or build a workflow on them.

**Warnings on a slip that has left `draft` are not recomputable.** That is the deliberate cost of
the status lock, recorded in `.docs/knowledge/domain/payroll-rules.md`. Its consequence is that a
payslip computed *before* this change carries zero `PayslipWarning` rows forever, and an empty
warnings block reads as "clean" rather than "never captured".

🔴 **Required post-deploy step, not optional.** Measured on the live host on 2026-09-18 *before*
the push: **21 payslips, all `status = "draft"`, zero approved, zero paid** — so every existing slip
is still recomputable and one `runPayroll` pass per open period backfills every missing warning.
**Run that pass before approving anything.** This is why no `Payslip.warningsComputedAt`
discriminator column was added: the data said the window can be closed by a run instead of by a
one-way schema push. As belt-and-braces the list page renders `—`, not `0`, in the คำเตือน column
for a non-`draft` slip with no warnings — it errs toward "unknown", never toward "none".

**Two blockers found in review and fixed here, both of which re-created this card's own bug
elsewhere:** the durable "not synced this round" marker compared `lastSyncAt` against
`SyncRun.finishedAt` (written *after* the run) instead of `startedAt`, so every healthy sheet went
amber and the one missing sheet was indistinguishable; and the OT paste form lost its no-JS path,
so a submit before hydration silently imported nothing and a mid-import throw swallowed the
unmatched usernames entirely.

**Split out of this card, with reasons:** task **011** (`/ot` computes OT money a second time —
§2 rule 2; whether the `เป็นเงิน` column survives is linus's call) · **012** (the warning string
cites `§7 ข้อ 8`, which is a different question) · **013** (payslip lifecycle: the guard reads
status outside its transaction · `paid → draft` lets a run rewrite what was paid · inactive staff
leave stale drafts inside the period total) · **014** (an OT import that fails halfway leaves the
screen showing pre-import data) · **015** (a pinned `bun test` lane that has a database) ·
**016** ("✓ Sync เสร็จ" stays green when every sheet failed to arrive).

### Second review round (2026-09-18) — `code-reviewer` BLOCK · `payroll-auditor` BLOCK · `uxui-designer` APPROVE-WITH-NITS

🔴 **The blocker was introduced by the first fix pass, and both money gates found it
independently.** Making `/ot` round its float noise away with `money()` rounded the OT *hours* and
fed that into the baht multiplication — `money(money(h − threshold) × rate)`, i.e. §2 rule 5's
"round mid-way and round again", under a comment citing that very rule. A fingerprint export writes
9:20 as `9.333333333333334`: the engine pays **13.33**, the screen showed **13.20**; over 20 such
days 266.67 ฿ paid against 264.00 ฿ shown, on the screen whose only job is checking the import
against the payslip. Clean 2-dp hours agree, so a spot check never sees it. Fixed by keeping the
raw excess for arithmetic and rounding each *output* once.
`.docs/knowledge/domain/payroll-rules.md` rule 4 asserted the old code was fine and is corrected
with it.

⚠️ **What the new test in `lib/payroll.test.ts` (23 → 24) is, and what it is not** — corrected in
the third review round, where both gates read the first wording as a claim it does not support. The
defect lived in `app/ot/page.tsx`; the test exercises `computePayslip`, whose OT block is
**byte-identical to HEAD before this card**, so it would have gone green against the pre-fix tree.
It writes the engine's figures for a >2-decimal hours value (13.33 · qty 0.33 · 266.67 over 20 days)
down **outside the screen**, which is what makes a future disagreement provable — a **reference
figure, not a regression test**. 🔴 **The screen's own formula is untested**: re-introducing
`const otExcess = (h) => money(Math.max(0, h - threshold))` today leaves `bun test` green and puts
`/ot` back at 13.20 against 266.67 paid. Pinning it needs a testable seam (an `otDisplay()` helper
outside the page), and that is **task 011 option 2** — building it here would pre-empt linus's
decision on whether the `เป็นเงิน` column survives at all, so it was deliberately not built.

**Also fixed in this pass:**

- 🔴 **`NaN` hours could reach the database.** `OtEntry.hours` is a `Float` ⇒ `double precision`,
  which accepts `NaN`, so "it fails loudly at the DB write" was never established. `somchai,
  2026-07-01,แปด` would have written `hours = NaN`, and §2.4's `Math.max(0, NaN − 9)` turns that
  person's `otPay`, `net` and whole month into `NaN` — one character voiding one payslip.
  `parseOtPaste` now rejects a non-finite hours value into `invalidHours`, which reaches the screen
  the same way `unmatched` does. Made impossible rather than investigated, so the outcome does not
  depend on what the driver happens to refuse. Pin `lib/ot-import.test.ts` 5 → **6**.
  ⚠️ **On the paste path only** — `/ot` has a second write path, the one-row `add` form, which still
  wrote `Number(formData.get("hours"))` unchecked. Closed in the third round below.
- The stale marker fired forever on **inactive** sheets (`syncSources` only fetches
  `active: true`, so their `lastSyncAt` can never advance). Suppressed by predicate only — no
  badge, no column; whether the sources table should show `active` at all went to task **016**.
- After a **failed** run the marker went blind: one query answered both "how long does a run take"
  (must exclude failures) and "when did the last attempt start" (must include them), so every sheet
  a crashed run never reached compared clean. The marker now has its own `findFirst`; the estimator
  query is untouched.
- The `/ot` catch asserted a cause it had not established ("วันที่หรือชั่วโมงไม่ถูกต้อง" for any
  throw, including a dropped connection). It now names the row it stopped on — `rows[imported]` is
  that row — and claims nothing about why.
- UI nits: the `—` warnings state carried its meaning in a `title` alone (invisible on touch,
  unreachable by keyboard, often unannounced) ⇒ always-visible inline qualifier; and the neutral
  closed-count banner sat between the two `card-warn` boxes ⇒ moved below both.

### Third review round (2026-09-18) — `code-reviewer` APPROVE-WITH-NITS · `payroll-auditor` BLOCK

Two Majors, one of them found by both lanes independently, and the second one is about this card
itself rather than about the code.

🔴 **The `NaN`/silent-zero guard existed on one of `/ot`'s two write paths.** The bullet above
declared the hazard settled while `app/ot/page.tsx`'s `add` server action still did
`const hours = Number(formData.get("hours"))` straight into `db.otEntry.upsert`. `type="number"
step="0.25" required` is a client hint and a server action is a plain HTTP endpoint, so:
`formData.get()` returns a `File` for a crafted multipart part and `"1e999"` gives `Infinity` ⇒
`Math.max(0, NaN − 9)` is `NaN` ⇒ that person's `otPay`, `net` and stored `Payslip.net` are `NaN`,
and `app/payslips/page.tsx`'s `reduce` makes **รวมทั้งงวด** `NaN` for all eight staff; a request with
no `hours` field gives `Number(null) === 0` and `update: { hours }` overwrites a recorded 12.5 h
with a zero, net 21,570.00 → 21,430.00, the row rendering `0 / 0.00` with nothing saying a recorded
value was replaced (§2 rule 4 exactly). Fixed in that one action: a non-string or non-finite value
is rejected **before** the write and reported on screen — `redirect` to `?err=hours`, rendered as a
`card-warn` line under the add form, with the Thai copy in the source and only a flag in the URL.
The success path now redirects to the clean URL as well, so the notice cannot outlive the row that
caused it. **The same unguarded shape on `/sales`, `/classes` and `/admin/config` was left alone on
purpose and written into task 013 §4** with this finding as the precedent.

**The second Major was a documentation claim, and the fix was to correct the claim, not to write
more code.** The new OT test is a reference figure, not a regression test of the screen — see the
⚠️ block in the second-round section above, which is the corrected wording, and
`.docs/knowledge/domain/payroll-rules.md` rule 4, corrected the same way. The auditor's preferred
remedy (extract `otDisplay(hours, threshold, rate)` so a test can pin the screen) is **task 011
option 2** and was deliberately not built here: it would settle a product question — whether the
`เป็นเงิน` column survives — that is linus's. Task 011 already records the untested-formula fact
under "The pin is not a fence"; the two now say the same thing.

**Also in this round, no code:**

- `.docs/knowledge/ops/gates.md` still named the pins as `lib/payroll.test.ts` 21 → 23 and
  `lib/ot-import.test.ts` at 5; they are **24** and **6**, and the two cases that raised them (the
  OT >2-decimal figure and `invalidHours`) are now named there.
- `.docs/knowledge/domain/payroll-rules.md` documents `/ot`'s rounding contract and its `num()`
  rule but did not list `app/ot/page.tsx` in `sources:`, so §5's staleness gate would not have
  flagged the card when task 011 changes or deletes that column. Added.
- `lib/ot-import.ts:83`'s `if (!user || !date || !hours) continue` also swallows a line with a valid
  username and date but an **empty hours cell** — a fingerprint export writes exactly that for a day
  someone did not scan out, so a 220-line paste reports "นำเข้าแล้ว 219 รายการ" with zero warnings
  while that person's OT is short. Carried over verbatim from pre-009 code ⇒ **task 014**, not
  fixed here.
