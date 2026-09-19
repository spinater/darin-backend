import { expect, test, describe } from "bun:test";
import { type SaleInput } from "../payroll";
import { ptSale, run, trainer } from "./fixtures";

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
