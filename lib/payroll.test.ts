import { expect, test, describe } from "bun:test";
import { computePayslip, type SaleInput, type StaffInput } from "./payroll";
import { CONFIG_DEFAULTS } from "./config-keys";

const config = Object.fromEntries(
  Object.entries(CONFIG_DEFAULTS).map(([k, v]) => [k, v.value]),
);

const teachRates = {
  pt: { PT: 200, CT: 300, ST: 400 },
  pilates: { PT: 300, CT: 400, ST: 500 },
  swim: { PT: 250, CT: 250, ST: 250 },
};

const trainer = (over: Partial<StaffInput> = {}): StaffInput => ({
  id: "t1",
  name: "เทรนเนอร์",
  role: "trainer",
  rank: "ST",
  baseSalary: 10000,
  classCredit: 5000,
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
  const counter = trainer({ id: "c1", role: "counter", rank: null, baseSalary: 15000, classCredit: 0 });
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
