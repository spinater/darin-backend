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

---

## What shipped — the `?hex=` listing, and the four guards that make its button safe

**Shape chosen: the first option** (`?hex=` on `/sync/review`). It reuses the `ignore` action and
its per-row `reviewNote` audit trail; the `/admin/config` bulk `updateMany` was rejected for writing
no per-row reason and for putting a bulk money action on a screen that has none.

| Piece | Where |
|---|---|
| the filter, pure and pinned | `payableWithColorWhere()` · `isReportableHex()` — `lib/color-rules.ts` |
| the listing, the way back, both actions | `app/sync/review/page.tsx` + `_components/` |
| the closed-period lock | `lib/closed-slips.ts` |
| one path list for both writers | `lib/revalidate.ts` |
| the count of what people removed | `runBlockers().handIgnored` → `/` and `/payslips` |

🔴 **Both review lanes BLOCKed the first cut, and every guard below is one of their findings.** The
listing was right from the start; what was wrong was everything around the button.

1. **`?hex=` accepted anything.** `?hex=%23ffffff` listed the ~320 payable คาบ a month that carry
   white — no swatch counts white, `addColor` refuses to *store* a white rule — under a bulk ข้าม, at
   50 × 250 = **12,500 ฿ a page**. And `mode: "insensitive"` compiles to `ILIKE`, so `%` and `_` are
   **wildcards** (`payroll-auditor` measured it against a real Postgres): `?hex=%25` matched every
   coloured payable คาบ of every period. ⇒ `isReportableHex` (`^#[0-9a-f]{6}$` and not neutral), and
   `payableWithColorWhere` returns **`null`** rather than a wider filter so no caller can forget it.
2. **One instruction for rules that mean opposite things.** ว่ายน้ำ is ruled `review` — *ให้คนตรวจ*
   never said "do not pay" — and the page told its reader to ข้าม *"ตามกฎสี"*. ⇒ one sentence per
   rule, bulk ข้าม only under `skip`, and **no listing at all** for a colour with no rule or ruled
   `pay`, because fifty checkboxes under an unanswered colour is the default-to-`skip` this repo
   refuses, reached through a URL.
3. **The queue's own controls were lethal on these rows.** They are `status: "ok"` with a date and a
   trainer, i.e. already inside computed slips. ยืนยัน on a row marked `sync ครั้งหน้าจัดให้เอง`
   strands it for ever (50 × 400 = **20,000 ฿**); editing the date of a คาบ in a paid period pays it
   **twice**. ⇒ the colour and ignored listings are read-only but for their one button.
4. **ข้าม in a closed period hid the problem instead of fixing it.** `runPayroll` will not recompute
   a non-`draft` slip, so the money stays and the row simply leaves `colorGaps`' `status: "ok"`
   filter — the one report still saying the colour is being paid goes quiet (**9,500 ฿** measured).
   ⇒ such a row is listed, named `งวดปิดแล้ว`, has no button, and the action re-checks it itself.
5. **Nothing named what the button removed.** This is the product's first action that takes money
   *off* a slip, and a recomputed slip carries no trace. ⇒ `handIgnored` on both dashboards (beside
   the queues, never summed with them) and `?ignored=1` with **เอากลับเข้าคิว** as the way back.

Also: `bulkIgnore` is constrained by the listing's own `where` instead of trusting posted ids · the
bulk button says **ในหน้านี้**, because selection does not survive pagination · `addColor` and the
ข้าม share `revalidateColorGaps()` · `sheet` is URL-encoded in every link (Thai sheet names).

⚠️ **What is still not proven:** no test here reaches a database, so that the listing's query agrees
with the swatch that linked to it is **reviewed, not asserted** — [015](015-db-test-lane.md). What is
pinned (16 tests) is the pure decision *may this string be aimed at rows at all*.

⚠️ **Not touched, on purpose:** whether a *sync* may override a human's review — that is
[066](../todo-human/066-may-a-human-dismiss-an-import-problem.md) and
[069](069-a-recoloured-reviewed-row-is-invisible-to-every-screen.md)'s question, and every act here
is a human's own explicit click in the direction their own colour rule already points.
