# Adding a staff member fails silently when the name, username or password is wrong

- status: todo
- commit:

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
