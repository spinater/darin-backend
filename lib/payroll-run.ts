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

/** คิดเงินเดือนทุกคนในงวด แล้วบันทึกทับสลิปที่ยังเป็น draft (สลิปที่ approved/paid แล้วไม่แตะ) */
export async function runPayroll(period: string) {
  const { from, to } = periodRange(period);

  const [staffList, config, rates, sessions, classSessions, sales, ot] = await Promise.all([
    db.staff.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
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
    const existing = await db.payslip.findUnique({
      where: { staffId_period: { staffId: staff.id, period } },
    });
    if (existing && existing.status !== "draft") {
      skipped.push({ staff: staff.name, reason: `สลิปสถานะ ${existing.status} แล้ว ไม่คำนวณทับ` });
      continue;
    }

    const result = computePayslip({
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        rank: staff.rank,
        baseSalary: staff.baseSalary,
        classCredit: staff.classCredit,
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
    // slip.id, which only exists after the upsert. Deliberately NOT a nested write either:
    // Prisma does not guarantee a nested deleteMany runs before a nested createMany, and if
    // that ever inverts, every line and warning is deleted right after insertion and the
    // payslip goes blank with no error. Prefer an order you can read.
    await db.$transaction(async (tx) => {
      const slip = await tx.payslip.upsert({
        where: { staffId_period: { staffId: staff.id, period } },
        update: { ...totals, status: "draft" },
        create: { staffId: staff.id, period, ...totals },
      });
      await tx.payslipLine.deleteMany({ where: { payslipId: slip.id } });
      // Warnings are rewritten wholesale on every recompute, exactly like lines (CLAUDE.md §2
      // rule 4). Always delete first: without it @@unique([payslipId, seq]) fails the insert,
      // which is loud — far better than silently accumulating duplicate warnings.
      await tx.payslipWarning.deleteMany({ where: { payslipId: slip.id } });
      if (lines.length)
        await tx.payslipLine.createMany({
          data: lines.map((l) => ({ payslipId: slip.id, ...l })),
        });
      if (warnings.length)
        await tx.payslipWarning.createMany({
          data: warnings.map((message, seq) => ({ payslipId: slip.id, seq, message })),
        });
    });

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
