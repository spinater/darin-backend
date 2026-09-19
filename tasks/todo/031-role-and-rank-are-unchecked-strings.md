# `role` and `rank` are stored as whatever the request said

- status: todo
- commit:

## Goal

`Staff.role` and `Staff.rank` are plain `String` columns whose allowed values live only in a
schema **comment** (`prisma/schema.prisma`: `// owner | admin | counter | trainer`,
`// ST | CT | PT (เฉพาะ trainer)`) and in two `const` arrays in one page
(`app/admin/config/page.tsx`: `RANKS`, `ROLES`). Nothing between the request and the write checks
that what arrived is one of them. Three paths write them:

| Path | Line | What it accepts |
|---|---|---|
| `addStaff` | `app/admin/config/page.tsx:156` | `String(formData.get("role") ?? "trainer")` — any string |
| `addStaff` | `app/admin/config/page.tsx:167` | `String(formData.get("rank") ?? "PT")` — any string, for a `trainer` |
| bulk `save` | `app/admin/config/page.tsx:107` | `tx.staff.update({ data: { rank: val \|\| null } })` — any string, per existing staff row |

The `<select>` elements only constrain a browser that renders them; a posted form is not obliged to.

## Why it is worth a card, and why it is not an emergency

**It is not a silent-money bug**, and that is the reason it can wait. A rank the rate table has no
row for is caught by §2 rule 4 at the engine: `lib/payroll.ts:107-110` finds no rate and pushes
`ไม่มีเรทค่าสอน <activity> × <rank> — <qty> คาบยังไม่ถูกคิดเงิน` into `warnings`. The money is
**not** paid, and the screen says so. Loud, not silent.

What it does cost:

1. **`role`** — a value outside the four known ones is a person who can log in and reach nothing:
   `requireRole()` (`lib/auth.ts:56-61`) matches by string equality, so they fall through every
   guard, and `app/layout.tsx` renders them the non-admin nav. Note the *interesting* direction is
   already legitimate: `ROLES` offers `owner`, so an `admin` creating an `owner` is the form working
   as designed, not an escalation. This card is about values that are not on the list at all.
2. **`rank`** — a typo (`pt`, `Pt`, ` PT`) produces a warning **per class row, every period**, for a
   trainer whose teaching is simply never paid until somebody notices the rank is wrong. The warning
   names the rank, so it is findable — but nothing stops it being written in the first place.
3. The allowed values are stated in three places (schema comment, `ROLES`/`RANKS`, this card) and
   enforced in none.

## Scope

- One home for each list, imported by everyone who writes the column — `lib/staff-roles.ts` or the
  equivalent. **Not** a copy in `lib/` beside the copy in `page.tsx`: §4's "one decision, one home".
- Refuse an unknown value at the write, through the surface the form already has
  (`?err=` + the notice in `_components/add-staff-form.tsx`) rather than a bare `return` — task 027
  is what built that surface, so this card should reuse it and not invent a second one.
- Decide whether the columns become a Prisma `enum`. 🔴 **This is the part that needs deciding, not
  assuming** — §2 rule 8: `migrate` runs `prisma db push`, which has no down path, and an enum
  narrows a column that already holds free text. Check what is actually in the column on the deploy
  host first — which is blocked behind [002](../todo-human/002-deploy-host-setup.md) /
  [008](../todo-human/008-merge-sync-progress-then-deploy-develop.md), the same wall
  [029](../todo-human/029-sweep-rows-keyed-before-the-guards.md) is behind. A `lib/` guard needs no
  migration and can ship first; the enum is a separate, later decision.

## Notes

- Found while briefing [task 027](../done/027-addstaff-fails-silently.md) (2026-09-19) and deliberately kept
  out of it: 027 is about a refusal nobody can see, this is about a value nobody checks. Widening
  027 would have broken §6 rule 4 (one feature, one commit, able to name its own cause).
- `sheetName` in the same action has the same shape and is **not** covered here — it belongs to
  [033](033-addstaff-alias-write-is-silent-both-ways.md), which owns the alias write. One of the two
  cards fixes it, never both.
- Related: [028](028-config-values-have-no-per-key-spec.md) is the same shape one layer over —
  `lib/config-form.ts` says a per-key ceiling "needs a spec table beside `CONFIG_DEFAULTS`, which is
  carded, not guessed here." Whoever takes one of these should look at whether they share a home.
