import { describe, expect, test } from "bun:test";
import { gymmoHandKeyedMatches, type HandKeyedSession } from "./gymmo-hand-keyed";
import type { GymmoImportPlan, GymmoSessionWrite } from "./gymmo-import";

const D = (iso: string) => new Date(`${iso}T00:00:00Z`);

const write = (over: Partial<GymmoSessionWrite> = {}): GymmoSessionWrite => ({
  sourceKey: JSON.stringify(["โอ", "2026-08-04", "18:00", "Core Strength"]),
  date: D("2026-08-04"),
  classId: "c-core",
  staffId: "s-o",
  booked: 9,
  noShow: 0,
  ...over,
});

const plan = (writes: GymmoSessionWrite[]): GymmoImportPlan => ({
  writes,
  writeRefs: [],
  problems: [],
  ptRows: 0,
});

const byHand = (over: Partial<HandKeyedSession> = {}): HandKeyedSession => ({
  id: "cs-1",
  date: D("2026-08-04"),
  classId: "c-core",
  staffId: "s-o",
  className: "Core Strength",
  staffName: "ธันยา มูลละคร",
  booked: 5,
  noShow: 0,
  ...over,
});

describe("คาบที่คีย์เองแล้วไฟล์กำลังจะนำเข้าซ้ำ (ใบ 065)", () => {
  test("วัน+ครู+คลาสตรงกัน ⇒ ขึ้นรายชื่อ พร้อมตัวเลขทั้งสองฝั่ง", () => {
    const m = gymmoHandKeyedMatches(plan([write()]), [byHand()]);
    expect(m).toHaveLength(1);
    // The row the human has to look at, named — this is the whole point of the card: the count it
    // replaces ("12 hand-keyed คาบ" over nine months) could not be acted on.
    expect(m[0]).toEqual({
      id: "cs-1",
      date: "2026-08-04",
      className: "Core Strength",
      staffName: "ธันยา มูลละคร",
      booked: 5,
      noShow: 0,
      fileRows: 1,
    });
  });

  // 🔴 The narrowing that makes this a *list* rather than the old count. A คาบ keyed by hand in the
  // same months that the file does not land on is not a duplicate candidate at all, and reporting it
  // is what made the count unreadable.
  test("อยู่ในช่วงเดียวกันแต่ไฟล์ไม่แตะ ⇒ ไม่ขึ้น", () => {
    const other = [
      byHand({ id: "cs-day", date: D("2026-08-05") }),
      byHand({ id: "cs-cls", classId: "c-aqua" }),
      byHand({ id: "cs-stf", staffId: "s-ploy" }),
    ];
    expect(gymmoHandKeyedMatches(plan([write()]), other)).toEqual([]);
  });

  // 🔴 `ClassSession` stores the UTC calendar day with **no clock**, so one trainer teaching the same
  // class twice in a day is two `sourceKey`s under one triple. `fileRows` is what turns that
  // collapsing from a bug into the answer: "the file brings two คาบ for this day and you already have
  // one of them by hand". ใบ 063's ⛔ — never key an import on this triple — is the same fact.
  test("สองคาบในไฟล์วันเดียวกัน (07:15 + 09:00) ⇒ หนึ่งแถว fileRows = 2", () => {
    const two = plan([
      write(),
      write({ sourceKey: JSON.stringify(["โอ", "2026-08-04", "09:00", "Core Strength"]) }),
    ]);
    const m = gymmoHandKeyedMatches(two, [byHand()]);
    expect(m).toHaveLength(1);
    expect(m[0].fileRows).toBe(2);
  });

  // The ใบ 035 bug class, on this module's own key: `staffId` and `classId` are opaque strings, so a
  // `|`-joined key has a reachable collision. `JSON.stringify` of the tuple does not — `JSON.parse`
  // returns the exact tuple back, so two keys are equal only when their parts are.
  test("ส่วนประกอบของคีย์ที่มีอักขระคั่นอยู่ข้างใน ⇒ ไม่ชนกัน", () => {
    // Two triples that are **different** but whose `|` join is byte-identical:
    //   2026-08-04 | "s-o|c-core" | "x"   vs   2026-08-04 | "s-o" | "c-core|x"
    // ⇒ a joined key reports a duplicate คาบ that does not exist, and the human deletes a real row.
    const p = plan([write({ staffId: "s-o|c-core", classId: "x" })]);
    expect(gymmoHandKeyedMatches(p, [byHand({ staffId: "s-o", classId: "c-core|x" })])).toEqual([]);
  });

  test("แผนว่าง หรือไม่มีคาบที่คีย์เอง ⇒ ว่าง", () => {
    expect(gymmoHandKeyedMatches(plan([]), [byHand()])).toEqual([]);
    expect(gymmoHandKeyedMatches(plan([write()]), [])).toEqual([]);
  });
});
