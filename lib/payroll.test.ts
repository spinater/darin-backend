import { expect, test, describe } from "bun:test";
import { buildTeachRates, computePayslip, type SaleInput, type StaffInput } from "./payroll";
import { CONFIG_DEFAULTS, num, pct } from "./config-keys";

const config = Object.fromEntries(Object.entries(CONFIG_DEFAULTS).map(([k, v]) => [k, v.value]));

/**
 * Built through the **real** builder rather than hand-rolled, so the fixture cannot drift from the
 * shape `runPayroll` actually passes (task 034 turned this from an object literal into a `Map`).
 * The rows are written as a readable table and flattened, which is also what the DB hands over.
 */
const ratesTable: Record<string, Record<string, number>> = {
  pt: { PT: 200, CT: 300, ST: 400 },
  pilates: { PT: 300, CT: 400, ST: 500 },
  swim: { PT: 250, CT: 250, ST: 250 },
};
const rows = (table: Record<string, Record<string, number>>) =>
  Object.entries(table).flatMap(([activity, byRank]) =>
    Object.entries(byRank).map(([rank, rate]) => ({ activity, rank, rate })),
  );
const teachRates = buildTeachRates(rows(ratesTable));

const trainer = (over: Partial<StaffInput> = {}): StaffInput => ({
  id: "t1",
  name: "เทรนเนอร์",
  role: "trainer",
  rank: "ST",
  baseSalary: 10000,
  classCredit: 5000,
  active: true,
  ...over,
});

const run = (over: Partial<Parameters<typeof computePayslip>[0]> = {}) =>
  computePayslip({
    staff: trainer(),
    sessions: [],
    classSessions: [],
    sales: [],
    otEntries: [],
    config,
    teachRates,
    ...over,
  });

const ptSale = (over: Partial<SaleInput> = {}): SaleInput => ({
  id: "s1",
  kind: "pt",
  tier: null,
  productName: "PT 30 ครั้ง",
  listPrice: null,
  netPrice: 20000,
  attributions: [{ staffId: "t1", role: "closer" }],
  ...over,
});

describe("ค่าสอน 1-on-1 (§1.2)", () => {
  test("ST: PT 400 · Pilates 500 · ว่ายน้ำ 250", () => {
    const r = run({
      sessions: [
        { date: new Date(), activity: "pt" },
        { date: new Date(), activity: "pt" },
        { date: new Date(), activity: "pilates" },
        { date: new Date(), activity: "swim" },
      ],
    });
    expect(r.teachPay).toBe(400 * 2 + 500 + 250);
    expect(r.net).toBe(10000 + 1550);
  });

  test("ว่ายน้ำเรทเท่ากันทุกระดับ", () => {
    const s = [{ date: new Date(), activity: "swim" }];
    for (const rank of ["PT", "CT", "ST"])
      expect(run({ staff: trainer({ rank }), sessions: s }).teachPay).toBe(250);
  });

  test("ไม่มีเรท (Yoga) → เตือน ไม่ใช่จ่าย 0 เงียบๆ", () => {
    const r = run({ sessions: [{ date: new Date(), activity: "yoga" }] });
    expect(r.teachPay).toBe(0);
    expect(r.warnings.join()).toContain("ไม่มีเรทค่าสอน yoga");
  });

  /**
   * 🔴 **Task 034 — the activity name may not reach a rate that was never configured for it.**
   * An admin can type any name into "เพิ่มกิจกรรมใหม่", and the one name that is also a key of
   * `Object.prototype` used to turn the warning above into a 0 ฿ line with `warnings: []`: the rate
   * landed on the prototype and every other activity inherited it. The test is written against the
   * **worst case** — `__proto__` configured at a real rate, so an inheriting lookup would return a
   * number and pay it — because a lookup that merely returns `undefined` for the missing activity
   * would pass even while the write was still polluting the process.
   */
  test("กิจกรรมชื่อ __proto__ ไม่รั่วเรทไปหากิจกรรมอื่น (ใบ 034)", () => {
    const polluted = buildTeachRates([
      ...rows(ratesTable),
      { activity: "__proto__", rank: "ST", rate: 999 },
    ]);
    const r = run({ sessions: [{ date: new Date(), activity: "yoga" }], teachRates: polluted });
    // yoga still has no rate ⇒ still a warning, still unpaid — not 999 and not a silent 0.
    expect(r.teachPay).toBe(0);
    expect(r.warnings.join()).toContain("ไม่มีเรทค่าสอน yoga");
    // …and the activity itself is an ordinary key that pays its own configured rate.
    expect(
      run({ sessions: [{ date: new Date(), activity: "__proto__" }], teachRates: polluted })
        .teachPay,
    ).toBe(999);
  });
});

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

describe("ค่าคอม PT (§1.5)", () => {
  test("ปิดเอง = 10%", () => {
    expect(run({ sales: [ptSale()] }).commission).toBe(2000);
  });

  test("มีคนส่งลีด → ผู้ปิด 7%", () => {
    const sale = ptSale({
      attributions: [
        { staffId: "t1", role: "closer" },
        { staffId: "c1", role: "referrer" },
      ],
    });
    expect(run({ sales: [sale] }).commission).toBe(1400);
  });

  test("ผู้ส่งลีด / เจ้าของคลิป ได้ 3%", () => {
    for (const role of ["referrer", "content_owner"]) {
      const sale = ptSale({
        attributions: [
          { staffId: "x", role: "closer" },
          { staffId: "t1", role },
        ],
      });
      expect(run({ sales: [sale] }).commission).toBe(600);
    }
  });

  test("เจ้าของคลิปปิดเอง → 7%+3% = 10% (§7 ข้อ 1)", () => {
    const sale = ptSale({
      attributions: [
        { staffId: "t1", role: "closer" },
        { staffId: "t1", role: "content_owner" },
      ],
    });
    expect(run({ sales: [sale] }).commission).toBe(2000); // 1400 + 600
  });

  test("ต่ออายุคอร์ส / freeze → ไม่มีคอมให้ใคร (§3)", () => {
    const sales = [
      ptSale({ kind: "course_ext", netPrice: 900 }),
      ptSale({ id: "s2", kind: "freeze", netPrice: 300 }),
    ];
    expect(run({ sales }).commission).toBe(0);
  });

  // §2 rule 4: an unrecognised sale kind is undecidable, so it must warn — not pay 0 in silence.
  // course_ext/freeze above pay 0 *by rule* and correctly stay quiet; these two cases differ.
  test("unknown sale.kind → warning AND zero commission, never a silent 0", () => {
    const r = run({ sales: [ptSale({ kind: "seminar" })] });
    expect(r.commission).toBe(0);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain("ไม่รู้จักประเภทการขาย");
    expect(r.warnings[0]).toContain("seminar");
  });
});

describe("Incentive (§1.6)", () => {
  const bulk = (total: number): SaleInput[] => [ptSale({ netPrice: total })];

  test("ต่ำกว่าเกณฑ์ 1 บาท → ยังใช้ 10%", () => {
    expect(run({ sales: bulk(29999) }).commission).toBe(2999.9);
  });

  test("ถึงเกณฑ์พอดี 30,000 → 12% ย้อนหลังทั้งเดือน", () => {
    expect(run({ sales: bulk(30000) }).commission).toBe(3600);
  });

  test("ยอดจากลีด (7%) ไม่นับรวมในเกณฑ์ incentive", () => {
    const lead = ptSale({
      id: "s2",
      netPrice: 25000,
      attributions: [
        { staffId: "t1", role: "closer" },
        { staffId: "c1", role: "referrer" },
      ],
    });
    const r = run({ sales: [ptSale({ netPrice: 20000 }), lead] });
    // ปิดเอง 20,000 < 30,000 → 10% = 2000 · ลีด 25,000 × 7% = 1750
    expect(r.commission).toBe(3750);
  });

  test("incentive ใช้กับยอดปิดเองทุกบิลในเดือน ไม่ใช่เฉพาะบิลที่ทำให้ถึงเกณฑ์", () => {
    const r = run({
      sales: [ptSale({ netPrice: 20000 }), ptSale({ id: "s2", netPrice: 15000 })],
    });
    expect(r.commission).toBe(35000 * 0.12);
  });
});

describe("ค่าคอมสมาชิก (§2.2)", () => {
  const counter = trainer({
    id: "c1",
    role: "counter",
    rank: null,
    baseSalary: 15000,
    classCredit: 0,
  });
  const sale = (over: Partial<SaleInput>): SaleInput => ({
    id: "m1",
    kind: "membership",
    tier: "premium",
    productName: "Premium 1 ปี",
    listPrice: 12000,
    netPrice: 12000,
    attributions: [{ staffId: "c1", role: "closer" }],
    ...over,
  });

  test("ราคาเต็ม Premium → 10%", () => {
    expect(run({ staff: counter, sales: [sale({})] }).commission).toBe(1200);
  });

  test("จ่ายจริงต่ำกว่าราคาเต็ม = โปรฯ → 5% ของราคาที่จ่ายจริง", () => {
    expect(run({ staff: counter, sales: [sale({ netPrice: 9000 })] }).commission).toBe(450);
  });

  test("Basic → 5% แม้ขายเต็มราคา", () => {
    const r = run({
      staff: counter,
      sales: [sale({ tier: "basic", listPrice: 3000, netPrice: 3000 })],
    });
    expect(r.commission).toBe(150);
  });

  // §7 item 8 is still open: there is no membership commission rule for a non-closer role.
  // Routing it to warnings is the CORRECT behaviour — do not invent a config default to silence it.
  test("membership attributed to a non-closer → warning AND zero commission", () => {
    const r = run({
      staff: counter,
      sales: [
        sale({
          attributions: [
            { staffId: "x", role: "closer" },
            { staffId: "c1", role: "referrer" },
          ],
        }),
      ],
    });
    expect(r.commission).toBe(0);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain("referrer");
    expect(r.warnings[0]).toContain("ยังไม่มีกฎคอมสำหรับบทบาท");
  });
});

describe("OT (§2.4)", () => {
  test("คิดรายวัน — 10ชม.+10ชม. = 2ชม.OT ไม่ใช่ 20−9=11", () => {
    const r = run({
      staff: trainer({ role: "counter", baseSalary: 15000 }),
      otEntries: [
        { date: new Date("2026-07-01"), hours: 10 },
        { date: new Date("2026-07-02"), hours: 10 },
      ],
    });
    expect(r.otPay).toBe(2 * 40);
  });

  test("ทำไม่ถึงเกณฑ์ → ไม่มี OT ติดลบ", () => {
    const r = run({ otEntries: [{ date: new Date(), hours: 5 }] });
    expect(r.otPay).toBe(0);
  });

  // 🔴 The engine's own answer for hours a fingerprint export really produces: 9:20 arrives as
  // 9.333333333333334, not as 9.33. Kept as the **reference figure** for that input (§2 rule 5:
  // round once, at the end) — it pins `computePayslip`, which was never wrong, so what it buys is
  // that a future disagreement is provable against a number written down in advance.
  // As of task 011 **no screen previews this figure**: `/ot`'s `เป็นเงิน` column was deleted, and
  // computing money outside `lib/payroll.ts` is a §2 rule 2 violation, not a rounding question.
  // With clean 2-dp hours a wrong implementation still agrees, which is why only a >2-decimal
  // value pins it. The qty line rounds for display only.
  test("ชั่วโมงทศนิยมยาว (9:20 = 9.333…) — ปัดครั้งเดียวตอนท้าย ไม่ปัดชั่วโมงก่อนคูณ", () => {
    const r = run({ otEntries: [{ date: new Date("2026-07-01"), hours: 9.333333333333334 }] });
    expect(r.otPay).toBe(13.33);
    const ot = r.lines.find((l) => l.group === "ot");
    expect(ot).toMatchObject({ qty: 0.33, rate: 40, amount: 13.33 });
    // 20 such days: the whole month lands on the engine's figure, not on 20 × 13.20 = 264.
    const month = run({
      otEntries: Array.from({ length: 20 }, () => ({
        date: new Date("2026-07-01"),
        hours: 9.333333333333334,
      })),
    });
    expect(month.otPay).toBe(266.67);
  });
});

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

/**
 * `num()` is the single door every rate, threshold and percentage walks through, so what it does
 * with an unreadable value decides what **every** payslip does with it. Until task 013 item 4 it
 * answered `Number("") === 0` and let `Infinity` past — both silently, both in the direction §2
 * rule 4 exists to forbid. These pin the refusal at the point where it multiplies.
 */
describe("num() refuses what it cannot read (task 013 item 4)", () => {
  test("a blank value throws instead of being read as 0", () => {
    expect(() => num({ ...config, "ot.ratePerHour": "" }, "ot.ratePerHour")).toThrow();
    expect(() => num({ ...config, "ot.ratePerHour": "   " }, "ot.ratePerHour")).toThrow();
    // A blank is not a missing key: the key exists and the value was erased, which is a different
    // mistake to report, so the two messages stay distinguishable.
    expect(() => num({}, "ot.ratePerHour")).toThrow("ไม่พบ config");
    expect(() => num({ ...config, "ot.ratePerHour": "" }, "ot.ratePerHour")).toThrow("เว้นว่าง");
  });

  test("overflow and NaN both throw — `Number.isNaN` alone let Infinity through", () => {
    expect(() => num({ ...config, "incentive.rate": "1e999" }, "incentive.rate")).toThrow();
    expect(() => num({ ...config, "incentive.rate": "แปด" }, "incentive.rate")).toThrow();
  });

  test("the values the form can actually store still read back", () => {
    // Fractions are legal config (`class.halfRatio` is 0.5) and 0 is a real configured number —
    // the refusal must not widen into them.
    expect(num(config, "class.halfRatio")).toBe(0.5);
    expect(num({ ...config, "ot.ratePerHour": "0" }, "ot.ratePerHour")).toBe(0);
    expect(pct(config, "comm.pt.selfClosed")).toBe(0.1);
  });

  test("🔴 the blank that used to pay 0 ฿ now stops the run instead of the money", () => {
    // Measured before the fix: a cleared `comm.pt.selfClosed` paid 0 ฿ on this 20,000 ฿ self-closed
    // bill with `warnings: []` — 2,000 ฿ missing from one slip and nothing on screen. A throw is
    // the correct outcome: the run dies loudly and nobody is underpaid quietly.
    const selfClosed = {
      sales: [ptSale({ netPrice: 20000, attributions: [{ staffId: "t1", role: "closer" }] })],
    };
    expect(run(selfClosed).commission).toBe(2000);
    expect(() => run({ ...selfClosed, config: { ...config, "comm.pt.selfClosed": "" } })).toThrow();
  });
});
