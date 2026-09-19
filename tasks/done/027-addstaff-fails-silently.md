# Adding a staff member fails silently when the name, username or password is wrong

- status: done
- commit: 81d129f

## Goal

`app/admin/config/page.tsx`'s `addStaff` starts with:

```ts
if (!name || !username || password.length < MIN_PASSWORD_LEN) return;
```

A bare `return` from a server action: the page revalidates, the form clears, and **nothing says the
staff member was not created**. The admin's next move is to look for the person in the list and
wonder — or worse, not look.

Task 013 item 4 gave this exact form an error surface for `baseSalary` / `classCredit`, so the
missing half is now visible by comparison: the money fields report their refusal, the identity
fields still do not.

## Scope

- Report all three refusals through the surface the form already has
  (`_components/add-staff-form.tsx` + the `err` flag), naming which field was refused — and for the
  password, naming `MIN_PASSWORD_LEN` rather than a literal.
- A duplicate `username` currently throws Prisma's unique violation up as an unhandled server-action
  error; decide whether that becomes the same kind of notice.

## Notes

- Found by `backend-dev` during task 013 item 4 (2026-09-18); left out because it is not a money
  path, which is the only reason it is a separate card rather than part of that change.
- §2 rule 4's principle is about money, but the same argument applies to any refusal a person needs
  to know about: a silent `return` is the failure nobody can see.

---

## What shipped (81d129f)

`lib/staff-form.ts` (104, new) · `lib/staff-form.test.ts` (143, new, 9 tests) ·
`app/admin/config/page.tsx` (446) · `_components/add-staff-form.tsx` (177) ·
`_components/save-notice.tsx` (49) · `scripts/junit-pins.txt` (+1 row) · two knowledge cards.
`verify.sh` ALL GREEN, all three tiers. `code-reviewer` **BLOCK → PASS**, `payroll-auditor`
**APPROVE-WITH-NITS** (every nit applied).

### Both of the card's open questions, answered

| Question the card left open | Answer |
|---|---|
| does a duplicate `username` become the same kind of notice? | **yes** — `err=newstaffDup`, caught as `P2002` on the `create` |
| (implicit) where does the parse live? | `lib/staff-form.ts`, on `lib/config-form.ts`'s model — five outcomes is real logic, and `page.tsx` was at 436 against the §4 ceiling of 500 |

The duplicate had become more urgent than the card knew: it was an **unhandled throw**, so since
[task 020](020-no-error-boundary-anywhere.md) shipped this morning it rendered the new Thai boundary
saying *a config value is not set* — a wrong explanation, worse than the generic English page it
replaced. Closing one silent path made this one actively misleading.

### Why `P2002` and nothing else, written down because the next change will want to widen it

`Staff` has exactly **one** unique index (`username`), which is what makes the narrow
`instanceof PrismaClientKnownRequestError && e.code === "P2002"` correct: there is no other
constraint it could be mistaking. `e.meta.target` is deliberately **not** tested — with the driver
adapter that value is regex-scraped out of the Postgres `detail` string (`@prisma/adapter-pg`), so a
check on it can fail *silently*, and it would add a silent false-negative path to remove an
impossible false-positive one. No `findUnique` pre-check either: TOCTOU, and the index is the real
guard. 🔴 The day a second table joins this write in a transaction, that reasoning expires — see
[033](../todo/033-addstaff-alias-write-is-silent-both-ways.md), which carries the condition.

### Two defects review found that the card did not know about

1. **`"[object File]"` is 13 characters and `MIN_PASSWORD_LEN` is 12.** Every field was read with
   `String(formData.get(…))`, and any multipart body may post a field as a `File`. The password
   therefore **cleared the length check** and was hashed, producing an account whose password is a
   literal anybody can guess. `lib/staff-form.ts`'s `text()` closes it, pinned on every field.
   The same shape survives in `app/account/page.tsx` ⇒
   [032](../todo/032-account-page-renders-url-text-and-reads-a-file-as-a-password.md).
2. **The flag→copy lookup walked the prototype chain** (the review's one BLOCK, found independently
   by both lanes). `?err=__proto__` returned `Object.prototype` — truthy, an object, straight into a
   React child slot ⇒ `Objects are not valid as a React child`, thrown by the **production**
   renderer, putting `app/error.tsx` over a healthy page: this card's own failure mode walking back
   in through the URL. Both notices now decide a miss with `Object.hasOwn`, including
   `save-notice.tsx`, which had the hole before this change.

### One thing the scope asked for that was dropped on purpose

The `newstaffDup` copy first read *"แก้**เฉพาะ**ช่องชื่อผู้ใช้แล้วกดเพิ่มอีกครั้ง"*, which asserts the
other boxes still hold what the admin typed. Nothing guarantees that — the form echoes nothing back,
so it depends on React keeping uncontrolled DOM nodes across the `redirect()`. The honest check is to
watch the screen, and **we cannot**: the deploy host is blocked behind
[002](../todo-human/002-deploy-host-setup.md) / [008](../todo-human/008-merge-sync-progress-then-deploy-develop.md)
and nobody has seen this screen render. So the claim was dropped rather than shipped unverified.
*"ช่องอื่นกรอกถูกหมดแล้ว"* stays — the parse provably passed before the `create`.

### Opened by this round

[031](../todo/031-role-and-rank-are-unchecked-strings.md) `role`/`rank` unchecked ·
[032](../todo/032-account-page-renders-url-text-and-reads-a-file-as-a-password.md) `/account` renders URL
text and reads a `File` as a password ·
[033](../todo/033-addstaff-alias-write-is-silent-both-ways.md) the alias write, silent in both directions ·
[034](034-activity-named-proto-pollutes-the-rate-map.md) an activity named `__proto__` turning a
missing-rate **warning** into a silent 0 ฿ — pre-existing, on the money path, found by the same sweep
that cleared the rest.

### Budget note for whoever opens this file next

`app/admin/config/page.tsx` went **436 → 446** against the 500 ceiling (the sweep warns at 450): the
parse took 12 lines out and the `try`/`catch` put 22 back. The split itself is right and both lanes
said so, but what is left is seven inline server actions plus markup, which this move cannot relieve
again. The next structural step is `app/admin/config/actions.ts` with a file-level `"use server"` —
a real change, deliberately out of scope here, and named in [033](../todo/033-addstaff-alias-write-is-silent-both-ways.md)
so it is budgeted rather than discovered.
