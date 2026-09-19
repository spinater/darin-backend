# An activity name containing `|` overwrites a *different* activity's teach rate with 0 ฿

- status: todo
- commit:

## Goal

`/admin/config` names every teach-rate box after the row it belongs to, joining three parts with a
pipe, and parses it back by splitting on the same pipe:

```tsx
name={`rate|${a}|${r}`}                       // app/admin/config/page.tsx:293 — written
```
```ts
const [kind, ...rest] = name.split("|");      // lib/config-form.ts:21 — numericKind
const [kind, ...rest] = k.split("|");         // app/admin/config/page.tsx:88 — the write loop
const [activity, rank] = rest;                // app/admin/config/page.tsx:89
```

`a` is whatever `addActivity` wrote, and that action accepts **any** non-empty trimmed string
(`app/admin/config/page.tsx:131-136`) — the pipe is not reserved anywhere. So an activity whose name
*contains* a pipe produces a field name with four segments, and the parse reads the extra segment as
the rank of a **different** activity.

**Concrete, end to end** — `RANKS = ["PT", "CT", "ST"]` (`page.tsx:21`):

1. an admin adds an activity named `pt|ST`. Three `TeachRate` rows are created at rate **0**;
2. the rate table renders a `pt|ST` row whose PT box is named `rate|pt|ST|PT`, `defaultValue={0}`;
3. the admin presses **บันทึกทั้งหมด** without touching anything. `numericKind("rate|pt|ST|PT")`
   returns `"rate"` (`lib/config-form.ts:21-22` reads only the first segment), so the value is
   accepted; FormData preserves DOM order and `"pt"` sorts before `"pt|ST"`, so the genuine
   `rate|pt|ST` box (400 ฿) is written first and `rate|pt|ST|PT` then parses to
   `activity="pt", rank="ST"` and **upserts it to 0**;
4. `teachRates.get("pt")?.get("ST")` is now `0`, not `undefined` ⇒ `rate == null` at
   `lib/payroll.ts:122` is **false** ⇒ no warning. Every ST trainer's `pt` sessions become a 0 ฿
   line with `warnings: []`.

## ⚠️ After task 036 the symptom changed — it is now a **delete**, not an overwrite

Task 036 stopped `addActivity` seeding three `TeachRate` rows at 0, so the registered name `pt|PT`
renders three **blank** boxes instead of three `0`s. A blank rate box is the documented way to
*delete* a rate (`lib/config-form.ts:87`), so the same บันทึกทั้งหมด now runs
`deleteMany({ activity: "pt", rank: "PT" })` against the genuine row instead of upserting it to 0.
Rows still sort `pt` before `pt|PT`, so the real upsert runs first and is deleted in the same submit.

**Net direction is an improvement** — a deleted rate *warns* (`ไม่มีเรทค่าสอน pt × PT`) where the
0 paid silently, which is §2 rule 4 working. But the money still moves: a PT-rank trainer with 40
`pt` คาบ drops from 40 × 200 = **8,000 ฿ to 0 ฿**, and retyping 200 does not help because the next
submit deletes it again. The trigger set is unchanged, and the mechanism is now a `DELETE` on the
live money table.

🔑 **Task 036 already paid for this card's better option.** `TeachActivity.id` exists for exactly
one reason: to make `rate|<id>` cheap. Prefer it over rejecting `|` at the write.

Found by `payroll-auditor` on the task 036 review, 2026-09-19.

## Why this one matters

🔴 **Same failure as [task 034](../done/034-activity-named-proto-pollutes-the-rate-map.md), reached by a
different road, and task 034's fix does not touch it.** The `Map` closed the prototype-key class;
this is a *delimiter* collision in the form's field names, one layer above. The end state is
identical and is the one CLAUDE.md §2 rule 4 exists to prevent: money that disappears quietly and is
noticed at payday.

The dashboard does not catch it either — `app/page.tsx:34-36` flags an activity only when **no** rate
row exists (`!rates.some(...)`), and here a row exists, at 0.

Reach is the same shape as 034's: an authenticated admin types an odd name once. Consequence is
narrower than 034's (one activity × one rank, not the whole process) but **persistent** — it is a
real `TeachRate` row at 0, so it survives restarts and is re-applied on every bulk save.

## Scope

Pick **one** and do not add a second home for the decision:

- **Reject the delimiter at the write** — `addActivity` refuses a name containing `|`, out loud,
  through the `?err=` flag surface `app/admin/config/_components/add-activity-form.tsx` already has
  (task 034 built it for the empty-name refusal; a second flag is a lookup table, so re-read what
  task 027 decided about `Object.hasOwn` before indexing one). ⚠️ This leaves **existing** rows with
  a pipe in the name unhandled — check whether any exist before choosing it.
- **Stop encoding the name in the field at all** — name the box `rate|<teachRateId>` and look the row
  up by id. This makes the class of bug structurally impossible rather than filtered, which is the
  direction task 034 chose for its own half. Costs more: the box for a rank that has **no** row yet
  has no id to carry, so the "ยังไม่ตั้ง" boxes need their own encoding.

Whichever is chosen, the fix must keep the documented behaviour that **a blank rate box deletes that
rate** (`lib/config-form.ts:87` and the amber note under the table) — note the same collision in the
delete direction wipes the genuine row instead of zeroing it, which at least warns afterwards.

## Who reviews this

The diff lands on `app/admin/config/page.tsx`, which writes `TeachRate` ⇒ CLAUDE.md §9's path list
⇒ **`code-reviewer` + `payroll-auditor`**, not one lane. Not the `claude-tekton` lane: choosing
between the two scopes above is a decision, not a transcription.

## Notes

- Found by `code-reviewer` during the task 034 review (2026-09-19), while answering that card's
  question "does an activity name still have reachable harm anywhere else". **Pre-existing** and in
  no line task 034's diff moved, which is why it did not block it.
- The same sweep came back **clean for prototype keys**: after task 034 there is no variable-keyed
  plain-object *write* left in `lib/**` or `app/**`. The surfaces checked and cleared, worth not
  re-deriving: the `activity_rank` compound unique (shorthand for fixed identifiers — the name is a
  bound value, never a key) · `byActivity` / `byClass` in `lib/payroll.ts` (already `Map`s) ·
  payslip line labels (string interpolation) · `GROUP_LABEL[g]` in `app/payslips/[id]/page.tsx:70`
  (`g` is written in five places from literals) · `[...byActivity].sort()` (entry tuples) ·
  `lib/sync.ts` / `lib/parser.ts` / `lib/normalize.ts` (activity is copied as a value) · React
  `key=` props (React prefixes user keys internally) · `lib/config-keys.ts` (`Object.fromEntries`
  defines own properties) · `save-notice.tsx:41` and `add-staff-form.tsx:111` (both already gate on
  `Object.hasOwn`, task 027).
