# `counter-test.sh restore` is one-shot, and a failed second restore turns a kill count into a guess

- status: todo
- commit:
- found while running task [064](../done/064-gymmo-import-problems-have-no-home.md) · confirmed by
  `payroll-auditor` in the same review

## What happened

`bash scripts/counter-test.sh restore` **consumes its store**. A second `restore` against the same
`save` fails — and its failure reads enough like success in a `tail -1` that a lane took it as one.
Two mutants then stacked on files that had never been restored, and the repair was done **by hand**.

The code came out fine (46/46 tests pass, the diff was read line by line). What did **not** survive is
the *evidence*:

🔑 **`restore` compares against the sha256 it recorded at `save` — that comparison is the only thing
that makes a restore evidence rather than an assertion.** On a hand-repaired file it never ran. So
every "this mutant killed exactly N arms, and nothing else moved" claim for those files is
human-attested, not proven, and a counter-test whose specificity is unproven is not a counter-test.

## Why this is a gate bug, not a lane's mistake

CLAUDE.md §6 rule 8 made `counter-test.sh` **the safe path** precisely so that breaking the code on
purpose could not lose work — `git checkout` restores from the index and deletes anything unstaged,
which is why the rule exists at all. A tool whose second `restore` fails converts a mutant round into
a hand-repair, which is exactly the state §6 rule 8 was written to prevent. The trap is in the tool,
so the fix belongs there.

## What to fix

1. **A second `restore` must not be silently unusable.** Either make it idempotent (keep the store
   until an explicit `drop`) or make the failure impossible to misread — non-zero exit **and** a
   message that names the state: "ไม่มี store แล้ว (restore ไปแล้วเมื่อ …) ⇒ ไฟล์ตอนนี้ยังเป็น mutant หรือถูกซ่อมมือ
   ไม่รับประกัน".
2. **`save` must refuse to overwrite a live store**, or at minimum say loudly that one exists. That is
   the moment two mutants start stacking.
3. **Say the protocol in the tool's own help**: one `save` per mutant, `restore` before the next one.
4. ⚠️ **Check `restore`'s own exit code and output shape first** — the whole finding is that its
   failure was readable as success. Whatever the fix, a selftest arm must assert that a second
   `restore` exits non-zero (`scripts/tests/` — and note that touching `scripts/**` turns the
   deferred selftest tier back on, §7).

## What to record, not just fix

The pin rows in `scripts/junit-pins.txt` that were written during the stacked round overlap in what
they claim (two rows both attributing kills to the same key-derivation mutant). Re-prove **one mutant
at a time on a clean tree**, and record **failing test names** rather than a count — a count cannot be
checked afterwards by anyone, which is how this went unnoticed in the first place.

## Second sighting — ใบ 043, 2026-09-21

It happened again, unprompted, to a lane that had **not** read this card: a three-mutant loop of
`save` → mutate → test → `restore` per iteration. The first `restore` succeeded and consumed the
store; the second and third printed *"ไม่มีคลังของสายนี้"* to a `>/dev/null 2>&1` and returned, so
mutant 2 was never undone and mutant 3 landed on top of it. Mutant 1's evidence is clean, mutant 2's
is clean, **mutant 3's was worthless** and had to be re-run.

🔑 **What makes this worth recording:** the file was `lib/color-rules.ts`, **new and not yet
`git add`ed**, so `git checkout` could not have recovered it either (§6 rule 8) — the repair was by
hand. The damage a silent `restore` does is therefore not bounded by "you can always go back to
HEAD". And the loop that produced it is the obvious way to write a multi-mutant counter-test, which
is the argument for "Starting a second mutant without restoring the first is refused", below, over
merely making the second `restore` louder.

## Done when

- A second `restore` cannot be mistaken for a successful one.
- Starting a second mutant without restoring the first is refused or loudly reported.
- A selftest arm covers both, and the protocol is written where the next lane will read it.
