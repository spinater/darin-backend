# `check-text-bytes.sh` came out in 017 — and 57 cards later the bug it watched landed in a money file

- status: todo
- commit:

## Goal

Task 017 removed four gates on the ground that there was *"nothing left in this repo for them to
watch"*. One of them was `check-text-bytes.sh` — described in that card as watching
*"a file meant to be text whose bytes read as binary, which every other content gate then skips
whole"*. CLAUDE.md §7 kept the hole on the record as **open, not closed**.

On 2026-09-22 it landed, in `lib/ot-import.ts` — the parser that decides which OT hours become
money. A literal NUL (0x00) was written as a template-literal separator (`` `${staffId}\0${date}` ``),
and **`bash scripts/verify.sh` was `ALL GREEN` over it**. Caught by eye in review, not by a gate.

This card is not "put the gate back". It is: **decide**, with a real instance on the table instead
of a hypothetical, whether the gate returns or the hole stays documented — and if it returns, at
what price.

## What was measured on the day (so the decision does not have to re-derive it)

| Tool | Behaviour with the NUL present |
| --- | --- |
| `grep -n 'finiteNumber' lib/ot-import.ts` | **no output, exit 1** — not "Binary file matches", not an error (this box is `ugrep 7.8.4`) |
| `grep -rn 'parseOtPaste' lib/` | returns only the test file — the function's own definition is invisible in a recursive grep of its own directory |
| `rg` | `binary file matches (found "\0" byte around offset 10773)`, no lines |
| `git grep` | works — not fooled |
| `git diff` | rendered as **text**, because the NUL sat at byte ~10774 |
| `tsc --noEmit` · `prettier --check` · `bun test` | all pass — a NUL is legal inside a template literal |

🔴 **The `git diff` row is the one with a fuse on it.** Git sniffs only the first **8000 bytes** for
a NUL. Verified in a throwaway repo: NUL at byte 100 ⇒ `git diff` prints `Binary files a/f.txt and
b/f.txt differ` and `--stat` shows `Bin 20101 -> 20107 bytes`; the identical edit with the NUL at
byte 9000 ⇒ ordinary text diff. `lib/ot-import.ts` had about **2.7 KB of headroom**. A later card
that trims that much doc-comment would have turned the money parser's diff binary — in exactly the
review that is supposed to catch a rate change — with no warning and no red gate.

## Why this is worth a decision rather than a reflex

The cost side is real and 017 was right about it at the time: `git ls-files -c -o --exclude-standard
| grep -cP '[^\x00-\x7F]'` was **0**, and a gate with no live subject is pure latency. What 017
could not price is the direction of the failure, which is the same argument CLAUDE.md §4 makes for
deciding file scope by *exclusion*: **a missing byte check is silent, and it hides the file from the
tools everyone reads with.** §8 puts grep at step three of how every agent in this repo reads code.

## Scope — whichever way it goes

- If the gate returns: it is a **core-tier** check (it costs one pass over `git ls-files`, like
  `check-file-length.sh`), it needs its selftest back (§7 — the gates' gates), and it must say which
  file and which byte offset, because "is binary" with no offset is not actionable.
- If it does not return: CLAUDE.md §7's paragraph must stop saying "latent" for this one and say
  *"fired for real on 2026-09-22, caught by review"* — a hole with an instance is a different fact
  from a hole without one.
- Either way, look at the sibling in the same paragraph: **`check-path-bytes.sh`**, whose subject
  (a non-ASCII path that `core.quotePath` quotes, which the remaining gates then skip **before their
  own counter moves**) was also measured at zero in 017 and is still latent. This card is the
  evidence that "measured zero today" and "cannot happen here" are not the same sentence.

## Notes

- Found by `code-reviewer` and `payroll-auditor` independently in the task 014 review round; both
  reached the same conclusion about which removed gate it belongs to.
- The record of what each removed gate watched is
  [017](../done/017-shrink-gate-and-review-lanes.md) — CLAUDE.md §7 says to read it before
  concluding a class of bug "cannot happen here". That instruction is what this card is a receipt for.
