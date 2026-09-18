# Payslip lifecycle: the "locked" states are not actually locked

- status: todo
- commit:

## Goal

Three defects that share one root — `Payslip.status` is treated as a lock, but nothing enforces it
as one. All three were found by `payroll-auditor` during the task 009 review and were ruled out of
that card's scope because none is caused by it.

## 1. The non-draft guard reads status outside the transaction it protects

`lib/payroll-run.ts:43-49` does a `findUnique` to refuse a non-`draft` slip, then `:99` opens the
transaction that overwrites it. An approval landing between the two is overwritten and the slip is
pushed back to `draft` by `update: { ...totals, status: "draft" }`. Single-branch and admin-only, so
realistically unreachable today — but moving the guard inside the transaction callback costs nothing
and removes the class.

## 2. "กลับเป็นร่าง" on a `paid` slip lets the next run rewrite what was paid

`setStatus` offers the reverse transition on a `paid` slip. The next `runPayroll` then rewrites its
amounts **and** its warnings using today's config — so a paid slip's record is not immutable, and a
rate change months later silently rewrites history. Decide what the product wants:

- forbid `paid → draft` outright, or
- keep it but snapshot the config used, so a recompute is visibly a *different* computation.

🚫 That is linus's call, not an agent's — it is a policy about money already handed to a person.

## 3. Inactive staff leave stale `draft` slips inside the period total

`lib/payroll-run.ts:23` filters `active: true`, so a staff member deactivated mid-period keeps a
`draft` payslip that `runPayroll` never revisits again. Its stale `net` is still summed into
"รวมทั้งงวด" on `app/payslips/page.tsx`, and task 009's skipped-slip banner does not count them
either — it counts `status !== "draft"`, and these are draft.

## 4. Three more server actions write an unchecked `Number()` into money data

Found in the **third** task 009 review round (`code-reviewer` and `payroll-auditor` independently),
on the same shape 009 had just closed on `/ot`. Added here rather than fixed there, because 009's
scope was the one action its own change had touched.

**The precedent, and the worked example to reuse.** `app/ot/page.tsx`'s `add` did
`const hours = Number(formData.get("hours"))` straight into an upsert. `type="number" required` is
client-side only — a server action is a plain HTTP endpoint — so the field arrives as anything or
not at all, and both ways it is silent: an absent field gives `Number(null) === 0`, which
**overwrites a recorded 12.5 h with a zero nobody is told about**; a crafted multipart part (which
`formData.get` returns as a `File`) or `"1e999"` gives `NaN`/`Infinity`, and the column is a `Float`
⇒ `double precision`, which **accepts `NaN`** ⇒ `otPay`, `net`, the stored `Payslip.net` and the
period total on `app/payslips/page.tsx` all become `NaN`, for every staff member in the `reduce`.
009 fixed that one action: reject non-finite/absent before the write and say so on screen
(CLAUDE.md §2 rule 4), rather than trust the client or the driver.

Still unguarded, all three reaching a figure that becomes money:

| Site | Field |
| --- | --- |
| `app/sales/page.tsx:64` | `netPrice: Number(formData.get("netPrice"))` — drives every commission and the incentive threshold |
| `app/classes/page.tsx:42-43` | `booked` / `noShow` — decide the full/half/no-pay branch of a class |
| `app/admin/config/page.tsx:101-102` | `baseSalary` / `classCredit` on a staff record — `NaN` there voids that person's `net` on every future run |

Fix them the same way, per action, and note that `/sales` and `/admin/config` have no warning
surface on those forms yet — adding one is part of the work, not an extra.

## Notes

- 1 and 3 are agent-decidable. 2 needs an answer from linus ⇒ if this card is picked up before he
  answers, ship 1 and 3 and leave 2 with the question quoted.
- 4 is agent-decidable too, and independent of 1–3: it can ship on its own.
- Related: task 009 established that warnings are not recomputable once a slip leaves `draft`
  (`.docs/knowledge/domain/payroll-rules.md`, invariant 3). Item 2 is the other side of that coin.

### Negative hours are the same hole with a different cause

`app/ot/page.tsx`'s `add` action now rejects a non-finite or absent `hours` (task 009), but a
*negative finite* value still passes and writes: `hours = -5` stores, and `Math.max(0, -5 - 9)` is
0, so the OT silently computes to nothing. It is less severe than the `Number(null) === 0` case
009 closed — the row renders `-5`, so the bad value is visible rather than disguised as a plausible
zero — but it is nonsense data on a money path.

Deliberately **not** folded into 009: it was found after that card's final review round, and task
009 had already been through two rounds in which a small unreviewed "while we are here" fix
introduced a defect the next round had to catch. Widening a predicate after the last gate has
answered is how that happens. One token (`|| hours < 0`) plus a test when this card is picked up.

---

## Round 1 (2026-09-18): items 1 and 3 shipped in `1bc770a`, items 2 and 4 still open

Implemented by `backend-dev`, reviewed by `code-reviewer` **and** `payroll-auditor` (§9 — the diff
moves money). Both returned `BLOCK` on the first pass and the findings are recorded here rather than
in a review log, because two of them changed what shipped.

**What landed beyond the card's own text:**

1. **Item 1's guard was not enough on its own.** Moving the `findUnique` inside the transaction
   narrows the window but does not close it — Prisma interactive transactions run at Postgres'
   default READ COMMITTED, so an approval committing between the read and the write is still
   overwritten. The write is therefore **conditional**:
   `updateMany({ where: { staffId, period, status: "draft" } })` + branch on `count`, with its own
   skip reason (`RACED_SKIP_REASON`) when the row was raced. `status: "draft"` also came out of the
   update payload — that was the field that pushed an approved slip back to draft. ⇒ the card's
   original sentence, "moving the guard inside the transaction … removes the class", was too strong.
2. **`setStatus` was the other half of the same lock** and was unconditional, so the reverse
   interleaving (recompute commits first, approval lands second) closed a slip at a figure the
   approver never saw. Made symmetric in the same change: the form carries the status the row was
   rendered for, the write is conditional on it, and losing the race tells the admin instead of
   proceeding.
3. **Item 3's first shape left the bigger half of the hole open.** Selecting "inactive **and**
   already holds a slip in this period" misses the ordinary leaver entirely, because variable pay is
   computed after the month closes (`darin-payroll-system.md` §6: ภายในวันที่ 3 ของเดือนถัดไป) ⇒ the
   person who resigned on the 20th has no slip when the run happens. `payroll-auditor` priced one
   real case at **16,760 ฿** vanishing with no slip, no warning and no review-queue row. The
   selector now also matches an inactive person with **payable activity inside the period**
   (teach sessions, class sessions, sale attributions, OT entries).
4. **The base salary of a leaver is charged for the whole period** — the engine pro-rates for
   nobody. That is a policy question, not an agent's call ⇒ [task 021](../todo-human/021-leaver-base-salary-proration.md),
   and the slip's Thai warning says so on screen in the meantime.
5. **`skipped` reaches no screen.** `app/payslips/page.tsx` discards `runPayroll`'s return value, and
   task 009 removed the run's event banner on purpose. Three comments written in round 1 claimed a
   distinction "on screen" and were corrected to say *returned, not yet rendered*; the surface itself
   is [task 022](022-render-payroll-run-refusals.md).

**Junit pin lowered on purpose — `lib/payroll-run.test.ts` 5 → 4** (§7 requires the reason here):
two `staffInPeriodWhere` tests asserted the same thing, the second being a strict subset of the
first's whole-object `toEqual`. They were merged. **No coverage was removed** — the merged test
still pins every arm, the arm count and the period binding. This is not a pin lowered to make the
gate green.

**What these tests still do not prove**, stated because the pin number would otherwise imply
otherwise: `bun test` has no database here, so nothing exercises the read being *inside* the
transaction, the `count === 0` branch, or the concurrent-`create` throw against a real Postgres.
That is [task 015](015-db-test-lane.md)'s job and is written at the top of the test file too.

**Still open on this card:** item 2 (`paid → draft` — blocked on linus, and it is the sibling of
task 021) and item 4 (the unchecked `Number()` server actions — ships as its own commit).

**Knowledge cards** `.docs/knowledge/ops/gates.md` and `.docs/knowledge/domain/payroll-rules.md`
both crossed the 170-line warn in this round. Not split here — cramming or omitting the corrections
would have cost more than the warn ⇒ [task 023](023-split-two-oversized-knowledge-cards.md).
