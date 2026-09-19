import { expect, test, describe } from "bun:test";
import { run, trainer } from "./fixtures";

describe("ค่าสอนคลาส Group (§1.4)", () => {
  const cls = (booked: number, noShow = 0) => ({
    className: "Aqua Fit",
    price: 400,
    booked,
    noShow,
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
});
