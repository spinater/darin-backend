# The seed re-creates a rate the owner deliberately deleted — on every deploy, paying silently

- status: todo
- commit:

## Goal

`/admin/config` now promises, in amber under the rate matrix
(`app/admin/config/_components/rate-table.tsx`, task 036):

> ช่องว่าง = **ยังไม่มีเรท** → คาบของกิจกรรมนั้นจะไม่ถูกคิดเงินและขึ้นเตือนในสลิป

and `lib/config-form.ts:87` implements it: a blank rate box **deletes** the `TeachRate` row.

`prisma/seed.ts` then puts it back:

```ts
for (const [activity, byRank] of Object.entries(RATES))
  for (const [rank, rate] of Object.entries(byRank))
    await db.teachRate.upsert({
      where: { activity_rank: { activity, rank } },
      update: {},        // protects an EDITED value
      create: { activity, rank, rate },   // …but re-creates a DELETED one
    });
```

and the seed runs on **every deploy** — `docker-compose.yml`'s `migrate` service →
`Dockerfile:31` → `prisma db push && bun run prisma/seed.ts`.

**Worked example.** The owner decides PT-rank staff no longer teach `pt` and blanks the pt×PT box.
The warning appears exactly as promised, and for the rest of that month the slips say so. The next
`git push origin develop` re-creates pt×PT at **200 ฿**, and a PT trainer with 40 คาบ is paid
40 × 200 = **8,000 ฿** the owner had removed — with `warnings: []`, because a rate now exists again.

🔴 `update: {}` is the trap. It looks like "never overwrite the owner", and it is — for a value that
was *changed*. It does nothing for a value that was *deleted*, because `upsert` cannot tell "this row
was removed on purpose" from "this row has never existed". That is the same shape as
[task 036](../done/036-addactivity-seeds-rate-zero-so-the-warning-can-never-fire.md) itself: a number nobody
typed, arriving where the engine reads it as a choice.

## Scope

A policy decision first — CLAUDE.md §2 rule 3 says `CONFIG_DEFAULTS` values are used **at seed time
only**, and this is the same question one table over: *what is the seed allowed to assert about a
database that has been in use?*

- **Seed the reference rates only when `TeachRate` is empty** (a first-boot fixture), leaving every
  later deploy to touch nothing. Simple, and it makes "seed" mean "initialise", which is what §2 rule
  3 already says about config.
- **Or record what was seeded** and re-assert only rows the seed itself created and nobody has since
  touched. More faithful, and much more machinery than this app has anywhere else.

Do **not** "fix" it by deleting the rate seeding: a fresh database has to come up with a working
matrix, and `prisma/seed.ts` is the only thing that gives it one.

Check the same shape in the same pass, rather than fixing one and leaving the siblings: `ClassPrice`,
`PayrollConfig`, `SheetSource`, `ColorRule` and the new `TeachActivity` are all seeded with
`upsert … update: {}` and all of them can be deleted or edited by an owner through a screen. The
answer should be one rule applied to the file, not five judgements.

⚠️ The deploy pipeline has **never reached the host** ([018](018-deploy-docs-claim-a-pipeline-that-never-ran.md),
[002](../todo-human/002-deploy-host-setup.md)), so this has not fired in production yet. That is a
reason to fix it *before* the pipeline is armed, not a reason to defer it — the day the ssh key lands
is the day a deploy starts rewriting owner decisions.

## Who reviews this

`prisma/seed.ts` writes `TeachRate` ⇒ CLAUDE.md §9's path list ⇒ **`code-reviewer` +
`payroll-auditor`**, with `architect` first for the policy choice above. Not the `claude-tekton` lane.

## Notes

- Found by `payroll-auditor` on the task 036 review, 2026-09-19 (finding 3). The mechanism is
  **pre-existing** and unchanged by that diff — what 036 changed is that the screen now *promises*
  the opposite in writing, so the contradiction became visible.
- It is also the last remaining answer to "is there any path left that creates a `TeachRate` row with
  a number nobody typed?", which is the question task 036 was opened to close. 036 closed the screen;
  this closes the deploy.
