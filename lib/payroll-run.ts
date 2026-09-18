import type { Prisma } from "../generated/prisma/client";
import { db } from "./db";
import { computePayslip, type PayslipResult } from "./payroll";

/**
 * คาบที่ยังจ่ายไม่ได้ — รวมเคส status=ok แต่ไม่มีผู้สอน (พนักงานถูกลบ)
 * ไม่งั้นคาบพวกนี้จะหลุดทั้งจากสลิป (กรอง staffId != null) และจากคิวรอตรวจ = หายเงียบ
 */
export const NEEDS_ATTENTION = {
  OR: [{ status: "needs_review" }, { status: "ok", staffId: null }],
};

export function periodRange(period: string): { from: Date; to: Date } {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`งวดไม่ถูกต้อง: ${period} (ต้องเป็น YYYY-MM)`);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

/**
 * Who this period pays: everyone still active, plus anyone **deactivated who still has this period
 * owed to them** — either because a slip already exists, or because they did payable work in it.
 *
 * 🔴 **`{ active: true }` alone loses a leaver's whole month.** Variable pay is computed after the
 * month closes (`darin-payroll-system.md` §6 — ภายในวันที่ 3 ของเดือนถัดไป), so the ordinary case
 * is: resigns 20 July, deactivated the same day, run happens 3 August. That person has no slip yet
 * and is not active ⇒ under the old filter they matched nothing, and the loss was **completely
 * silent**: no slip, no warning, no entry in `skipped`, nothing in `pendingReviewInPeriod`, and the
 * period total simply short by their month. The arms below each name one way the period can still
 * be owed; the activity arms are what catch the leaver before a slip exists.
 *
 * A slip that has left `draft` is still skipped — by `nonDraftSkipReason` below, not by this
 * filter. The two questions are separate: *whose* slip belongs in this period, and *whether* this
 * particular slip may be overwritten.
 *
 * ⚠️ Selecting them is not the same as paying them correctly: `computePayslip` charges
 * `baseSalary` for the **whole** period and has no pro-rating for anyone, so a leaver's slip
 * carries a full month of base. That is a policy question for the owner, not something the engine
 * may decide — which is why the inactive warning says so out loud rather than the run quietly
 * picking a number.
 *
 * Typed as `Prisma.StaffWhereInput` so `tsc` checks the relation names — a typo in `payslips` or
 * `attributions` would otherwise surface only as a query error at run time, i.e. at payroll time.
 */
export function staffInPeriodWhere(period: string): Prisma.StaffWhereInput {
  const { from, to } = periodRange(period);
  const inPeriod = { gte: from, lt: to };
  return {
    OR: [
      // still employed — the ordinary case, and the only arm that does not need the period
      { active: true },
      // already has a slip for this period (recompute it rather than leave a stale `net` in the
      // period total; deactivating someone mid-period does not forfeit the slip they already have)
      { payslips: { some: { period } } },
      // …or no slip yet, but payable work inside the period. One arm per thing that becomes money
      // in `computePayslip`, so adding a new earning source means adding an arm here too.
      // `status: "ok"` mirrors the session query below: anything else is in the review queue and is
      // not payable yet. A session with a null `date` cannot be placed in a period and is excluded
      // by the range — that case is the review queue's, not this one's.
      { teachSessions: { some: { status: "ok", date: inPeriod } } },
      { classSessions: { some: { date: inPeriod } } },
      { attributions: { some: { sale: { date: inPeriod } } } },
      { otEntries: { some: { date: inPeriod } } },
    ],
  };
}

/**
 * Why an existing slip may not be recomputed, or `null` when it may.
 *
 * Pure and exported so the predicate and its exact wording can be tested without a database. What
 * it cannot test is the part that matters most — that its caller reads the row **inside** the
 * transaction that overwrites it (task 013 item 1). See `lib/payroll-run.test.ts`.
 */
export function nonDraftSkipReason(existing: { status: string } | null): string | null {
  if (!existing || existing.status === "draft") return null;
  return `สลิปสถานะ ${existing.status} แล้ว ไม่คำนวณทับ`;
}

/**
 * The other way a slip is refused: it was `draft` when this run read it and was not `draft` any
 * more when the conditional update ran (`count: 0`), i.e. somebody approved it mid-run.
 *
 * 🔑 **Deliberately different wording from `nonDraftSkipReason`** — they are different events: the
 * first is the ordinary "already closed, as expected", the second says an approval and this run
 * crossed. One shared string would collapse that distinction.
 *
 * ⚠️ **No screen shows either string today.** `runPayroll` returns them in `skipped`, and
 * `app/payslips/page.tsx`'s `compute` action discards its whole return value — so this wording is
 * an API contract and a log line, not UI copy. What actually tells the admin a slip was left alone
 * is **state-derived, not event-derived** (task 009 removed the event banner on purpose): the
 * neutral `closedCount` box, and the `— (ไม่ได้คำนวณใหม่)` marker in the คำเตือน column for a
 * non-draft slip with no stored warnings. Both cover a raced slip, because by render time it is
 * non-draft; a raced slip that *does* carry warnings from an earlier compute shows that count
 * instead, which does not say "not recomputed". Rendering the run's own refusals is a separate
 * card — do not bolt an event banner back on here.
 *
 * A constant rather than a function because there is nothing to decide — the status it lost to is
 * not readable from `count: 0`, and re-reading the row to name it would be another race.
 */
export const RACED_SKIP_REASON = "สลิปเปลี่ยนสถานะระหว่างคิดเงิน ไม่คำนวณทับ";

/** คิดเงินเดือนทุกคนในงวด แล้วบันทึกทับสลิปที่ยังเป็น draft (สลิปที่ approved/paid แล้วไม่แตะ) */
export async function runPayroll(period: string) {
  const { from, to } = periodRange(period);

  const [staffList, config, rates, sessions, classSessions, sales, ot] = await Promise.all([
    db.staff.findMany({ where: staffInPeriodWhere(period), orderBy: { name: "asc" } }),
    db.payrollConfig.findMany(),
    db.teachRate.findMany(),
    db.teachSession.findMany({
      where: { status: "ok", date: { gte: from, lt: to }, staffId: { not: null } },
      select: { staffId: true, date: true, activity: true },
    }),
    db.classSession.findMany({ where: { date: { gte: from, lt: to } }, include: { class: true } }),
    db.sale.findMany({ where: { date: { gte: from, lt: to } }, include: { attributions: true } }),
    db.otEntry.findMany({ where: { date: { gte: from, lt: to } } }),
  ]);

  const cfg = Object.fromEntries(config.map((c) => [c.key, c.value]));
  const teachRates: Record<string, Record<string, number>> = {};
  for (const r of rates) (teachRates[r.activity] ??= {})[r.rank] = r.rate;

  const skipped: { staff: string; reason: string }[] = [];
  const results: { staffId: string; name: string; result: PayslipResult }[] = [];

  for (const staff of staffList) {
    // Computed before the transaction opens and thrown away when the guard inside it refuses the
    // write. `computePayslip` is pure and touches nothing (§2 rule 2), so the wasted call costs a
    // few microseconds — whereas holding a transaction open across it would put the engine inside
    // the 5 s interactive-transaction window for no reason.
    const result = computePayslip({
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        rank: staff.rank,
        baseSalary: staff.baseSalary,
        classCredit: staff.classCredit,
        active: staff.active,
      },
      sessions: sessions
        .filter((s) => s.staffId === staff.id)
        .map((s) => ({ date: s.date!, activity: s.activity })),
      classSessions: classSessions
        .filter((c) => c.staffId === staff.id)
        .map((c) => ({
          className: c.class.name,
          price: c.class.price,
          booked: c.booked,
          noShow: c.noShow,
        })),
      sales: sales
        .filter((s) => s.attributions.some((a) => a.staffId === staff.id))
        .map((s) => ({
          id: s.id,
          kind: s.kind,
          tier: s.tier,
          productName: s.productName,
          listPrice: s.listPrice,
          netPrice: s.netPrice,
          attributions: s.attributions.map((a) => ({ staffId: a.staffId, role: a.role })),
        })),
      otEntries: ot
        .filter((o) => o.staffId === staff.id)
        .map((o) => ({ date: o.date, hours: o.hours })),
      config: cfg,
      teachRates,
    });

    const { lines, warnings, ...totals } = result;
    // One transaction per staff member, never one around the whole loop: an interactive
    // transaction defaults to a 5 s timeout, so one slow run would roll back every payslip.
    // Per-staff idempotency already comes from the staffId_period unique.
    //
    // Interactive (callback) form, not `db.$transaction([...])`, because createMany needs
    // slip.id, which only exists after the payslip row is written. Deliberately NOT a nested write
    // either: Prisma does not guarantee a nested deleteMany runs before a nested createMany, and if
    // that ever inverts, every line and warning is deleted right after insertion and the
    // payslip goes blank with no error. Prefer an order you can read.
    //
    // 🔴 `Payslip.status` is a **lock**, and task 013 item 1 made it one. Two things together, not
    // either alone:
    //   1. the status is read **inside** this callback (`tx`, not `db`) — read before the
    //      transaction opened, as it was until 013, and an approval committing in between was
    //      simply overwritten; and
    //   2. the update is **conditional on the status it read** (`updateMany … status: "draft"`).
    // (2) is what actually closes the race: under READ COMMITTED — Postgres' default, and Prisma's
    // for an interactive transaction — the read in (1) only sees what was committed at that
    // statement, so an approval landing between the read and the write would still have won. An
    // `UPDATE … WHERE status = 'draft'` instead takes the row lock and re-checks the predicate
    // against the *committed* row, so it matches nothing and reports `count: 0`.
    //
    // Dropping `status: "draft"` from the payload is part of the fix, not tidying: that field is
    // the line that used to push an approved or paid slip back to draft.
    const skipReason = await db.$transaction(async (tx) => {
      const existing = await tx.payslip.findUnique({
        where: { staffId_period: { staffId: staff.id, period } },
      });
      // The readable common path: a slip that is already approved or paid never reaches the write
      // below. Returned, not pushed — the caller owns `skipped`, so the callback writes nothing at
      // all on this path, neither to the database nor to state outside itself.
      const refused = nonDraftSkipReason(existing);
      if (refused) return refused;

      let payslipId: string;
      if (existing) {
        // staffId + period is unique, so this updates at most one row. `count: 0` can mean only
        // one thing here: the slip left `draft` between the findUnique above and this statement.
        const { count } = await tx.payslip.updateMany({
          where: { staffId: staff.id, period, status: "draft" },
          data: totals,
        });
        if (count === 0) return RACED_SKIP_REASON;
        payslipId = existing.id;
      } else {
        // 🔴 `create`, not `upsert`: a slip that did not exist at the read must not be silently
        // adopted if a concurrent run created one in between. That loses on
        // @@unique([staffId, period]), which aborts this transaction and **throws** out of
        // `runPayroll`. That is the correct direction — do not "fix" it into a catch that
        // continues: two payroll runs racing on one period is a fact worth stopping for, and the
        // run is safe to repeat (every write here is draft-only and keyed by that same unique).
        const created = await tx.payslip.create({
          data: { staffId: staff.id, period, ...totals },
        });
        payslipId = created.id;
      }

      await tx.payslipLine.deleteMany({ where: { payslipId } });
      // Warnings are rewritten wholesale on every recompute, exactly like lines (CLAUDE.md §2
      // rule 4). Always delete first: without it @@unique([payslipId, seq]) fails the insert,
      // which is loud — far better than silently accumulating duplicate warnings.
      await tx.payslipWarning.deleteMany({ where: { payslipId } });
      if (lines.length)
        await tx.payslipLine.createMany({
          data: lines.map((l) => ({ payslipId, ...l })),
        });
      if (warnings.length)
        await tx.payslipWarning.createMany({
          data: warnings.map((message, seq) => ({ payslipId, seq, message })),
        });
      return null;
    });

    if (skipReason) {
      skipped.push({ staff: staff.name, reason: skipReason });
      continue;
    }

    results.push({ staffId: staff.id, name: staff.name, result });
  }

  return { results, skipped };
}

/** คาบที่ยังค้างตรวจในงวดนี้ — ต้องเคลียร์ก่อนจ่ายจริง ไม่งั้นจ่ายขาด */
export async function pendingReviewInPeriod(period: string) {
  const { from, to } = periodRange(period);
  return db.teachSession.count({
    where: {
      ...NEEDS_ATTENTION,
      AND: [{ OR: [{ date: { gte: from, lt: to } }, { date: null }] }],
    },
  });
}
