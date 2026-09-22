---
sources:
  # The two parses the table's flags come out of — `kind`, and the identity flags themselves.
  # They are here and not on [money-input-guards.md](money-input-guards.md) because what they
  # encode is per-action policy — which blank means what, in which order refusals win — not the
  # predicate itself. ⚠️ The parses' own logic, their pins and the baht a blank `cfg` box cost left
  # this card at ใบ 083: [config-form-parses.md](config-form-parses.md).
  - lib/config-form.ts
  - lib/staff-form.ts
  # `calendarDate` is exported from here and the `date` rows below rest on it. The **paste** that
  # closed that rollover first is [ot-paste-import.md](ot-paste-import.md)'s since ใบ 083.
  - lib/ot-import.ts
  # The four screens whose actions this card enumerates. Re-introducing a bare
  # `Number(formData.get(x))`, or dropping the clean-URL redirect from any action that writes, must
  # land here as STALE rather than pass under a card still promising both.
  - app/ot/page.tsx
  - app/sales/page.tsx
  - app/classes/page.tsx
  - app/admin/config/page.tsx
  # ใบ 080 put the ยืนยัน action on this card's surface: its `date` guard and its two former silent
  # `return`s are **field** refusals on the shared `?err=` surface, not colour ones.
  # [sheet-colour-rules.md](sheet-colour-rules.md) keeps that screen's *colour* refusals (ใบ 070)
  # and lists this same file for them — two cards, one file, one claim each, and they go stale
  # together. Dropping any of the three flags below must land here.
  - app/sync/review/page.tsx
---

# ด่านของแต่ละ action — อันไหนปฏิเสธอะไร และมันบอกคนยังไง

Split out of [money-input-guards.md](money-input-guards.md) at ใบ 068 (it had reached 189/200).
That card owns **the predicate**: what `finiteNumber`/`isBlank` refuse and why `Number()` cannot be
trusted on an HTTP boundary. This one owns **the policy on top of it** — which action guards which
field, what a *blank* means in each one, and the shared `?err=` surface they all report through.
It is the half that grows: every new form adds a row, not a rule.

Read the predicate first; nothing here re-states it.

Two topics have left this card. `/classes`'s two **pair** guards at ใบ 073 (it had reached
167/200) — a value weighed against a second value, where the refusal is itself a money decision:
[pair-guards.md](pair-guards.md). And at ใบ 083 (192/200) the `/ot` paste's per-line buckets →
[ot-paste-import.md](ot-paste-import.md) · the two parses with real logic behind them →
[config-form-parses.md](config-form-parses.md).

## The actions, and what each refuses

| Action | Fields | Blank means | Flag |
| --- | --- | --- | --- |
| `/ot` `add` | `hours` | refused | `err=hours` |
| `/ot` `add` | `date` | refused — and so is a day that is not a real calendar day (ใบ 072); **checked before `hours`**, one flag per submit | `err=date` |
| `/sales` `add` | `date` | refused — and so is a day that is not a real calendar day (ใบ 080); **checked before both prices** | `err=date` |
| `/sales` `add` | `netPrice` | refused | `err=netPrice` |
| `/sales` `add` | `listPrice` | "sold at list price" ⇒ `null`, and fine | `err=listPrice` |
| `/classes` `add` | `date` | same predicate again (ใบ 080); **checked before both head counts and before the pair** | `err=date` |
| `/classes` `add` | `booked` | refused | `err=booked` |
| `/classes` `add` | `noShow` | 0 — what `?? 0` and `defaultValue={0}` already said | `err=noShow` |
| `/classes` `add` | `noShow` **vs** `booked` | — (a *pair*, not a field ⇒ [pair-guards.md](pair-guards.md)) | `err=noShowOverBooked` |
| `/sync/review` `resolve` (ยืนยัน) | `date`, then `staffId` | **blank is refused, loudly** — both were a bare `return` until ใบ 080; the calendar-day half is the same predicate as the three rows above | `err=need` (either field blank) · `err=date` · `err=stale` |
| `/admin/config` `addStaff` | `baseSalary`, `classCredit` | 0, the documented default | `err=newstaff` |
| `/admin/config` `addStaff` | `name`, `username` (trimmed), `password` | refused, one flag each and in a **fixed order** ([config-form-parses.md](config-form-parses.md)) — a `File` part too, never `"[object File]"` | `err=newstaffName` · `err=newstaffUser` · `err=newstaffPass` |
| `/admin/config` `addStaff` | `username` **vs** the rows already there | — (the `@unique` index, caught as `P2002`) | `err=newstaffDup` |
| `/admin/config` `addActivity` | `activity` (trimmed), and the same name **vs** every one already visible | refused — it used to `return` in silence, the box cleared and nothing said the activity was not added (task 034, the same shape task 027 took out of `addStaff`); a name already in the union is refused too, and the action writes one `TeachActivity` row and **no** `TeachRate` row (task 036) | `err=activityEmpty` · `err=activityDup` |
| `/admin/config` `save` | every `cfg` box — every rate, threshold and percentage the engine has | refused | `err=cfg` |
| `/admin/config` `save` | every teach rate, class price and staff salary field of the bulk form | a **rate** blank deletes that rate; every other blank is refused | `err=rate` · `err=class` · `err=staff` |

🔴 **ใบ 072 paid the same debt back in the other direction, on `date`.** ใบ 014 closed the rollover
on the paste ([ot-paste-import.md](ot-paste-import.md)); the `add` form in the table above kept
`new Date(String(formData.get("date")) + "T…")` with no check, so `POST date=2026-06-31` stored
**`2026-07-01`** — 120 ฿ out of June into July on a 12-hour day,
**and** an upsert on `(staffId, date)` overwriting that person's real 1 July row. A
`type="date"` attribute is a *client* hint exactly as `type="number"` is, and the file was already
arguing that for one of its two fields. `calendarDate` is exported from `lib/ot-import.ts` now, so
both paths refuse the same set — the `finiteNumber` arrangement applied to the other field.
⚠️ **Both callers must `.trim()`**: the round-trip compares against the text it is handed, so
`" 2026-07-01"` is refused, and a caller that forgets is a caller that diverges.
⚠️ `staffId` in `add` stays unguarded **on purpose** — an id nobody owns fails on the foreign key,
which is loud, not silent, so it is not this class of defect.

🔴 **ใบ 080 — the other three money writes took the same unguarded date, and the date now goes
first on every one of them.** One `?err=` slot fits in the URL ⇒ the order of the guards *is* the
decision about which problem the operator is told about first, and the date outranks the money
fields because it is the field that decides **which month the row belongs to** — which on two of
these screens is not a per-row question:

| Screen | What one shifted row costs beyond itself |
|---|---|
| `/sales` | §1.6's threshold is applied **retroactively across the month** ⇒ an 8,000 ฿ bill typed `2026-06-31` takes June's self-closed total 32,000 → 24,000, misses 30,000, and pays 10% not 12% = **1,440 ฿ short**, four times the 400 ฿ of commission that moved |
| `/classes` | §1.4's `max(0, classValue − classCredit)` deducts from the **month's total** ⇒ a 200 ฿ คาบ moved to 1 July makes June `max(0, 2,000 − 2,000) = 0` *and* is absorbed by July's own credit: **200 ฿ paid becomes 0, in both months** |
| `/sync/review` | the reviewer is there **because** the sheet's date was unreadable ⇒ highest-probability typo site in the app, and the write is `reviewed: true` ⇒ **no later sync repairs it** (250 ฿ in the wrong month, permanently, queue clean) |

🔑 **One sentence, one worked example (`เช่น 2026-06-31`), each screen's own noun** (บิลนี้ · คาบนี้)
— a box reading as copied from another screen, beside two that do not, is the third dialect. Only
`/sync/review`'s says more, and only what is particular to it: the stamp is permanent.

🔴 **Both of `resolve`'s silent `return`s became flags in the same card.** Neither lost a baht (the
row stays in the queue) ⇒ §2 rule 4's *shape*, and the shape is the point: **a click that does
nothing is indistinguishable from a click that confirmed the คาบ.** `err=need` is the ordinary case
— neither control carries `required`; `err=stale` refuses a ยืนยัน on a row that already left the
queue **by way of `resolve`**, reachable from an ordinary **second tab** (`resolve` is itself what
takes rows out of `NEEDS_ATTENTION`) and not only from a crafted post — the same concurrency as the
`err=closed` re-check beside it.

⚠️ **`err=stale`'s predicate is not `NEEDS_ATTENTION` and one cell of the difference leaks** —
`{status: "ignored", staffId: null}` passes both halves of `status !== "needs_review" && staffId
!== null`, and `ignore` writes `status: "ignored"` without ever setting `staffId` ⇒ a **trainer-less
row a human has just ข้าม** can be confirmed back onto pay from a stale tab, permanently
(`reviewed: true`). Pre-existing, **not** fixed by ใบ 080, carded separately; dropping
`&& staffId !== null` is the wrong fix — it would refuse the legitimate `{status: "ok",
staffId: null}` arm.

⚠️ `resolve` also had **no redirect at all** ⇒ point 4 below was false for it until ใบ 080 added
`redirect(back)` — pinned to a `/sync/review` prefix, since `back` is client-supplied, and carrying
`?page=` so a reviewer is not thrown to page 1 per row. `bulkIgnore` is still in that state on its
success path.

## The error surface — copy it, do not invent a third dialect

Established at `/ot` (task 009) and `/payslips` (task 013 item 1), and now the same on every screen
that writes — five since ใบ 080 brought `/sync/review` onto it:

1. the action `redirect`s back to the same page with `?err=<flag>`;
2. the flag is a **flag, not a message** — nothing from the URL is rendered, the Thai copy lives in
   the page file (§2.5) ⇒ a crafted link cannot put words on an admin's screen;
3. the notice names the field **and** says nothing was saved — a bill or a คาบ that somebody
   believes is keyed in is the failure this screen can hide;
4. a successful write redirects to the **clean** URL, so a stale notice cannot outlive its cause.

🔴 **Point 4 binds every action on the page that writes, not just the guarded one.** One screen has
one `?err=` slot, so an action that only `revalidatePath`s leaves whatever flag is in the address
bar standing over the thing it just saved. The expensive instance was `addStaff`: refused → admin
fixes the field → submits again → the `create` **succeeds** while `?err=newstaff` still renders
"ยังไม่ได้เพิ่มพนักงานคนนี้" ⇒ the person is added twice, the alias follows the newer row, and the
orphan draws its `baseSalary` in every run with no sessions to make it look wrong. `addActivity`,
`addAlias`, `addColor`, `toggleActive` and both `del` actions carry the same redirect for the same
reason.

`/admin/config` keeps its copy in `_components/` (`save-notice`, `add-staff-form`, `add-activity-form`)
rather than the page: 462 lines against the §4 ceiling of 500 when the first moved, and the rate matrix
followed as `rate-table.tsx` at task 036.

## ใบ 043 / ใบ 070 — the colour refusals moved out

`addColor`'s two refusals (`?err=colorMeaning` · `?err=colorNeutral`) and `/sync/review`'s three
(the unaimable `?hex=`, the unruled colour, `?err=closed`) are **one topic with its own home**:
[sheet-colour-rules.md](sheet-colour-rules.md). They left this card at ใบ 070, when adding the third
screen's worth pushed it to the 200-line cap — and `app/admin/config/_actions.ts` left `sources:`
with them, since that card already watches it. 🔑 They obey everything above unchanged: a flag not a
message, the redirect to a clean URL, and **loud, never a silent `return`**.
