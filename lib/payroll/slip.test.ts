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
        sourceKey: null,
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

describe("ฐานเงินเดือน 0 (ใบ 063)", () => {
  // 🔴 `if (base) lines.push(...)` means a 0 base emits **no line**, and nothing else in the engine
  // mentions it ⇒ before this arm, a trainer nobody had configured got a slip with no base line and
  // `warnings: []`. Measured on real data: ประพัฒน์ พันธุ์โยศรี taught 5 คาบ in 1–21 Sep, all with 0
  // attendees ⇒ `net 0.00`, and the slip said nothing at all was missing. The seed plants two such
  // trainers on purpose (nobody has said what they are paid), so this is behaviour task 063 newly
  // depends on and nothing pinned it.
  test("เทรนเนอร์ที่ฐานเป็น 0 ต้องเตือน — สลิปว่างเปล่าไม่ใช่คำตอบ", () => {
    const r = run({ staff: trainer({ baseSalary: 0 }) });
    // Exact text: the trainer reads this on their own payslip, and it has to name the field and
    // where to fix it. A reworded warning is a product change, not a refactor.
    expect(r.warnings).toEqual([
      "ยังไม่ได้ตั้งฐานเงินเดือนของเทรนเนอร์คนนี้ (0 บาท) — สลิปใบนี้จึงไม่มีบรรทัดฐานเงินเดือน ⇒ ตั้งฐานเงินเดือน (และเครดิตสอนคลาส) ที่หน้า /admin/config ก่อนอนุมัติ",
    ]);
    // It moves no money and adds no line — the warning is the whole change (§2 rule 4).
    expect(r.base).toBe(0);
    expect(r.lines.filter((l) => l.group === "base")).toEqual([]);
  });

  // The predicate is `role === "trainer"`, not `!base`: the seeded `owner` row is 0 on purpose, and
  // a warning on every owner slip would teach people to ignore the line above.
  test("owner/counter ที่ฐานเป็น 0 ไม่เตือน (ตั้งใจให้เป็น 0)", () => {
    for (const role of ["owner", "counter"])
      expect(run({ staff: trainer({ role, baseSalary: 0, classCredit: 0 }) }).warnings).toEqual([]);
    // …and a trainer WITH a base stays silent too, so the arm above is about 0 and not about role.
    expect(run({ staff: trainer({ baseSalary: 10000 }) }).warnings).toEqual([]);
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
      sourceKey: null,
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
