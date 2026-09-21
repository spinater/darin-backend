# A hand-reviewed payable คาบ can be repaired from nowhere in the product

- status: todo
- commit:

## Goal

`/sync/review` lists `NEEDS_ATTENTION` (`lib/payroll-run.ts`):

```ts
export const NEEDS_ATTENTION = {
  OR: [{ status: "needs_review" }, { status: "ok", staffId: null }],
};
```

A คาบ a human has cleared is `status: "ok"` **with** a trainer, so it matches neither arm. `lib/sync.ts`
skips it on every future sync (`if (prev?.reviewed) … continue`). No other screen renders an
individual `TeachSession` — `/me`, `/payslips/[id]` and `/sync` all aggregate. ⇒ **those คาบ are
repairable from nowhere in the product**, and the `ignore` action that would repair them already
exists on the review page; only its listing excludes them.

ใบ 043 made this visible for the first time: a colour ruled **ไม่จ่าย** whose คาบ are hand-reviewed
shows red on `/`, `/payslips` and `/admin/config` for ever. Re-syncing does nothing, and the one
button that clears the entry is re-ruling the colour to **จ่ายปกติ** — i.e. the only working exit is
the one that declares a cancelled colour payable. On the ว่ายน้ำ sheet, which is 100% hand-reviewed
by construction (`prisma/seed.ts` gives it `trainer: null`, so `lib/parser.ts` forces
`needs_review`), that is 12 คาบ × 250 = **3,000 ฿** per month with no exit that is not a lie.

🔴 Both review lanes reached this independently in the ใบ 043 round — `payroll-auditor` finding 2
and `code-reviewer`'s BLOCK. ใบ 043 shipped with the **copy made true** ("ยังไม่มีหน้าจอไหนแก้ได้")
rather than with a fix, because the fix is `lib/sync.ts`/`/sync/review` work and the copy could not
be allowed to name a repair that does not exist.

## What to fix — two shapes, pick one

- **`?hex=` on `/sync/review`**: list `status: "ok"` rows of one colour so the existing `ignore`
  action can reach them, and link the swatch straight at it. Smallest change, reuses the action and
  the per-row audit trail (`reviewNote: "คนตรวจสั่งข้าม"`).
- **A per-colour `ข้าม n คาบที่ตรวจแล้ว` on `/admin/config`**: one `updateMany` to
  `status: "ignored"`. Fewer clicks, but it is a bulk money action on a screen that has none today,
  and it writes no per-row reason.

⚠️ **Whichever is chosen, it must not become a way to re-open a human's decision by accident** —
`reviewed: true` exists to stop a sync overwriting a person. This card moves rows *in the direction
the colour rule already says*, at a human's explicit click, which is a different act from the
override question ใบ 066 and ใบ 069 are waiting on.

## Not the same as ใบ 069

[069](069-a-recoloured-reviewed-row-is-invisible-to-every-screen.md) is a reviewed row **recoloured
in the sheet**, where the database never learns the new colour and nothing can see the problem at
all. This card is a colour the database **knows**, a rule that **exists**, and no action anywhere to
apply it. They share the `prev.reviewed` short-circuit and nothing else.

## Done when

- A hand-reviewed payable คาบ whose colour is ruled `skip` can be made `ignored` from a screen.
- `ColorSwatches`' `ยังไม่มีหน้าจอไหนแก้ได้` copy and ใบ 043's table row are replaced by the exit.
- Re-ruling a colour to `pay` is no longer the only way to clear a red entry.

## Notes

- Opened out of the ใบ 043 review round (2026-09-21). Pre-existing: the disjointness of
  `NEEDS_ATTENTION` and "reviewed and payable" is older than 043 and nothing in 043 made it worse.
