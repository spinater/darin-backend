import { expect, test, describe } from "bun:test";
import { parseOtPaste, otUsernameKey } from "./ot-import";

// The caller keys the map the same way (`s.username.trim().toLowerCase()`), which is what
// `otUsernameKey` exists to keep in one place.
const staff = new Map([
  [otUsernameKey("somchai"), "s1"],
  [otUsernameKey("Nok"), "s2"],
]);

describe("parseOtPaste (task 009)", () => {
  test("tab and comma are both accepted as separators", () => {
    const tabbed = parseOtPaste("somchai\t2026-07-01\t10", staff);
    const comma = parseOtPaste("somchai,2026-07-01,10", staff);
    expect(tabbed.rows).toEqual(comma.rows);
    expect(tabbed.rows).toHaveLength(1);
    expect(tabbed.unmatched).toHaveLength(0);
  });

  test("a known username parses to staffId + UTC-midnight date + hours", () => {
    // Spacing and casing are normalized away — the scanner export is not tidy.
    const { rows } = parseOtPaste("  NOK , 2026-07-02 , 9.5 ", staff);
    expect(rows).toEqual([{ staffId: "s2", date: new Date("2026-07-02T00:00:00Z"), hours: 9.5 }]);
  });

  test("blank and short lines are skipped, not counted", () => {
    const { rows, unmatched } = parseOtPaste(
      ["", "   ", "somchai", "somchai\t2026-07-01", "somchai\t2026-07-01\t8", ""].join("\n"),
      staff,
    );
    expect(rows).toHaveLength(1);
    expect(unmatched).toHaveLength(0);
  });

  test("an unknown username reaches unmatched and NEVER reaches rows (§2 rule 4)", () => {
    const { rows, unmatched } = parseOtPaste(
      ["ghost\t2026-07-01\t12", "somchai\t2026-07-01\t12"].join("\n"),
      staff,
    );
    // The hours of the unknown name are not imported — that is exactly why they must be shown.
    expect(rows).toEqual([{ staffId: "s1", date: new Date("2026-07-01T00:00:00Z"), hours: 12 }]);
    expect(unmatched).toEqual(["ghost"]);
  });

  // 🔴 The single most expensive line in this file. `OtEntry.hours` is a `Float` ⇒ PostgreSQL
  // `double precision`, which **accepts `NaN`** — so "it fails loudly at the DB write" was never
  // established for a non-numeric hours field. If one lands, §2.4's `Math.max(0, NaN - 9)` is
  // `NaN` and that staff member's `otPay`, `net` and whole payslip for the month become `NaN`.
  // This pins the outcome here, where it does not depend on what the driver happens to reject.
  test("a non-finite hours value NEVER reaches rows — it is reported instead (§2 rule 4)", () => {
    const { rows, unmatched, invalidHours } = parseOtPaste(
      [
        "somchai\t2026-07-01\tแปด", // NaN
        "Nok,2026-07-02,Infinity", // finite check, not just isNaN
        "somchai\t2026-07-03\t9.5", // the good row still lands
      ].join("\n"),
      staff,
    );
    expect(rows).toEqual([{ staffId: "s1", date: new Date("2026-07-03T00:00:00Z"), hours: 9.5 }]);
    expect(rows.every((r) => Number.isFinite(r.hours))).toBe(true);
    expect(unmatched).toHaveLength(0);
    // Each line is reported separately — a bad hours value is per-line, unlike a misspelt name.
    expect(invalidHours).toHaveLength(2);
    expect(invalidHours[0]).toContain("แปด");
    expect(invalidHours[1]).toContain("Nok");
  });

  // 🔴 Task 013 item 4: the *negative* case, added when `/ot`'s one-row form started refusing it.
  // `-5` is the quiet one — it is finite, so the old `Number.isFinite` check passed it through, it
  // stored, and `Math.max(0, -5 - threshold)` then paid nothing. The paste is how OT actually
  // arrives, so this was the open door of the two.
  test("a negative hours value NEVER reaches rows either — same bucket, not a silent 0", () => {
    const { rows, invalidHours } = parseOtPaste(
      [
        "somchai\t2026-07-01\t-5",
        "Nok,2026-07-02,-0.25",
        "somchai\t2026-07-03\t0", // a real zero somebody typed still lands
      ].join("\n"),
      staff,
    );
    expect(rows).toEqual([{ staffId: "s1", date: new Date("2026-07-03T00:00:00Z"), hours: 0 }]);
    expect(invalidHours).toHaveLength(2);
    expect(invalidHours[0]).toContain("-5");
    expect(invalidHours[1]).toContain("Nok");
  });

  test("unmatched is deduplicated by the normalized key, keeping the first spelling", () => {
    // A month of scans repeats one bad username daily; 20 identical bullets bury the real count.
    const { unmatched } = parseOtPaste(
      ["ghost\t2026-07-01\t12", "GHOST\t2026-07-02\t12", " ghost \t2026-07-03\t12"].join("\n"),
      staff,
    );
    expect(unmatched).toEqual(["ghost"]);
  });
});
