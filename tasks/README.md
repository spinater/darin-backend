# Tasks

One file per task. **Moved, never deleted.**

- `todo/` — open work. Filename `NNN-short-slug.md`, globally sequential (never restarted per area).
- `done/` — shipped. Move the file here in the commit that ships it and record the SHA.

The task number is this repo's cross-reference spine: cite it in the commit subject
(`feat: เพิ่มเรท Yoga (task 004)`), in spec section notes, and in code comments where a decision
needs explaining.

## Template

```md
# <หัวข้อภาษาไทย>

- status: todo | done
- commit: <SHA once shipped>
- spec: darin-payroll-system.md §1.5 · REQUIREMENTS.md §5
- money: yes | no

## Goal
What and why, in a line or two.

## Notes
Decisions, gotchas, follow-ups.
```

Two fields beyond the obvious, both load-bearing:

- **`spec:`** — which rule this implements. `solution-architect` quotes it instead of guessing, and
  it is what makes a payroll change auditable a year later.
- **`money: yes`** — the trigger for `payroll-auditor` in the dev loop. When in doubt, write `yes`.

## Workflow rules

1. **Commit before redeploy.** Deploy off a commit, never a dirty tree.
2. **One task, one file.** Track it here before starting, not after.
3. **Docs stay current per commit.** Knowledge cards and spec updates land in the same commit as the
   code — `bun run check:knowledge` enforces the card half.
4. **One finished feature, one commit.** Never batch several features into one deploy, or a broken
   deploy cannot name its cause.
