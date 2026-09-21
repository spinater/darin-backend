import { describe, expect, test } from "bun:test";
import {
  problemClears,
  problemIsCleared,
  problemWhere,
  type ProblemCopyInput,
} from "./class-problems-copy";
import type { ClassProblemState } from "./class-problems";

const KINDS = ["session", "duplicate", "row"] as const;
const STATES: (ClassProblemState | null)[] = ["missing", "closedSlip", "accountedFor", null];
const cell = (kind: string, state: ClassProblemState | null): ProblemCopyInput => ({ kind, state });

describe("ข้อความบอกสถานะและทางแก้ของแถวนำเข้า (ใบ 065 รอบ 2)", () => {
  // 🔴 The whole grid, because both BLOCKs were a cell nobody had looked at: round 1 keyed the exit
  // on `kind` alone (a closed-slip คาบ told to re-import, which `leaveAlone` guarantees will not
  // clear it), round 2 was the same shape reached through `kind: "duplicate"`.
  test("ทุกช่องของตาราง (kind × state) มีข้อความ ไม่มีช่องว่างและไม่มี markdown", () => {
    for (const kind of KINDS)
      for (const state of STATES) {
        const c = cell(kind, state);
        for (const text of [problemWhere(c), problemClears(c)]) {
          expect(text.length).toBeGreaterThan(10);
          // A warning/copy string is rendered as plain text — `**bold**` would print literally.
          expect(text).not.toContain("**");
        }
      }
  });

  // 🔴 The round-3 blocker: the count keyed this on (kind, state) while the screen keyed it on state
  // alone, so `duplicate` + `accountedFor` was **counted as blocking and displayed as resolved** —
  // and the two strings written the round before to warn about exactly that row became dead code
  // with a green pin over them. One cell of twelve, and it is worth 200 ฿ on an Aqua Fit whose head
  // count the file disputes. Both callers now ask this function.
  test("แถวที่ถือว่าจบแล้ว มีช่องเดียวใน 12 ช่อง — session + accountedFor", () => {
    const cleared = KINDS.flatMap((kind) =>
      STATES.filter((state) => problemIsCleared(cell(kind, state))).map((state) => [kind, state]),
    );
    expect(cleared).toEqual([["session", "accountedFor"]]);
    // …and the cell next to it, which the wrong predicate would have swept in with it.
    expect(problemIsCleared(cell("duplicate", "accountedFor"))).toBe(false);
  });

  // A `ClassSession` exists in this cell, so `problemWhere` must say so rather than fall through to
  // the `kind` branch — the string is one `filter` away from being printed if `live` ever widens.
  test("session + accountedFor ⇒ บอกว่าอยู่ในฐานแล้ว ไม่ใช่ยังไม่อยู่", () => {
    expect(problemWhere(cell("session", "accountedFor"))).toContain("อยู่ในฐานแล้ว");
    expect(problemWhere(cell("session", "accountedFor"))).not.toContain("ยังไม่อยู่");
  });

  // 🔴 The round-2 blocker. `planGymmoImport` refuses both file rows, so *this* import wrote nothing
  // — but an earlier one may hold the key at a different head count. 15 Aug 19:00 Aqua Fit stored
  // 5/3 (attended 2 ⇒ half ⇒ 200 ฿) against a file carrying 9/0 (400 ฿): telling the admin nothing
  // was written has them key it by hand ⇒ 200 + 400 = 600 ฿ for one 400 ฿ คาบ.
  test("duplicate ที่มีคาบอยู่ในฐานแล้ว ⇒ ห้ามบอกว่าไม่ได้เขียน และต้องห้ามคีย์ซ้ำ", () => {
    const present = cell("duplicate", "accountedFor");
    expect(problemWhere(present)).toContain("อยู่ในฐานแล้ว");
    expect(problemWhere(present)).toContain("ห้ามคีย์ซ้ำ");
    expect(problemWhere(present)).not.toContain("ไม่เขียนทั้งคู่");
    // …while a duplicate with no คาบ behind it may still say so.
    expect(problemWhere(cell("duplicate", "missing"))).toContain("ไม่เขียนทั้งคู่");
  });

  // 🔴 The round-1 blocker. Re-importing into a still-closed period returns `leaveAlone`: the row is
  // neither deleted nor re-inserted, so "แก้ต้นทางแล้วนำเข้าซ้ำ" is a dead end the code guarantees.
  test("closedSlip ⇒ ทางแก้คือเปิดสลิปก่อน ไม่ใช่แก้ต้นทางแล้วนำเข้าซ้ำ", () => {
    for (const kind of ["session", "duplicate"]) {
      const t = problemClears(cell(kind, "closedSlip"));
      expect(t).toContain("เปิดสลิปกลับเป็นร่าง");
      expect(t).not.toContain("แก้ต้นทาง");
      // A recompute reads today's config, so a slip already transferred can come back a different
      // number — 3,050 → 3,150 when Core Strength moves 200 → 250.
      expect(t).toContain("เรทของวันนี้");
    }
    expect(problemWhere(cell("session", "closedSlip"))).toContain("สลิปงวดนั้นปิด");
  });

  // `kind: "row"` keys on `[ชีต, #, วันเวลา]`; the same คาบ once fixed is written under a 4-tuple
  // `sourceKey`, so no import can ever match it. Promising it will disappear sends the reader to do
  // what they already did, and the count they stop trusting is the one carrying 8,000 ฿.
  test("row ⇒ ไม่มีทางปิด และห้ามสัญญาว่านำเข้าซ้ำแล้วหาย ไม่ว่า state เป็นอะไร", () => {
    for (const state of STATES) {
      const t = problemClears(cell("row", state));
      expect(t).toContain("ไม่หายเองแม้แก้ไฟล์แล้ว");
      expect(t).not.toContain("หายเอง ·");
    }
  });

  test("session ที่ยังไม่มีคาบ ⇒ แก้ต้นทาง และเตือนให้ลบแถวที่คีย์เองก่อน", () => {
    const t = problemClears(cell("session", "missing"));
    expect(t).toContain("แก้ต้นทาง");
    expect(t).toContain("ลบแถวที่คีย์เองก่อน");
    expect(problemWhere(cell("session", "missing"))).toBe("ยังไม่อยู่ในฐาน");
  });
});
