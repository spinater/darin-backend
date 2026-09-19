# What "เพิ่มกิจกรรมใหม่" is actually for — and whether a rate of `0` is ever a deliberate choice

- status: todo-human
- commit:

- 🚫 **Blocked on linus (three questions, none of them about table shape).** They came out of the
  `architect` pass on [task 036](../done/036-addactivity-seeds-rate-zero-so-the-warning-can-never-fire.md)
  on 2026-09-19, which separated what a lane may decide from what it may not. 036 ships **without**
  these answers — it is correct under every one of them — so nothing is waiting on this card. What is
  waiting is knowing whether a branch of complexity in the payroll engine deserves to exist at all.

## 1. Is "this rank is not paid for this activity" a real thing that happens?

The engine currently distinguishes two cases and pays them differently:

| the rate | what the engine does |
|---|---|
| a row with `rate = 0` | pays 0 ฿, shows a line on the payslip, **no** warning — read as *the owner chose this* |
| no row at all | pays nothing, **warns** `ไม่มีเรทค่าสอน <กิจกรรม> × <ระดับ>` — read as *nobody has set it yet* |

The whole distinction rests on a `0` sometimes being deliberate. **Is it?** Concretely: does Darin
ever want a trainer of one rank to teach an activity and be paid nothing per session for it — or does
an owner always leave the box blank when there is no rate, so that a `0` in the database is *always*
a mistake or a leftover?

- If a deliberate `0` is real ⇒ everything stays as it is.
- If it is never real ⇒ a `0` could be read as "not set" and would start warning, which removes a
  branch from the engine and a paragraph from three screens. **Nobody may take that reading on his
  behalf**: it changes what appears on a payslip, and the direction that goes wrong (a warning that
  should not be there) is noisy, while the other direction (no warning when there should be one) is
  the silent zero this whole run of cards exists to remove.

⚠️ A separate, *retrospective* version of the same question is already queued at
[029](029-sweep-rows-keyed-before-the-guards.md) for the rows sitting in the live database. That one
needs database access; this one does not.

## 2. What should `/admin/config` → "เพิ่มกิจกรรมใหม่" do?

**The engineering fact behind the question, which is not obvious from the screen:** an activity added
there can never produce a paid session today. `TeachSession.activity` is copied from
`SheetSource.activity` (`lib/sync.ts:215`), and there is **no UI anywhere to create a `SheetSource` or
edit its `activity`** — the bulk save writes `spreadsheetId` only (`app/admin/config/page.tsx:110`),
and the four sheet sources come from `prisma/seed.ts`. So the form registers a rate dimension for work
the system cannot yet receive; a new activity needs a code change either way.

Three answers, all compatible with what 036 builds:

- **(a) keep it as pre-registration** — the admin sets the rate now, the sheet source arrives with the
  code change later. This is what 036 implements, and it needs no further work.
- **(b) extend the screen to add a sheet source too**, so adding an activity is end-to-end. A much
  larger card, and it puts the Google Sheet wiring in front of an admin.
- **(c) drop the form.** ⚠️ This contradicts `REQUIREMENTS.md` §6, which promises
  *"ตารางเรท กิจกรรม×ระดับ (แก้ทุกช่อง + เพิ่มกิจกรรม/ระดับ)"* — so it is a change to the agreed
  requirement, not a cleanup, and the requirement doc would move with it.

036 assumes (a) **and says so**. If linus answers (b) or (c) later, the money fix does not have to be
redone: under (c) the `TeachActivity` registry is dropped and the activity list falls back to the union
over the rate rows, sheet sources and recorded sessions, which is already how 036 builds it.

## 3. Yoga's rate — still open, still nobody else's to fill in

`REQUIREMENTS.md` §7 item 10 has asked for this since the requirement doc was written, and the
dashboard nags about it on every load (`ยังไม่มีเรทค่าสอนของกิจกรรม: yoga`). It is listed here only so
nobody "finishes" 036 by typing a plausible number into that row to make the warning go away. **The
warning is correct. It is doing its job.**

## Notes

- Raised by `architect` while deciding 036's shape (2026-09-19). It explicitly ruled that the table
  shape was its own call and these three were not — that boundary is the reason this card exists
  rather than a guess landing in the code.
- ✅ Nothing here blocks 036, 035 or 037. Move this back to `tasks/todo/` the moment there are answers,
  per [tasks/README.md](../README.md).
