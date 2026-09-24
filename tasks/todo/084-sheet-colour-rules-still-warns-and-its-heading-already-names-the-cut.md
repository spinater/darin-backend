# `sheet-colour-rules.md` is at 176 and the boundary is already a heading in the file

- status: todo
- commit:

## Goal

ใบ 083 split `form-refusals.md` in two and asked for `sheet-colour-rules.md` to be "looked at in the
same pass". It was, and the honest result is **174 → 172**: the ใบ 080 frontmatter pointer that
pushed it over was tightened (every claim kept, the flag list now read from
`form-refusals.md`'s table where it lives), and one duplicated sentence about the
unguarded hex *shape* became a pointer to the copy 35 lines above it.

That is all a shrink can honestly buy. Going further means deleting lessons, which §5 forbids and
`scripts/check-knowledge.sh` says in its own comment is the easy wrong path.

## The boundary is already a heading in the file

Line 122: `## The refusals of the two colour screens (moved here from form-refusals.md at ใบ 070)`
— that section **arrived as a unit** at ใบ 070 and is 51 lines of the card's 176. Splitting there:

| | Lines after |
|---|---|
| `sheet-colour-rules.md` — the rule, why nothing seeds or guesses, the `colorGaps` fold, what is not proven | ~121 ⇒ **inside §5's 40–120 band for the first time** |
| the new card — `addColor`'s two refusals and `/sync/review`'s three | ~55 |

## Why this is a card and not part of ใบ 083

🔑 **A warn is braking distance, not a rule — and the gate says so in its own words**, which is
rule** — *"170 ไม่ใช่กฎ มันคือระยะเบรก … จะสอนให้คนแตกการ์ดแบบลวก ๆ เพื่อผ่านเกต"*. ใบ 083 had a
different reason to act: `form-refusals.md` was at **192/200**, eight lines from the hard cap, with
[081](081-the-review-screens-queue-guard-and-its-remaining-silences.md) and
[082](082-calendarDate-accepts-a-year-that-cannot-be-real.md) both landing on it. It came out at
**146**. Nothing is that urgent here: 28 lines of headroom, and no card in the queue grows this one.

⚠️ So this is **not** "finish what 083 started". It is the next split, named with its line so the
next person does not re-derive it — the same way `tasks/done/073-split-form-refusals-knowledge-card.md`
named ใบ 083's cut.

## Requirements (§5, unchanged from ใบ 083)

1. **`sources:` shrinks with the prose.** ⚠️ Measured while writing this card: it probably **cannot**
   here — the parent still claims `addColor` refuses a bad `meaning`, stores lowercase and refuses
   `#ffffff` (so `app/admin/config/_actions.ts` stays) and still claims the `?hex=` listing mirrors
   `colorGapsSeen()`'s filter (so `app/sync/review/page.tsx` stays). Two cards, one file, one claim
   each — the arrangement that card already runs with `form-refusals.md`. **Say so in the card
   rather than dropping a source to look tidy.**
2. **Re-read every card that links to it** — [colour-gap-states.md](../../.docs/knowledge/domain/colour-gap-states.md)
   calls itself "the other half" of it, and [teach-rate-lookup.md](../../.docs/knowledge/domain/teach-rate-lookup.md)
   points at it for the unruled-colour blocker. Both may end up pointing at the wrong half. That is
   [078](078-a-card-pointer-that-resolves-but-names-the-wrong-owner.md)'s class of bug.
3. **A row in `.docs/knowledge/index.md`**, Thai, in the neighbours' style, naming the parent by
   **file name, not by position** — ใบ 083 had to fix three rows that said *"แยกจากการ์ดบน"* and
   stopped being true the moment two rows were inserted between them.
4. **Prove pure movement**: the moved block cut from HEAD by line range must `diff` clean against
   the new card except for declared re-anchor hunks.

### Re-stamped 2026-09-24 — the number moved while this card sat in `todo/`

The card was opened at **172**. It is **176** now: ใบ 082 added the §5-mandated dated note to it as
an incidental `sources:` card (4 lines), and splitting it inside ใบ 082's commit would have broken
§6 rule 4 (one feature, one commit), so it was correctly left alone. Nothing about the plan changes
— the cut is still the ใบ 070 section, which is still 51 lines — but the table below was computed
from 172 and now reads 4 lines light on the parent side. 🔑 **Re-measure with `wc -l` before
splitting rather than trusting either number**; a card that has drifted twice will drift again.

## Notes

- Precedent for the mechanics, in order of closeness: ใบ 083 (two cuts, 45 lines moved, 2 declared
  re-anchors) · [073](../done/073-split-form-refusals-knowledge-card.md) · [023](../done/023-split-two-oversized-knowledge-cards.md).
