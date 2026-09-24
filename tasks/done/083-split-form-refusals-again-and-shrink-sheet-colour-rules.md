# `form-refusals.md` is at 192/200 — the split ใบ 073 named is now the next card, not a someday

- status: done
- commit: a01aea1

## Goal

Two cards are in §5's warn band (170, hard cap 200):

| Card | Lines | Why it grew |
| --- | --- | --- |
| `.docs/knowledge/domain/form-refusals.md` | **192** — 8 lines of headroom | ใบ 080 added three action rows, the per-screen cost table that makes the guard *order* decidable, and then its review round added the `err=stale` scoping |
| `.docs/knowledge/domain/sheet-colour-rules.md` | **174** | one frontmatter pointer, added by ใบ 080 for the ใบ 078 reverse-direction check |

The gate is green — this is a warn, not a failure — and it is being carded rather than crammed,
which is the precedent ใบ 013 set and ใบ 023 discharged.

## The boundary is already named, twice

`tasks/done/073-split-form-refusals-knowledge-card.md` named it when it made the first cut, and ใบ
080's implementer named the same one independently: **the ใบ 014 paste-import block** — the
four-bucket table (`unmatched` · `invalidHours` · `invalidDates` · what is skipped) plus the two
paragraphs framing it, and the `/ot` `paste` row in the action table.

That block sources `lib/ot-import.ts` and `app/ot/**` alone, and is self-contained: nothing in the
queue grows it. Moving it leaves the parent at roughly **112 + ใบ 080's additions**, back inside
the band, and leaves the parent as one topic — per-field refusals on the shared `?err=` surface.

## Requirements (§5, and the two things the last split taught)

1. **`sources:` shrinks with the prose on every card touched** — including `sheet-colour-rules.md`,
   which is over the band for a pointer and should be looked at in the same pass rather than left
   four lines under the warn. A card that moves its prose but keeps the parent's whole source list
   goes STALE just as often.
2. 🔴 **Re-read every card that links to the ones being split.** ใบ 073 falsified a sentence on a
   *third* card (`money-input-guards.md`) and no gate could see it: cards do not `sources:` other
   cards, so `check-knowledge.sh` is structurally blind, and `check-links.sh` sees only that the
   file still exists. That is [078](../todo/078-a-card-pointer-that-resolves-but-names-the-wrong-owner.md),
   and this card is the next chance to prove the reverse-link habit works before the gate question
   is even decided.
3. **A row in `.docs/knowledge/index.md`** for the new card, Thai, in the neighbours' style, naming
   the task it was split at.
4. **Prove pure movement** the way ใบ 073 did: the moved block cut from HEAD by line range must
   `diff` against the new card with only declared re-anchor hunks. ⚠️ ใบ 073's lesson — a sentence
   that was fine as rhetoric ("every row in the table above…") can become a **checkable claim that
   is false** once it crosses a card boundary. Re-read the seams, do not just move them.

## Notes

- 🔴 **Do this before anything else touches either file.** At 192/200 the headroom is **8 lines** —
  less than one action row with its reason. The next card that lands there either fails the hard cap
  or gets crammed, and §5's remedy is a split, never a shrink.
  [081](../todo/081-the-review-screens-queue-guard-and-its-remaining-silences.md) and
  [082](082-calendarDate-accepts-a-year-that-cannot-be-real.md) both land there.
  🔑 Same order as ใบ 073 before ใบ 072, and for the same reason: a docs split with a money change
  in flight makes the money diff unreadable. It was deferred out of ใบ 080 on that argument, not
  because the split could wait.
- Precedent for the mechanics: [073](073-split-form-refusals-knowledge-card.md) and
  [023](023-split-two-oversized-knowledge-cards.md).

---

## What was done

| Card | Before | After |
|---|---|---|
| `.docs/knowledge/domain/form-refusals.md` | 192/200 | **147** |
| `.docs/knowledge/domain/ot-paste-import.md` — **new**, cut A | — | 51 |
| `.docs/knowledge/domain/config-form-parses.md` — **new**, cut B | — | 56 |
| `.docs/knowledge/domain/sheet-colour-rules.md` | 174 | **172** (still warns) |

**Cut A is the boundary this card named** — the ใบ 014 paste block: the `/ot` `paste` row, the 🔑
same-predicate paragraph, the 🔴 two-layers paragraph, the four-bucket table, the ⚠️ infrastructure
line. Sources shrank to `lib/ot-import.ts` + `lib/ot-import.test.ts` + `app/ot/page.tsx` +
`app/ot/_components/paste-form.tsx`; the last two are **new** — the card's "one bullet per line, no
new surface needed" claim rests on the component, which nothing sourced before.

🔴 **Cut B was not named by this card and is a decision, not a discovery.** The named cut alone
leaves the parent at **exactly 170** — the warn line, zero braking distance — with
[081](../todo/081-the-review-screens-queue-guard-and-its-remaining-silences.md) and
[082](082-calendarDate-accepts-a-year-that-cannot-be-real.md) both landing on that file. §5's remedy
is a split, never a shrink, and `scripts/check-knowledge.sh` says in its own comment that paying the
difference by deleting old lines is the easy wrong path. So the two parses with real logic
(`parseConfigNumbers`, `parseNewStaff`) and the `cfg`-boxes hole left too — one topic, **parse the
whole form, then write**, and the only block on the parent with its own tests and its own pins
(12 and 9). ⚠️ **The card's projection of "roughly 112" for the named cut alone is wrong**: measured,
it is 170. Recorded here so the next person does not re-derive it.

**`sheet-colour-rules.md` was shrunk, not split, and it still warns at 172/200.** The ใบ 080
frontmatter pointer that pushed it over was tightened (flag list now read from `form-refusals.md`'s
table, where it lives) and one duplicated sentence became a pointer. That is what a shrink can
honestly buy. 🔑 **172 is a warn with 28 lines of braking distance, and the gate's own comment says
a warn is not a rule** — so the split is [084](../todo/084-sheet-colour-rules-still-warns-and-its-heading-already-names-the-cut.md),
which names the boundary by line (122, the section that arrived as a unit at ใบ 070) the same way
ใบ 073 named this one.

## Requirement 4 — movement proved

45 lines moved. HEAD `form-refusals.md` 117–131 `diff`s **clean** against the new card (zero hunks);
133–159 differs in exactly the one declared re-anchor; 63–67 and row 47 differ only by the declared
link insertion. Word-level comparison confirmed both re-anchors are the HEAD text plus the declared
insertion and nothing else.

## Requirement 2 — the reverse-link pass found seven, and review found five more

Fixed here: `money-on-screen.md` (the buckets' owner) · `money-input-guards.md` (frontmatter + two
prose pointers) · `pair-guards.md` (the P2002/TOCTOU argument travelled with the parse) ·
`payroll-rules.md` · `payslip-lifecycle.md` · three `index.md` rows saying *"แยกจากการ์ดบน"* that
stopped being true the moment two rows were inserted between them.

🔴 **`code-reviewer` returned BLOCK and was right**: the sweep looked for *"การ์ดบน"* (above) and
missed `index.md`'s form-refusals row saying *"ฝั่ง policy ของการ์ดข้างล่าง"* (**below**) — whose
referent became `ot-paste-import.md` the moment this commit inserted two rows under it. A fresh
relative pointer written in the same edit (*"สองแถวถัดไป"*) was the same defect again, one line
later. ⇒ **rows and pointers name the card, never its position.** Also from that round: the
`the five` re-anchor was checkable against a table that has seven actions and no longer holds one of
task 013's call sites, so it now enumerates the doors instead of counting them · `addStaff`'s
**fixed order** is load-bearing (9 pins) and only the child said so, so the parent's row points at it
· `form-refusals.md`'s *"the same on all four"* predated ใบ 080 putting `/sync/review` on that
surface · and `sheet-colour-rules.md` carried a ใบ 070 pointer claiming `form-refusals.md` owns the
`addColor` lowercasing claim, which that card has never contained (ใบ 078's exact shape, on the file
ใบ 084 is about to split).
