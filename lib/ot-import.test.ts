import { expect, test, describe } from "bun:test";
import { parseOtPaste, otUsernameKey } from "./ot-import";

// ⚠️ `bun test` has no database — `lib/ot-import.ts`'s own header says why (stage 4 of
// `scripts/check-code.sh` runs before the throwaway postgres exists). So **nothing in this file
// proves task 014's other half**: that the `deleteMany` + `createMany` in `app/ot/page.tsx` really
// rolls back as one transaction. What is pinned here is the parse that makes the transaction safe
// — every per-row data problem rejected *before* the write, so what can still roll it back is
// infrastructure, plus one concurrent-paste race (`P2002`) that also needs a database to see.
// The missing lane is `tasks/todo/015-db-test-lane.md`.

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

  // Task 014 narrowed the skip twice — first to `!user && !date`, then (round 2) to `!line.trim()`
  // — so this test has to say *which* of its lines are still skipped and where every other one now
  // goes. It used to pass on `rows).toHaveLength(1)` while three different lines vanished for three
  // different reasons.
  test("only a wholly blank line is skipped — every other line reaches a bucket", () => {
    const { rows, unmatched, invalidHours, invalidDates } = parseOtPaste(
      [
        "", // blank: nothing left after trim ⇒ skipped, the line at the end of every paste
        "   ", // whitespace only: same
        "\t\t", // separators around nothing: still nothing after trim ⇒ same
        "somchai", // a name and nothing else ⇒ the date is the structural problem
        "somchai\t2026-07-01", // no third field at all ⇒ the hours cell is missing
        // 🔴 Round 2's case: hours with **neither** identity field. `!user && !date` skipped this,
        // and it is what a CSV writes when the name column is blank for a scan the reader could not
        // identify — `max(0, 11.5 − 9) × 40 = 100 ฿` gone with nothing on screen (§2 rule 4).
        // Both arms here reach a bucket; the assertion below is what proves it.
        ",,176",
        "\t\t11.5",
        "somchai\t2026-07-01\t8", // the good row still lands
      ].join("\n"),
      staff,
    );
    expect(rows).toEqual([{ staffId: "s1", date: new Date("2026-07-01T00:00:00Z"), hours: 8 }]);
    // 🔴 Whole-array compare, not a length: the two no-identity lines both key on `""`, so they
    // collapse to the one readable bullet the screen already renders rather than needing a fourth
    // box. A length assertion would stay green if either arm silently stopped arriving.
    expect(unmatched).toEqual(["(บรรทัดไม่มีชื่อผู้ใช้)"]);
    expect(invalidDates).toHaveLength(1);
    expect(invalidHours).toHaveLength(1);
  });

  // 🔴 Task 014's most expensive case. A fingerprint export writes exactly this shape for a day
  // somebody did not scan out, and the pre-014 skip dropped it before the username lookup ⇒ in no
  // bucket at all: a 220-line paste reported "นำเข้าแล้ว 219 รายการ" with zero warnings while that
  // person's OT was short. Invisible by construction — §2 rule 4's worst shape.
  test("an empty or absent hours cell reaches invalidHours, never silence and never rows", () => {
    const { rows, invalidHours } = parseOtPaste(
      [
        "somchai\t2026-07-01\t", // the cell is there and empty
        "Nok\t2026-07-02", // no third field at all
        "somchai\t2026-07-03\t7", // the good row still lands
      ].join("\n"),
      staff,
    );
    expect(rows).toEqual([{ staffId: "s1", date: new Date("2026-07-03T00:00:00Z"), hours: 7 }]);
    expect(invalidHours).toHaveLength(2);
    // The label must render a missing cell as an empty one — `${undefined}` would print the word
    // `undefined` back at the operator as if that were what they pasted.
    expect(invalidHours.join(" ")).not.toContain("undefined");
    expect(invalidHours[0]).toContain("somchai 2026-07-01");
    expect(invalidHours[1]).toContain("Nok 2026-07-02");
  });

  test("a header row reaches unmatched — which is what the old skip comment was really doing", () => {
    const { rows, unmatched } = parseOtPaste(
      ["username,date,hours", "somchai,2026-07-01,8"].join("\n"),
      staff,
    );
    expect(rows).toHaveLength(1);
    expect(unmatched).toEqual(["username"]);
  });

  test("a line with a date but no username gets a readable bullet, deduplicated to one", () => {
    const { rows, unmatched } = parseOtPaste(
      ["\t2026-07-01\t8", "\t2026-07-02\t8", ",2026-07-03,8"].join("\n"),
      staff,
    );
    expect(rows).toHaveLength(0);
    // The dedup key is `""`, so a whole month of them collapses to one bullet — and the bullet has
    // to say something, because an empty one is unreadable.
    expect(unmatched).toEqual(["(บรรทัดไม่มีชื่อผู้ใช้)"]);
  });

  // 🔴 The silent half is the point. `new Date("2026-06-31")` answers 2026-07-01 without
  // complaining, so that day's OT would be counted in **July's** payroll period — wrong month, no
  // warning, `Number.isNaN(getTime())` green. The round-trip comparison is what catches it, and
  // this test is what stops it being "simplified" back to an isNaN check.
  test("a date that is unparseable OR silently rolled over NEVER reaches rows (§2 rule 4)", () => {
    const { rows, invalidDates } = parseOtPaste(
      [
        "somchai\t2026-13-01\t8", // unparseable: month 13
        "Nok\t2026-06-31\t8", // parses, and quietly becomes 2026-07-01
        "somchai\t2026-2-3\t8", // parses in some runtimes, not the pinned YYYY-MM-DD shape
        "somchai\t2026-07-03\t9.5", // the good row in the same paste still lands
      ].join("\n"),
      staff,
    );
    expect(rows).toEqual([{ staffId: "s1", date: new Date("2026-07-03T00:00:00Z"), hours: 9.5 }]);
    expect(invalidDates).toHaveLength(3);
    expect(invalidDates[1]).toContain("2026-06-31");
    // Nothing that survived may be a date the operator did not write.
    expect(rows.every((r) => !Number.isNaN(r.date.getTime()))).toBe(true);
  });

  // Task 014: the write became `deleteMany` + `createMany` inside one transaction, and
  // `@@unique([staffId, date])` would make a repeated pair throw and roll back the *whole* paste.
  // Last-wins is what the old upsert-per-row loop already did silently; this pins it where a test
  // can see it, and pins the order too — the operator reads the list they pasted.
  test("two lines for the same person and day collapse to one row, last wins, in place", () => {
    const { rows } = parseOtPaste(
      [
        "somchai\t2026-07-01\t8",
        "Nok\t2026-07-01\t6",
        "somchai\t2026-07-01\t9", // same person, same day ⇒ replaces the first, does not move
      ].join("\n"),
      staff,
    );
    expect(rows).toEqual([
      { staffId: "s1", date: new Date("2026-07-01T00:00:00Z"), hours: 9 },
      { staffId: "s2", date: new Date("2026-07-01T00:00:00Z"), hours: 6 },
    ]);
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
