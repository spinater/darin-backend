import { expect, test, describe } from "bun:test";
import { RACED_SKIP_REASON, nonDraftSkipReason, staffInPeriodWhere } from "./payroll-run";
// `buildTeachRates` lives in `lib/payroll.ts` — it builds `computePayslip`’s own input type,
// and keeping it out of this module is what lets the engine’s test suite build a real rate map
// without importing `lib/db.ts`. It is exercised *here* because `runPayroll` is its only caller
// and this file is where that caller’s pure decisions are pinned.
import { buildTeachRates } from "./payroll";

/**
 * The decisions task 013 items 1 and 3 turn on, tested where they are pure.
 *
 * 🔴 **What these tests do NOT prove.** `bun test` has no database here (`scripts/check-code.sh`
 * stage 5 spins up a throwaway postgres for `prisma db push` + seed, and nothing else runs against
 * it), so every claim about the lock that needs two concurrent transactions is reviewed by reading
 * `lib/payroll-run.ts`, not asserted here:
 *   - that the status is read **inside** the `$transaction` that writes, through `tx` and not `db`;
 *   - that `updateMany({ where: { …, status: "draft" } })` reports `count: 0` when an approval
 *     commits between that read and the write — **the `RACED_SKIP_REASON` branch below is
 *     therefore unreached in this suite**; only its wording is pinned;
 *   - that a concurrent `create` loses on @@unique([staffId, period]) and throws;
 *   - that `staffInPeriodWhere` really **returns** a leaver — the activity arms are asserted as a
 *     query object, so what is pinned is that the predicate asks the right question, never that
 *     Postgres answers it with that person's row. A relation that exists but holds nothing the arm
 *     matches would pass here and lose the month for real.
 * All of it needs a real Postgres and, for the lock, two sessions — task 015's lane. What is pinned
 * here is what a later edit is most likely to change by accident: the predicates and the strings.
 */

describe("ยามสลิปที่ไม่ใช่ draft (ใบ 013 ข้อ 1)", () => {
  test("ยังไม่มีสลิป หรือสลิปเป็น draft → คำนวณทับได้", () => {
    expect(nonDraftSkipReason(null)).toBeNull();
    expect(nonDraftSkipReason({ status: "draft" })).toBeNull();
  });

  test("approved / paid → ไม่คำนวณทับ และข้อความเหมือนเดิมคำต่อคำ", () => {
    // Exact strings: this is the run's own report of what it deliberately left alone, carried in
    // `skipped`. ⚠️ No screen renders it today — `app/payslips/page.tsx` discards `runPayroll`'s
    // return value, so this is an API contract and a log line, not UI copy (task 022 is the card
    // that would render it). Pinned word for word because it is the only place the two refusals
    // are told apart at all. `paid` matters as much as `approved` — money already handed over.
    expect(nonDraftSkipReason({ status: "approved" })).toBe("สลิปสถานะ approved แล้ว ไม่คำนวณทับ");
    expect(nonDraftSkipReason({ status: "paid" })).toBe("สลิปสถานะ paid แล้ว ไม่คำนวณทับ");
    // Any status that is not `draft` refuses — the guard is not a list of two known states, so a
    // status added later (`cancelled`, …) is refused by default rather than silently overwritten.
    expect(nonDraftSkipReason({ status: "อะไรก็ตามที่ไม่ใช่ draft" })).toContain("ไม่คำนวณทับ");
  });

  test("เหตุผลของการแพ้จังหวะ ต้องอ่านแยกออกจากเหตุผลของสลิปที่ปิดไปแล้ว", () => {
    // The two refusals are different events: one is "already closed, as expected", the other is
    // "an approval and this run crossed". Collapsing them into one string — the obvious
    // copy-paste — would destroy that distinction before anything can ever render it, so it is
    // pinned here rather than left to a reviewer's eye. ⚠️ Neither string reaches a screen today
    // (see `RACED_SKIP_REASON`'s doc-comment and task 022); what tells the admin a slip was left
    // alone is state-derived — the `closedCount` box and the `— (ไม่ได้คำนวณใหม่)` marker.
    for (const status of ["approved", "paid"])
      expect(RACED_SKIP_REASON).not.toBe(nonDraftSkipReason({ status }));
    expect(RACED_SKIP_REASON).toBe("สลิปเปลี่ยนสถานะระหว่างคิดเงิน ไม่คำนวณทับ");
    // Both still end the same way, so the two read as one family wherever they are read.
    expect(RACED_SKIP_REASON).toContain("ไม่คำนวณทับ");
  });
});

describe("ขอบเขตพนักงานของงวด (ใบ 013 ข้อ 3)", () => {
  test("ทุกแขนที่ทำให้งวดนี้ยังค้างอยู่ — active · มีสลิปแล้ว · มีงานที่ต้องจ่ายในงวด", () => {
    // One whole-object comparison rather than several probes: it pins the arm **count** (an arm
    // deleted is red), the arm **order** as documented, `OR` rather than `AND` (an `AND` would
    // select only people who are both active and already hold a slip — nobody, on a period's first
    // run), and every arm's binding to this period in one place. Dates are written out rather than
    // derived from `periodRange`, so the test states the range instead of restating the code.
    const jul = { gte: new Date(Date.UTC(2026, 6, 1)), lt: new Date(Date.UTC(2026, 7, 1)) };
    expect(staffInPeriodWhere("2026-07")).toEqual({
      OR: [
        { active: true },
        // not `some: {}` — that would drag in everyone who ever held a slip in any period and
        // recompute months already closed
        { payslips: { some: { period: "2026-07" } } },
        // 🔴 The leaver arms. Without these, someone who resigned on 20 July and was deactivated
        // that day matches nothing when the run happens on 3 August: no slip, no warning, no
        // `skipped` entry, and the period total short by their whole month in silence.
        // `status: "ok"` because a session still in the review queue is not payable yet.
        { teachSessions: { some: { status: "ok", date: jul } } },
        { classSessions: { some: { date: jul } } },
        { attributions: { some: { sale: { date: jul } } } },
        { otEntries: { some: { date: jul } } },
      ],
    });
  });
});

describe("buildTeachRates — ชื่อกิจกรรมที่แอดมินพิมพ์เองต้องไม่ไปแตะ Object.prototype (ใบ 034)", () => {
  test("กิจกรรมชื่อ __proto__ ถูกเก็บเป็นคีย์ธรรมดา ไม่ใช่เขียนลง prototype", () => {
    const built = buildTeachRates([
      { activity: "pt", rank: "ST", rate: 400 },
      { activity: "__proto__", rank: "ST", rate: 999 },
      { activity: "__proto__", rank: "PT", rate: 111 },
    ]);

    // 🔴 The half that outlives the request. The old object-literal build wrote these two rates onto
    // `Object.prototype` itself, for the whole server process — so this assertion, not the lookup
    // below, is the one that catches the pollution at its source. Asserted on a **fresh** object as
    // well as on the prototype, because that is how the damage was felt: every object in the
    // process suddenly had an `ST` and a `PT`.
    expect(Object.hasOwn(Object.prototype, "ST")).toBe(false);
    expect(Object.hasOwn(Object.prototype, "PT")).toBe(false);
    expect(({} as Record<string, unknown>).ST).toBeUndefined();

    // The name is data and is kept as data — its own entry, its own rates, reaching nothing else.
    expect(built.get("__proto__")?.get("ST")).toBe(999);
    expect(built.get("__proto__")?.get("PT")).toBe(111);
    expect(built.get("pt")?.get("ST")).toBe(400);
    // …and no other activity inherits from it: `pt` has no `PT` rate configured, so the lookup
    // `computePayslip` performs must come back empty and let the §2 rule 4 warning fire.
    expect(built.get("pt")?.get("PT")).toBeUndefined();
    expect([...built.keys()].sort()).toEqual(["__proto__", "pt"]);
  });

  test("หลายแถวของกิจกรรมเดียวกันรวมเข้า Map เดียว ไม่ทับกันทิ้ง", () => {
    const built = buildTeachRates([
      { activity: "pt", rank: "PT", rate: 200 },
      { activity: "pt", rank: "CT", rate: 300 },
      { activity: "pt", rank: "ST", rate: 400 },
    ]);
    expect([...(built.get("pt") ?? [])]).toEqual([
      ["PT", 200],
      ["CT", 300],
      ["ST", 400],
    ]);
  });
});
