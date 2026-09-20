# A config value that arrived from `CONFIG_DEFAULTS` and nobody reviewed never reaches the banner

- status: todo
- commit:

## Goal

[Task 040](../done/040-seed-recreates-a-rate-the-owner-deliberately-deleted.md) settled that the seed
asserts the `CONFIG_DEFAULTS` **key set** on every run, while the **value** is written once and
never again. That is the right call — a missing key makes `num()` throw at page render and no
screen can create it — but it leaves one thing unsaid on screen:

> a rate the engine is using right now arrived from a developer's `CONFIG_DEFAULTS` at deploy time,
> and **nobody at this branch has ever looked at it**.

A value nobody reviewed and a value the owner chose render identically at `/admin/config`, and both
feed `computePayslip` the same way. `incentive.rate = 12` is a number in a commit, not a number
Darin agreed to.

## Why it waited

The asymmetry that made deferring this defensible, and it still holds: a `CONFIG_DEFAULTS` value
was typed by a developer in a **reviewed commit**, whereas a re-created `TeachRate` (task 040's
subject) contradicts a decision the owner made *after* that commit. Wrong-by-default is worse than
never-reviewed, so 040 shipped first.

## Scope

- Needs a **per-key "reviewed" fact that does not exist today** — a nullable `reviewedAt` on
  `PayrollConfig`, or a separate table. 🔴 That is a schema change under §2 rule 8 (`prisma db push`,
  no down path): say in this card's own Decision what is lost if the push is wrong before touching
  `prisma/schema.prisma`.
- Set it where a **human** saved the value (`lib/config-form.ts`'s bulk save), never in
  `prisma/seed.ts` — a seed that marks its own writes reviewed is the whole bug written in one line.
- Backfill: every row on the live database today is unreviewed by this definition, including ones
  the owner really did type at `/admin/config`. Decide whether the backfill is "all unreviewed"
  (loud, noisy once) or "all reviewed, new keys unreviewed from here" (quiet, and wrong about
  today's 18). Do not split the difference silently.
- Natural home for the output: the **"ต้องเคลียร์ก่อนจ่ายจริง"** banner on `app/page.tsx`, beside
  the unpriced-activity warning it already carries.

## Notes

- Opened out of the task 040 review round, 2026-09-20 (architect design §11 c).
  `.docs/knowledge/domain/teach-rate-lookup.md` described this gap as "carded" before the card
  existed; it now points here.
- Sibling: [044](044-admin-config-renders-only-rows-that-exist-so-a-missing-key-has-no-box.md) — that
  one gives a *missing* key a box, this one flags a *present* value nobody chose.
