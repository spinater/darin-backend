# An in-place `perl -i` edit emptied a money file, and §6 rule 8 does not cover that shape

- status: todo
- commit:

## Goal

On 2026-09-22, during task 014's fix round, `lib/ot-import.ts` was **truncated to 0 bytes**. The
cause was a one-liner that both passed `-i` to perl *and* opened `$ARGV` for writing inside the
script — two writers to one path, so the file was emptied before anything was read back.

Everything lost was **uncommitted**: the whole of task 014's work on that file, after it had
already been through two review lanes. There was no stash, no `counter-test.sh save`, and
`git fsck --lost-found`'s dangling blobs turned out to be an unrelated task card. The only reason
the work survived is that the agent still had a full read of the file in its own context and
retyped it.

## Why this needs a rule and not just a "be careful"

CLAUDE.md §6 rule 8 already teaches the lesson **for one specific tool**: `git checkout -- <path>`
restores from the index, so anything not `git add`ed is gone with no conflict and no warning. The
remedy it gives is `counter-test.sh save/restore`, which restores by copy and compares against a
recorded sha256.

This incident is the same failure — *uncommitted work destroyed silently by a command that looked
like an edit* — arriving through a door the rule does not name. The rule is written about
`checkout`; the hazard is about **any in-place rewrite of a file whose current contents exist
nowhere else**. `sed -i`, `perl -i`, `truncate`, a `>` redirect onto the file being read, and a
heredoc `cat > file` that starts before the old content is captured are all the same door.

The direction of the error is what makes it worth a rule (the §4 argument): the command **succeeds**.
Nothing is red. The next thing you see is a gate that passes on a file that is now empty or wrong.

## Scope

- Propose the addition to CLAUDE.md §6 — a rule 9, or a clause on rule 8 that generalises it from
  `git checkout` to *any* in-place rewrite. It must name the cheap habit, not just the hazard:
  **`git add` (or `counter-test.sh save`) before any in-place edit of work that is not committed.**
  Round-tripping through a new file and `mv` is the other safe shape.
- Decide whether anything mechanical can help, or whether this stays a rule. Candidate: the
  `PostToolUse` hook that already runs `check-file-length.sh` could also refuse a tracked file that
  just became **0 bytes** — a file emptied is never a legitimate edit, it is always this bug, and
  it is the one state that is cheap to detect and unambiguous.
- 🔑 Whatever lands, **the 500-line ceiling and §2.5 apply to the rulebook too** — CLAUDE.md is long,
  so this is a few lines in the right place, not a new section.

## Notes

- Related: [067](067-counter-test-restore-is-one-shot-and-that-breaks-its-own-evidence.md) — the
  save/restore tool this rule would point at has an open defect of its own, so the two should be
  read together before anyone writes "always use counter-test.sh" into the rulebook.
- The recovery in this instance was verified, not assumed: `git diff HEAD -- lib/ot-import.ts` had
  exactly 26 deletion lines and they matched the pre-truncation diff one for one, which proves no
  pre-existing content was lost. That check only works because HEAD still held the old version —
  it proves nothing about added lines, and it would have proved nothing at all for a **new** file.
  A new uncommitted file destroyed this way is simply gone.
