import { expect, test, describe } from "bun:test";
import { buildTeachRates } from "../payroll";
import { ratesTable, rows, run, trainer } from "./fixtures";

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
  /**
   * 🔴 **Task 037 — the branch is `rate == null`, not `!rate`.** These two arms differ by one
   * configured number and have to stay distinguishable: a rate of exactly `0` is a number the owner
   * chose, so it is paid (as nothing) and **shown**; a *missing* rate is undecidable and goes to
   * `warnings` instead (§2 rule 4). Either one-character tidy-up breaks exactly one of them —
   * `?? 0` turns the missing rate into a silent `0 ฿` line, `if (!rate)` starts warning about a
   * deliberate `0` — and before this pair both tidy-ups kept the whole suite green.
   *
   * 🔑 Both arms assert on the teach **lines**, not on `teachPay`: the total is `0` either way, and
   * what actually differs is whether a line exists at all (the task-025 lesson).
   *
   * ⚠️ This pins **today's engine behaviour**, not a settled product rule: whether a deliberate
   * `0` is a real thing is still open at `tasks/todo-human/038-what-adding-an-activity-is-for.md`
   * §1. If linus answers "never", the zero arm **inverts** (a `0` warns like a missing rate) and
   * is rewritten rather than deleted — the count stays 6 and no junit pin moves.
   */
  test("a rate configured at exactly 0 pays 0, warns about nothing, and still shows its line", () => {
    const withZero = buildTeachRates([
      ...rows(ratesTable),
      { activity: "aqua", rank: "ST", rate: 0 },
    ]);
    const r = run({ sessions: [{ date: new Date(), activity: "aqua" }], teachRates: withZero });
    expect(r.teachPay).toBe(0);
    expect(r.warnings).toEqual([]);
    expect(r.lines.filter((l) => l.group === "teach")).toEqual([
      { group: "teach", label: "ค่าสอน aqua", qty: 1, rate: 0, amount: 0 },
    ]);
  });

  test("a missing rate skips its own activity only — the rated ones beside it still pay", () => {
    // 🔴 The rated activity shares the `sessions` array on purpose. `[...byActivity].sort()` is
    // lexicographic, so the unrated `aqua` is visited **first**, and a third one-token tidy-up in
    // this same branch — `continue` → `break` — drops the 12 `pt` คาบ (4,800 ฿) while leaving only
    // this one warning, which names the 4 aqua คาบ and nothing else, on the slip. Measured green
    // against all 36 tests before this arm covered both activities at once.
    const r = run({
      sessions: [
        ...Array.from({ length: 4 }, () => ({ date: new Date(), activity: "aqua" })),
        ...Array.from({ length: 12 }, () => ({ date: new Date(), activity: "pt" })),
      ],
    });
    expect(r.teachPay).toBe(4800);
    // `aqua` contributes no line at all; `pt` is untouched by its neighbour's warning.
    expect(r.lines.filter((l) => l.group === "teach")).toEqual([
      { group: "teach", label: "ค่าสอน pt", qty: 12, rate: 400, amount: 4800 },
    ]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain("ไม่มีเรทค่าสอน aqua × ST");
  });
});
