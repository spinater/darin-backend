import { expect, test, describe } from "bun:test";
import { run, trainer } from "./fixtures";

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
