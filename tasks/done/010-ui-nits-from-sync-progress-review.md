# UI findings from the task 008 design review

- status: done
- commit: 13a53ac

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

---

## ✅ Done 2026-09-18 — `13a53ac`

All three findings closed plus the named retrofit. `bash scripts/verify.sh` → ALL GREEN
(48 tests, `prisma db push` + seed on throwaway postgres), nothing skipped.

### What the card did not predict

**`@apply card` does not compile.** Tailwind 4 refuses `@apply` of a class declared in
`@layer components` (`Cannot apply unknown utility class 'card'`), so "built on `.card`" could
not be written the obvious way. Two alternatives were compiled against this repo's own
`@tailwindcss/postcss` 4.3.3 before choosing:

- `class="card card-warn"` with a colour-only modifier — works, but **only while `.card-warn` is
  declared after `.card`**: source order decides, so it breaks silently if anyone reorders the file.
- **`@utility`** (chosen) — `.card` itself is declared `@utility`, the variants `@apply card` on
  top. Geometry is inlined into each variant's own rule at compile time, so it is immune to
  reordering, and call sites stay a single class. Verified by inspecting the compiled CSS, in which
  `.card` is emitted *after* the three variants and everything still resolves.

`.card` therefore no longer lives in `@layer components` — that is deliberate, not drift.

### Design-gate rulings folded into the same commit

`uxui-designer` returned APPROVE-WITH-NITS with three token-layer findings it asked to land here
rather than let [task 009](009-surface-payroll-warnings.md) build warning banners on tokens already
known to fail:

- `.td`'s `border-neutral-100` is **~1.04:1 on `bg-green-50`** — invisible, and would be equally
  invisible on the `amber-50` task 009 needs ⇒ dividers are now alpha (`black/10` / `black/5`),
  which renders where the old grays did on white but scales to any tint under it.
- `.th`'s `text-neutral-500` at 12px was **~4.52:1 on `card-ok` and ~4.73:1 on white** — riding the
  AA floor everywhere, not just on colour ⇒ `text-neutral-600`.
- The sync results table gets `-mx-2`: it is the one table in the app that does not own its own
  `.card`, so its cells' `px-2` had nothing to cancel against and the first column did not line up
  with the `✓ Sync เสร็จใน …` line above it.

### Two defects found while fixing finding 1

- **`ActionProgress` announced the start and was then silent forever.** `pending ? "กำลังทำงาน" : ""`
  — emptying a live region emits nothing, so a screen-reader user who submitted a payroll run heard
  the start and then had no signal that it had finished. Fixed with a `ran` flag → `"เสร็จแล้ว"`.
- **New Thai comments violated §2.5.** The exemption covers *existing* Thai that must not be
  rewritten; it is not a licence to write new Thai into a file whose old comments are Thai. Both
  components date from `edf0a11` (2026-07-29) and the rule from `cdb1778` (2026-09-17), so the old
  comments are grandfathered and were left alone. Five new blocks were translated — including one
  old comment that had been moved *and reworded*, which makes it new writing.

### Not done here

Nothing from the card. The systemic UI debt it lists under "Not in this card" remains with
[task 006](../todo-human/006-ui-design-pass.md).
