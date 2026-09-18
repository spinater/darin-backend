# Two knowledge cards are at the warn line — split them before the next card lands on them

- status: todo
- commit:

## Goal

`.docs/knowledge/ops/gates.md` and `.docs/knowledge/domain/payroll-rules.md` both crossed the
**170-line warn** during task 013 (cap is 200 — `check-knowledge.sh` prints
`warn: การ์ด N ใบเกิน 170 บรรทัด` and still exits 0). §5 is explicit that a card at the cap gets
**split, not a bigger cap**, and both reviewers on task 013 said the same thing: the additions were
load-bearing, so do not cram or omit them, but the next growth owes a split.

Splitting is cheapest **before** the work commit that would grow them again, not after
(`check-knowledge.sh`'s own comments say a split may be its own commit ahead of the work).

🔴 **Measured after task 013 item 4 (2026-09-18): `payroll-rules.md` is at 198/200 and `gates.md` at
189/200.** Two lines of headroom on the card that **nearly every money commit must update** — it
sources `lib/payroll.ts`, `lib/config-keys.ts`, `lib/payroll-run.ts`, `prisma/schema.prisma`, both
payroll test files and `app/payslips/page.tsx`. The next such commit will shave a paragraph to fit,
and shaving is how the *why* gets lost, which is the only thing these cards are for. ⇒ **pull this
card next**, as the thing standing in front of the next money change, not as housekeeping.

## Scope

- Split by **topic with a clear boundary**, not by line count.
- 🔑 **Shrink `sources:` with the split.** §5: a card that moves its prose but keeps the parent's
  whole source list goes STALE just as often as before, which is the failure the split was meant to
  fix. `payroll-rules.md` picked up two test files in its `sources:` during task 013, so it now goes
  stale on more commits than it used to — that is the concrete symptom to fix here.
- Every new card needs its row in `.docs/knowledge/index.md` (the gate checks that direction; the
  reverse is `check-links.sh`'s job and is not duplicated).
- Candidate boundaries, to be argued rather than assumed:
  - `gates.md` — what each gate watches · versus the two-tier machinery and the junit pin layer.
  - `payroll-rules.md` — the payslip lifecycle invariants (status as a lock, what a run selects,
    what is recomputed) · versus the formula-level rules that cite `REQUIREMENTS.md` §§.

## Notes

- Pure documentation: no code, no gate, no schema. `bash scripts/verify.sh` must still exit 0, and
  `check-knowledge.sh` must report **no** card over 170 when it is done.
- Do not shorten by deleting the "why": the `gates.md` paragraph added in task 013 retracts a false
  structural claim (that a test importing `lib/db.ts` fails at import time — it does not; Prisma 7
  with `@prisma/adapter-pg` connects lazily and only the first query throws). A retraction that gets
  edited away comes back as the same wrong assumption three cards later.
