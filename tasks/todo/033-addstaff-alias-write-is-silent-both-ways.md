# Adding a staff member can create the person and not the alias, and say nothing either way

- status: todo
- commit:

## Goal

`addStaff` in `app/admin/config/page.tsx` writes **twice**, outside any transaction: `db.staff.create`,
then a `db.trainerAlias.upsert` loop. [Task 027](../done/027-addstaff-fails-silently.md) gave every *parse*
refusal a notice; the alias write has two outcomes that still reach nobody.

### 1. The alias is skipped in silence when `normalizeTrainer` returns empty

```ts
const sheetNames = [String(formData.get("sheetName") ?? "").trim() || name];
for (const raw of sheetNames) {
  const alias = normalizeTrainer(raw);
  if (alias) await db.trainerAlias.upsert({ … });   // ← no else
}
```

`normalizeTrainer` (`lib/normalize.ts`) lowercases, strips **all** whitespace, then strips a leading
`pt` and a leading `พี่`. So a trainer added as name `PT` with `sheetName` left blank normalizes to
`""` and the `if (alias)` arm is skipped with nothing said. The screen redirects to the clean URL
and reads as a complete success.

**Worked example** (`payroll-auditor`, 2026-09-19): that trainer teaches 30 PT sessions in the month
at §1.2's 400 ฿. `lib/payroll-run.ts` filters `staffId: { not: null }`, so none of them match a staff
member. The slip pays §1.3's base 10,000 ฿ instead of §1.7's 10,000 + 12,000 = **22,000 ฿**.
🔑 It is **recoverable and not silent at the other end** — the unmatched rows go to the review queue
(§2 rule 6) and `/sync/review` is where someone sees them. What is missing is that the add screen,
which is where the mistake was actually made, said nothing.

### 2. A failed alias write after the staff row is committed reports the wrong thing

The `upsert` runs after `create` has committed, with no handler around it. If it throws, the staff
member **exists**, and since [task 020](../done/020-no-error-boundary-anywhere.md) the admin gets
`app/error.tsx`, whose Thai copy says a config value is not set. They will reasonably conclude
nothing was added, and add the person again: two active `Staff` rows for one human, the alias
following the newer one, and the orphan drawing its `baseSalary` every run with no sessions to make
it look wrong — the failure `addStaff`'s own comment at the end of the action already warns about.

This is the **only unreported outcome left in the action** after task 027.

## Scope

1. Decide the transaction question first, because everything else follows from it: wrap
   `create` + the alias loop in `db.$transaction`, or keep two writes and report the second one.
   ⚠️ If it becomes one transaction, the `P2002` handler must stop assuming `username`:
   `TrainerAlias.alias` is also unique, so the catch has to look at `e.meta.target` before blaming a
   field. 🔴 Read task 027's reasoning before doing that — it deliberately did **not** test
   `meta.target`, because with the driver adapter that value is regex-scraped out of the Postgres
   `detail` string (`@prisma/adapter-pg`), so a check on it can fail **silently**. Today `Staff` has
   exactly one unique index, which is what makes the narrow `instanceof` + `e.code` correct; adding
   a second table to the transaction is what changes that.
2. Report the empty-alias case through the surface 027 built (`?err=` flag + the notice in
   `_components/add-staff-form.tsx`). Refusing the whole add is one option and warning after a
   successful add is another — they are different products, so decide deliberately: a name that
   normalizes to nothing is a name the sheet can never match, which argues for refusing.
3. `sheetName` is still read with `String(formData.get(…))` ⇒ a `File` part writes
   `normalizeTrainer("[object File]")` as an alias. Covered by neither 027 nor
   [031](031-role-and-rank-are-unchecked-strings.md); fix it here or add it there, but not both.

## Notes

- Both halves found during the task 027 review (2026-09-19) — 1 by `payroll-auditor`, 2 by
  `code-reviewer` — and deliberately left out of that commit: 027 is about refusals the *parse*
  decides, and both of these are about a **write** that already happened. §6 rule 4.
- 🔑 Whoever takes this will be editing `app/admin/config/page.tsx`, which is at **446 lines** against
  the §4 ceiling of 500 (sweep warns at 450). `code-reviewer` named the next structural move:
  `app/admin/config/actions.ts` with a file-level `"use server"`, since what is left in the page is
  seven inline server actions and the markup. That is a bigger change than this card — budget for it
  rather than discovering it.
