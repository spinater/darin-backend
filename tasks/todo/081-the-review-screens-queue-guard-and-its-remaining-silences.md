# `/sync/review`'s queue guard misses one cell, and three clicks there still say nothing

- status: todo
- commit:

## Goal

ใบ 080 turned two of `resolve`'s silent `return`s into `?err=` flags. What it left is one guard that
**approximates** queue membership instead of mirroring it, and three more silences on the same
screen — including one on the button that takes money *off* a slip.

## 1. 🔴 The guard does not mirror `NEEDS_ATTENTION` — and the gap is reachable by an ordinary click

`app/sync/review/page.tsx:192`

```ts
if (row.status !== "needs_review" && row.staffId !== null) redirect(withErr(back, "stale"));
```

`NEEDS_ATTENTION` (`lib/payroll-run.ts:9`) is `OR: [{status:"needs_review"}, {status:"ok", staffId:null}]`.
Measured against every cell:

```
{"status":"needs_review","staffId":null}  blocked:false  inQueue:true    ok
{"status":"needs_review","staffId":"s1"}  blocked:false  inQueue:true    ok
{"status":"ok","staffId":null}            blocked:false  inQueue:true    ok
{"status":"ok","staffId":"s1"}            blocked:true   inQueue:false   ok
{"status":"ignored","staffId":null}       blocked:FALSE  inQueue:FALSE   ← writes, though not in queue
{"status":"ignored","staffId":"s1"}       blocked:true   inQueue:false   ok
```

**`ignore` never sets `staffId`** (`app/sync/review/page.tsx:144` writes only
`status:"ignored", reviewed:true, reviewNote`), and queue rows are largely trainer-less — so ข้าม on
an ordinary row lands it in exactly the uncovered cell.

**The scenario needs no crafted post, only two tabs** — the same concurrency the `err=closed`
re-check beside it was written for. A and B both show the queue. A clicks ข้าม on a ว่ายน้ำ row: the
คาบ comes off pay, which is the whole point of ใบ 070. B, rendered before that write, still shows the
row with its ยืนยัน button. B clicks it, the assertion passes, and the row is written
`status:"ok", staffId, reviewed:true`.

⇒ **the คาบ a human deliberately took off pay is back on pay at 250 ฿ — permanently, because
`reviewed: true` stops every later sync from touching it — and nobody is told.** §2 rule 4's shape.

### The fix, and the trap inside it

```ts
if (!(row.status === "needs_review" || (row.status === "ok" && row.staffId === null)))
  redirect(withErr(back, "stale"));
```

🔴 **Do not "simplify" this by dropping the `&& row.staffId !== null` half of the original** — that
refuses the legitimate `{status:"ok", staffId:null}` arm, which is half of what the queue lists
(`NEEDS_ATTENTION`'s own comment says why that arm exists: a คาบ whose trainer was deleted falls out
of both the slip and the queue = money lost in silence).

⚠️ The predicate now exists in two places with no mechanical link. Prefer deriving it from
`NEEDS_ATTENTION` — or, if a Prisma `where` object cannot be reused as an in-memory predicate
cheaply, put the two next to each other with a comment each naming the other, and say so in the
knowledge card.

## 2. `bulkIgnore` — no success redirect, and two silent `return`s of its own

- `if (!scope) return;` and `if (!ids.length) return;` (~`:225-227`). **`!ids.length` is the ordinary
  click** — the operator presses the bulk button with nothing ticked — and it is silent. That is
  verbatim the argument that justified `err=need` one function above, on a button that takes money
  **off** a slip.
- It also has no clean-URL redirect on success, so an `?err=` from an earlier refusal outlives it.
  ใบ 080's stated reason for deferring ("a bulk submit carries no `back` field") is **weak**:
  `backHref` is in scope and the bulk `<form>` already carries a hidden `hex`. The real reason is
  that its clean target differs across three listings — which is a decision, so make it here.

## 3. `if (!row) return;` — now the only silent exit in an action where everything else speaks

`app/sync/review/page.tsx:130`. ใบ 080 sharpened this by adding `redirect(back)`: on a clean URL, a
vanished row is now **indistinguishable from success**. No baht (there is nothing left to write), and
it is a genuinely different question from the other two — `/classes`'s `del` answers it one way with
`err=gone`, and nobody has said which is right here. Decide it rather than letting it stay by default.

## 4. Three phrasings of "nothing was written" on one screen

`ยังไม่ถูกยืนยัน` · `ยังไม่มีอะไรถูกบันทึก` · `ไม่มีอะไรถูกบันทึกเพิ่ม`. Each is accurate and each
carries its own remedy, so §2 rule 4 is met — but there is now more variance *within* this screen
than between the three screens ใบ 080 touched, which is the opposite of what that copy rule was for.
⇒ a `microcopy-writer` / `uxui-designer` pass, not a guess at the keyboard.

## Also left over from ใบ 080

`err=stale` redirects **before** `revalidateColorGaps`, so this tab's client router cache can still
serve the listing showing the row — which is why its copy has to say "โหลดหน้านี้ใหม่". A
`revalidatePath("/sync/review")` before that one redirect would make the instruction unnecessary.
Cosmetic, but it is the kind of thing that is cheap here and expensive to rediscover.

## Notes

- Item 1 found by `code-reviewer` in the ใบ 080 review; the truth table above was re-run by hand
  before this card was opened. Items 2–4 from the same round, `payroll-auditor` concurring on 3.
- 🔴 **This card is about the screen's guards, not about dates.** The date predicate's own gap —
  `calendarDate` accepts an implausible *year* — is
  [082](../done/082-calendarDate-accepts-a-year-that-cannot-be-real.md) and reaches four screens.
- Related: [080](../done/080-three-more-money-writes-still-take-an-unguarded-date.md) ·
  ใบ 070 for why ข้าม exists at all.
