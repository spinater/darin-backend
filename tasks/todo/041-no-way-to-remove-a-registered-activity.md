# A registered activity name can never be removed, and the bulk save pays for each one forever

- status: todo
- commit:

## Goal

[Task 036](../done/036-addactivity-seeds-rate-zero-so-the-warning-can-never-fire.md) made the rate matrix
list activity **names** from `TeachActivity` ∪ `TeachRate` ∪ `SheetSource` ∪ `TeachSession`, which is
what lets an activity exist with no rate. It also removed the only way an activity ever left the
screen, and that removal was accidental in both directions:

- **Before:** the list was derived from the rate rows, so blanking all three boxes deleted them and
  the activity disappeared. A mis-typed `boxxing` could be un-typed.
- **After:** the registry keeps the name. `boxxing` stays as three `ยังไม่ตั้ง` boxes with no way to
  remove it from any screen — there is no delete path for a `TeachActivity` row anywhere.

036 accepted this and wrote it down as **clutter only**: no rate, no sessions, no warning, no baht.
That is still true, and this card is not urgent. Two things make it worth a card rather than a
shrug:

1. **The clutter is monotonic.** Every typo is permanent, and the only repair today is a `DELETE`
   typed by hand against the live database — exactly the kind of manual money-table surgery
   [029](../todo-human/029-sweep-rows-keyed-before-the-guards.md) exists to keep off the table.
2. **The bulk save pays for it.** Every listed activity renders three rate boxes, and every blank box
   is a `deleteMany` inside `save`'s single interactive transaction (`app/admin/config/page.tsx`,
   5 s default). Today that is 4 activities × 3 = 12 fields, the same as before 036, so nothing is at
   risk now — but the count can only grow, and the failure mode when it exceeds the transaction
   budget is a `P2028` rollback of the **whole** save. That failure is loud (nothing saved, and the
   screen says so) and never a wrong amount, which is why this is a capacity note and not a defect.

## Scope

Add a way to remove a registered name, and make it refuse when removal would lose something:

- delete a `TeachActivity` row only when it has **no** `TeachRate` row, **no** `SheetSource` and
  **no** `TeachSession` — i.e. only when the union's other three arms would not list it anyway, so
  the delete can never make a rate or a history invisible. That predicate is the whole safety
  argument and belongs next to `listActivities()` in `lib/activities.ts`.
- refuse **out loud** when it is not removable, naming which of the three is holding it. The refusal
  surface is already there (`?err=` flag → `_components/add-activity-form.tsx`), and the screen now
  has three flags, so re-read what task 027 decided about `Object.hasOwn` before indexing a lookup
  table — or keep it to `===` comparisons as 034 and 036 both did.
- ⚠️ **Never cascade.** A delete that removes rate rows or sessions with the name is the opposite of
  this card: it would turn a tidy-up into a money change.

While that screen is open, the same question applies to its neighbours: there is no delete path for
`ClassPrice`, `SheetSource`, `ColorRule` or `TrainerAlias` either. Do not fold them in blindly — but
if the answer here is a reusable "remove only when nothing references it" shape, say so in the card
rather than letting the next one re-invent it.

## Who reviews this

Touches a page that writes `TeachRate`-adjacent config ⇒ **`code-reviewer`**, and
**`payroll-auditor`** too if the implementation ends up reading or writing `TeachRate` for the
removability predicate (it should only *read* it).

## Notes

- Named in advance by `architect` while designing task 036 ("ลบกิจกรรมที่ไม่มีเรทและไม่มีคาบ"), so
  the loss of the accidental removal path would be recorded rather than discovered. The capacity half
  was added by `payroll-auditor` on that card's review (finding 6), 2026-09-19.
- **Not** a blocker for 035, 037, 039 or 040, and it moves no money in any direction.
