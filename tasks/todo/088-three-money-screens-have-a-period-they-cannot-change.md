# `/ot`, `/sales` and `/classes` read a period they give the operator no way to change

- status: todo
- commit:

## Goal

All three screens take `?period=YYYY-MM`, default it to the current month, query their table with it
and redirect back to it after every write:

```
app/ot/page.tsx:27       const period = periodParam ?? new Date().toISOString().slice(0, 7);
app/sales/page.tsx:33    const period = periodParam ?? new Date().toISOString().slice(0, 7);
app/classes/page.tsx     — same
```

**Nothing on any of the three renders a control that sets it.** Grepped: no `type="month"`, no
period `<select>`, no previous/next month link. The only period navigation in the app is
`/sync/review`'s `hrefFor`, and the two dashboards that link into it. So the period is reachable
only by hand-editing the address bar, which is not an operation a counter staff member performs.

## Why it is a card and not a nicety

1. **It is the reason ใบ 082's window is loose.** That card had to choose between binding a row's
   date to the screen's period (tightest — and it catches `2025-06-05` typed for `2026-06-05`,
   which the configured window does not) and a plausible-operating-window. It chose the window
   *because* period-binding with no month control would refuse yesterday's OT row typed on the 1st
   of the next month and offer no way out. Ship the control and the tighter guard becomes available.
2. **Today the failure is silent in the ordinary direction too.** Save a row dated outside the
   month the screen is showing and it is written, the redirect returns to the same period, and the
   row **is not in the table** — the operator sees their entry vanish with nothing said. The two
   "semi-self-revealing" screens of ใบ 082 are only semi-self-revealing because of this.
3. A month is the unit every one of these screens is built around; being unable to say which month
   you are looking at is the missing half of the screen, not a preference.

## Scope

- One control, one home: the three screens share the shape, so it is a component, not three
  copies (the `app/_components/` precedent — `submit-button.tsx`, `warning-card.tsx`).
- It is a `GET` navigation, not a server action: changing month must not write anything.
- ⚠️ It must **preserve `err=`** or deliberately drop it — a rejection notice that survives a month
  change describes a row that is no longer on screen (the same reasoning that makes every `add`
  redirect back to the clean URL).
- Decide whether `/sync/review` joins: it already has period navigation of its own via `hrefFor`,
  so this may be three screens, not four.
- Once it exists, re-open the tighter date guard: see ใบ 082's **Decision** section for what
  period-binding would close that the window does not.

## Notes

- Opened by ใบ 082, which measured the gap while deciding its bounds. Nothing here was found by a
  crafted request — it is what the three files render.
- Related: [082](../done/082-calendarDate-accepts-a-year-that-cannot-be-real.md) ·
  [079](079-periodRange-accepts-aliases-for-one-month-and-payslips-are-keyed-by-the-string.md)
  (what a period *string* is allowed to be, rather than how it is chosen) ·
  [006](../todo-human/006-ui-design-pass.md)
