import { describe, expect, test } from "bun:test";
import { attendedOf, parseGymmoGrids, parseGymmoWhen } from "./gymmo";
import type { RawCell, RawGrid } from "./sheets";

const HEADER = [
  "#",
  "Date & Time",
  "Duration",
  "Class",
  "Type",
  "Students",
  "Attendees",
  "No shows",
  "Late canceled",
];

function grid(sheetName: string, rows: string[][]): RawGrid {
  return {
    sheetName,
    rows: rows.map((r) => r.map((v): RawCell => ({ v, f: v }))),
  };
}

/** The shape of a real row, copied from the 1–21 SEP 2026 export. */
const PT_ROW = [
  "1",
  "1 SEP 2026, 07:15",
  "60 mins",
  "SENIOR TRAINER",
  "PT",
  "1",
  "พัฒน์ ว.",
  "-",
  "-",
];
const CLASS_ROW = [
  "2",
  "4 SEP 2026, 18:00",
  "45 mins",
  "Core Strength",
  "Class",
  "3",
  "ก, ข, ค",
  "1",
  "-",
];

describe("parseGymmoWhen", () => {
  test("reads the export's date format to UTC midnight and keeps the clock separate", () => {
    const r = parseGymmoWhen("1 SEP 2026, 07:15");
    expect(r).not.toBeNull();
    expect(r!.date.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(r!.timeText).toBe("07:15");
  });

  test("pads a one-digit hour so times sort as text", () => {
    expect(parseGymmoWhen("20 SEP 2026, 9:05")!.timeText).toBe("09:05");
  });

  test("rejects a day the month does not have instead of rolling into the next one", () => {
    // Date.UTC(2026, 8, 31) silently becomes 1 OCT — which would move a session across the
    // month boundary that payroll buckets by.
    expect(parseGymmoWhen("31 SEP 2026, 10:00")).toBeNull();
  });

  test("rejects an unknown month and a missing time", () => {
    expect(parseGymmoWhen("1 XXX 2026, 07:15")).toBeNull();
    expect(parseGymmoWhen("1 SEP 2026")).toBeNull();
  });
});

describe("parseGymmoGrids", () => {
  test("reads one sheet per trainer and carries the sheet name onto every row", () => {
    const { rows, problems } = parseGymmoGrids([
      grid("ธันยา มูลละคร", [HEADER, PT_ROW]),
      grid("เกวลี เถาว์จันทร์", [HEADER, CLASS_ROW]),
    ]);
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0].trainerSheet).toBe("ธันยา มูลละคร");
    expect(rows[1].trainerSheet).toBe("เกวลี เถาว์จันทร์");
  });

  test("splits PT from Class, which are paid by different rules", () => {
    const { rows } = parseGymmoGrids([grid("s", [HEADER, PT_ROW, CLASS_ROW])]);
    expect(rows.map((r) => r.kind)).toEqual(["pt", "class"]);
  });

  test("reads counts, duration and the dash that means none", () => {
    const { rows } = parseGymmoGrids([grid("s", [HEADER, CLASS_ROW])]);
    expect(rows[0]).toMatchObject({
      className: "Core Strength",
      durationMin: 45,
      booked: 3,
      noShow: 1,
      lateCancel: 0,
    });
  });

  test("keeps Attendees verbatim — a real name contains a comma", () => {
    // From the export: `เอรา,อลัน เอรา,อลัน`. Splitting on "," invents people.
    const row = [...CLASS_ROW];
    row[6] = "เอรา,อลัน เอรา,อลัน";
    const { rows } = parseGymmoGrids([grid("s", [HEADER, row])]);
    expect(rows[0].attendeesRaw).toBe("เอรา,อลัน เอรา,อลัน");
  });

  test("an empty Students column means nobody booked, not a broken row", () => {
    const row = [...CLASS_ROW];
    row[5] = "-";
    row[7] = "-";
    const { rows, problems } = parseGymmoGrids([grid("s", [HEADER, row])]);
    expect(problems).toEqual([]);
    expect(rows[0].booked).toBe(0);
  });

  test.each([
    ["วันเวลา", 1, "not a date"],
    ["ชนิด", 4, "Workshop"],
    ["จำนวน", 5, "สาม"],
  ])("a row with an unreadable %s is reported, never dropped in silence", (_label, col, bad) => {
    const row = [...CLASS_ROW];
    row[col] = bad;
    const { rows, problems } = parseGymmoGrids([grid("ชีตก", [HEADER, row])]);
    expect(rows).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("ชีตก");
    expect(problems[0]).toContain("แถว 2");
  });

  test("a sheet with no header line is reported rather than read as data", () => {
    const { rows, problems } = parseGymmoGrids([
      grid("ปฏิทิน", [
        ["Mon", "Tue"],
        ["1", "2"],
      ]),
    ]);
    expect(rows).toEqual([]);
    expect(problems[0]).toContain("ปฏิทิน");
  });

  test("blank rows between sessions are skipped without a complaint", () => {
    const { rows, problems } = parseGymmoGrids([
      grid("s", [HEADER, PT_ROW, ["", "", "", "", "", "", "", "", ""], CLASS_ROW]),
    ]);
    expect(rows).toHaveLength(2);
    expect(problems).toEqual([]);
  });
});

describe("attendedOf", () => {
  test("attended is booked minus no-show", () => {
    expect(attendedOf({ booked: 8, noShow: 2 })).toBe(6);
  });

  test("does NOT clamp a negative — payroll warns on it rather than paying zero", () => {
    // Clamping here would hide the row from the task 025 guard in lib/payroll.ts.
    expect(attendedOf({ booked: 2, noShow: 5 })).toBe(-3);
  });
});
