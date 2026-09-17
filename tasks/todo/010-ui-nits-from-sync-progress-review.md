# UI findings from the task 008 design review

- status: todo
- commit:

## Goal

`uxui-designer` reviewed the sync-progress UI as the §9 gate before task 008's fast-forward and
returned **APPROVE-WITH-NITS**. The verdict did not block the merge; these are the three findings
it attributed to that code rather than to pre-existing debt. They are small and independent.

## 1. `aria-live` on a clock that ticks 4× a second

`app/_components/action-progress.tsx:66-70` · `app/sync/sync-runner.tsx:202-207,235`

Both components run `setInterval(…, 250)` and put the live "ผ่านไป N วินาที" text inside
`role="status" aria-live="polite"`. A live region that changes four times a second is a WCAG 4.1.3
anti-pattern: a screen reader tries to re-announce every tick, so the page is unusable with
assistive tech for the whole duration of a sync or a payroll run.

Fix: keep the visible ticking text, move `role="status"`/`aria-live` to a coarser announcement that
fires only on **phase change** (idle → fetch → process → done/error), and put the ticking number
itself outside that region or mark it `aria-hidden`.

## 2. A third card style instead of the token layer

`app/sync/sync-runner.tsx:250-280` (done banner) · `:283` (error banner)

`rounded-lg border border-green-300 bg-green-50 p-3` duplicates `.card`'s radius/border pattern
with a different padding (`p-3` vs `.card`'s `p-4` — an unintended inconsistency) and a per-instance
colour override. The results table inside it (`:256-277`) skips `.th`/`.td` entirely and hand-rolls
`py-1 pr-3 font-medium` headers, so it is the one table in the app that does not share every other
table's row styling.

Fix in `app/globals.css`, which is the whole design system: add `.card-ok` / `.card-warn` /
`.card-error` built on `.card`, and reuse `.th`/`.td` for the table. **Retrofit the pre-existing
instances of the same anti-pattern in the same pass** — `app/account/page.tsx:82-83`,
`app/payslips/page.tsx:77`, `app/page.tsx:66`.

These same classes are what card [009](009-surface-payroll-warnings.md) needs to render payroll
warnings, so this card should land first or alongside it.

## 3. Process-phase label wraps against its spinner

`app/sync/sync-runner.tsx:213-219` — `sheetName` is unbounded and the row is
`flex items-center gap-2`. A long sheet name wraps to two lines and `items-center` then centres the
spinner against the wrapped block instead of the first line. Low severity (admin-only, desktop
page). Fix: `items-start` + `pt-0.5` on the spinner, or truncate `sheetName`.

## Not in this card

The systemic UI debt the same review found — money never right-aligned or forced to 2 decimals, no
`@media print` on the payslip, no sticky headers or `overflow-x-auto` on any table, inconsistent
zero-row messages, no active-route marker in `app/layout.tsx` — is **pre-existing since `cdc580e`**
and belongs to [task 006](../todo-human/006-ui-design-pass.md), which is blocked on linus for brand
direction. Dropping `warnings` belongs to [task 009](009-surface-payroll-warnings.md).

⚠️ Route the result back through `uxui-designer` in review mode (§9) — `app/globals.css` changes
are exactly what that gate watches.
