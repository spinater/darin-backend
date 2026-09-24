import { expect, test, describe } from "bun:test";
import { DateWindowError, dateWindow, windowForRender, withinWindow } from "./date-window";
import { CONFIG_DEFAULTS } from "./config-keys";
import type { Config } from "./config-keys";

// 🔑 The seeded defaults, flattened — **not** two literals retyped here. A test that hardcodes
// `2024` and `31` keeps passing after somebody changes the shipped default, which is the one
// direction §2 rule 3 is about: the numbers have one home and this file reads it.
const seeded: Config = Object.fromEntries(
  Object.entries(CONFIG_DEFAULTS).map(([k, v]) => [k, v.value]),
);

/** The clock every case below is measured against — the predicate takes `now` from its caller. */
const NOW = new Date("2026-09-24T11:30:00Z");

const day = (iso: string) => new Date(iso + "T00:00:00Z");

describe("dateWindow / withinWindow (ใบ 082)", () => {
  // 🔴 The measured table from the card's Goal, verbatim. Every one of these is **accepted** by
  // `calendarDate` — they are real days, written exactly as typed — and every one of them puts the
  // row outside every `periodRange`, i.e. in no payslip at all. This is the whole reason the module
  // exists, so it is the first thing pinned.
  test("the five measured impossible years are all refused", () => {
    const w = dateWindow(seeded, NOW);
    for (const bad of ["0226-06-05", "0206-06-05", "0026-06-05", "9999-12-31", "0001-01-01"]) {
      // Stated out loud: the day itself is fine. Anyone tempted to fold this check back into
      // `calendarDate` has to explain this line first.
      expect(Number.isNaN(day(bad).getTime())).toBe(false);
      expect(withinWindow(day(bad), w)).toBe(false);
    }
  });

  // 🔴 The bounds are exactly what a future reader will want to shrink, so both edges and both
  // neighbours are pinned. **Inclusive at both ends**: 1 January of the earliest configured year is
  // an ordinary working day, and `now + date.futureDays` is the last day the grace was bought to
  // cover — refusing either would be §2 rule 4 in its mirror direction (hours or a bill not
  // recorded because the guard was too tight).
  test("both edges are inside, and the two days just outside them are not", () => {
    const w = dateWindow(seeded, NOW);

    expect(withinWindow(w.earliest, w)).toBe(true);
    expect(withinWindow(w.latest, w)).toBe(true);

    const justBefore = new Date(w.earliest.getTime() - 86_400_000);
    const justAfter = new Date(w.latest.getTime() + 86_400_000);
    expect(withinWindow(justBefore, w)).toBe(false);
    expect(withinWindow(justAfter, w)).toBe(false);

    // And the edges are where the two config values say, not where a literal in the module says.
    expect(w.earliest.toISOString().slice(0, 10)).toBe("2024-01-01");
    expect(w.latest.toISOString().slice(0, 10)).toBe("2026-10-25"); // 2026-09-24 + 31 days
  });

  // The mirror direction, stated as its own case because it is the failure a tighter window would
  // cause and nothing else in this file would go red for it: a backfill of last quarter and a row
  // typed today for yesterday are both ordinary, and both must pass.
  test("an ordinary back-dated correction and today both stay accepted", () => {
    const w = dateWindow(seeded, NOW);
    for (const ok of ["2026-09-23", "2026-09-24", "2026-06-05", "2025-12-31", "2024-03-15"]) {
      expect(withinWindow(day(ok), w)).toBe(true);
    }
  });

  // The bounds move with the config and with the clock — the two things that make this a window
  // rather than a pair of constants (§2 rule 3, and `now` from the caller).
  test("both bounds follow the config and the clock, not a literal", () => {
    const tight = dateWindow(
      { ...seeded, "date.earliestYear": "2026", "date.futureDays": "0" },
      NOW,
    );
    expect(tight.earliest.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(tight.latest.toISOString().slice(0, 10)).toBe("2026-09-24");
    // 2025 was inside the seeded window and is outside this one — nothing here is baked in.
    expect(withinWindow(day("2025-12-31"), tight)).toBe(false);

    const later = dateWindow(seeded, new Date("2027-03-01T00:00:00Z"));
    expect(later.latest.toISOString().slice(0, 10)).toBe("2027-04-01"); // +31 days, month rolls
  });

  // 🔴 `Date.UTC(year, …)` maps 0..99 onto 1900+year, which would turn a `date.earliestYear` of
  // `26` into **1926** — a window that swallows the entire class of defect this module exists for,
  // silently. `setUTCFullYear` has no such rule, and this arm is what stops the "simplification"
  // back to `Date.UTC`.
  test("a two-digit earliestYear is that year, never 1900 + it", () => {
    const w = dateWindow({ ...seeded, "date.earliestYear": "26" }, NOW);
    expect(w.earliest.getUTCFullYear()).toBe(26);
    // …and the impossible years of the first test are then *inside* a window configured that way.
    // The gym would never configure this; the point is that the module reports what it was told
    // rather than quietly reporting something else.
    expect(withinWindow(day("0226-06-05"), w)).toBe(true);
  });

  // `num()` throws on a blank or a non-number, and that throw is the feature (task 013 item 4).
  // A silent `0` here is the worst possible shape: `earliest` at year 0 and `latest` at today, i.e.
  // a window that refuses tomorrow and accepts the year 226 — the guard running backwards.
  test("a blank or missing bound throws instead of defaulting to zero", () => {
    expect(() => dateWindow({ ...seeded, "date.earliestYear": "  " }, NOW)).toThrow();
    const missing = { ...seeded };
    delete missing["date.futureDays"];
    expect(() => dateWindow(missing, NOW)).toThrow();
  });

  // 🔴 The **render** half of the very same delta, and the half `ConfigError` was created for
  // (`payroll-auditor`, ใบ 082 fourth round). The arm above pins the *throw*; nothing pinned what
  // the four screens do with a key that is missing or blank, and that is exactly the case
  // `windowForRender` only survives because `bound()` can recognise `num()`'s throw. Revert the
  // three throws in `lib/config-keys.ts` from `ConfigError` to a plain `Error` — one word, the edit
  // a refactor makes without thinking, leaving `bound()`'s narrow catch untouched — and the whole
  // suite stayed green while `windowForRender` went back to throwing: `/ot`, `/sales`, `/classes`
  // and `/sync/review` then 500 on a key that is simply absent, with the Thai cause redacted in
  // production. `app/_components/window-fault-notice.tsx` states in prose that this case lands in
  // its amber box, and its heading was written to be true of it.
  //
  // ⚠️ How the bad state is reached: **not** on the deployed site. `docker-compose.yml` makes `app`
  // wait on the `migrate` service, whose command ends in `bun run prisma/seed.ts`, and the seed
  // backfills every missing `CONFIG_DEFAULTS` key on every deploy. It is an unseeded developer
  // database, or a row deleted by hand. The pin's value does not rest on that: it holds a
  // documented behaviour against a one-word refactor, which is true however the state arises.
  //
  // 🔑 Asserted on the **message**, because `num()`'s two sentences are two different remedies: a
  // key that is missing has no field on `/admin/config` at all (ใบ 044), a key that was blanked has
  // one. A bare `fault !== null` would not tell them apart.
  test("a missing or blank bound reaches the box on screen, never the error boundary", () => {
    const missing = { ...seeded };
    delete missing["date.earliestYear"];
    const gone = windowForRender(missing, NOW);
    expect(gone.bounds).toBeNull();
    expect(gone.fault).toMatch(/ไม่พบ config/);

    const blank = windowForRender({ ...seeded, "date.futureDays": "  " }, NOW);
    expect(blank.bounds).toBeNull();
    expect(blank.fault).toMatch(/เว้นว่าง/);
  });

  // 🔴 The same argument one step further out (`payroll-auditor`, ใบ 082 review). `/admin/config`'s
  // `cfg` arm accepts any non-negative finite number, so `date.earliestYear = 2027` saves cleanly
  // and then **every money write in the app is refused at once** — the paste, every bill, every
  // คาบ, every ยืนยัน. A guard that refuses everything is the guard running backwards, and it has
  // to say so: silence here is §2 rule 4 with nothing on screen at all.
  test("an inverted window throws instead of refusing every date in silence", () => {
    const inverted = { ...seeded, "date.earliestYear": "2027" };
    expect(() => dateWindow(inverted, NOW)).toThrow(/กลับด้าน/);

    // …and the neighbouring case that is *not* inverted still builds: earliest exactly equal to
    // latest is a one-day window, which is tight but honest and must not be swept up by the guard.
    const oneDay = dateWindow(
      { ...seeded, "date.earliestYear": "2026", "date.futureDays": "0" },
      new Date("2026-01-01T09:00:00Z"),
    );
    expect(withinWindow(day("2026-01-01"), oneDay)).toBe(true);
  });

  // 🔴 The **ordering** of the three `Number.isNaN` checks, which is the one throw of the four with
  // nothing else in this file standing behind it (`payroll-auditor`, ใบ 082 second review round).
  // `now` is tested before the two config bounds on purpose: an invalid `now` makes `latest` NaN,
  // so with the checks grouped "tidily" by shape this case comes back as
  // `config date.futureDays อยู่นอกช่วง: 31` — a misattributed cause that sends whoever reads it to
  // `/admin/config` to fix a key that is already right, while the real fault is the caller's clock.
  // The regex is the whole point: a bare `.toThrow()` stays green under exactly that reordering.
  test("an invalid `now` is reported as the clock, never as one of the two config keys", () => {
    expect(() => dateWindow(seeded, new Date("x"))).toThrow(/now ไม่ใช่วันที่/);
  });

  // The second half of the same guard. An unrepresentable bound is worse than a wrong one: it made
  // `withinWindow` false for everything **and** made the four pages' `renderWindow.toISOString()`
  // raise `RangeError` outside any try/catch ⇒ a server error page with the Thai cause redacted.
  //
  // 🔑 The **fractional** bounds share this fixture rather than taking a test of their own (§7: the
  // expensive unit is the fixture), and they are here as a **record of measured behaviour, not an
  // endorsement of it**. `/admin/config`'s `cfg` arm has to accept non-integers — `class.halfRatio`
  // is `0.5` — so `date.futureDays = 0.5` saves cleanly, and ใบ 082's third round expected it to
  // land on the NaN check above. It does **not**: `MakeDay` takes `ToIntegerOrInfinity` of its
  // arguments, so the fraction is truncated toward zero and the window is simply one day shorter.
  // Stated out loud so that whoever later decides a fraction should be *refused* changes this line
  // deliberately, instead of discovering that the throw they expected was never there.
  test("a bound that is not a representable date throws, naming its own key", () => {
    expect(() => dateWindow({ ...seeded, "date.futureDays": "1e9" }, NOW)).toThrow(
      /date\.futureDays/,
    );
    expect(() => dateWindow({ ...seeded, "date.earliestYear": "1e9" }, NOW)).toThrow(
      /date\.earliestYear/,
    );

    // Measured 2026-09-24, and the opposite of what the review round assumed: truncation, not NaN.
    const frac = dateWindow({ ...seeded, "date.futureDays": "0.5" }, NOW);
    expect(frac.latest.toISOString().slice(0, 10)).toBe("2026-09-24"); // 24 + 0.5 → the 24th
    const fracYear = dateWindow({ ...seeded, "date.earliestYear": "2024.9" }, NOW);
    expect(fracYear.earliest.toISOString().slice(0, 10)).toBe("2024-01-01");
  });

  // 🔴 The render path's half of the same failure (`payroll-auditor`, ใบ 082 second review round),
  // and the arm that stops a "simplification" back to `dateWindow(cfg, new Date())` inside a page
  // body. The throw above is right where a **write** is being refused; on a render it took the
  // page's *correction* surface down with its write surface — `/sales` 500s whole, so a 30,000 ฿
  // membership entered twice can be neither seen nor deleted, and a run approved before someone
  // fixes the key pays 6,000 ฿ instead of 3,000 ฿ (§2.2 `comm.membership.full`).
  //
  // 🔑 Asserted on the **message**, not merely on `fault !== null`: the box on screen prints this
  // string, and a `fault` that said only "ตั้งค่าผิด" would be the refusal §2 rule 4 calls useless.
  test("windowForRender reports an unusable window instead of throwing", () => {
    const bad = windowForRender({ ...seeded, "date.earliestYear": "2027" }, NOW);
    expect(bad.bounds).toBeNull();
    expect(bad.fault).toMatch(/กลับด้าน/);
    // Both offending numbers reach the screen — they are the remedy.
    expect(bad.fault).toContain("2027");
    expect(bad.fault).toContain("31");

    // …and the ordinary case still hands the pages the two strings they print, formatted once here
    // rather than by four `toISOString().slice(0, 10)` call sites.
    const ok = windowForRender(seeded, NOW);
    expect(ok.fault).toBeNull();
    expect(ok.bounds).toEqual({ earliest: "2024-01-01", latest: "2026-10-25" });
  });

  // 🔴 The `throw e` arm — **reachable since `bound()` re-tags only `ConfigError`** (ใบ 082 third
  // round). While `bound` caught everything, this arm had no input that could reach it and the
  // counter-test for dropping `instanceof DateWindowError` came back **green**; the narrowness it
  // guards was a claim nothing could break. `num()`'s own class now draws the line at this
  // module's boundary instead of at `num()`'s, so a `cfg` that is not the shape it claims raises
  // an ordinary `TypeError` that must reach `app/error.tsx` and the log — **not** an amber box on
  // four screens saying the two date keys are misconfigured, which is a wrong cause stated
  // confidently about a fault nobody then investigates.
  //
  // 🔑 Asserted as **not** a `DateWindowError`, not merely as "throws": `windowForRender` returning
  // a `fault` is the failure this pins, and a bare `.toThrow()` would stay green if the catch were
  // widened back and the re-tag re-added.
  test("a fault that is not a config fault is re-thrown, never printed as the two date keys", () => {
    const notAConfig = null as unknown as Config;

    expect(() => windowForRender(notAConfig, NOW)).toThrow(TypeError);
    expect(() => dateWindow(notAConfig, NOW)).toThrow(TypeError);

    // ⚠️ The sentinel's own class is asserted, not merely "not a `DateWindowError`" (ใบ 082 fourth
    // round). Written as a bare `not.toBeInstanceOf`, the sentinel `Error` thrown when
    // `windowForRender` *stops* throwing lands in this same `catch` and satisfies it ⇒ the block
    // reads as a guard and is green in precisely the case it was written to catch.
    expect.hasAssertions();
    try {
      windowForRender(notAConfig, NOW);
      throw new Error("windowForRender swallowed a fault it does not understand");
    } catch (e) {
      expect(e).toBeInstanceOf(TypeError);
      expect(e).not.toBeInstanceOf(DateWindowError);
    }
  });
});
