/**
 * The plausible operating window a hand-typed date has to fall inside (ใบ 082).
 *
 * 🔴 **Pure on purpose, and deliberately *not* folded into `calendarDate`.** That helper
 * (`lib/ot-import.ts`) answers one question — *does this day exist, and is it the day that was
 * written* — and it is shared by a parse that has no page context at all. It answers that question
 * correctly for `0226-06-05`: the 5th of June of the year 226 is a real day, written exactly as it
 * was meant. Measured before this module existed, every one of these was **accepted**:
 *
 * ```
 * 0226-06-05   0206-06-05   0026-06-05   9999-12-31   0001-01-01
 * ```
 *
 * A Chrome/Firefox date picker's year box takes three digits and zero-pads, so `0226` is produced
 * by an ordinary slip of the hand, not by a crafted post. The row then lands outside every
 * `periodRange` query ⇒ it appears in **no** payslip. On `/sync/review` that is permanent: the
 * ยืนยัน writes `status: "ok", reviewed: true`, so the คาบ leaves the queue, reaches no period, and
 * no later sync repairs it — 250 ฿ paid as 0 ฿ with the queue showing clean (§2 rule 4).
 *
 * 🔴 **No DB, no `new Date()` of its own.** `now` comes from the caller, exactly as the screens
 * already take their `period` from the clock, so the whole predicate is testable without one.
 *
 * ⚠️ **The window is deliberately generous, and that is the decision, not an oversight.** A window
 * is itself a refusal, so §2 rule 4 bites in *both* directions: too tight and a legitimate
 * back-dated correction — a backfill of last quarter, an OT row typed on the 1st for the 31st — is
 * refused, which is hours or a bill not paid. It is sized to catch the shape above (a year that
 * cannot be real), **not** a plausible-but-wrong year: `2025-06-05` typed for `2026-06-05` passes
 * this window and is ใบ 088's problem, which needs the row bound to the month the operator is
 * looking at and therefore needs a month control on three screens first.
 */

import { ConfigError, num, type Config, type ConfigKey } from "./config-keys";

/** Inclusive at both ends — see `withinWindow`. */
export type DateWindow = { earliest: Date; latest: Date };

/**
 * The class of failure `windowForRender` is allowed to catch — **every** way this module can
 * decide it has no usable window, and nothing else.
 *
 * 🔴 **It exists so the render path's `catch` can be narrow.** A page that wraps `dateWindow` in a
 * bare `catch` turns any unrelated fault inside it — a `TypeError` from a `cfg` that is not the
 * shape it claims, anything a future edit adds — into the same amber box saying "fix two config
 * keys", i.e. a wrong cause printed confidently and an exception nobody ever investigates. Tagging
 * the throws instead means the render path re-throws whatever it does not recognise and that fault
 * still reaches `app/error.tsx` and the log.
 */
export class DateWindowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DateWindowError";
  }
}

/**
 * `num()`, with its throw re-tagged — **the message is `num()`'s, unchanged**.
 *
 * ⚠️ The wrapping is only about *who may catch it*: a blank or missing `date.earliestYear` is a
 * window that cannot be built, exactly like the four checks below, and it has the same remedy on
 * the same screen. Re-writing the message here would put a second home for the same sentence
 * (§2 rule 3's argument, applied to copy): `num()` stays the one place that says what a bad config
 * value reads like.
 *
 * 🔴 **Only `ConfigError` is re-tagged, and that boundary is this module's, not `num()`'s**
 * (`payroll-auditor`, ใบ 082 third round). A bare `catch` here claimed more than the class above
 * promises: it turned *anything* coming out of that call — a `cfg` that is not the shape it claims
 * (`cfg[key]` on a null), a fault a later edit adds inside `num()` — into "the two date keys are
 * misconfigured", printed in an amber box on four screens. Narrowing it here is what makes the
 * `instanceof DateWindowError` check in `windowForRender` reachable rather than decorative, and it
 * is pinned as such.
 */
function bound(cfg: Config, key: ConfigKey): number {
  try {
    return num(cfg, key);
  } catch (e) {
    if (e instanceof ConfigError) throw new DateWindowError(e.message);
    throw e;
  }
}

/**
 * The window, in UTC midnights, from the two configured numbers and the caller's clock.
 *
 * 🔴 **Both bounds are `PayrollConfig`, never a literal** (§2 rule 3): `date.earliestYear` and
 * `date.futureDays`, read through the engine's own `num()` so a blank or a non-number throws here
 * rather than turning into a silent `0` (which would put `earliest` at year 0 and `latest` at
 * today — a window that refuses tomorrow and accepts the year 226, i.e. exactly backwards).
 *
 * ⚠️ **`new Date(0)` + `setUTCFullYear`, never `Date.UTC(year, …)`.** `Date.UTC` maps a year of
 * `0..99` onto `1900 + year`, so a `date.earliestYear` configured as `26` would silently become
 * **1926** and the window would swallow the whole class of defect this module exists for. The
 * setter has no such rule.
 *
 * 🔴 **A window that refuses everything throws, in `num()`'s own voice.** The module header's
 * argument about a silent `0` is the same argument one step further out: `/admin/config`'s `cfg`
 * arm accepts any non-negative finite number, so `date.earliestYear = 2027` saves cleanly and
 * **every money write in the app is refused at once** — `/ot`'s whole fingerprint paste, every bill
 * on `/sales`, every คาบ on `/classes`, every ยืนยัน on `/sync/review` (measured at ~640 ฿/day of
 * OT alone, inside §6's three-day window for variable pay). A guard that refuses everything is the
 * guard running **backwards**, and §2 rule 4 says it must say so rather than quietly refuse. The
 * same throw covers a bound that is not a representable `Date` at all (`date.futureDays` above
 * ~1e8 ⇒ `latest` is an **Invalid Date**), which used to leave `withinWindow` false for everything
 * *and* make the four `renderWindow.…toISOString()` call sites raise `RangeError` outside any
 * try/catch — four server error pages whose Thai cause is redacted in production.
 */
export function dateWindow(cfg: Config, now: Date): DateWindow {
  const earliestYear = bound(cfg, "date.earliestYear");
  const earliest = new Date(0);
  earliest.setUTCFullYear(earliestYear, 0, 1);

  // Today's UTC midnight plus the grace, in one call: `setUTCFullYear` normalises an overflowing
  // day-of-month, so no month or year arithmetic is done here by hand.
  const futureDays = bound(cfg, "date.futureDays");
  const latest = new Date(0);
  latest.setUTCFullYear(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + futureDays);

  // `now` is checked first and separately so the two messages below cannot be made to name a
  // config key for a fault that is the caller's clock — a misattributed cause sends whoever reads
  // it to `/admin/config` to fix a key that is already right.
  if (Number.isNaN(now.getTime()))
    throw new DateWindowError("dateWindow: now ไม่ใช่วันที่ที่ใช้ได้");
  // ⚠️ **"อยู่นอกช่วงที่เป็นวันที่ได้" is the *whole* cause here — a fraction never reaches this
  // check.** ใบ 082's third round was asked to add "ต้องเป็นจำนวนเต็มวัน" on the reading that
  // `MakeDay` returns NaN for a non-integral day. **Measured, it does not**: `MakeDay` takes
  // `ToIntegerOrInfinity` of each argument, so `setUTCFullYear(2026, 8, 24 + 0.5)` truncates to the
  // 24th and `date.futureDays = 31.9` is simply 31. Only a bound outside the representable range
  // (`1e9`, via `/admin/config`'s `cfg` arm, which accepts any non-negative finite number) lands
  // here, so naming integrality would state a cause that cannot have produced this throw — the
  // same defect in the mirror direction. The truncation itself is recorded in the test file.
  if (Number.isNaN(earliest.getTime()))
    throw new DateWindowError(
      `config date.earliestYear อยู่นอกช่วงที่เป็นวันที่ได้: ${earliestYear}`,
    );
  if (Number.isNaN(latest.getTime()))
    throw new DateWindowError(`config date.futureDays อยู่นอกช่วงที่เป็นวันที่ได้: ${futureDays}`);

  // ⚠️ Inverted, not merely tight: `earliest > latest` is an **empty** window, so nothing can be
  // written on any of the five call sites until a human moves a key. Reported with both bounds
  // printed, because the two numbers that produced it are the remedy.
  if (earliest.getTime() > latest.getTime())
    throw new DateWindowError(
      `config date.earliestYear (${earliestYear}) กับ date.futureDays (${futureDays}) ` +
        `ทำให้ช่วงวันที่กลับด้าน: ต้นช่วง ${day(earliest)} อยู่หลังปลายช่วง ${day(latest)} ` +
        `⇒ จะไม่รับวันที่ใดเลย — ต้องแก้ค่าที่หน้าตั้งค่าก่อนบันทึกข้อมูล`,
    );

  return { earliest, latest };
}

/** `YYYY-MM-DD` of a Date already known to be valid — for the messages above and `windowForRender`. */
function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Is this day inside the window? **Inclusive at both ends.**
 *
 * The edges are inclusive because both of them are ordinary: 1 January of the earliest configured
 * year is a real working day of this gym, and `now + date.futureDays` is the last day the grace was
 * bought to cover. An exclusive edge would refuse them with no way for the operator to tell why —
 * the mirror-direction failure the module header is about.
 *
 * ⚠️ Compares `getTime()`, not the `Date` objects: `===` on two `Date`s is identity, so the naive
 * version is green on nothing and a copy of the same instant would be refused.
 */
export function withinWindow(d: Date, w: DateWindow): boolean {
  const t = d.getTime();
  return t >= w.earliest.getTime() && t <= w.latest.getTime();
}

/**
 * What a **page render** gets: the two bounds as text, or the reason there are none.
 *
 * 🔴 **The render path and the action path answer the same failure differently, and that split is
 * the whole point** (`payroll-auditor`, ใบ 082 second review). On the action path the throw is
 * correct: a window nobody can satisfy must not let a dated write through. On the render path it
 * was a **regression** — before the throw existed, `date.earliestYear = 2027` left all four screens
 * rendering (both bounds were valid `Date`s) and refused only the dated writes, so everything
 * taking no date kept working. With the throw at module scope of the page, `/sales` 500s whole:
 * a 30,000 ฿ Premium membership entered twice can then be neither seen nor deleted, and a run
 * approved before someone fixes the key pays `30,000 × 10%` **twice** — 6,000 ฿ instead of 3,000 ฿
 * (§2.2 `comm.membership.full`). Same shape, 250 ฿ a duplicate คาบ on `/classes` (§1.2).
 *
 * So: the page renders, its period table and every dateless action (`del`, `bulkIgnore`) stay
 * reachable, `fault` prints in an amber box with the two offending numbers and the remedy, and the
 * dated form is disabled — a refusal that can be predicted belongs **before** the typing, not after
 * (§2 rule 4: the refusal has to be useful).
 *
 * ⚠️ **Only `DateWindowError` is caught; everything else is re-thrown** — see that class. This is
 * deliberately not `try { … } catch {}` around a render.
 */
export type RenderWindow =
  { bounds: { earliest: string; latest: string }; fault: null } | { bounds: null; fault: string };

export function windowForRender(cfg: Config, now: Date): RenderWindow {
  try {
    const w = dateWindow(cfg, now);
    return { bounds: { earliest: day(w.earliest), latest: day(w.latest) }, fault: null };
  } catch (e) {
    if (e instanceof DateWindowError) return { bounds: null, fault: e.message };
    throw e;
  }
}
