# A hand-reviewed คาบ recoloured in the sheet is invisible to every screen

- status: todo
- commit:

## Goal

ใบ 043 reports colour gaps from the **database**: `TeachSession.bgColor` grouped against
`ColorRule`. That is the right default — state outlives an event, and the banner is true on every
visit long after any sync. It has exactly one blind spot, and `code-reviewer` found it while
reviewing 043:

```ts
// lib/sync.ts
if (prev?.reviewed) {
  if (prev.rawValue !== p.rawValue) { … status: "needs_review" … }   // text changed → reopen
  res.skippedReviewed++; done++; continue;                            // otherwise: untouched
}
```

A row a human has cleared is re-opened **only when its text changes**. So:

1. a คาบ is reviewed by hand (an unknown trainer matched) ⇒ `status: "ok", reviewed: true`;
2. the counter staff later cancel it by **colouring the cell**, leaving the text alone;
3. `syncSources()` hits `prev.reviewed`, `continue`s, and never writes the new `bgColor`;
4. the database still holds the *old* colour ⇒ `colorGaps()` cannot see the new one, `/sync/review`
   has nothing in it, the slip has no warning, and the คาบ is paid.

🔴 **This is the one case where the sync-time signal would have seen more than the stored state** —
`p.bgColor` is in hand at the line above the `continue`, and it is the only place the new colour
ever exists. ใบ 043's decision table argues "state beats event" without naming this exception; that
line now points here.

## Why it is its own card, not a fix inside 043

The repair is a change to **`lib/sync.ts`**, which is money-path code (§9: `code-reviewer` +
`payroll-auditor`), and the decision it needs is not obvious:

- **reopen the row when `bgColor` changed**, exactly as a changed `rawValue` does? That is the
  consistent reading — a recolour *is* an edit by the counter staff — but it overrides a human's
  review with a sheet edit, which is the thing `reviewed` exists to prevent. On the ว่ายน้ำ sheet
  (100% hand-reviewed by construction) any recolouring sweep would re-open the entire sheet.
- **or report it without touching the row** — count distinct `(bgColor now) ≠ (bgColor stored)` on
  reviewed rows during the sync and surface it, leaving `reviewed` intact.

⚠️ **Do not decide this from out here.** The second option is the conservative one and probably
right, but it needs the same "who may override whom" answer that ใบ 066 is waiting on a human for.

## Done when

- A recoloured hand-reviewed คาบ is visible on at least one screen before the run that pays it.
- `reviewed: true` still means a sync cannot silently overwrite a human's decision.
- The exception line in `.docs/knowledge/domain/sheet-colour-rules.md` ("What is not proven") and
  ใบ 043's decision table both point at the outcome instead of at this card.

## Notes

- Opened out of the ใบ 043 review round (`code-reviewer` finding 2, 2026-09-21). Pre-existing: the
  `prev.reviewed` short-circuit is older than 043 and nothing in 043 made it worse.
- Measured shape: every ว่ายน้ำ row is `reviewed: true` (`prisma/seed.ts` gives that sheet
  `trainer: null`, so `lib/parser.ts` forces `needs_review` and a human clears each one) ⇒ that
  sheet is 100% inside the blind spot, at 250 ฿ per คาบ.
