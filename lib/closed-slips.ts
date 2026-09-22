import { utcPeriodOf } from "./class-problems";
import { db } from "./db";

/** `staffId|period` → the non-`draft` status of that person's slip for that period. */
export type ClosedSlips = Map<string, string>;

const slipKey = (staffId: string, period: string) => `${staffId}|${period}`;

/** The Thai for the two statuses that close a period. */
export const SLIP_STATUS_TH: Record<string, string> = {
  approved: "อนุมัติแล้ว",
  paid: "จ่ายแล้ว",
};

/**
 * Which of these คาบ sit in a period whose slip is **already approved or paid** (task 070).
 *
 * 🔴 **This is the guard that keeps ข้าม from being a one-way loss** (`payroll-auditor`).
 * `runPayroll` refuses to recompute a non-`draft` slip (`lib/payroll-run.ts`) and no screen reopens
 * one, so flipping a คาบ in such a period to `ignored` **does not take the money back** — it only
 * removes the row from `gapsWhere`'s `status: "ok"` filter, which is the one thing still reporting
 * that the colour is being paid. One click, and the red swatch disappears from all three screens
 * while every baht of the exposure stays where it was: 38 คาบ × 250 = 9,500 ฿ in the measured case.
 * That is §2 rule 4 reached through the repair instead of through the engine, and it is the failure
 * ใบ 043's review BLOCKed three times.
 *
 * ⚠️ It runs **after** the listing query rather than inside it — at most one page of rows, and
 * folding it into the `where` would *hide* those rows, which is the same silence one level down.
 * They are listed, named as settled, and given no button.
 *
 * ⚠️ A คาบ with no `date` or no `staffId` is in nobody's period and is never closed. It is also
 * payable by no run, so nothing is lost by treating it as open.
 */
export async function closedSlipsFor(
  rows: { staffId: string | null; date: Date | null }[],
): Promise<ClosedSlips> {
  const pairs = rows
    .filter((r): r is { staffId: string; date: Date } => !!r.staffId && !!r.date)
    .map((r) => ({ staffId: r.staffId, period: utcPeriodOf(r.date) }));
  if (!pairs.length) return new Map();
  const slips = await db.payslip.findMany({
    where: { OR: pairs },
    select: { staffId: true, period: true, status: true },
  });
  return new Map(
    slips.filter((s) => s.status !== "draft").map((s) => [slipKey(s.staffId, s.period), s.status]),
  );
}

/** The closed status of one row, or `undefined` when its period is still open. */
export function closedOf(
  closed: ClosedSlips,
  r: { staffId: string | null; date: Date | null },
): string | undefined {
  return r.staffId && r.date ? closed.get(slipKey(r.staffId, utcPeriodOf(r.date))) : undefined;
}
