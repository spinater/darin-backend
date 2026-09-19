import { expect, test, describe } from "bun:test";
import { ptSale, run, trainer } from "./fixtures";

describe("สูตรรวม (§1.7)", () => {
  test("ทุกส่วนประกอบรวมกันเป็น net และ lines ตรวจย้อนได้", () => {
    const r = run({
      sessions: [
        { date: new Date(), activity: "pt" },
        { date: new Date(), activity: "pilates" },
      ],
      classSessions: Array.from({ length: 20 }, () => ({
        className: "Aqua Fit",
        price: 400,
        booked: 10,
        noShow: 0,
      })),
      sales: [ptSale({ netPrice: 30000 })],
      otEntries: [{ date: new Date(), hours: 12 }],
    });
    expect(r.base + r.teachPay + r.classPay + r.commission + r.otPay).toBe(r.net);
    expect(r.teachPay).toBe(900); // 400 + 500
    expect(r.classPay).toBe(3000); // 8000 − 5000
    expect(r.commission).toBe(3600); // ถึงเกณฑ์ → 12%
    expect(r.otPay).toBe(120); // (12−9)×40
    expect(r.net).toBe(10000 + 900 + 3000 + 3600 + 120);
    expect(r.lines.reduce((s, l) => s + l.amount, 0)).toBe(r.net);
    expect(r.warnings).toHaveLength(0);
  });
});

describe("พนักงานที่ถูกปิดการใช้งาน (ใบ 013 ข้อ 3)", () => {
  // Deliberately the same rich input as the สูตรรวม case above: every block of the formula is
  // non-zero, so "not one figure moved" is a claim about the whole engine rather than about an
  // empty slip that could not have moved anyway.
  const busy = {
    sessions: [
      { date: new Date(), activity: "pt" },
      { date: new Date(), activity: "pilates" },
    ],
    classSessions: Array.from({ length: 20 }, () => ({
      className: "Aqua Fit",
      price: 400,
      booked: 10,
      noShow: 0,
    })),
    sales: [ptSale({ netPrice: 30000 })],
    otEntries: [{ date: new Date(), hours: 12 }],
  };

  test("ถูกปิดการใช้งานแต่ยังมีงวดค้าง → เตือน และบอกว่าฐานไม่ได้หารตามสัดส่วน", () => {
    const r = run({ ...busy, staff: trainer({ active: false }) });
    // Exact text, not a substring: this string is what the trainer's own payslip screen prints,
    // and `/payslips` counts it. A reworded warning is a product change, not a refactor.
    expect(r.warnings).toEqual([
      "พนักงานถูกปิดการใช้งานแล้ว แต่ยังมีงวดนี้ค้างอยู่ — ฐานเงินเดือนคิดเต็มงวด ไม่ได้หารตามสัดส่วนวันที่ทำงานจริง ⇒ ตรวจยอดก่อนอนุมัติ",
    ]);
    // The pro-rating caveat is the half a reader acts on, so it is pinned on its own: a leaver's
    // slip carries a full month of base and nothing in the engine divides it.
    expect(r.warnings[0]).toContain("ไม่ได้หารตามสัดส่วน");
    expect(r.base).toBe(10000);
  });

  test("คำเตือนอย่างเดียว — ไม่ขยับเงินสักบาท (§2 rule 4)", () => {
    const off = run({ ...busy, staff: trainer({ active: false }) });
    const on = run({ ...busy, staff: trainer({ active: true }) });
    // Whole-result comparison with warnings blanked on both sides: base, teachPay, classPay,
    // commission, otPay, net **and** every line. Paying a deactivated person 0 "because they are
    // inactive" is the silent zero §2 rule 4 forbids — this is the test that catches someone
    // deciding it later.
    expect({ ...off, warnings: [] }).toEqual({ ...on, warnings: [] });
    expect(on.warnings).toHaveLength(0);
    // Guards the comparison itself: two empty slips would also be equal.
    expect(off.net).toBe(10000 + 900 + 3000 + 3600 + 120);
  });
});
