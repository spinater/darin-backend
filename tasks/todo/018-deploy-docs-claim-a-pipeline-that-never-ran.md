# Two ops docs and CLAUDE.md describe a deploy pipeline that has never once run

- status: todo
- commit:

## Goal

Three places in the repo state that pushing to `develop` deploys:

- `.docs/knowledge/ops/gates.md`, open-holes item 3 — "`verify.sh` ยังไม่อยู่ใน CI — push develop แล้ว deploy
  เลยโดยไม่มีเกตขวาง"
- `.docs/knowledge/ops/deploy.md:35` — "**push develop = dev deploy ลงแล้ว**"
- `CLAUDE.md` §6, Deploy — "**push-to-develop = dev deploy is already live**"

**It has never run.** `.github/workflows/deploy-dev.yml` fires on `push: branches: [develop]`, but
the repo has no `DEPLOY_SSH_KEY` secret, so every run dies at the ssh step — the workflow's own
header says so, and the host bears it out: 157.85.104.171 is still on `feat/sync-progress-ui` at
`106cbe8`, 50 days stale. Measured read-only from the host on 2026-09-18.

`deploy.md:40` already records the missing secret a few lines below its own headline claim, so that
file contradicts itself rather than being simply wrong.

## Why this is worth a card and not a quiet patch

The error points the safe way for *deploying* and the dangerous way for *reasoning*:

- Someone reads "push = live deploy" and treats a push as a release — over-cautious, harmless.
- Someone reasons **from** that premise to a decision. That already happened once: during task 017
  the `private-68` lane weighed the commit/push call partly on push-to-develop being armed, and
  said afterwards the premise was wrong. The outcome did not change, but the reasoning rested on it.

The reverse error is the expensive one and it is coming: the day `DEPLOY_SSH_KEY` is added, all
three statements become true in the same minute, and `migrate` starts running `prisma db push`
against the persistent `pgdata` volume on every deploy (§2 rule 8, already written into
`tasks/todo-human/002-deploy-host-setup.md`).

## Scope

- Correct all three statements to say what is true: the workflow exists, is committed and is
  readable, and is **not armed** — no secret, so no run has ever reached the host.
- Keep the warning they were carrying. "No gate in front of develop" stays true and stays the
  reason the local gate is the only gate; it just is not true *yet* that a push reaches the host.
- Both knowledge cards list their sources — check `check-knowledge.sh` staleness in the same commit
  (§5), and whether `.github/workflows/deploy-dev.yml` belongs in `deploy.md`'s `sources:`.
- One line in each place pointing at task 002, which is where the secret actually gets added.

## Notes

- Flagged by the `private-68` lane at the end of task 017, deliberately not patched into either
  that card or task 009 — it is ops and belongs to neither.
- Do **not** "fix" this by adding the secret. That is task 002 and it is blocked on a human.
