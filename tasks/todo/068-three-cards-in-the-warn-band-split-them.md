# Three knowledge cards are in the §5 warn band — split each at the seam it already draws

- status: todo
- commit:
- opened by ใบ 065, which pushed all three over 170 · the precedent is
  [042](../done/042-split-payroll-rules-card-at-the-engine-screen-seam.md), shipped the same day

## Goal

`scripts/check-knowledge.sh` warns above **170** (hard cap 200). After ใบ 065:

| Card | Lines | Headroom |
|---|---|---|
| `ops/gate-tiers-and-pins.md` | ~~194~~ → **106** ✅ | — |
| `domain/money-input-guards.md` | **189** | **11** |
| `domain/gymmo-import.md` | **190** | **10** |

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
3. **`domain/gymmo-import.md`** — ใบ 063 already named this boundary and chose not to act on it
   (it was 172 then): *the key and the write* against *the three preview signals*, which is where
   ใบ 065's eight lines went and where item 4 of ใบ 063 will add more. `gymmo-import-data.md` is the
   worked precedent — that split came out of this same card.

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
