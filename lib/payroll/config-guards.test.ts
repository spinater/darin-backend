import { expect, test, describe } from "bun:test";
import { num, pct } from "../config-keys";
import { config, ptSale, run } from "./fixtures";

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
