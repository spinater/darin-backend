---
name: tekton-brief
description: Write a brief for the claude-tekton lane (Qwen3 27B via llm-router.tekton.sh) and dispatch it. Use when handing mechanical, fully-specified work to that lane instead of implementing it here — a rename across files, boilerplate from an exact spec, a template filled in, a repetitive edit with a known shape. Also use to judge whether a piece of work belongs there at all.
---

# Briefing the tekton lane

`claude-tekton` runs **Qwen3 27B**, roughly a tenth the capability of the lanes in `CLAUDE.md` §9.
It is a separate process reached by `bash scripts/tekton.sh <brief.md>` — never `Task`/`Agent`.

CLAUDE.md §9 already says brief detail is **inversely proportional to the model's strength**: a
sonnet lane gets numbered steps and a copyable template, an opus lane gets the goal and the traps.
This lane sits below both, and the rule extends one step further:

> 🔴 **A brief for this lane contains no decisions left to make.** Where an opus lane is handed a
> goal and a sonnet lane a procedure, this lane is handed a **transcription task**. Every question
> the work raises is answered *in the brief*, by you, before it is sent.

The failure mode is specific and it is not "it writes bad code". It is that **an undecided question
gets answered by a guess, and the guess is written in the same confident prose as the work** — so
the brief that says "update the config keys as appropriate" comes back with invented key names,
plausibly formatted, in the right file.

## Step 1 — decide whether it belongs here at all

Send it only if **all four** are true:

1. You can name **every file** it may touch. Not a directory, not a glob — a list.
2. You can state the finished state as something a `git diff` can be checked against.
3. Nothing in it is money, schema, or auth. Those are §2 and §9 invariants; they do not leave the
   opus lanes, however mechanical the edit looks. A rename inside `lib/payroll.ts` is still
   `lib/payroll.ts`.
4. It needs **no test written and no gate read** — the lane has no Bash. If the work only makes
   sense alongside a test, write the test here and let the lane fill the implementation.

Anything else: do it yourself or send it to the project's own developer lane. **A brief that took
longer to write than the edit would have taken is a brief you should not have written** — say so and
move on; that is a correct outcome, not a failure.

## Step 2 — write it to `.scratch/`

`.scratch/` is gitignored and is where working files belong (§6 rule 5 — never `/tmp`).
Name it `.scratch/<NNN>-<slug>-brief.md` after the task card it serves.

Use these sections, in this order. Every one is load-bearing; the ones people drop are 4 and 6, and
those are the two that decide whether the result is reviewable.

```markdown
# <one line: the finished state, not the activity>

## Files you may touch
- path/one.ts
- path/two.ts
Touch nothing else. If the change seems to need another file, STOP and say so.

## What is already true
<the current state of those files, concretely — the exact current name, signature or block.
 Quote it. Do not send the model to "find" something; tell it what it will find.>

## Do exactly this
1. In `path/one.ts`, replace `<exact old text>` with `<exact new text>`.
2. …
<Numbered. One edit per step. Literal strings, not descriptions of strings.>

## Templates to copy
<If anything is being created, paste the complete shape it must have — not a description of
 the shape. A 27B model reproduces a template well and invents one badly.>

## Decisions already made — do not revisit
- <naming choice> is `<the name>`. Do not shorten, pluralise or "improve" it.
- <the ambiguity you noticed> resolves to `<your answer>`.
<This section is the one that prevents the guessing. If you found nothing to put here,
 you have not looked hard enough at your own brief.>

## Done means
- [ ] <a condition a diff can be checked against>
- [ ] Nothing outside the file list above changed.

## Do not
- Do not run commands or claim to have run them. You have no Bash.
- Do not refactor anything you were not asked to change.
- Do not add comments explaining the change (the task card is its record).
- If any step cannot be done exactly as written, STOP and report which one and why.
```

## Step 3 — dispatch, then verify *here*

```bash
bash scripts/tekton.sh .scratch/<NNN>-<slug>-brief.md
```

Then, yourself:

1. **Read the diff, never the log.** The model writes its reasoning into the ordinary text block, so
   the log deliberates out loud and ends with "I have completed…" whether or not anything happened.
   `scripts/tekton.sh` prints `git diff --stat` for exactly this reason.
2. `bash scripts/verify.sh`.
3. Review per §9 — and note `scripts/tekton.sh` writes files inside the repo, so if the diff reaches
   `app/**`, `lib/**` or the schema, it is reviewed like any other change. **The lane's output has
   no special standing.** An edit nobody asked for is a finding even when the rest is right.

## When it comes back wrong

Fix the **brief**, not the output, and re-dispatch on a clean tree (`git checkout` is not how you
clean it — §6 rule 8: it restores from the index and takes unstaged work with it silently). A brief
that failed twice is a brief whose work was not mechanical; take it back.
