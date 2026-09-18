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
