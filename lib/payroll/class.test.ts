import { expect, test, describe } from "bun:test";
import { run, trainer } from "./fixtures";

describe("ค่าสอนคลาส Group (§1.4)", () => {
  // `sourceKey: null` = keyed by hand at `/classes`. It moves no money (see `ClassSessionInput`),
  // so every arm below is unaffected by it; the one arm that reads it is the ใบ 065 pair at the end.
  const cls = (booked: number, noShow = 0, sourceKey: string | null = null) => ({
    className: "Aqua Fit",
    price: 400,
    booked,
    noShow,
    sourceKey,
  });

  test("คนเข้าจริง 0 = 0 · 1–2 = ครึ่งราคา · ≥3 = เต็ม", () => {
    // 0คน=0 · 1คน=200 · 2คน=200 · 3คน=400 · 5จอง-3ไม่มา=2คน=200 → รวม 1000
    const r = run({
      classSessions: [cls(0), cls(1), cls(2), cls(3), cls(5, 3)],
      staff: trainer({ classCredit: 0 }),
    });
    expect(r.classPay).toBe(1000);
  });

  test("มูลค่าคลาสต่ำกว่าเครดิต → ไม่จ่ายเพิ่ม (ไม่ติดลบ)", () => {
    const r = run({ classSessions: [cls(10), cls(10)] }); // 800 < เครดิต 5000
    expect(r.classPay).toBe(0);
    expect(r.net).toBe(10000);
  });

  test("เกินเครดิต → จ่ายเฉพาะส่วนเกิน", () => {
    const r = run({ classSessions: Array.from({ length: 20 }, () => cls(10)) }); // 8000 − 5000
    expect(r.classPay).toBe(3000);
  });

  // task 025 — `noShow > booked` stored before `/classes` refused the pair, and the engine folded
  // the negative `attended` into its `<= 0` branch: 0 ฿ with `warnings: []`. Both halves are pinned
  // together on purpose: the payment assertion alone was green against the defect.
  test("no-show มากกว่าคนจอง → ไม่คิดเงิน **แต่ต้องเตือนพร้อมตัวเลข** ไม่ใช่ 0 เงียบๆ (ใบ 025)", () => {
    const r = run({ classSessions: [cls(2, 5)], staff: trainer({ classCredit: 0 }) });
    // `classPay` alone cannot fail — `Math.max(0, … − classCredit)` clamps it, so a row that
    // *subtracted* 400 ฿ of class value would still read 0 here. The class **line** is the figure
    // that carries a sign, so pin that: this คาบ contributes exactly nothing, not something negative.
    expect(r.classPay).toBe(0);
    expect(r.lines.find((l) => l.group === "class")?.amount).toBe(0);
    expect(r.warnings).toHaveLength(1);
    // The warning has to lead a reader back to the row: the two head counts **in order** (a set of
    // substrings passes even when the message swaps which number is the no-show), the negative
    // result, the class, and the price that went unpaid.
    for (const part of ["Aqua Fit", "no-show (5) มากกว่าคนจอง (2)", "(-3)", "400"])
      expect(r.warnings[0]).toContain(part);
  });

  // `byClass` merges rows by `className`, so the payslip shows ONE คลาส line for both of these.
  // The warnings do **not** merge, and must not: two unreadable คาบ are two rows to go and fix.
  test("สองแถวเสียของคลาสเดียวกัน → เตือนสองบรรทัด ห้ามยุบรวมตามชื่อคลาส (ใบ 025)", () => {
    const r = run({ classSessions: [cls(2, 5), cls(2, 5)], staff: trainer({ classCredit: 0 }) });
    expect(r.warnings).toHaveLength(2);
    expect(r.lines.filter((l) => l.group === "class")).toHaveLength(1);
  });

  test("คนเข้าจริง 0 พอดี = เรื่องปกติ ไม่เตือน — เส้นแบ่งอยู่ที่ติดลบเท่านั้น (ใบ 025)", () => {
    const r = run({ classSessions: [cls(0), cls(3, 3)], staff: trainer({ classCredit: 0 }) });
    expect(r.classPay).toBe(0);
    expect(r.warnings).toEqual([]);
  });

  // ใบ 065 — the ใบ 025 warning used to end `ลบคาบนี้แล้วคีย์ใหม่ที่หน้าคาบสอนคลาส Group` for **every**
  // row. For an imported คาบ that is the instruction that doubles the pay: deleting the row makes its
  // `sourceKey` one the file has never been seen to carry, so the next upload plans a `create` and the
  // คาบ comes back beside the hand-keyed replacement — on 4 Aug 18:00 Core Strength, 200 ฿ in
  // §1.4's price table, that is 200 + 200 for one 200 ฿ คาบ. (The fixture below is Aqua Fit at 400,
  // which is the price table's figure for *that* class; the branch under test reads no amount.)
  //
  // 🔴 **Both directions in one arm, deliberately.** The defect is a message that says *delete* no
  // matter what, and the hand-keyed half alone is green against it; the imported half alone would go
  // green against the mirror defect (always *fix at Gymmo*, which sends a hand-keyed row to a system
  // that has never heard of it). The pair is the only thing that pins the branch rather than a string.
  test("ข้อความแก้ไขต้องตรงที่มาของคาบ — คีย์เอง ≠ นำเข้า (ใบ 065)", () => {
    const r = run({
      classSessions: [cls(2, 5), cls(2, 5, '["โอ","2026-08-04","18:00","Core Strength"]')],
      staff: trainer({ classCredit: 0 }),
    });
    expect(r.warnings).toHaveLength(2);

    const [byHand, imported] = r.warnings;
    expect(byHand).toContain("ลบคาบนี้แล้วคีย์ใหม่");
    expect(byHand).not.toContain("Gymmo");

    expect(imported).toContain("Gymmo");
    expect(imported).toContain("ห้ามลบ");
    // 🔑 The dangerous substring, asserted absent rather than the safe one asserted present: a
    // message that appended the new sentence to the old one would pass every `toContain` above and
    // still tell the reader to delete the row.
    expect(imported).not.toContain("ลบคาบนี้แล้วคีย์ใหม่");
  });
});
