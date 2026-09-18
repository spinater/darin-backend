# Two pages still add baht up inside the component

- status: todo
- commit:

## Goal

Task 011 deleted the two screen-side money formulas (`/ot`'s `เป็นเงิน`, `/classes`'s `มูลค่า`), and
the money knowledge card was rewritten to say so. Writing that sentence is what found this one: two
pages still add baht up inside the component.

```ts
// app/page.tsx:43
["รวมจ่ายสุทธิ", slips.reduce((s, x) => s + x.net, 0).toLocaleString("th-TH")],

// app/payslips/page.tsx:58 — the same expression, on the period list
const total = slips.reduce((s, x) => s + x.net, 0);
```

`payroll-auditor` found the second occurrence while sweeping `app/**` for arithmetic during the task
011 review; they are one defect in two places and want one answer, not two.

`app/page.tsx:41` is the neighbouring case and is **not** the same thing — `ยอดขายในงวด` reads
`sales._sum.netPrice`, a sum Postgres computed, which is a stored value read back rather than a
formula in a component.

## How bad is it, honestly

**Lower than the two columns task 011 removed, and the card should not pretend otherwise.** Both of
those re-derived a rate × quantity the engine also derives; this one only adds up `Payslip.net`
values the engine already produced and `money()` already rounded. Nobody can be underpaid by it.

What it can do is *read* wrong:

- Summing n values that are each exact to 2 dp still accumulates binary error (~1e-13 at this size).
  `toLocaleString("th-TH")` defaults to 3 fraction digits, so today that error rounds away before it
  reaches the screen — the protection is a default nobody chose, not a decision.
- It is an **unrounded** aggregate of **rounded** parts, which is the same shape as the aggregate
  hazard recorded in `.docs/knowledge/domain/payroll-rules.md` rule 4 (20 rows summing to 266.60
  against an engine that pays 266.67). Here the parts are the engine's own outputs, so the two agree
  — but the shape is one an agent is told to distrust, sitting in a file no card watches.

## The decision this card needs

Not urgent, and there is a cheap option and a correct one:

1. **Round the display once** — `money(...)` the reduce, or give `toLocaleString` explicit
   `minimumFractionDigits: 2, maximumFractionDigits: 2`. Costs nothing, keeps the sum in the page.
2. **Move the total into the query or into `lib/`** — an `aggregate({ _sum: { net: true } })` over the
   same `where`, so both pages read a total instead of computing one, and `app/**` holds no baht
   arithmetic at all. That is what makes the knowledge card's invariant clean enough to state without
   a caveat.

Option 2 is the one that closes the class of bug rather than this instance of it. Option 1 is what to
do if this is judged not worth a query change.

## While the file is open

`app/page.tsx` is the one screen whose whole job is a per-period overview, so whoever takes this card
should also check whether `ยอดขายในงวด` and `รวมจ่ายสุทธิ` want a `บาท` unit — neither carries one
today, and after task 011 removed the baht columns elsewhere, the dashboard is where a reader now
goes for a money figure that is not a payslip.

## Notes

- Found by `code-reviewer` during the task 011 review (finding 2), raised as the counter-evidence that
  made the proposed knowledge-card sentence *"the payslip is the single place a baht figure appears
  anywhere in this product"* false. That sentence was corrected in task 011 rather than the code —
  the card now states what is true (no screen **computes** baht; stored values and configured rates
  are read back in several places) and points here.
- `app/admin/config/page.tsx` also shows baht (rates, class prices, ฐานเงินเดือน) and `/classes`
  shows `({c.price})`. Those are configured values rendered as they are stored, not arithmetic — out
  of scope for this card, and deliberately so.
