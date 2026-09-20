import { expect, test, describe } from "bun:test";
import { plantsFixture, recordsMark, seedMode, seedReport } from "./seed-policy";

/**
 * The seed's one decision, pinned where it is pure (task 040).
 *
 * 🔴 **What these tests do NOT prove.** Nothing here touches a database: `bun test` runs in stage 4
 * of `scripts/check-code.sh`, before the throwaway Postgres exists and with no `DATABASE_URL`, so
 * "the seed really withheld the fixture" is asserted **one layer up** — the db stage runs the real
 * seed twice and greps `seed: mode=already-initialized created=0` out of the second run. What is
 * pinned here is the decision that stage is exercising, and the wording it greps.
 *
 * 🔑 The load-bearing arm is `{ marked: false, staffCount: 7 } ⇒ "adopt"`. That case is the deploy
 * host's first post-fix deploy, and getting it wrong plants the reference fixture over a live
 * database — this card's own bug, shipped once, on the only database with real money in it.
 */

describe("seedMode — which database is this (ใบ 040)", () => {
  test("rows but no mark ⇒ adopt, never initialize (the deploy host, once)", () => {
    // `db push` creates `SeedMark` empty on the host, so "no mark" is true there on the first
    // deploy after this change while seven staff, a rate matrix and a month of sessions exist.
    // The staff count is the entire defence, so it is asserted at the boundary (1) as well as at
    // the real figure (7).
    expect(seedMode({ marked: false, staffCount: 7 })).toBe("adopt");
    expect(seedMode({ marked: false, staffCount: 1 })).toBe("adopt");
  });

  test("no mark and no staff ⇒ initialize", () => {
    // A genuinely fresh database: first deploy, the gate's throwaway Postgres, a recreated volume.
    expect(seedMode({ marked: false, staffCount: 0 })).toBe("initialize");
  });

  test("a mark ⇒ already-initialized, whatever the staff count says", () => {
    // The mark wins over the witness in both directions. The `staffCount: 0` arm is the one that
    // matters: a database whose staff were somehow all removed must still not be re-planted.
    expect(seedMode({ marked: true, staffCount: 0 })).toBe("already-initialized");
    expect(seedMode({ marked: true, staffCount: 7 })).toBe("already-initialized");
  });

  test("the fixture is planted on one mode; the mark is recorded on two", () => {
    // Whole-object comparison over every mode, so a fourth mode or a flipped predicate cannot
    // arrive quietly. `adopt` recording a mark is what makes the host's first post-fix deploy
    // auditable — and what stops it adopting again on every deploy afterwards.
    const modes = ["initialize", "adopt", "already-initialized"] as const;
    expect(modes.map((m) => ({ m, plants: plantsFixture(m), marks: recordsMark(m) }))).toEqual([
      { m: "initialize", plants: true, marks: true },
      { m: "adopt", plants: false, marks: true },
      { m: "already-initialized", plants: false, marks: false },
    ]);
  });
});

describe("seedReport — what the run says it did (ใบ 040)", () => {
  const noGaps = { classes: [], sheets: [] };

  test("a settled database prints exactly the two lines, and the gate's grep matches the last", () => {
    // This is every deploy from the third onwards, and it is the exact output `check-code.sh`
    // greps. Compared whole: a helpful extra line here is a line printed on every deploy forever.
    const out = seedReport("already-initialized", noGaps, [], 0);
    expect(out).toEqual([
      "seed: mode=already-initialized — fixture withheld",
      "seed: teach rates NOT re-asserted — the rate matrix has belonged to the owner since first boot",
      "seed: mode=already-initialized created=0",
    ]);
    expect(out[out.length - 1]).toBe("seed: mode=already-initialized created=0");
  });

  test("initialize says it is planting and never claims the rates were withheld", () => {
    // The withheld-rates sentence on a planting run would be a lie in the one direction that
    // matters: it is the line an owner reads to confirm their deletion survived the deploy.
    expect(seedReport("initialize", noGaps, [], 31)).toEqual([
      "seed: mode=initialize (empty database) — planting reference fixture",
      "seed: mode=initialize created=31",
    ]);
  });

  test("adopt names the keys it created with their defaults, and the gaps no screen can fill", () => {
    // The key line carries the value, because that value is the one thing here that was never
    // reviewed by the owner — it arrives from a developer's commit straight into a live database.
    expect(
      seedReport(
        "adopt",
        { classes: ["Boxing"], sheets: ["Muay Thai"] },
        ["ot.ratePerHour", "class.halfRatio"],
        3,
      ),
    ).toEqual([
      "seed: mode=adopt (database in use, no seed mark) — fixture withheld, mark recorded",
      "seed: config keys created this run: ot.ratePerHour=40 · class.halfRatio=0.5",
      "seed: in CLASSES but not in the database (no screen can add these): Boxing",
      "seed: in SOURCES but not in the database (no screen can add these): Muay Thai",
      "seed: teach rates NOT re-asserted — the rate matrix has belonged to the owner since first boot",
      "seed: mode=adopt created=3",
    ]);
  });

  test("no mode reports a missing rate — the omission is the pin", () => {
    // 🔴 The most likely well-meant regression: adding "rates the fixture would have created" to
    // the withheld report. `FixtureGaps` has no third field, so feeding one in needs a type change
    // — and this arm is what makes that change red instead of green. No created keys are passed on
    // purpose: `ot.ratePerHour` is a config key whose *name* contains "rate", and it would make
    // this filter say something it does not mean.
    const withheld =
      "seed: teach rates NOT re-asserted — the rate matrix has belonged to the owner since first boot";
    const rateLines = (mode: Parameters<typeof seedReport>[0]) =>
      seedReport(mode, { classes: ["Boxing"], sheets: ["Muay Thai"] }, [], 1).filter((l) =>
        /rate/i.test(l),
      );
    expect(rateLines("already-initialized")).toEqual([withheld]);
    expect(rateLines("adopt")).toEqual([withheld]);
    expect(rateLines("initialize")).toEqual([]);
  });
});
