# Three knowledge cards are in the §5 warn band — split each at the seam it already draws

- status: done
- commit: 13316c9 · e6a0637 · 06bfd3d
- opened by ใบ 065, which pushed all three over 170 · the precedent is
  [042](042-split-payroll-rules-card-at-the-engine-screen-seam.md), shipped the same day

## Goal

`scripts/check-knowledge.sh` warns above **170** (hard cap 200). After ใบ 065:

| Card | Lines | Headroom |
|---|---|---|
| `ops/gate-tiers-and-pins.md` | ~~194~~ → **106** ✅ | — |
| `domain/money-input-guards.md` | ~~189~~ → **76** ✅ | — |
| `domain/gymmo-import.md` | ~~190~~ → **154** ✅ | — |

🔴 **All three moved inside ใบ 065's five review rounds alone** — `gate-tiers-and-pins.md`
183 → 194, `money-input-guards.md` 171 → 189, `gymmo-import.md` 165 → 190, because every card that
adds a test file adds a paragraph to its pin history — three pins in one card. **Seven lines is less
than one review round**, and the next card to add a test hits the hard cap and has to split under
time pressure, which is when a split goes wrong. This one is not "when convenient".
⇒ **Do this card before the next behaviour card**, not after: a review round that finds a defect in
`applyGymmoImport` cannot record the fix on `gymmo-import.md` without hitting 200.


⚠️ And one **file** is in the same position: `lib/gymmo-import-run.ts` is **448/500** against
`scripts/check-file-length.sh`'s 450 warn after ใบ 065's fix round. Its seam is the same one as the
card's — the read/preview half (`readExisting` · `readClosedPeriods` · `readHandKeyedSignal` ·
`previewGymmoImport`) against `applyGymmoImport`'s transaction. Not this card's scope unless it goes
over; recorded so the next person to add a field knows the brake is two lines away.

None is a gate failure and none was padded — each grew because a real claim landed on it. But 11
lines of headroom is one review round, and §5's answer to a card near its cap is **split**, never
trim to stay under. The warn is the brake working.

## The seams, already drawn by each card's own `sources:`

1. **`ops/gate-tiers-and-pins.md`** — two subjects sit in one card and only one of them keeps
   growing: *the two tiers* (`verify.sh` · its selftest, §7 of the rulebook) and *the junit pin
   layer* (`check-code-junit.sh` · `junit-pins.txt`), which gains a paragraph on every card that
   adds a test. Split at the `## The junit pin layer` heading; `scripts/verify.sh` and
   `scripts/tests/check-verify-summary-selftest.sh` stay with the tiers, `scripts/check-code.sh`,
   `scripts/lib/check-code-junit.sh` and `scripts/junit-pins.txt` go with the pins. 🔴 **Do this one
   first** — it is the one with six lines and the one every future test card has to touch.

   ✅ **Done.** The seam taken is **not** the one sketched above, and the difference is the point: the
   tier half does not grow, the **pin history** does — five review rounds of ใบ 065 added eleven
   lines to this card and every one of them was a table row. So `## The junit pin layer`'s *rules*
   stayed and its *history* left: `ops/junit-pin-history.md` (**115**) holds the card-by-card
   paragraphs and the "what each raise bought" table, with `scripts/junit-pins.txt` as its **only**
   source — and that source came **out** of the parent (§5), so a new test file now goes stale on one
   card instead of two. Parent **194 → 106**. The filename is unchanged on purpose: 22 citations in
   13 files point at it and all but one are about the half that stayed.
2. **`domain/money-input-guards.md`** — the *field* guards (`lib/form-number.ts`,
   `lib/config-form.ts`, `lib/staff-form.ts` and their tests) against the *per-screen* half (the
   action table, the `?err=` surface, the two pair guards on `/classes`). The second half is the one
   that grows as screens land, exactly as `money-on-screen.md` was to `payroll-rules.md` at ใบ 042.

   ✅ **Done** — the seam was exactly as sketched. `domain/form-refusals.md` (**143**) takes the
   per-action table, the `?err=` surface and the two *pair* guards (`noShow` vs `booked`, and ใบ 065's
   `confirm=imported`), with `lib/config-form.ts` · `lib/staff-form.ts` · their tests ·
   `lib/ot-import.ts` and the four screens moving **out** of the parent's `sources:` with the prose
   (§5). Parent **189 → 76**: the predicate alone, which is one decision and does not grow. Citations
   re-pointed — `payroll-rules.md` ×2, `money-on-screen.md`, and the `newstaff` flag comment in
   `lib/staff-form.ts`, which names the table it must not be renamed out of. ⚠️ 143 is over §5's
   40–120 band and under the 170 warn: the remainder is one topic (per-action policy) and the only
   cut below this seam would separate an action's *refusal* from how it *reports* it, which is the
   pair a reader needs together.
3. **`domain/gymmo-import.md`** — ใบ 063 already named this boundary and chose not to act on it
   (it was 172 then): *the key and the write* against *the three preview signals*, which is where
   ใบ 065's eight lines went and where item 4 of ใบ 063 will add more. `gymmo-import-data.md` is the
   worked precedent — that split came out of this same card.

   ✅ **Done** — `domain/gymmo-import-preview.md` (**69**) takes *"three things the preview must show
   before anybody confirms"*, sourced by `lib/gymmo-import-run.ts` (**also** the parent's, and that
   is correct rather than a leftover: one file, two genuinely different claims — the transaction and
   the preview — so touching it should stale both) plus `lib/gymmo-hand-keyed.*`, which came out of
   the parent with the prose. Parent **190 → 154**. Two things fixed on the way: the heading *"What
   reaches the screen instead of being decided"* was about the **planner's** refusals, not the
   screen, and now says so; and the two cards citing the moved claims — `class-import-blockers.md`
   (the `imported − matched` shape) and `class-import-queue.md` (signal 1 on the result) — point at
   the new card. ⚠️ 154 is over §5's band: the remainder is the key **and** the write, which cannot
   be cut apart — `sourceKey`'s whole justification is what `diffGymmoPlan` and `applyGymmoImport`
   then do with it, and a reader who has one without the other re-derives the wrong half.

## Result

All three ✅ · `check-knowledge: warn 0` for the first time since ใบ 058. Every card in the repo is
now under 170, and the three that grow — pin history, per-action refusals, preview signals — each
have their own file, so the next card to add a test, a form or a preview signal lands in a card with
room instead of in one six lines from the cap.

## Rules for each (§5)

- Shrink `sources:` **with** the prose. A card that moves its text and keeps the parent's whole
  source list goes stale just as often — ใบ 042 is the worked example, including the case where a
  test file legitimately sources **both** halves because both quote its numbers.
- 40–120 lines each where the remainder allows it, a row per card in
  [index.md](../../.docs/knowledge/index.md), and re-point every citation:
  `grep -rn "<card-name>" .docs .claude scripts app lib prisma`.
- **Do not fold a split into a card that also changes behaviour.** A §5 split is provable by reading
  — a card's claims moved, none invented — and burying it under a code diff costs that. One commit
  per card is fine; three separate commits is better.
