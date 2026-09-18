# The payroll run refuses to overwrite slips and tells nobody it did

- status: todo
- commit:

## Goal

`runPayroll` returns `{ results, skipped }`. Its only caller throws the return value away:

```ts
// app/payslips/page.tsx
await timed("payroll", () => runPayroll(p));
redirect(...)
```

So every refusal the engine makes is invisible. There are two of them today, and task 013 added the
second:

| Reason | When |
| --- | --- |
| `สลิปสถานะ <status> แล้ว ไม่คำนวณทับ` | the slip was already `approved`/`paid` when the run reached it |
| `สลิปเปลี่ยนสถานะระหว่างคิดเงิน ไม่คำนวณทับ` | the slip left `draft` **between** the guard's read and the conditional write — the race task 013 item 1 closed |

Both were found by `code-reviewer` and `payroll-auditor` independently during the task 013 review
(2026-09-18), which is also why three comments in that change were corrected: they described a
distinction "on screen" that reaches no screen.

**Today's cover, and why it is not enough.** Task 009 deliberately replaced the run's event banner
with state derived from the DB — `closedCount` plus the `— (ไม่ได้คำนวณใหม่)` marker on
`/payslips` — because an event banner lies as soon as the page is reloaded. A refused slip is
non-draft by render time, so it *is* inside that count. What the count cannot say is **that the
admin's run just now refused it**: a slip closed last week and a slip that lost a race two seconds
ago render identically. The admin who pressed คำนวณ to pull in eight newly synced sessions sees a
neutral "N ใบปิดงวดแล้ว" and reasonably concludes the recompute landed.

## Scope

- Carry the run's own refusals from the server action to the render. The action `redirect`s, so it
  needs a carrier that survives that — a searchParam **count** (a flag, never a message: nothing
  from the URL is rendered, the Thai copy lives in the page file, per `/ot`'s precedent) or a
  persisted note, whichever survives review. Do not reintroduce a banner that outlives its cause:
  a successful run must clear it.
- Keep the two reasons distinguishable. The raced one is the interesting one — it means data moved
  under a human — and it is the one that should read differently from "this slip was already closed".
- `lib/payroll-run.ts` already exports the strings (`nonDraftSkipReason`, `RACED_SKIP_REASON`) and
  `lib/payroll-run.test.ts` pins that they differ. That pin becomes meaningful only when this card
  ships; until then it protects wording nobody reads.

## Notes

- Money consequence if it is never built: an admin believes a recompute landed when it did not, and
  approves a stale figure. The person underpaid notices at payday; the shop does not.
- Related: task 013 item 2 (`paid → draft`) and task 021 (leaver base) are the two policy questions
  open on this same screen.
- Not urgent enough to have blocked task 013: the refusals are correct, and no money moves *because*
  of the missing surface — it moves because a human acted on an incomplete picture.
